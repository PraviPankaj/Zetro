from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.seed import ensure_cod_gateway, subscription_window
from app.models import (
    Shop,
    ShopStatus,
    ShopSubscription,
    ShopUser,
    ShopUserRole,
    SubscriptionPlan,
    SubscriptionStatus,
)
from app.services.catalog import normalize_theme

REGISTER_PURPOSE = "shop_register"
REGISTER_SLUG = "_register"
RESERVED_SLUGS = {"platform", "api", "media", "admin", "register"}


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return digits


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return (slug[:80] or "shop").strip("-")


def unique_slug(db: Session, base: str) -> str:
    slug = base
    suffix = 1
    while db.scalar(select(Shop).where(Shop.slug == slug)):
        slug = f"{base}-{suffix}"[:80].rstrip("-")
        suffix += 1
    return slug


def validate_slug(slug: str) -> str:
    cleaned = slugify(slug)
    if cleaned in RESERVED_SLUGS:
        raise ValueError("This shop URL is reserved")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", cleaned):
        raise ValueError("Shop URL must use lowercase letters, numbers, and hyphens only")
    return cleaned


async def save_shop_logo(shop: Shop, file: UploadFile) -> str:
    settings = get_settings()
    ext = Path(file.filename or "logo.png").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".png"
    filename = f"logo_{uuid.uuid4().hex[:8]}{ext}"
    dest_dir = Path(settings.media_root) / shop.slug
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / filename
    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            await out.write(chunk)
    return f"{settings.media_url_prefix}/{shop.slug}/{filename}"


def activate_trial(db: Session, shop_id: int) -> None:
    plan = db.scalar(
        select(SubscriptionPlan).where(
            SubscriptionPlan.code == "free_trial",
            SubscriptionPlan.is_active.is_(True),
        )
    )
    if not plan:
        return
    starts, ends = subscription_window(plan.duration_days)
    db.add(
        ShopSubscription(
            shop_id=shop_id,
            plan_id=plan.id,
            status=SubscriptionStatus.trial,
            starts_at=starts,
            ends_at=ends,
        )
    )


async def create_registered_shop(
    db: Session,
    phone: str,
    name: str,
    slug: Optional[str] = None,
    logo: Optional[UploadFile] = None,
) -> tuple[Shop, ShopUser]:
    name = (name or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Shop name is too short")

    if slug:
        shop_slug = validate_slug(slug)
        if db.scalar(select(Shop).where(Shop.slug == shop_slug)):
            raise HTTPException(status_code=400, detail="Shop URL already taken")
    else:
        shop_slug = unique_slug(db, slugify(name))

    shop = Shop(
        name=name,
        slug=shop_slug,
        owner_phone=phone,
        description=None,
        status=ShopStatus.active,
        storefront_theme=normalize_theme(None),
        created_by_id=None,
    )
    db.add(shop)
    db.flush()

    if logo and logo.filename:
        shop.logo_url = await save_shop_logo(shop, logo)

    user = ShopUser(
        shop_id=shop.id,
        phone=phone,
        name=f"{name} Owner",
        role=ShopUserRole.owner,
        permissions={"catalog": True, "orders": True, "payments": True},
    )
    db.add(user)
    db.flush()
    ensure_cod_gateway(db, shop.id)
    activate_trial(db, shop.id)
    db.commit()
    db.refresh(shop)
    db.refresh(user)
    return shop, user
