"""Shop barcode stock-in and POS billing endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_shop_user
from app.db.session import get_db
from app.schemas import (
    BarcodeStockIn,
    OrderOut,
    PosBillCreate,
    PosBillPreview,
    ProductOut,
)
from app.services import catalog as catalog_service
from app.services import retail as retail_service

router = APIRouter(prefix="/shops/{slug}", tags=["shop-retail"])


def _order_out(order) -> OrderOut:
    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        status=order.status.value,
        payment_status=order.payment_status.value,
        payment_provider=order.payment_provider.value,
        channel=getattr(order, "channel", None) or "online",
        subtotal=float(order.subtotal),
        discount_amount=float(order.discount_amount or 0),
        tax_amount=float(getattr(order, "tax_amount", 0) or 0),
        round_off=float(getattr(order, "round_off", 0) or 0),
        coupon_code=order.coupon_code,
        total=float(order.total),
        shipping_address=order.shipping_address or {},
        created_at=order.created_at,
        items=[
            {
                "product_name": i.product_name,
                "variant_name": i.variant_name,
                "quantity": i.quantity,
                "unit_price": float(i.unit_price),
                "line_total": float(i.line_total),
            }
            for i in order.items
        ],
    )


@router.get("/admin/barcode/lookup", response_model=ProductOut | None)
def lookup_by_barcode(
    slug: str,
    barcode: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    product = retail_service.find_product_by_barcode(db, shop.id, barcode)
    if not product:
        return None
    return catalog_service.serialize_product(product)


@router.post("/admin/barcode/stock-in", response_model=ProductOut)
def stock_in_barcode(
    slug: str,
    body: BarcodeStockIn,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    return retail_service.stock_in_by_barcode(db, shop, body)


@router.post("/admin/billing/preview", response_model=PosBillPreview)
def preview_bill(
    slug: str,
    body: PosBillCreate,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    if not body.items:
        raise HTTPException(status_code=400, detail="Add at least one item")
    data = retail_service.preview_pos_bill(db, shop, body.items, apply_gst=body.apply_gst)
    return PosBillPreview(**data)


@router.post("/admin/billing", response_model=OrderOut)
def create_bill(
    slug: str,
    body: PosBillCreate,
    db: Session = Depends(get_db),
    ctx=Depends(require_shop_user),
):
    shop, _ = ctx
    order = retail_service.create_pos_bill(db, shop, body)
    return _order_out(order)
