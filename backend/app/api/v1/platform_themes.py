from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_platform
from app.db.session import get_db
from app.models import StorefrontTheme
from app.services.theme_analyzer import analyze_theme_html
from app.services.theme_storage import read_platform_theme_html, read_platform_theme_source, save_platform_theme_html, slugify_theme_name, write_platform_theme_html

router = APIRouter(prefix="/platform/themes", tags=["platform-themes"])


class StorefrontThemeOut(BaseModel):
    id: int
    slug: str
    name: str
    description: str | None
    variables: list[dict[str, Any]]
    instructions: str | None
    is_active: bool
    html_path: str

    model_config = {"from_attributes": True}


class StorefrontThemeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


def _theme_out(theme: StorefrontTheme) -> StorefrontThemeOut:
    return StorefrontThemeOut(
        id=theme.id,
        slug=theme.slug,
        name=theme.name,
        description=theme.description,
        variables=theme.variables or [],
        instructions=theme.instructions,
        is_active=theme.is_active,
        html_path=theme.html_path,
    )


@router.get("", response_model=list[StorefrontThemeOut])
def list_platform_themes(
    db: Session = Depends(get_db),
    _: object = Depends(require_platform),
):
    themes = db.scalars(select(StorefrontTheme).order_by(StorefrontTheme.name)).all()
    return [_theme_out(t) for t in themes]


@router.post("/upload", response_model=StorefrontThemeOut)
async def upload_platform_theme(
    file: UploadFile = File(...),
    name: str = Form(...),
    slug: str | None = Form(None),
    description: str | None = Form(None),
    db: Session = Depends(get_db),
    _: object = Depends(require_platform),
):
    theme_slug = slugify_theme_name(slug or name)
    existing = db.scalar(select(StorefrontTheme).where(StorefrontTheme.slug == theme_slug))
    if existing:
        raise HTTPException(status_code=400, detail=f"Theme slug '{theme_slug}' already exists")

    path = await save_platform_theme_html(theme_slug, file)
    html_content = read_platform_theme_source(
        StorefrontTheme(slug=theme_slug, name=name, html_path=path)
    ) or ""
    analysis = await analyze_theme_html(html_content)

    patched = analysis.get("patched_html")
    if patched and patched.strip() and patched != html_content:
        write_platform_theme_html(theme_slug, patched)

    theme = StorefrontTheme(
        slug=theme_slug,
        name=name.strip(),
        description=description,
        html_path=path,
        variables=analysis.get("variables") or [],
        instructions=analysis.get("instructions"),
        is_active=True,
    )
    db.add(theme)
    db.commit()
    db.refresh(theme)
    return _theme_out(theme)


@router.patch("/{theme_slug}", response_model=StorefrontThemeOut)
def update_platform_theme(
    theme_slug: str,
    body: StorefrontThemeUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_platform),
):
    theme = db.scalar(select(StorefrontTheme).where(StorefrontTheme.slug == theme_slug))
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(theme, key, val)
    db.commit()
    db.refresh(theme)
    return _theme_out(theme)


@router.post("/{theme_slug}/reanalyze", response_model=StorefrontThemeOut)
async def reanalyze_platform_theme(
    theme_slug: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_platform),
):
    theme = db.scalar(select(StorefrontTheme).where(StorefrontTheme.slug == theme_slug))
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    html_content = read_platform_theme_source(theme) or read_platform_theme_html(theme) or ""
    analysis = await analyze_theme_html(html_content)
    patched = analysis.get("patched_html")
    if patched and patched.strip():
        write_platform_theme_html(theme.slug, patched)
    theme.variables = analysis.get("variables") or []
    theme.instructions = analysis.get("instructions")
    db.commit()
    db.refresh(theme)
    return _theme_out(theme)
