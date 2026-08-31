from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_shop_by_slug, require_shop_user
from app.core.security import create_access_token, create_refresh_token
from app.db.seed import subscription_window
from app.db.session import get_db
from app.models import (
    Shop,
    ShopStatus,
    ShopSubscription,
    ShopUser,
    SubscriptionPlan,
    SubscriptionStatus,
)
from app.schemas import (
    ActivatePlanRequest,
    OTPRequest,
    OTPVerify,
    PlanOut,
    SubscriptionOut,
    TokenResponse,
)
from app.services.otp import otp_service

router = APIRouter(prefix="/shops/{slug}", tags=["shop-auth"])


def _shop_user_token_response(user: ShopUser, shop: Shop) -> TokenResponse:
    claims = {
        "kind": "shop_user",
        "shop_id": shop.id,
        "role": user.role.value,
        "permissions": list((user.permissions or {}).keys()),
    }
    return TokenResponse(
        access_token=create_access_token(str(user.id), claims),
        refresh_token=create_refresh_token(str(user.id), claims),
    )


@router.post("/auth/demo", response_model=TokenResponse)
def shop_demo_login(slug: str, db: Session = Depends(get_db)):
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.demo_bypass_enabled or slug != settings.demo_shop_slug:
        raise HTTPException(status_code=404, detail="Demo login not available")

    shop = get_shop_by_slug(slug, db)
    if shop.status == ShopStatus.suspended:
        raise HTTPException(status_code=403, detail="Shop suspended")
    user = db.scalar(
        select(ShopUser).where(
            ShopUser.shop_id == shop.id,
            ShopUser.phone == settings.demo_shop_phone,
        )
    )
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Demo user not found")
    return _shop_user_token_response(user, shop)


@router.post("/auth/otp/request")
def shop_otp_request(slug: str, body: OTPRequest, db: Session = Depends(get_db)):
    shop = get_shop_by_slug(slug, db)
    if shop.status == ShopStatus.suspended:
        raise HTTPException(status_code=403, detail="Shop suspended")
    user = db.scalar(
        select(ShopUser).where(ShopUser.shop_id == shop.id, ShopUser.phone == body.phone)
    )
    if not user:
        raise HTTPException(status_code=404, detail="Shop user not found for this phone")
    try:
        return otp_service.request_otp("shop_user", slug, body.phone)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc


@router.post("/auth/otp/verify", response_model=TokenResponse)
def shop_otp_verify(slug: str, body: OTPVerify, db: Session = Depends(get_db)):
    shop = get_shop_by_slug(slug, db)
    if not otp_service.verify_otp("shop_user", slug, body.phone, body.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    user = db.scalar(
        select(ShopUser).where(ShopUser.shop_id == shop.id, ShopUser.phone == body.phone)
    )
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Shop user not found")
    if body.name:
        user.name = body.name
        db.commit()
    return _shop_user_token_response(user, shop)


@router.get("/admin/me")
def shop_admin_me(ctx=Depends(require_shop_user)):
    shop, user = ctx
    return {
        "shop": {"id": shop.id, "name": shop.name, "slug": shop.slug, "status": shop.status.value},
        "user": {
            "id": user.id,
            "phone": user.phone,
            "name": user.name,
            "role": user.role.value,
            "permissions": user.permissions,
        },
    }


@router.get("/admin/plans", response_model=list[PlanOut])
def shop_plans(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    return db.scalars(select(SubscriptionPlan).where(SubscriptionPlan.is_active.is_(True))).all()


@router.get("/admin/subscription", response_model=SubscriptionOut | None)
def current_subscription(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    sub = db.scalar(
        select(ShopSubscription)
        .options(joinedload(ShopSubscription.plan))
        .where(ShopSubscription.shop_id == shop.id)
        .order_by(ShopSubscription.id.desc())
    )
    if not sub:
        return None
    return SubscriptionOut(
        id=sub.id,
        plan=PlanOut.model_validate(sub.plan),
        status=sub.status.value,
        starts_at=sub.starts_at,
        ends_at=sub.ends_at,
    )


@router.post("/admin/subscription/activate", response_model=SubscriptionOut)
def activate_plan(
    slug: str,
    body: ActivatePlanRequest,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == body.plan_code))
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Plan not found")

    if plan.is_trial:
        prior_trial = db.scalar(
            select(ShopSubscription)
            .join(SubscriptionPlan)
            .where(
                ShopSubscription.shop_id == shop.id,
                SubscriptionPlan.is_trial.is_(True),
            )
        )
        if prior_trial:
            raise HTTPException(status_code=400, detail="Free trial already used")

    starts, ends = subscription_window(plan.duration_days)
    status = SubscriptionStatus.trial if plan.is_trial else SubscriptionStatus.active
    # expire previous active
    for old in db.scalars(
        select(ShopSubscription).where(
            ShopSubscription.shop_id == shop.id,
            ShopSubscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trial]),
        )
    ):
        old.status = SubscriptionStatus.cancelled

    sub = ShopSubscription(
        shop_id=shop.id,
        plan_id=plan.id,
        status=status,
        starts_at=starts,
        ends_at=ends,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    sub = db.scalar(
        select(ShopSubscription)
        .options(joinedload(ShopSubscription.plan))
        .where(ShopSubscription.id == sub.id)
    )
    return SubscriptionOut(
        id=sub.id,
        plan=PlanOut.model_validate(sub.plan),
        status=sub.status.value,
        starts_at=sub.starts_at,
        ends_at=sub.ends_at,
    )
