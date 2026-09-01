from __future__ import annotations

import html
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Shop, StorefrontTheme
from app.services import catalog as catalog_service
from app.services.theme_storage import read_platform_theme_html

PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def get_active_html_theme(db: Session, theme_slug: str) -> StorefrontTheme | None:
    return db.scalar(
        select(StorefrontTheme).where(
            StorefrontTheme.slug == theme_slug,
            StorefrontTheme.is_active.is_(True),
        )
    )


def is_html_theme(db: Session, theme_slug: str | None) -> bool:
    if not theme_slug or theme_slug in catalog_service.PRESET_THEMES:
        return False
    return get_active_html_theme(db, theme_slug) is not None


def _money(amount: float | None) -> str:
    if amount is None:
        return "—"
    return f"₹{float(amount):,.0f}"


def build_products_catalog_html(shop: Shop, db, slug: str) -> str:
    products = catalog_service.filter_products_by_category(db, shop.id, None)
    active = [p for p in products if p.is_active][:24]
    if not active:
        return '<p class="zetro-catalog-empty">No products yet.</p>'

    cards = []
    for p in active:
        img = p.images[0].url if p.images else ""
        price = p.variants[0].price if p.variants else None
        img_tag = (
            f'<img src="{html.escape(img)}" alt="{html.escape(p.name)}" loading="lazy" />'
            if img
            else '<div class="zetro-product-ph"></div>'
        )
        cards.append(
            f'<a class="zetro-product" href="/{slug}/product/{html.escape(p.slug)}">'
            f'<div class="zetro-product-media">{img_tag}</div>'
            f'<div class="zetro-product-meta"><h3>{html.escape(p.name)}</h3>'
            f'<span class="zetro-price">{_money(price)}</span></div></a>'
        )

    return (
        '<div class="zetro-catalog">'
        '<style>.zetro-catalog{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;}'
        ".zetro-product{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;}"
        ".zetro-product-media img{width:100%;aspect-ratio:1;object-fit:cover;display:block;}"
        ".zetro-product-ph{aspect-ratio:1;background:#f3f4f6;}"
        ".zetro-product-meta{padding:.75rem;} .zetro-product-meta h3{font-size:.95rem;margin:0 0 .25rem;}"
        ".zetro-price{font-weight:600;}</style>"
        + "".join(cards)
        + "</div>"
    )


def expand_config(config: dict[str, Any], variables: list[dict]) -> dict[str, str]:
    flat: dict[str, str] = {}
    for key, value in config.items():
        if isinstance(value, list):
            for i, slide in enumerate(value, start=1):
                if not isinstance(slide, dict):
                    continue
                for sk, sv in slide.items():
                    flat[f"{key}_{i}_{sk}"] = str(sv or "")
                    flat[f"{key}{i}{sk}"] = str(sv or "")
                    flat[f"{key}_{i}"] = str(slide.get("image") or slide.get("url") or "")
            continue
        flat[key] = str(value or "")

    for var in variables:
        if var.get("type") != "carousel":
            continue
        base = var["key"]
        count = int(var.get("count") or 4)
        slides = config.get(base) or []
        if not isinstance(slides, list):
            slides = []
        for i in range(1, count + 1):
            slide = slides[i - 1] if i - 1 < len(slides) else {}
            if not isinstance(slide, dict):
                slide = {}
            for field in ("image", "title", "subtitle", "url", "link"):
                val = slide.get(field, "")
                flat[f"{base}_{i}_{field}"] = str(val or "")
                flat[f"{base}{i}{field}"] = str(val or "")
                if field == "image":
                    flat[f"{base}_{i}"] = str(val or "")
                    flat[f"{base}{i}"] = str(val or "")

    return flat


def render_theme_html(
    shop: Shop,
    db: Session,
    slug: str,
    *,
    base_url: str = "",
) -> str | None:
    theme_record = get_active_html_theme(db, shop.storefront_theme)
    if not theme_record:
        return None

    raw = read_platform_theme_html(theme_record)
    if not raw:
        return None

    media_base = base_url.rstrip("/") if base_url else ""

    def abs_url(path: str) -> str:
        if not path:
            return ""
        if path.startswith("http"):
            return path
        if media_base:
            return f"{media_base}{path}"
        return path

    config = shop.theme_config or {}
    variables = theme_record.variables or []
    values = expand_config(config, variables)

    builtins = {
        "shop_name": shop.name or "",
        "shop_description": shop.description or "",
        "shop_logo": abs_url(shop.logo_url or values.get("logo", "")),
        "products_catalog": build_products_catalog_html(shop, db, slug),
    }

    def replace(match: re.Match) -> str:
        key = match.group(1)
        if key in builtins:
            return builtins[key]
        if key in values:
            val = values[key]
            if key.endswith("_url") or "url" in key or "link" in key or "image" in key or "logo" in key:
                return abs_url(val)
            return html.escape(val)
        return match.group(0)

    return PLACEHOLDER_RE.sub(replace, raw)
