from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Coupon, CouponDiscountType, Shop


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def calculate_discount(coupon: Coupon, subtotal: float) -> float:
    if coupon.discount_type == CouponDiscountType.percent:
        discount = subtotal * float(coupon.discount_value) / 100
    else:
        discount = float(coupon.discount_value)
    return round(min(discount, subtotal), 2)


def get_coupon(db: Session, shop_id: int, code: str) -> Coupon | None:
    normalized = code.strip().upper()
    return db.scalar(
        select(Coupon).where(
            Coupon.shop_id == shop_id,
            Coupon.code == normalized,
            Coupon.is_active.is_(True),
        )
    )


def validate_coupon(db: Session, shop: Shop, code: str, subtotal: float) -> tuple[Coupon, float]:
    coupon = get_coupon(db, shop.id, code)
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon code")

    now = _utcnow()
    if coupon.starts_at and _as_utc(coupon.starts_at) > now:
        raise HTTPException(status_code=400, detail="Coupon is not active yet")
    if coupon.ends_at and _as_utc(coupon.ends_at) < now:
        raise HTTPException(status_code=400, detail="Coupon has expired")
    if subtotal < float(coupon.min_order_amount):
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order amount is ₹{coupon.min_order_amount}",
        )
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")

    return coupon, calculate_discount(coupon, subtotal)


def apply_coupon(db: Session, coupon: Coupon) -> None:
    coupon.used_count += 1
    db.add(coupon)
