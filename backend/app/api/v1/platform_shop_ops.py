from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_platform_permission
from app.db.session import get_db
from app.models import (
    Order,
    PaymentStatus,
    PlatformUser,
    Product,
    ProductVariant,
    Shop,
)
from app.schemas import (
    CategoryCreate,
    CategoryOut,
    PlatformReportSummary,
    PlatformShopReport,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    ShopOut,
    ShopSettingsUpdate,
)
from app.services import catalog as catalog_service

router = APIRouter(prefix="/platform", tags=["platform-shop-ops"])

LOW_STOCK_THRESHOLD = 5


def _shop_or_404(db: Session, shop_id: int) -> Shop:
    shop = db.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _build_summary(db: Session, shop: Shop) -> PlatformReportSummary:
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


@router.get("/themes")
def platform_themes():
    return [
        {"id": theme, "name": theme.replace("-", " ").title()}
        for theme in catalog_service.STOREFRONT_THEMES
    ]


@router.get("/reports", response_model=list[PlatformReportSummary])
def all_shop_reports(
    _: PlatformUser = Depends(require_platform_permission("shops.view")),
    db: Session = Depends(get_db),
):
    shops = db.scalars(select(Shop).order_by(Shop.name)).all()
    return [_build_summary(db, shop) for shop in shops]


@router.get("/shops/{shop_id}/reports", response_model=PlatformShopReport)
def shop_report(
    shop_id: int,
    _: PlatformUser = Depends(require_platform_permission("shops.view")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    summary = _build_summary(db, shop)

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
            "total": float(o.total),
            "created_at": o.created_at,
            "items_count": len(o.items),
        }
        for o in orders[:10]
    ]

    return PlatformShopReport(
        shop=ShopOut.model_validate(shop),
        summary=summary,
        orders_by_status=dict(orders_by_status),
        payment_by_status=dict(payment_by_status),
        top_products=top_products,
        low_stock=low_stock,
        recent_orders=recent_orders,
    )


@router.get("/shops/{shop_id}/categories", response_model=list[CategoryOut])
def list_shop_categories(
    shop_id: int,
    _: PlatformUser = Depends(require_platform_permission("shops.view")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    return catalog_service.list_categories(db, shop.id)


@router.post("/shops/{shop_id}/categories", response_model=CategoryOut)
def create_shop_category(
    shop_id: int,
    body: CategoryCreate,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    return catalog_service.create_category(db, shop, body)


@router.get("/shops/{shop_id}/products", response_model=list[ProductOut])
def list_shop_products(
    shop_id: int,
    _: PlatformUser = Depends(require_platform_permission("shops.view")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    return catalog_service.list_products(db, shop.id)


@router.post("/shops/{shop_id}/products", response_model=ProductOut)
def create_shop_product(
    shop_id: int,
    body: ProductCreate,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    return catalog_service.create_product(db, shop, body)


@router.patch("/shops/{shop_id}/products/{product_id}", response_model=ProductOut)
def update_shop_product(
    shop_id: int,
    product_id: int,
    body: ProductUpdate,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    return catalog_service.update_product(db, shop, product_id, body)


@router.delete("/shops/{shop_id}/products/{product_id}")
def delete_shop_product(
    shop_id: int,
    product_id: int,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    catalog_service.delete_product(db, shop, product_id)
    return {"message": "deleted"}


@router.post("/shops/{shop_id}/products/{product_id}/images", response_model=ProductOut)
async def upload_shop_product_image(
    shop_id: int,
    product_id: int,
    file: UploadFile = File(...),
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    return await catalog_service.upload_product_image(db, shop, product_id, file)


@router.patch("/shops/{shop_id}/settings")
def update_shop_settings(
    shop_id: int,
    body: ShopSettingsUpdate,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    shop.storefront_theme = catalog_service.normalize_theme(body.storefront_theme)
    db.commit()
    db.refresh(shop)
    return {"message": "updated", "storefront_theme": shop.storefront_theme}
