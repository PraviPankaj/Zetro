from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Order, PaymentStatus, Product, ProductVariant, Shop
from app.schemas import PlatformReportSummary

LOW_STOCK_THRESHOLD = 5


def build_shop_summary(db: Session, shop: Shop) -> PlatformReportSummary:
    products = db.scalars(select(Product).where(Product.shop_id == shop.id)).all()
    variants = db.scalars(select(ProductVariant).where(ProductVariant.shop_id == shop.id)).all()
    orders = db.scalars(select(Order).where(Order.shop_id == shop.id)).all()

    total_stock = sum(v.stock or 0 for v in variants)
    low_stock = sum(1 for v in variants if (v.stock or 0) <= LOW_STOCK_THRESHOLD)

    return PlatformReportSummary(
        shop_id=shop.id,
        shop_name=shop.name,
        shop_slug=shop.slug,
        total_orders=len(orders),
        total_revenue=float(sum(float(o.total) for o in orders)),
        paid_revenue=float(
            sum(float(o.total) for o in orders if o.payment_status == PaymentStatus.paid)
        ),
        products_count=len(products),
        active_products=sum(1 for p in products if p.is_active),
        total_stock_units=total_stock,
        low_stock_count=low_stock,
    )


def build_shop_dashboard(db: Session, shop: Shop) -> dict:
    summary = build_shop_summary(db, shop)

    orders = db.scalars(
        select(Order)
        .options(joinedload(Order.items))
        .where(Order.shop_id == shop.id)
        .order_by(Order.id.desc())
    ).unique().all()

    orders_by_status: dict[str, int] = defaultdict(int)
    payment_by_status: dict[str, int] = defaultdict(int)
    for order in orders:
        orders_by_status[order.status.value] += 1
        payment_by_status[order.payment_status.value] += 1

    product_sales: dict[str, dict] = defaultdict(lambda: {"quantity": 0, "revenue": 0.0})
    for order in orders:
        for item in order.items:
            key = item.product_name
            product_sales[key]["quantity"] += item.quantity
            product_sales[key]["revenue"] += float(item.line_total)

    top_products = sorted(
        [{"product_name": name, **stats} for name, stats in product_sales.items()],
        key=lambda row: row["revenue"],
        reverse=True,
    )[:8]

    variants = db.scalars(
        select(ProductVariant)
        .options(joinedload(ProductVariant.product))
        .where(ProductVariant.shop_id == shop.id)
        .order_by(ProductVariant.stock.asc())
    ).unique().all()

    low_stock = [
        {
            "product_id": v.product_id,
            "product_name": v.product.name if v.product else "",
            "variant_name": v.name,
            "sku": v.sku,
            "stock": v.stock,
            "price": float(v.price),
        }
        for v in variants
        if (v.stock or 0) <= LOW_STOCK_THRESHOLD
    ][:20]

    recent_orders = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status.value,
            "payment_status": o.payment_status.value,
            "payment_provider": o.payment_provider.value,
            "total": float(o.total),
            "created_at": o.created_at,
            "items_count": len(o.items),
            "customer_name": (o.shipping_address or {}).get("name"),
            "customer_phone": (o.shipping_address or {}).get("phone"),
        }
        for o in orders[:10]
    ]

    return {
        "summary": summary,
        "orders_by_status": dict(orders_by_status),
        "payment_by_status": dict(payment_by_status),
        "top_products": top_products,
        "low_stock": low_stock,
        "recent_orders": recent_orders,
    }
