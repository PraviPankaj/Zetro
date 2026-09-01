from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_shop_user
from app.db.session import get_db
from app.models import Coupon, CouponDiscountType, Customer, Order, ProductVariant
from app.schemas import (
    BulkStockUpdate,
    CouponCreate,
    CouponOut,
    CouponUpdate,
    CouponValidateRequest,
    CouponValidateResponse,
    CustomerAdminOut,
    InventoryItemOut,
)
from app.services import catalog as catalog_service
from app.services.coupons import validate_coupon
from app.services.export import to_csv
from app.services.reports import LOW_STOCK_THRESHOLD

router = APIRouter(prefix="/shops/{slug}", tags=["shop-phase2"])


def _coupon_out(coupon: Coupon) -> CouponOut:
    return CouponOut(
        id=coupon.id,
        code=coupon.code,
        title=coupon.title,
        discount_type=coupon.discount_type.value,
        discount_value=float(coupon.discount_value),
        min_order_amount=float(coupon.min_order_amount),
        max_uses=coupon.max_uses,
        used_count=coupon.used_count,
        starts_at=coupon.starts_at,
        ends_at=coupon.ends_at,
        is_active=coupon.is_active,
    )


@router.get("/admin/coupons", response_model=list[CouponOut])
def list_coupons(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    coupons = db.scalars(
        select(Coupon).where(Coupon.shop_id == shop.id).order_by(Coupon.id.desc())
    ).all()
    return [_coupon_out(c) for c in coupons]


@router.post("/admin/coupons", response_model=CouponOut)
def create_coupon(
    slug: str, body: CouponCreate, db: Session = Depends(get_db), ctx=Depends(require_shop_user)
):
    shop, _ = ctx
    try:
        discount_type = CouponDiscountType(body.discount_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="discount_type must be percent or fixed") from exc
    code = body.code.strip().upper()
    existing = db.scalar(select(Coupon).where(Coupon.shop_id == shop.id, Coupon.code == code))
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    coupon = Coupon(
        shop_id=shop.id,
        code=code,
        title=body.title,
        discount_type=discount_type,
        discount_value=body.discount_value,
        min_order_amount=body.min_order_amount,
        max_uses=body.max_uses,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        is_active=body.is_active,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return _coupon_out(coupon)


@router.patch("/admin/coupons/{coupon_id}", response_model=CouponOut)
def update_coupon(
    slug: str,
    coupon_id: int,
    body: CouponUpdate,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    coupon = db.scalar(select(Coupon).where(Coupon.id == coupon_id, Coupon.shop_id == shop.id))
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    data = body.model_dump(exclude_unset=True)
    if "discount_type" in data:
        try:
            coupon.discount_type = CouponDiscountType(data["discount_type"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid discount_type") from exc
        del data["discount_type"]
    for field, value in data.items():
        setattr(coupon, field, value)
    db.commit()
    db.refresh(coupon)
    return _coupon_out(coupon)


@router.delete("/admin/coupons/{coupon_id}")
def delete_coupon(
    slug: str, coupon_id: int, db: Session = Depends(get_db), ctx=Depends(require_shop_user)
):
    shop, _ = ctx
    coupon = db.scalar(select(Coupon).where(Coupon.id == coupon_id, Coupon.shop_id == shop.id))
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    db.delete(coupon)
    db.commit()
    return {"message": "deleted"}


@router.post("/admin/coupons/validate", response_model=CouponValidateResponse)
def validate_coupon_code(
    slug: str,
    body: CouponValidateRequest,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    coupon, discount = validate_coupon(db, shop, body.code, body.subtotal)
    return CouponValidateResponse(
        code=coupon.code,
        discount_amount=discount,
        total=round(body.subtotal - discount, 2),
    )


@router.get("/admin/customers", response_model=list[CustomerAdminOut])
def list_customers(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    customers = db.scalars(
        select(Customer).where(Customer.shop_id == shop.id).order_by(Customer.id.desc())
    ).all()
    stats = db.execute(
        select(
            Order.customer_id,
            func.count(Order.id),
            func.coalesce(func.sum(Order.total), 0),
        )
        .where(Order.shop_id == shop.id)
        .group_by(Order.customer_id)
    ).all()
    stat_map = {row[0]: (int(row[1]), float(row[2])) for row in stats}
    return [
        CustomerAdminOut(
            id=c.id,
            name=c.name,
            phone=c.phone,
            email=c.email,
            order_count=stat_map.get(c.id, (0, 0))[0],
            total_spent=stat_map.get(c.id, (0, 0))[1],
            created_at=c.created_at,
        )
        for c in customers
    ]


@router.get("/admin/inventory", response_model=list[InventoryItemOut])
def list_inventory(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    variants = db.scalars(
        select(ProductVariant)
        .options(joinedload(ProductVariant.product))
        .where(ProductVariant.shop_id == shop.id)
        .order_by(ProductVariant.stock.asc())
    ).unique().all()
    return [
        InventoryItemOut(
            variant_id=v.id,
            product_id=v.product_id,
            product_name=v.product.name if v.product else "",
            sku=v.sku,
            stock=v.stock or 0,
            price=float(v.price),
            is_active=bool(v.product and v.product.is_active),
        )
        for v in variants
    ]


@router.post("/admin/inventory/bulk")
def bulk_update_stock(
    slug: str,
    body: BulkStockUpdate,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    updated = 0
    for item in body.updates:
        variant_id = item.get("variant_id")
        stock = item.get("stock")
        if variant_id is None or stock is None:
            continue
        variant = db.scalar(
            select(ProductVariant).where(
                ProductVariant.id == variant_id, ProductVariant.shop_id == shop.id
            )
        )
        if not variant:
            continue
        variant.stock = int(stock)
        updated += 1
    db.commit()
    return {"message": "updated", "count": updated}


@router.get("/admin/orders/export")
def export_orders(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    orders = db.scalars(
        select(Order).where(Order.shop_id == shop.id).order_by(Order.id.desc())
    ).all()
    rows = [
        {
            "order_number": o.order_number,
            "status": o.status.value,
            "payment_status": o.payment_status.value,
            "payment_provider": o.payment_provider.value,
            "subtotal": float(o.subtotal),
            "discount_amount": float(o.discount_amount or 0),
            "coupon_code": o.coupon_code or "",
            "total": float(o.total),
            "customer_name": (o.shipping_address or {}).get("name", ""),
            "customer_phone": (o.shipping_address or {}).get("phone", ""),
            "created_at": o.created_at.isoformat() if o.created_at else "",
        }
        for o in orders
    ]
    csv_data = to_csv(
        rows,
        [
            "order_number",
            "status",
            "payment_status",
            "payment_provider",
            "subtotal",
            "discount_amount",
            "coupon_code",
            "total",
            "customer_name",
            "customer_phone",
            "created_at",
        ],
    )
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{shop.slug}-orders.csv"'},
    )


@router.get("/admin/products/export")
def export_products(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    products = catalog_service.list_products(db, shop.id)
    rows = []
    for p in products:
        variant = p.variants[0] if p.variants else None
        rows.append(
            {
                "name": p.name,
                "slug": p.slug,
                "sku": variant.sku if variant else "",
                "price": variant.price if variant else "",
                "stock": variant.stock if variant else 0,
                "is_active": p.is_active,
                "categories": ", ".join(c.name for c in p.categories),
            }
        )
    csv_data = to_csv(rows, ["name", "slug", "sku", "price", "stock", "is_active", "categories"])
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{shop.slug}-products.csv"'},
    )
