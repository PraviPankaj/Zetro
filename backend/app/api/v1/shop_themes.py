from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_shop_by_slug, require_shop_user
from app.db.session import get_db
from app.models import Shop, StorefrontTheme
from app.services import catalog as catalog_service
from app.services.theme_renderer import get_active_html_theme, is_html_theme, render_theme_html
from app.services.theme_storage import save_shop_theme_asset

router = APIRouter(prefix="/shops/{slug}", tags=["shop-themes"])


class ShopThemeUpdate(BaseModel):
    theme_slug: str | None = None
    theme_config: dict[str, Any] | None = None
    activate: bool = False


def _available_themes(db: Session) -> list[dict]:
    presets = [
        {"id": t, "name": t.replace("-", " ").title(), "type": "preset", "variables": []}
        for t in catalog_service.PRESET_THEMES
    ]
    html_themes = db.scalars(
        select(StorefrontTheme).where(StorefrontTheme.is_active.is_(True)).order_by(StorefrontTheme.name)
    ).all()
    for t in html_themes:
        presets.append(
            {
                "id": t.slug,
                "name": t.name,
                "type": "html",
                "description": t.description,
                "variables": t.variables or [],
                "instructions": t.instructions,
            }
        )
    return presets


def _shop_theme_payload(shop: Shop, db: Session) -> dict:
    active_slug = catalog_service.normalize_theme(shop.storefront_theme, db)
    html_theme = get_active_html_theme(db, active_slug) if is_html_theme(db, active_slug) else None
    return {
        "storefront_theme": active_slug,
        "theme_config": shop.theme_config or {},
        "theme_variables": html_theme.variables if html_theme else [],
        "instructions": html_theme.instructions if html_theme else None,
        "is_html_theme": html_theme is not None,
        "available_themes": _available_themes(db),
    }


@router.get("/themes")
def list_shop_themes(slug: str, db: Session = Depends(get_db)):
    get_shop_by_slug(slug, db)
    return _available_themes(db)


@router.get("/admin/theme")
def get_shop_theme(
    slug: str,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    return _shop_theme_payload(shop, db)


@router.patch("/admin/theme")
def update_shop_theme(
    slug: str,
    body: ShopThemeUpdate,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    if body.theme_slug is not None:
        normalized = catalog_service.normalize_theme(body.theme_slug, db)
        if body.theme_slug != normalized and body.theme_slug not in catalog_service.PRESET_THEMES:
            raise HTTPException(status_code=400, detail="Theme not found or inactive")
        shop.storefront_theme = normalized
    if body.theme_config is not None:
        shop.theme_config = body.theme_config
    if body.activate and body.theme_slug:
        shop.storefront_theme = catalog_service.normalize_theme(body.theme_slug, db)
    db.commit()
    db.refresh(shop)
    return {**_shop_theme_payload(shop, db), "message": "Theme updated"}


@router.post("/admin/theme/asset")
async def upload_shop_theme_asset(
    slug: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    url = await save_shop_theme_asset(shop, file)
    return {"url": url}


@router.get("/admin/theme/preview")
def preview_shop_theme(
    slug: str,
    request: Request,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    if not is_html_theme(db, shop.storefront_theme):
        raise HTTPException(status_code=400, detail="Select an HTML theme to preview")
    base_url = str(request.base_url).rstrip("/")
    rendered = render_theme_html(shop, db, slug, base_url=base_url)
    if not rendered:
        raise HTTPException(status_code=404, detail="Theme file not found")
    return {"html": rendered}


@router.get("/theme/render")
def render_storefront_theme(
    slug: str,
    request: Request,
    db: Session = Depends(get_db),
):
    shop = get_shop_by_slug(slug, db)
    if not is_html_theme(db, shop.storefront_theme):
        raise HTTPException(status_code=404, detail="No HTML theme active")

    base_url = str(request.base_url).rstrip("/")
    rendered = render_theme_html(shop, db, slug, base_url=base_url)
    if not rendered:
        raise HTTPException(status_code=404, detail="Theme file not found")

    return {"html": rendered}
