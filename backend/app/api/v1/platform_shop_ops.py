from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_platform_permission
from app.db.session import get_db
from app.models import PlatformUser, Shop
from app.schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    PlatformReportSummary,
    PlatformShopReport,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    ShopOut,
    ShopSettingsUpdate,
)
from app.services import catalog as catalog_service
from app.services.reports import build_shop_dashboard, build_shop_summary

router = APIRouter(prefix="/platform", tags=["platform-shop-ops"])

LOW_STOCK_THRESHOLD = 5


def _shop_or_404(db: Session, shop_id: int) -> Shop:
    shop = db.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def _build_summary(db: Session, shop: Shop) -> PlatformReportSummary:
    return build_shop_summary(db, shop)


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
    dashboard = build_shop_dashboard(db, shop)
    return PlatformShopReport(shop=ShopOut.model_validate(shop), **dashboard)


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


@router.patch("/shops/{shop_id}/categories/{category_id}", response_model=CategoryOut)
def update_shop_category(
    shop_id: int,
    category_id: int,
    body: CategoryUpdate,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    return catalog_service.update_category(db, shop, category_id, body)


@router.delete("/shops/{shop_id}/categories/{category_id}")
def delete_shop_category(
    shop_id: int,
    category_id: int,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    catalog_service.delete_category(db, shop, category_id)
    return {"message": "deleted"}


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


@router.delete("/shops/{shop_id}/products/{product_id}/images/{image_id}", response_model=ProductOut)
def delete_shop_product_image(
    shop_id: int,
    product_id: int,
    image_id: int,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    return catalog_service.delete_product_image(db, shop, product_id, image_id)


@router.patch("/shops/{shop_id}/settings")
def update_shop_settings(
    shop_id: int,
    body: ShopSettingsUpdate,
    _: PlatformUser = Depends(require_platform_permission("shops.manage")),
    db: Session = Depends(get_db),
):
    shop = _shop_or_404(db, shop_id)
    data = body.model_dump(exclude_unset=True)
    if "storefront_theme" in data and data["storefront_theme"]:
        shop.storefront_theme = catalog_service.normalize_theme(data["storefront_theme"])
    if "name" in data and data["name"]:
        shop.name = data["name"]
    if "description" in data:
        shop.description = data["description"]
    if "owner_phone" in data and data["owner_phone"]:
        shop.owner_phone = data["owner_phone"]
    db.commit()
    db.refresh(shop)
    return {
        "message": "updated",
        "name": shop.name,
        "description": shop.description,
        "owner_phone": shop.owner_phone,
        "storefront_theme": shop.storefront_theme,
    }
