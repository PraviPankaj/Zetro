from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.models import Shop, StorefrontTheme
from app.services import media_storage


def platform_theme_key(theme_slug: str, name: str = "index.html") -> str:
    return f"themes/{theme_slug}/{name}"


def write_platform_theme_html(theme_slug: str, content: str) -> None:
    media_storage.write_text(platform_theme_key(theme_slug), content)


async def save_platform_theme_html(theme_slug: str, file: UploadFile) -> str:
    if not file.filename or not file.filename.lower().endswith((".html", ".htm")):
        raise HTTPException(status_code=400, detail="Upload an HTML file (.html)")

    content = await file.read()
    if len(content) > 2_000_000:
        raise HTTPException(status_code=400, detail="HTML file too large (max 2MB)")

    await media_storage.save_bytes(
        platform_theme_key(theme_slug, "index.source.html"), content, "text/html; charset=utf-8"
    )
    return await media_storage.save_bytes(
        platform_theme_key(theme_slug), content, "text/html; charset=utf-8"
    )


def read_platform_theme_source(theme: StorefrontTheme) -> str | None:
    if not theme.html_path.endswith("index.html"):
        return None
    source_url = theme.html_path[: -len("index.html")] + "index.source.html"
    return media_storage.read_text(source_url) or read_platform_theme_html(theme)


async def save_shop_theme_asset(shop: Shop, file: UploadFile) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}:
        raise HTTPException(status_code=400, detail="Upload PNG, JPG, WebP, GIF, or SVG")

    return await media_storage.save_upload(
        f"{shop.slug}/theme-assets/{uuid.uuid4().hex}{ext}", file
    )


def read_platform_theme_html(theme: StorefrontTheme) -> str | None:
    return media_storage.read_text(theme.html_path)


def slugify_theme_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:40] or "theme"
