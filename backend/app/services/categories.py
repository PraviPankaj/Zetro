from __future__ import annotations

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.models import Category, Product, product_categories


def category_descendant_ids(db: Session, shop_id: int, category_id: int) -> set[int]:
    """Return category id plus all active descendant category ids."""
    rows = db.scalars(
        select(Category).where(Category.shop_id == shop_id, Category.is_active.is_(True))
    ).all()
    by_parent: dict[int | None, list[Category]] = {}
    for row in rows:
        by_parent.setdefault(row.parent_id, []).append(row)

    result = {category_id}

    def walk(parent_id: int) -> None:
        for child in by_parent.get(parent_id, []):
            result.add(child.id)
            walk(child.id)

    walk(category_id)
    return result


def assign_product_categories(
    db: Session, shop_id: int, product: Product, category_ids: list[int] | None
) -> None:
    ids = list(dict.fromkeys(category_ids or []))
    if ids:
        valid = set(
            db.scalars(
                select(Category.id).where(Category.shop_id == shop_id, Category.id.in_(ids))
            ).all()
        )
        ids = [cid for cid in ids if cid in valid]

    db.execute(delete(product_categories).where(product_categories.c.product_id == product.id))
    for cid in ids:
        db.execute(
            insert(product_categories).values(shop_id=shop_id, product_id=product.id, category_id=cid)
        )
    product.category_id = ids[0] if ids else None
    db.flush()
