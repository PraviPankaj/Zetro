"""Barcode stock intake and in-shop (POS) billing helpers."""

from __future__ import annotations

import re
import uuid
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Customer,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    Payment,
    PaymentProvider,
    PaymentStatus,
    Product,
    ProductVariant,
    Shop,
)
from app.schemas import BarcodeStockIn, PosBillCreate, PosBillItemIn, ProductOut
from app.services import catalog as catalog_service


WALKIN_PHONE = "0000000000"


def _money(value: float | Decimal) -> float:
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _round_rupee(value: float) -> tuple[float, float]:
    """Return (rounded_total, round_off) for nearest rupee."""
    raw = Decimal(str(value))
    rounded = raw.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    round_off = rounded - raw
    return float(rounded), float(round_off.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def normalize_barcode(raw: str) -> str:
    return re.sub(r"\s+", "", (raw or "").strip())


def find_product_by_barcode(db: Session, shop_id: int, barcode: str) -> Product | None:
    code = normalize_barcode(barcode)
    if not code:
        return None
    return db.scalar(
        catalog_service.product_query(db, shop_id).where(Product.barcode == code)
    )


def bill_totals(
    shop: Shop,
    line_totals: list[float],
    apply_gst: bool | None = None,
) -> dict[str, float | bool]:
    subtotal = _money(sum(line_totals))
    gst_on = shop.gst_enabled if apply_gst is None else apply_gst
    rate = float(shop.gst_rate or 0) if gst_on else 0.0
    tax_amount = _money(subtotal * rate / 100.0) if gst_on and rate else 0.0
    total, round_off = _round_rupee(subtotal + tax_amount)
    return {
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "round_off": round_off,
        "total": total,
        "gst_enabled": bool(gst_on),
        "gst_rate": rate if gst_on else 0.0,
    }


def get_or_create_walkin_customer(
    db: Session, shop_id: int, name: str | None = None, phone: str | None = None
) -> Customer:
    phone_norm = re.sub(r"\D", "", phone or "") or WALKIN_PHONE
    if len(phone_norm) < 8:
        phone_norm = WALKIN_PHONE
    customer = db.scalar(
        select(Customer).where(Customer.shop_id == shop_id, Customer.phone == phone_norm)
    )
    if customer:
        if name and not customer.name:
            customer.name = name
        return customer
    customer = Customer(
        shop_id=shop_id,
        phone=phone_norm,
        name=name or ("Walk-in" if phone_norm == WALKIN_PHONE else None),
    )
    db.add(customer)
    db.flush()
    return customer


def stock_in_by_barcode(db: Session, shop: Shop, body: BarcodeStockIn) -> ProductOut:
    code = normalize_barcode(body.barcode)
    if not code:
        raise HTTPException(status_code=400, detail="Barcode is required")

    product = find_product_by_barcode(db, shop.id, code)
    if product:
        if not product.variants:
            raise HTTPException(status_code=400, detail="Product has no variants")
        variant = product.variants[0]
        variant.stock = int(variant.stock or 0) + body.quantity
        if body.price is not None:
            variant.price = body.price
        db.commit()
        return catalog_service.serialize_product(
            catalog_service.get_product(db, shop.id, product.id)
        )

    # Create new product — hidden from storefront until enabled
    if not body.name or not body.name.strip():
        raise HTTPException(
            status_code=404,
            detail="Product not found for this barcode. Provide name (and price) to add as new.",
        )
    name = body.name.strip()
    slug_base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "product"
    slug = f"{slug_base}-{code[-6:]}"
    # Ensure unique slug
    existing_slug = db.scalar(
        select(Product.id).where(Product.shop_id == shop.id, Product.slug == slug)
    )
    if existing_slug:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    sku = (body.sku or f"BC-{code}")[:80]
    price = float(body.price or 0)
    product = Product(
        shop_id=shop.id,
        name=name,
        slug=slug,
        barcode=code,
        is_active=False,
    )
    db.add(product)
    db.flush()
    db.add(
        ProductVariant(
            shop_id=shop.id,
            product_id=product.id,
            sku=sku,
            name="Default",
            price=price,
            stock=body.quantity,
        )
    )
    db.commit()
    return catalog_service.serialize_product(
        catalog_service.get_product(db, shop.id, product.id)
    )


def preview_pos_bill(
    db: Session, shop: Shop, items: list[PosBillItemIn], apply_gst: bool | None = None
) -> dict:
    resolved = []
    line_totals = []
    for item in items:
        variant = db.scalar(
            select(ProductVariant)
            .options(joinedload(ProductVariant.product))
            .where(ProductVariant.id == item.variant_id, ProductVariant.shop_id == shop.id)
        )
        if not variant or not variant.product:
            raise HTTPException(status_code=400, detail=f"Variant {item.variant_id} not found")
        unit = float(item.unit_price if item.unit_price is not None else variant.price)
        line = _money(unit * item.quantity)
        line_totals.append(line)
        resolved.append(
            {
                "variant_id": variant.id,
                "product_id": variant.product_id,
                "product_name": variant.product.name,
                "variant_name": variant.name,
                "barcode": variant.product.barcode,
                "unit_price": unit,
                "quantity": item.quantity,
                "line_total": line,
                "stock": int(variant.stock or 0),
            }
        )
    totals = bill_totals(shop, line_totals, apply_gst=apply_gst)
    return {**totals, "items": resolved}


def create_pos_bill(db: Session, shop: Shop, body: PosBillCreate) -> Order:
    preview = preview_pos_bill(db, shop, body.items, apply_gst=body.apply_gst)

    for row in preview["items"]:
        if row["quantity"] > row["stock"]:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {row['product_name']} (have {row['stock']})",
            )

    customer = get_or_create_walkin_customer(
        db, shop.id, name=body.customer_name, phone=body.customer_phone
    )
    order_number = f"P{shop.id}-{uuid.uuid4().hex[:8].upper()}"
    order = Order(
        shop_id=shop.id,
        customer_id=customer.id,
        order_number=order_number,
        status=OrderStatus.delivered,
        payment_status=PaymentStatus.paid,
        payment_provider=PaymentProvider.cod,
        channel="pos",
        subtotal=preview["subtotal"],
        discount_amount=0,
        tax_amount=preview["tax_amount"],
        round_off=preview["round_off"],
        total=preview["total"],
        shipping_address={
            "name": customer.name or "Walk-in",
            "phone": customer.phone,
            "channel": "pos",
        },
        notes=body.notes,
    )
    db.add(order)
    db.flush()

    for row in preview["items"]:
        variant = db.get(ProductVariant, row["variant_id"])
        variant.stock = int(variant.stock or 0) - row["quantity"]
        db.add(
            OrderItem(
                shop_id=shop.id,
                order_id=order.id,
                variant_id=variant.id,
                product_name=row["product_name"],
                variant_name=row["variant_name"],
                unit_price=row["unit_price"],
                quantity=row["quantity"],
                line_total=row["line_total"],
            )
        )

    db.add(
        OrderStatusHistory(
            shop_id=shop.id,
            order_id=order.id,
            status=OrderStatus.delivered,
            note="In-shop sale",
        )
    )
    db.add(
        Payment(
            shop_id=shop.id,
            order_id=order.id,
            provider=PaymentProvider.cod,
            external_id=f"pos-{order_number}",
            amount=order.total,
            status=PaymentStatus.paid,
            raw_payload={"channel": "pos"},
        )
    )
    db.commit()
    return db.scalar(
        select(Order).options(joinedload(Order.items)).where(Order.id == order.id)
    )
