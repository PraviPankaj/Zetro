"""Barcode stock intake and in-shop (POS) billing helpers."""

from __future__ import annotations

import random
import re
import uuid
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    BarcodeBatch,
    BarcodeBatchStatus,
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
from app.schemas import (
    BarcodeBatchCreate,
    BarcodeBatchOut,
    BarcodeBatchUpdate,
    BarcodeStockIn,
    PosBillCreate,
    PosBillItemIn,
    ProductOut,
    ProductSearchOut,
)
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


def effective_gst_rate(shop: Shop, product: Product | None) -> float:
    """GST % for a product: its own rate if set, else the shop default."""
    if product is not None and product.gst_rate is not None:
        return float(product.gst_rate)
    return float(shop.gst_rate or 0)


def bill_totals(
    shop: Shop,
    lines: list[dict],
    apply_gst: bool | None = None,
) -> dict:
    """Compute totals from resolved lines.

    Each line needs ``line_total`` and ``gst_rate``; this fills in per-line
    ``tax_amount`` (mutating the dicts) and returns aggregate totals plus a
    breakup grouped by rate.
    """
    gst_on = shop.gst_enabled if apply_gst is None else apply_gst
    subtotal = _money(sum(float(l["line_total"]) for l in lines))
    breakup: dict[float, dict[str, float]] = {}
    tax_total = 0.0
    for line in lines:
        rate = float(line.get("gst_rate") or 0) if gst_on else 0.0
        tax = _money(float(line["line_total"]) * rate / 100.0) if rate else 0.0
        line["gst_rate"] = rate
        line["tax_amount"] = tax
        tax_total += tax
        if gst_on:
            slot = breakup.setdefault(rate, {"rate": rate, "taxable": 0.0, "tax": 0.0})
            slot["taxable"] = _money(slot["taxable"] + float(line["line_total"]))
            slot["tax"] = _money(slot["tax"] + tax)
    tax_amount = _money(tax_total)
    total, round_off = _round_rupee(subtotal + tax_amount)
    return {
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "round_off": round_off,
        "total": total,
        "gst_enabled": bool(gst_on),
        "gst_rate": float(shop.gst_rate or 0) if gst_on else 0.0,
        "tax_breakup": [breakup[r] for r in sorted(breakup)],
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
        if body.gst_rate is not None:
            product.gst_rate = body.gst_rate
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
        gst_rate=body.gst_rate,
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


# ---------------------------------------------------------------------------
# Product search (billing fallback when the scanner fails)
# ---------------------------------------------------------------------------


def search_products(db: Session, shop_id: int, q: str, limit: int = 20) -> list[ProductSearchOut]:
    needle = (q or "").strip()
    if not needle:
        return []
    like = f"%{needle.lower()}%"
    code = normalize_barcode(needle)
    conditions = [func.lower(Product.name).like(like)]
    if code:
        conditions.append(Product.barcode.like(f"%{code}%"))
    query = (
        catalog_service.product_query(db, shop_id)
        .where(or_(*conditions))
        .order_by(Product.name)
        .limit(limit)
    )
    products = db.scalars(query).unique().all()
    out: list[ProductSearchOut] = []
    for product in products:
        variant = product.variants[0] if product.variants else None
        if not variant:
            continue
        out.append(
            ProductSearchOut(
                product_id=product.id,
                variant_id=variant.id,
                name=product.name,
                barcode=product.barcode,
                price=float(variant.price or 0),
                stock=int(variant.stock or 0),
                is_active=product.is_active,
                gst_rate=float(product.gst_rate) if product.gst_rate is not None else None,
            )
        )
    return out


# ---------------------------------------------------------------------------
# Barcode generator batches
# ---------------------------------------------------------------------------


def _ean13_check_digit(digits12: str) -> str:
    total = 0
    for idx, ch in enumerate(digits12):
        weight = 1 if idx % 2 == 0 else 3
        total += int(ch) * weight
    return str((10 - (total % 10)) % 10)


def generate_store_barcode(db: Session, shop_id: int) -> str:
    """Generate a unique EAN-13 in the in-store range (prefix 2)."""
    for _ in range(50):
        body = f"2{shop_id % 1000:03d}{random.randint(0, 99_999_999):08d}"
        code = body + _ean13_check_digit(body)
        exists = db.scalar(
            select(Product.id).where(Product.shop_id == shop_id, Product.barcode == code)
        )
        if not exists:
            return code
    raise HTTPException(status_code=500, detail="Could not generate a unique barcode; try again")


def _unique_product_slug(db: Session, shop_id: int, name: str, code: str) -> str:
    slug_base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "product"
    slug = f"{slug_base}-{code[-6:]}"
    if db.scalar(select(Product.id).where(Product.shop_id == shop_id, Product.slug == slug)):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    return slug


def _create_barcode_product(
    db: Session, shop: Shop, name: str, price: float, code: str, gst_rate: float | None = None
) -> Product:
    product = Product(
        shop_id=shop.id,
        name=name,
        slug=_unique_product_slug(db, shop.id, name, code),
        barcode=code,
        gst_rate=gst_rate,
        is_active=False,
    )
    db.add(product)
    db.flush()
    db.add(
        ProductVariant(
            shop_id=shop.id,
            product_id=product.id,
            sku=f"BC-{code}"[:80],
            name="Default",
            price=price,
            stock=0,
        )
    )
    db.flush()
    return catalog_service.get_product(db, shop.id, product.id)


def _batch_out(db: Session, batch: BarcodeBatch) -> BarcodeBatchOut:
    variant = db.get(ProductVariant, batch.variant_id)
    product = db.get(Product, batch.product_id)
    return BarcodeBatchOut(
        gst_rate=float(product.gst_rate) if product and product.gst_rate is not None else None,
        id=batch.id,
        product_id=batch.product_id,
        variant_id=batch.variant_id,
        barcode=batch.barcode,
        product_name=batch.product_name,
        price=float(batch.price or 0),
        quantity=int(batch.quantity or 0),
        status=batch.status.value,
        stock_applied=int(batch.stock_applied or 0),
        print_count=int(batch.print_count or 0),
        current_stock=int(variant.stock or 0) if variant else 0,
        current_price=float(variant.price or 0) if variant else 0.0,
        created_at=batch.created_at,
        printed_at=batch.printed_at,
        cancelled_at=batch.cancelled_at,
    )


def _get_batch(db: Session, shop_id: int, batch_id: int) -> BarcodeBatch:
    batch = db.scalar(
        select(BarcodeBatch).where(BarcodeBatch.id == batch_id, BarcodeBatch.shop_id == shop_id)
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Barcode batch not found")
    return batch


def list_barcode_batches(db: Session, shop_id: int, limit: int = 50) -> list[BarcodeBatchOut]:
    batches = db.scalars(
        select(BarcodeBatch)
        .where(BarcodeBatch.shop_id == shop_id)
        .order_by(BarcodeBatch.id.desc())
        .limit(limit)
    ).all()
    return [_batch_out(db, b) for b in batches]


def get_barcode_batch(db: Session, shop_id: int, batch_id: int) -> BarcodeBatchOut:
    return _batch_out(db, _get_batch(db, shop_id, batch_id))


def create_barcode_batch(db: Session, shop: Shop, body: BarcodeBatchCreate) -> BarcodeBatchOut:
    """Create a draft batch. Stock is NOT touched until the batch is printed.

    Product resolution order: explicit product_id → existing barcode → exact
    name match (case-insensitive) → new hidden product with a generated code.
    """
    name = body.name.strip()
    price = _money(body.price)
    code = normalize_barcode(body.barcode or "")

    product: Product | None = None
    if body.product_id is not None:
        product = db.scalar(catalog_service.product_query(db, shop.id, body.product_id))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
    elif code:
        product = find_product_by_barcode(db, shop.id, code)
    if product is None and not code:
        product = db.scalar(
            catalog_service.product_query(db, shop.id).where(func.lower(Product.name) == name.lower())
        )

    if product is None:
        code = code or generate_store_barcode(db, shop.id)
        product = _create_barcode_product(db, shop, name, price, code, gst_rate=body.gst_rate)
    else:
        if not product.variants:
            raise HTTPException(status_code=400, detail="Product has no sellable variant")
        if body.gst_rate is not None:
            product.gst_rate = body.gst_rate
        if not product.barcode:
            # Existing product without a barcode — assign one so labels can be scanned
            product.barcode = code or generate_store_barcode(db, shop.id)
        elif code and product.barcode != code:
            raise HTTPException(
                status_code=400,
                detail=f"Barcode {code} belongs to “{product.name}”; leave it blank to generate a new one",
            )
        code = product.barcode

    variant = product.variants[0]
    batch = BarcodeBatch(
        shop_id=shop.id,
        product_id=product.id,
        variant_id=variant.id,
        barcode=code,
        product_name=product.name,
        price=price,
        quantity=body.quantity,
        status=BarcodeBatchStatus.draft,
        stock_applied=0,
        print_count=0,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return _batch_out(db, batch)


def update_barcode_batch(
    db: Session, shop: Shop, batch_id: int, body: BarcodeBatchUpdate
) -> BarcodeBatchOut:
    """Edit price / quantity.

    - Draft: nothing has hit stock, so just update the batch.
    - Printed: quantity delta is applied to stock immediately; a price change
      updates the product's selling price (already-printed labels show the old
      price, so the UI prompts a reprint).
    - Cancelled: read-only.
    """
    batch = _get_batch(db, shop.id, batch_id)
    if batch.status == BarcodeBatchStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cancelled batches cannot be edited")

    data = body.model_dump(exclude_unset=True)
    variant = db.get(ProductVariant, batch.variant_id)
    if not variant:
        raise HTTPException(status_code=400, detail="Product variant no longer exists")

    if data.get("quantity") is not None:
        new_qty = int(data["quantity"])
        if batch.status == BarcodeBatchStatus.printed:
            delta = new_qty - int(batch.stock_applied or 0)
            new_stock = int(variant.stock or 0) + delta
            if new_stock < 0:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot reduce to {new_qty}: only {variant.stock} left in stock "
                        f"(some of this batch has already been sold)"
                    ),
                )
            variant.stock = new_stock
            batch.stock_applied = new_qty
        batch.quantity = new_qty

    if data.get("price") is not None:
        new_price = _money(data["price"])
        batch.price = new_price
        if batch.status == BarcodeBatchStatus.printed:
            variant.price = new_price

    db.commit()
    db.refresh(batch)
    return _batch_out(db, batch)


def print_barcode_batch(db: Session, shop: Shop, batch_id: int) -> BarcodeBatchOut:
    """Mark a batch printed. Adds stock exactly once; reprints don't add again."""
    batch = _get_batch(db, shop.id, batch_id)
    if batch.status == BarcodeBatchStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cancelled batches cannot be printed")
    variant = db.get(ProductVariant, batch.variant_id)
    if not variant:
        raise HTTPException(status_code=400, detail="Product variant no longer exists")

    if batch.status == BarcodeBatchStatus.draft:
        variant.stock = int(variant.stock or 0) + int(batch.quantity)
        # Labels carry this price; make it the selling price so scans match
        variant.price = batch.price
        batch.stock_applied = int(batch.quantity)
        batch.status = BarcodeBatchStatus.printed
        batch.printed_at = datetime.now(timezone.utc)

    batch.print_count = int(batch.print_count or 0) + 1
    db.commit()
    db.refresh(batch)
    return _batch_out(db, batch)


def cancel_barcode_batch(db: Session, shop: Shop, batch_id: int) -> BarcodeBatchOut:
    """Cancel a batch, reversing any stock it added (never below zero)."""
    batch = _get_batch(db, shop.id, batch_id)
    if batch.status == BarcodeBatchStatus.cancelled:
        return _batch_out(db, batch)
    variant = db.get(ProductVariant, batch.variant_id)
    applied = int(batch.stock_applied or 0)
    if variant and applied:
        variant.stock = max(0, int(variant.stock or 0) - applied)
    batch.stock_applied = 0
    batch.status = BarcodeBatchStatus.cancelled
    batch.cancelled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(batch)
    return _batch_out(db, batch)


def preview_pos_bill(
    db: Session, shop: Shop, items: list[PosBillItemIn], apply_gst: bool | None = None
) -> dict:
    resolved = []
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
                "gst_rate": effective_gst_rate(shop, variant.product),
                "stock": int(variant.stock or 0),
            }
        )
    totals = bill_totals(shop, resolved, apply_gst=apply_gst)
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
                gst_rate=row.get("gst_rate") or 0,
                tax_amount=row.get("tax_amount") or 0,
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
