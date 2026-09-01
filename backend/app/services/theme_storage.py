from __future__ import annotations

import re
import uuid
from pathlib import Path

import aiofiles
from fastapi import HTTPException, UploadFile

from app.core.config import get_settings
from app.models import Shop, StorefrontTheme


def platform_theme_dir(theme_slug: str) -> Path:
    settings = get_settings()
    return Path(settings.media_root) / "themes" / theme_slug


def shop_theme_asset_dir(shop: Shop) -> Path:
    settings = get_settings()
    return Path(settings.media_root) / shop.slug / "theme-assets"


def write_platform_theme_html(theme_slug: str, content: str) -> None:
    dest = platform_theme_dir(theme_slug) / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf-8")


async def save_platform_theme_html(theme_slug: str, file: UploadFile) -> str:
    if not file.filename or not file.filename.lower().endswith((".html", ".htm")):
        raise HTTPException(status_code=400, detail="Upload an HTML file (.html)")

    dest_dir = platform_theme_dir(theme_slug)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "index.html"
    source = dest_dir / "index.source.html"

    content = await file.read()
    if len(content) > 2_000_000:
        raise HTTPException(status_code=400, detail="HTML file too large (max 2MB)")

    async with aiofiles.open(source, "wb") as out:
        await out.write(content)
    async with aiofiles.open(dest, "wb") as out:
        await out.write(content)

    settings = get_settings()
    return f"{settings.media_url_prefix}/themes/{theme_slug}/index.html"


def read_platform_theme_source(theme: StorefrontTheme) -> str | None:
    settings = get_settings()
    prefix = settings.media_url_prefix.rstrip("/")
    if not theme.html_path.startswith(prefix):
        return None
    rel = theme.html_path[len(prefix) :].lstrip("/")
    source = Path(settings.media_root) / rel.replace("index.html", "index.source.html")
    if source.is_file():
        return source.read_text(encoding="utf-8", errors="replace")
    return read_platform_theme_html(theme)


async def save_shop_theme_asset(shop: Shop, file: UploadFile) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    ext = Path(file.filename).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}:
        raise HTTPException(status_code=400, detail="Upload PNG, JPG, WebP, GIF, or SVG")

    dest_dir = shop_theme_asset_dir(shop)
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = dest_dir / filename

    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(1024 * 64):
            await out.write(chunk)

    settings = get_settings()
    return f"{settings.media_url_prefix}/{shop.slug}/theme-assets/{filename}"


def read_platform_theme_html(theme: StorefrontTheme) -> str | None:
    settings = get_settings()
    prefix = settings.media_url_prefix.rstrip("/")
    if not theme.html_path.startswith(prefix):
        return None
    rel = theme.html_path[len(prefix) :].lstrip("/")
    path = Path(settings.media_root) / rel
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8", errors="replace")


def slugify_theme_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:40] or "theme"
