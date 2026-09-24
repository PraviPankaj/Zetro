"""Lightweight additive migrations for SQLite and Postgres."""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if "categories" in tables:
            cols = {c["name"] for c in inspector.get_columns("categories")}
            if "parent_id" not in cols:
                conn.execute(text("ALTER TABLE categories ADD COLUMN parent_id INTEGER"))

        if "products" in tables and "product_categories" in tables and "categories" in tables:
            if dialect == "sqlite":
                backfill_sql = """
                    INSERT OR IGNORE INTO product_categories (shop_id, product_id, category_id)
                    SELECT p.shop_id, p.id, p.category_id
                    FROM products p
                    WHERE p.category_id IS NOT NULL
                    """
            else:
                # Postgres (and others): INSERT OR IGNORE is SQLite-only
                backfill_sql = """
                    INSERT INTO product_categories (shop_id, product_id, category_id)
                    SELECT p.shop_id, p.id, p.category_id
                    FROM products p
                    WHERE p.category_id IS NOT NULL
                    ON CONFLICT (product_id, category_id) DO NOTHING
                    """
            conn.execute(text(backfill_sql))

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
            if "meta_title" not in cols:
                conn.execute(text("ALTER TABLE shops ADD COLUMN meta_title VARCHAR(160)"))
            if "meta_description" not in cols:
                conn.execute(text("ALTER TABLE shops ADD COLUMN meta_description VARCHAR(320)"))
            if "homepage_blocks" not in cols:
                if dialect == "sqlite":
                    conn.execute(text("ALTER TABLE shops ADD COLUMN homepage_blocks JSON DEFAULT '[]'"))
                else:
                    conn.execute(text("ALTER TABLE shops ADD COLUMN homepage_blocks JSONB DEFAULT '[]'"))
            if "custom_theme_path" not in cols:
                conn.execute(text("ALTER TABLE shops ADD COLUMN custom_theme_path VARCHAR(512)"))
            if "theme_variables" not in cols:
                if dialect == "sqlite":
                    conn.execute(text("ALTER TABLE shops ADD COLUMN theme_variables JSON DEFAULT '[]'"))
                else:
                    conn.execute(text("ALTER TABLE shops ADD COLUMN theme_variables JSONB DEFAULT '[]'"))
            if "theme_config" not in cols:
                if dialect == "sqlite":
                    conn.execute(text("ALTER TABLE shops ADD COLUMN theme_config JSON DEFAULT '{}'"))
                else:
                    conn.execute(text("ALTER TABLE shops ADD COLUMN theme_config JSONB DEFAULT '{}'"))
            if "gst_enabled" not in cols:
                if dialect == "sqlite":
                    conn.execute(text("ALTER TABLE shops ADD COLUMN gst_enabled BOOLEAN DEFAULT 0"))
                else:
                    conn.execute(text("ALTER TABLE shops ADD COLUMN gst_enabled BOOLEAN DEFAULT FALSE"))
            if "gst_rate" not in cols:
                conn.execute(text("ALTER TABLE shops ADD COLUMN gst_rate NUMERIC(5,2) DEFAULT 18"))

        if "products" in tables:
            prod_cols = {c["name"] for c in inspector.get_columns("products")}
            if "barcode" not in prod_cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN barcode VARCHAR(64)"))
            indexes = {ix["name"] for ix in inspector.get_indexes("products")}
            if "uq_products_shop_barcode" not in indexes:
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_products_shop_barcode "
                        "ON products (shop_id, barcode) "
                        "WHERE barcode IS NOT NULL AND barcode != ''"
                    )
                )

        if "storefront_themes" not in tables:
            if dialect == "sqlite":
                conn.execute(
                    text(
                        """
                        CREATE TABLE storefront_themes (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            slug VARCHAR(40) NOT NULL UNIQUE,
                            name VARCHAR(120) NOT NULL,
                            description TEXT,
                            html_path VARCHAR(512) NOT NULL,
                            variables JSON DEFAULT '[]',
                            instructions TEXT,
                            is_active BOOLEAN DEFAULT 1,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE storefront_themes (
                            id SERIAL PRIMARY KEY,
                            slug VARCHAR(40) NOT NULL UNIQUE,
                            name VARCHAR(120) NOT NULL,
                            description TEXT,
                            html_path VARCHAR(512) NOT NULL,
                            variables JSONB DEFAULT '[]',
                            instructions TEXT,
                            is_active BOOLEAN DEFAULT TRUE,
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        )
                        """
                    )
                )

        if "orders" in tables:
            cols = {c["name"] for c in inspector.get_columns("orders")}
            if "discount_amount" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN discount_amount NUMERIC(10,2) DEFAULT 0"))
            if "coupon_code" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(40)"))
            if "tax_amount" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN tax_amount NUMERIC(10,2) DEFAULT 0"))
            if "round_off" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN round_off NUMERIC(10,2) DEFAULT 0"))
            if "channel" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN channel VARCHAR(20) DEFAULT 'online'"))

        if "shops" in tables:
            shop_cols = {c["name"] for c in inspector.get_columns("shops")}
            if "shop_mode" not in shop_cols:
                conn.execute(text("ALTER TABLE shops ADD COLUMN shop_mode VARCHAR(20) DEFAULT 'both'"))
            if "gst_enabled" not in shop_cols:
                if dialect == "sqlite":
                    conn.execute(text("ALTER TABLE shops ADD COLUMN gst_enabled BOOLEAN DEFAULT 0"))
                else:
                    conn.execute(text("ALTER TABLE shops ADD COLUMN gst_enabled BOOLEAN DEFAULT FALSE"))
            if "gst_rate" not in shop_cols:
                conn.execute(text("ALTER TABLE shops ADD COLUMN gst_rate NUMERIC(5,2) DEFAULT 18"))
