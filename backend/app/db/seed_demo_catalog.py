"""Minimal ABC Kids catalog for demo / Render deployments (no external downloads)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, Product, ProductVariant, Shop
from app.services.categories import assign_product_categories


DEMO_CATEGORIES = [
    {"name": "Kids Clothing", "slug": "kids-clothing"},
    {"name": "Kids Toys", "slug": "kids-toys"},
    {"name": "Kids Accessories", "slug": "kids-accessories"},
]

DEMO_PRODUCTS = [
    {
        "name": "Rainbow Cotton Romper",
        "slug": "rainbow-romper",
        "description": "Soft organic cotton romper in cheerful rainbow stripes.",
        "price": 890,
        "category_slug": "kids-clothing",
    },
    {
        "name": "Dino Adventure Tee",
        "slug": "dino-adventure-tee",
        "description": "Breathable jersey tee with a friendly T-Rex print.",
        "price": 649,
        "category_slug": "kids-clothing",
    },
    {
        "name": "Huggy Plush Bunny",
        "slug": "huggy-plush-bunny",
        "description": "Super-soft plush bunny for cuddles and nap time.",
        "price": 799,
        "category_slug": "kids-toys",
    },
    {
        "name": "Rocket Backpack",
        "slug": "rocket-backpack",
        "description": "Lightweight school backpack with padded straps.",
        "price": 1299,
        "category_slug": "kids-accessories",
    },
    {
        "name": "Wooden Block Castle",
        "slug": "wooden-block-castle",
        "description": "Classic wooden blocks for creative castle building.",
        "price": 1499,
        "category_slug": "kids-toys",
    },
]


def seed_demo_catalog_if_empty(db: Session, shop: Shop) -> None:
    count = db.scalar(select(func.count()).select_from(Product).where(Product.shop_id == shop.id))
    if count and count > 0:
        return

    cats: dict[str, Category] = {}
    for item in DEMO_CATEGORIES:
        cat = Category(
            shop_id=shop.id,
            name=item["name"],
            slug=item["slug"],
            is_active=True,
        )
        db.add(cat)
        cats[item["slug"]] = cat
    db.flush()

    for item in DEMO_PRODUCTS:
        cat = cats.get(item["category_slug"])
        product = Product(
            shop_id=shop.id,
            name=item["name"],
            slug=item["slug"],
            description=item["description"],
            category_id=cat.id if cat else None,
            is_active=True,
        )
        db.add(product)
        db.flush()
        if cat:
            assign_product_categories(db, shop.id, product, [cat.id])
        db.add(
            ProductVariant(
                shop_id=shop.id,
                product_id=product.id,
                name="Default",
                sku=f"{item['slug']}-default",
                price=item["price"],
                stock=25,
                is_active=True,
            )
        )
    db.commit()
