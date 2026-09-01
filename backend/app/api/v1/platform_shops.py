from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_platform, require_platform_permission
from app.db.seed import ensure_cod_gateway
from app.db.session import get_db
from app.models import PlatformUser, Shop, ShopStatus, ShopUser, ShopUserRole, SubscriptionPlan
from app.schemas import PlanOut, ShopCreate, ShopOut, ShopUpdate

router = APIRouter(prefix="/platform", tags=["platform-shops"])


@router.get("/shops", response_model=list[ShopOut])
def list_shops(
    _: PlatformUser = Depends(require_platform_permission("shops.view")),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Shop).order_by(Shop.id.desc())).all()


@router.post("/shops", response_model=ShopOut)
def create_shop(
    body: ShopCreate,
    user: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    if body.slug in {"platform", "api", "media", "admin"}:
        raise HTTPException(status_code=400, detail="Reserved slug")
    if db.scalar(select(Shop).where(Shop.slug == body.slug)):
        raise HTTPException(status_code=400, detail="Slug already taken")
    shop = Shop(
        name=body.name,
        slug=body.slug,
        owner_phone=body.owner_phone,
        description=body.description,
        status=ShopStatus.active,
        created_by_id=user.id,
    )
    db.add(shop)
    db.flush()
    db.add(
        ShopUser(
            shop_id=shop.id,
            phone=body.owner_phone,
            name=body.name + " Owner",
            role=ShopUserRole.owner,
            permissions={"catalog": True, "orders": True, "payments": True},
        )
    )
    db.commit()
    db.refresh(shop)
    ensure_cod_gateway(db, shop.id)
    return shop


@router.get("/shops/{shop_id}", response_model=ShopOut)
def get_shop(
    shop_id: int,
    _: PlatformUser = Depends(require_platform_permission("shops.view")),
    db: Session = Depends(get_db),
):
    shop = db.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.patch("/shops/{shop_id}", response_model=ShopOut)
def update_shop(
    shop_id: int,
    body: ShopUpdate,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = db.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if body.name is not None:
        shop.name = body.name
    if body.owner_phone is not None:
        shop.owner_phone = body.owner_phone
    if body.description is not None:
        shop.description = body.description
    if body.status is not None:
        try:
            shop.status = ShopStatus(body.status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid status") from exc
    if body.storefront_theme is not None:
        from app.services.catalog import normalize_theme

        shop.storefront_theme = normalize_theme(body.storefront_theme, db)
    db.commit()
    db.refresh(shop)
    return shop


@router.get("/plans", response_model=list[PlanOut])
def list_plans(
    _: PlatformUser = Depends(require_platform),
    db: Session = Depends(get_db),
):
    return db.scalars(select(SubscriptionPlan).where(SubscriptionPlan.is_active.is_(True))).all()
