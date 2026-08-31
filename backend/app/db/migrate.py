"""Lightweight SQLite migrations for additive schema changes."""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        if "categories" in tables:
            cols = {c["name"] for c in inspector.get_columns("categories")}
            if "parent_id" not in cols:
                conn.execute(text("ALTER TABLE categories ADD COLUMN parent_id INTEGER"))

        if "products" in tables and "product_categories" in tables and "categories" in tables:
            conn.execute(
                text(
                    """
                    INSERT OR IGNORE INTO product_categories (shop_id, product_id, category_id)
                    SELECT p.shop_id, p.id, p.category_id
                    FROM products p
                    WHERE p.category_id IS NOT NULL
                    """
                )
            )

        if "shops" in tables:
            cols = {c["name"] for c in inspector.get_columns("shops")}
            if "storefront_theme" not in cols:
                conn.execute(
                    text("ALTER TABLE shops ADD COLUMN storefront_theme VARCHAR(40) DEFAULT 'playful'")
                )
            conn.execute(
                text(
                    "UPDATE shops SET storefront_theme = 'playful' "
                    "WHERE storefront_theme IS NULL OR storefront_theme = ''"
                )
            )
            if "logo_url" not in cols:
                conn.execute(text("ALTER TABLE shops ADD COLUMN logo_url VARCHAR(512)"))
