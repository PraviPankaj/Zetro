from fastapi import APIRouter

from app.api.v1 import catalog, platform_auth, platform_shop_ops, platform_shops, shop_auth, shop_register, storefront

api_router = APIRouter()
api_router.include_router(platform_auth.router)
api_router.include_router(platform_shops.router)
api_router.include_router(platform_shop_ops.router)
api_router.include_router(shop_register.router)
api_router.include_router(shop_auth.router)
api_router.include_router(catalog.router)
api_router.include_router(storefront.router)
