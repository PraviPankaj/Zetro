from __future__ import annotations

import uuid
from pathlib import Path

import aiofiles
from fastapi import HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.models import (
    CartItem,
    Category,
    OrderItem,
    Product,
    ProductImage,
    ProductVariant,
    Shop,
    product_categories,
)
from app.schemas import CategoryBrief, CategoryCreate, CategoryUpdate, ProductCreate, ProductOut, ProductUpdate
from app.services.categories import assign_product_categories, category_descendant_ids

STOREFRONT_THEMES = ("playful", "classic", "fresh", "minimal")


def resolve_category_ids(
    body_category_ids: list[int] | None, body_category_id: int | None
) -> list[int]:
    if body_category_ids:
        return body_category_ids
    if body_category_id is not None:
        return [body_category_id]
    return []


def product_query(db: Session, shop_id: int, product_id: int | None = None):
    q = (
        select(Product)
        .options(
            joinedload(Product.images),
            joinedload(Product.variants),
            joinedload(Product.categories),
        )
        .where(Product.shop_id == shop_id)
    )
    if product_id is not None:
        q = q.where(Product.id == product_id)
    return q


def get_product(db: Session, shop_id: int, product_id: int) -> Product:
    return db.execute(product_query(db, shop_id, product_id)).unique().scalar_one()


def serialize_product(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        slug=product.slug,
        description=product.description,
        category_id=product.category_id,
        categories=[CategoryBrief.model_validate(c) for c in (product.categories or [])],
        is_active=product.is_active,
        images=product.images,
        variants=product.variants,
    )


def list_products(db: Session, shop_id: int) -> list[ProductOut]:
    products = db.scalars(product_query(db, shop_id).order_by(Product.id.desc())).unique().all()
    return [serialize_product(p) for p in products]


def list_categories(db: Session, shop_id: int, active_only: bool = False) -> list[Category]:
    q = select(Category).where(Category.shop_id == shop_id)
    if active_only:
        q = q.where(Category.is_active.is_(True))
    return db.scalars(q.order_by(Category.parent_id.nullsfirst(), Category.name)).all()


def create_category(db: Session, shop: Shop, body: CategoryCreate) -> Category:
    if body.parent_id is not None:
        parent = db.scalar(
            select(Category).where(Category.id == body.parent_id, Category.shop_id == shop.id)
        )
        if not parent:
            raise HTTPException(status_code=400, detail="Parent category not found")
    cat = Category(
        shop_id=shop.id,
        name=body.name,
        slug=body.slug,
        parent_id=body.parent_id,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def update_category(db: Session, shop: Shop, category_id: int, body: CategoryUpdate) -> Category:
    cat = db.scalar(
        select(Category).where(Category.id == category_id, Category.shop_id == shop.id)
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    data = body.model_dump(exclude_unset=True)
    if "parent_id" in data and data["parent_id"] is not None:
        if data["parent_id"] == category_id:
            raise HTTPException(status_code=400, detail="Category cannot be its own parent")
        parent = db.scalar(
            select(Category).where(Category.id == data["parent_id"], Category.shop_id == shop.id)
        )
        if not parent:
            raise HTTPException(status_code=400, detail="Parent category not found")

    for field in ("name", "slug", "parent_id", "is_active"):
        if field in data:
            setattr(cat, field, data[field])

    db.commit()
    db.refresh(cat)
    return cat


def delete_category(db: Session, shop: Shop, category_id: int) -> None:
    cat = db.scalar(
        select(Category).where(Category.id == category_id, Category.shop_id == shop.id)
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    children = db.scalar(
        select(Category.id).where(Category.parent_id == category_id, Category.shop_id == shop.id).limit(1)
    )
    if children:
        raise HTTPException(status_code=400, detail="Remove child categories first")

    linked = db.scalar(
        select(product_categories.c.product_id)
        .where(product_categories.c.category_id == category_id)
        .limit(1)
    )
    if linked:
        raise HTTPException(status_code=400, detail="Category is assigned to products — remove assignments first")

    direct = db.scalar(select(Product.id).where(Product.category_id == category_id).limit(1))
    if direct:
        raise HTTPException(status_code=400, detail="Category is assigned to products — remove assignments first")

    db.delete(cat)
    db.commit()


def create_product(db: Session, shop: Shop, body: ProductCreate) -> ProductOut:
    category_ids = resolve_category_ids(body.category_ids, body.category_id)
    product = Product(
        shop_id=shop.id,
        name=body.name,
        slug=body.slug,
        description=body.description,
        category_id=category_ids[0] if category_ids else None,
        is_active=body.is_active,
    )
    db.add(product)
    db.flush()
    assign_product_categories(db, shop.id, product, category_ids)
    for v in body.variants or []:
        db.add(
            ProductVariant(
                shop_id=shop.id,
                product_id=product.id,
                sku=v.sku,
                name=v.name,
                price=v.price,
                compare_at_price=v.compare_at_price,
                stock=v.stock,
            )
        )
    if not body.variants:
        db.add(
            ProductVariant(
                shop_id=shop.id,
                product_id=product.id,
                sku=f"{body.slug}-default",
                name="Default",
                price=0,
                stock=0,
            )
        )
    db.commit()
    return serialize_product(get_product(db, shop.id, product.id))


def update_product(db: Session, shop: Shop, product_id: int, body: ProductUpdate) -> ProductOut:
    product = db.scalar(
        select(Product)
        .options(joinedload(Product.variants), joinedload(Product.categories))
        .where(Product.id == product_id, Product.shop_id == shop.id)
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    data = body.model_dump(exclude_unset=True)
    for field in ("name", "slug", "description", "is_active"):
        if field in data:
            setattr(product, field, data[field])

    if "category_ids" in data or "category_id" in data:
        category_ids = resolve_category_ids(data.get("category_ids"), data.get("category_id"))
        assign_product_categories(db, shop.id, product, category_ids)

    variants_payload = data.get("variants")
    if variants_payload:
        by_id = {v.id: v for v in product.variants}
        for item in variants_payload:
            variant = by_id.get(item.get("id")) if item.get("id") else None
            if not variant and product.variants:
                variant = product.variants[0]
            if not variant:
                continue
            for field in ("sku", "name", "price", "compare_at_price", "stock"):
                if field in item and item[field] is not None:
                    setattr(variant, field, item[field])
    elif product.variants and ("price" in data or "stock" in data):
        variant = product.variants[0]
        if "price" in data and data["price"] is not None:
            variant.price = data["price"]
        if "stock" in data and data["stock"] is not None:
            variant.stock = data["stock"]

    db.commit()
    return serialize_product(get_product(db, shop.id, product_id))


def delete_product(db: Session, shop: Shop, product_id: int) -> None:
    product = db.scalar(
        select(Product)
        .options(joinedload(Product.variants))
        .where(Product.id == product_id, Product.shop_id == shop.id)
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    variant_ids = [v.id for v in product.variants]
    if variant_ids:
        in_orders = db.scalar(
            select(OrderItem.id).where(OrderItem.variant_id.in_(variant_ids)).limit(1)
        )
        if in_orders:
            raise HTTPException(
                status_code=409,
                detail="This product has order history and cannot be deleted. Deactivate it instead.",
            )
        for cart_item in db.scalars(select(CartItem).where(CartItem.variant_id.in_(variant_ids))):
            db.delete(cart_item)

    db.execute(delete(product_categories).where(product_categories.c.product_id == product.id))
    db.delete(product)
    db.commit()


async def upload_product_image(
    db: Session, shop: Shop, product_id: int, file: UploadFile
) -> ProductOut:
    product = db.scalar(select(Product).where(Product.id == product_id, Product.shop_id == shop.id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    settings = get_settings()
    ext = Path(file.filename or "img.jpg").suffix or ".jpg"
    filename = f"{shop.slug}_{product_id}_{uuid.uuid4().hex}{ext}"
    dest_dir = Path(settings.media_root) / shop.slug
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / filename
    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            await out.write(chunk)

    url = f"{settings.media_url_prefix}/{shop.slug}/{filename}"
    count = len(product.images)
    db.add(
        ProductImage(
            shop_id=shop.id,
            product_id=product.id,
            url=url,
            sort_order=count,
            alt_text=product.name,
        )
    )
    db.commit()
    return serialize_product(get_product(db, shop.id, product_id))


def delete_product_image(db: Session, shop: Shop, product_id: int, image_id: int) -> ProductOut:
    image = db.scalar(
        select(ProductImage).where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
            ProductImage.shop_id == shop.id,
        )
    )
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    settings = get_settings()
    prefix = settings.media_url_prefix.rstrip("/")
    if image.url.startswith(prefix + "/"):
        rel = image.url[len(prefix) + 1 :]
        file_path = Path(settings.media_root) / rel
        if file_path.is_file():
            file_path.unlink()

    db.delete(image)
    db.commit()
    return serialize_product(get_product(db, shop.id, product_id))


def filter_products_by_category(db: Session, shop_id: int, category_slug: str | None):
    qry = product_query(db, shop_id).where(Product.is_active.is_(True))
    if category_slug:
        cat = db.scalar(
            select(Category).where(
                Category.shop_id == shop_id,
                Category.slug == category_slug,
                Category.is_active.is_(True),
            )
        )
        if not cat:
            return []
        cat_ids = category_descendant_ids(db, shop_id, cat.id)
        qry = qry.join(product_categories).where(product_categories.c.category_id.in_(cat_ids))
    return db.scalars(qry).unique().all()


def normalize_theme(theme: str | None) -> str:
    if theme and theme in STOREFRONT_THEMES:
        return theme
    return STOREFRONT_THEMES[0]
