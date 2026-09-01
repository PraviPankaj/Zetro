from __future__ import annotations

from datetime import timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_shop_by_slug, require_shop_user
from app.db.seed import utcnow
from app.db.session import get_db
from app.models import Order, OrderStatus, Product, ShopSubscription, SubscriptionStatus
from app.schemas import (
    CategoryCreate,
    CategoryOut,
    OrderOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    ShopSettingsUpdate,
)
from app.services import catalog as catalog_service

router = APIRouter(prefix="/shops/{slug}", tags=["shop-admin-catalog"])


def _as_utc(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _require_active_subscription(db: Session, shop_id: int) -> None:
    sub = db.scalar(
        select(ShopSubscription)
        .where(
            ShopSubscription.shop_id == shop_id,
            ShopSubscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trial]),
        )
        .order_by(ShopSubscription.id.desc())
    )
    if not sub or _as_utc(sub.ends_at) < utcnow():
        raise HTTPException(status_code=402, detail="Active subscription required")


@router.get("/categories", response_model=list[CategoryOut])
def public_categories(slug: str, db: Session = Depends(get_db)):
    shop = get_shop_by_slug(slug, db)
    return catalog_service.list_categories(db, shop.id, active_only=True)


@router.get("/admin/categories", response_model=list[CategoryOut])
def list_categories(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    return catalog_service.list_categories(db, shop.id)


@router.post("/admin/categories", response_model=CategoryOut)
def create_category(
    slug: str, body: CategoryCreate, db: Session = Depends(get_db), ctx=Depends(require_shop_user)
):
    shop, _ = ctx
    _require_active_subscription(db, shop.id)
    return catalog_service.create_category(db, shop, body)


@router.get("/admin/products", response_model=list[ProductOut])
def list_admin_products(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    return catalog_service.list_products(db, shop.id)


@router.post("/admin/products", response_model=ProductOut)
def create_product(
    slug: str, body: ProductCreate, db: Session = Depends(get_db), ctx=Depends(require_shop_user)
):
    shop, _ = ctx
    _require_active_subscription(db, shop.id)
    return catalog_service.create_product(db, shop, body)


@router.patch("/admin/products/{product_id}", response_model=ProductOut)
def update_product(
    slug: str,
    product_id: int,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    return catalog_service.update_product(db, shop, product_id, body)


@router.delete("/admin/products/{product_id}")
def delete_product(
    slug: str,
    product_id: int,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    catalog_service.delete_product(db, shop, product_id)
    return {"message": "deleted"}


@router.post("/admin/products/{product_id}/images", response_model=ProductOut)
async def upload_product_image(
    slug: str,
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    _require_active_subscription(db, shop.id)
    return await catalog_service.upload_product_image(db, shop, product_id, file)


@router.delete("/admin/products/{product_id}/images/{image_id}", response_model=ProductOut)
def delete_product_image(
    slug: str,
    product_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    _require_active_subscription(db, shop.id)
    return catalog_service.delete_product_image(db, shop, product_id, image_id)


@router.patch("/admin/settings")
def update_shop_settings(
    slug: str,
    body: ShopSettingsUpdate,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    shop.storefront_theme = catalog_service.normalize_theme(body.storefront_theme)
    db.commit()
    db.refresh(shop)
    return {
        "message": "updated",
        "storefront_theme": shop.storefront_theme,
    }


@router.get("/admin/orders", response_model=list[OrderOut])
def list_orders(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    from sqlalchemy.orm import joinedload

    orders = db.scalars(
        select(Order)
        .options(joinedload(Order.items))
        .where(Order.shop_id == shop.id)
        .order_by(Order.id.desc())
    ).unique().all()
    result = []
    for o in orders:
        result.append(
            OrderOut(
                id=o.id,
                order_number=o.order_number,
                status=o.status.value,
                payment_status=o.payment_status.value,
                payment_provider=o.payment_provider.value,
                subtotal=float(o.subtotal),
                total=float(o.total),
                shipping_address=o.shipping_address or {},
                created_at=o.created_at,
                items=[
                    {
                        "product_name": i.product_name,
                        "variant_name": i.variant_name,
                        "quantity": i.quantity,
                        "unit_price": float(i.unit_price),
                        "line_total": float(i.line_total),
                    }
                    for i in o.items
                ],
            )
        )
    return result


@router.patch("/admin/orders/{order_id}/status")
def update_order_status(
    slug: str,
    order_id: int,
    status: OrderStatus,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    order = db.scalar(select(Order).where(Order.id == order_id, Order.shop_id == shop.id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = status
    db.commit()
    return {"message": "updated", "status": order.status.value}


@router.get("/catalog", response_model=list[ProductOut])
def public_catalog(
    slug: str,
    category: str | None = Query(None, description="Category slug filter"),
    q: str | None = Query(None, description="Search query"),
    db: Session = Depends(get_db),
):
    shop = get_shop_by_slug(slug, db)
    products = catalog_service.filter_products_by_category(db, shop.id, category)
    result = [catalog_service.serialize_product(p) for p in products]

    if q:
        needle = q.strip().lower()
        if needle:

            def matches(product: ProductOut) -> bool:
                parts = [
                    product.name,
                    product.slug,
                    product.description or "",
                    *(c.name for c in product.categories),
                    *(c.slug.replace("-", " ") for c in product.categories),
                    *(v.name for v in product.variants),
                ]
                haystack = " ".join(parts).lower()
                return needle in haystack or all(word in haystack for word in needle.split())

            result = [p for p in result if matches(p)]

    return result


@router.get("/catalog/{product_slug}", response_model=ProductOut)
def public_product(slug: str, product_slug: str, db: Session = Depends(get_db)):
    shop = get_shop_by_slug(slug, db)
    product = db.scalar(
        catalog_service.product_query(db, shop.id).where(
            Product.slug == product_slug,
            Product.is_active.is_(True),
        )
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return catalog_service.serialize_product(product)


@router.get("/info")
def shop_info(slug: str, db: Session = Depends(get_db)):
    shop = get_shop_by_slug(slug, db)
    return {
        "id": shop.id,
        "name": shop.name,
        "slug": shop.slug,
        "description": shop.description,
        "logo_url": shop.logo_url,
        "status": shop.status.value,
        "storefront_theme": catalog_service.normalize_theme(shop.storefront_theme),
    }


@router.get("/themes")
def list_themes():
    return [
        {"id": theme, "name": theme.replace("-", " ").title()}
        for theme in catalog_service.STOREFRONT_THEMES
    ]
