from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class PlatformLoginRequest(BaseModel):
    username: str
    password: str


class PlatformUserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role_ids: list[int] = Field(default_factory=list)


class PlatformUserOut(BaseModel):
    id: int
    username: str
    email: Optional[str]
    is_active: bool
    must_change_password: bool
    roles: list[str] = []

    model_config = {"from_attributes": True}


class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    permissions: list[str] = []

    model_config = {"from_attributes": True}


class PermissionOut(BaseModel):
    id: int
    code: str
    description: Optional[str]

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class ShopCreate(BaseModel):
    name: str
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    owner_phone: str
    description: Optional[str] = None


class ShopUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    owner_phone: Optional[str] = None
    description: Optional[str] = None
    storefront_theme: Optional[str] = None


class ShopSettingsUpdate(BaseModel):
    storefront_theme: str


class ShopOut(BaseModel):
    id: int
    name: str
    slug: str
    status: str
    owner_phone: str
    description: Optional[str]
    logo_url: Optional[str] = None
    storefront_theme: str = "playful"
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("storefront_theme", mode="before")
    @classmethod
    def normalize_storefront_theme(cls, value: object) -> str:
        if not value or not isinstance(value, str):
            return "playful"
        return value if value in {"playful", "classic", "fresh", "minimal"} else "playful"


class PlanOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    price: float
    duration_days: int
    is_trial: bool
    features: dict[str, Any]
    is_active: bool

    model_config = {"from_attributes": True}


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None


class RegistrationTokenResponse(BaseModel):
    registration_token: str
    expires_in: int
    phone: str


class RegisterShopResponse(TokenResponse):
    shop: ShopOut


class ActivatePlanRequest(BaseModel):
    plan_code: str


class SubscriptionOut(BaseModel):
    id: int
    plan: PlanOut
    status: str
    starts_at: datetime
    ends_at: datetime


class CategoryCreate(BaseModel):
    name: str
    slug: str
    parent_id: Optional[int] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    parent_id: Optional[int] = None
    is_active: bool

    model_config = {"from_attributes": True}


class CategoryBrief(BaseModel):
    id: int
    name: str
    slug: str
    parent_id: Optional[int] = None

    model_config = {"from_attributes": True}


class VariantIn(BaseModel):
    sku: str
    name: str = "Default"
    price: float
    compare_at_price: Optional[float] = None
    stock: int = 0


class ProductCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    category_ids: list[int] = Field(default_factory=list)
    variants: list[VariantIn] = Field(default_factory=list)
    is_active: bool = True


class VariantUpdate(BaseModel):
    id: Optional[int] = None
    sku: Optional[str] = None
    name: Optional[str] = None
    price: Optional[float] = None
    compare_at_price: Optional[float] = None
    stock: Optional[int] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    category_ids: Optional[list[int]] = None
    is_active: Optional[bool] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    variants: Optional[list[VariantUpdate]] = None


class ImageOut(BaseModel):
    id: int
    url: str
    sort_order: int
    alt_text: Optional[str]

    model_config = {"from_attributes": True}


class VariantOut(BaseModel):
    id: int
    sku: str
    name: str
    price: float
    compare_at_price: Optional[float]
    stock: int
    is_active: bool

    model_config = {"from_attributes": True}


class ProductOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    category_id: Optional[int]
    categories: list[CategoryBrief] = []
    is_active: bool
    images: list[ImageOut] = []
    variants: list[VariantOut] = []

    model_config = {"from_attributes": True}


class CartItemIn(BaseModel):
    variant_id: int
    quantity: int = Field(ge=1)


class CartItemOut(BaseModel):
    id: int
    variant_id: int
    quantity: int
    product_name: str
    variant_name: str
    unit_price: float
    line_total: float
    image_url: Optional[str] = None


class CartOut(BaseModel):
    id: int
    items: list[CartItemOut]
    subtotal: float


class CheckoutRequest(BaseModel):
    payment_provider: str = "cod"
    shipping_address: dict[str, Any]
    notes: Optional[str] = None


class OrderOut(BaseModel):
    id: int
    order_number: str
    status: str
    payment_status: str
    payment_provider: str
    subtotal: float
    total: float
    shipping_address: dict[str, Any]
    created_at: datetime
    items: list[dict[str, Any]] = []

    model_config = {"from_attributes": True}


class GatewayConfigIn(BaseModel):
    provider: str
    is_enabled: bool = True
    credentials: dict[str, Any] = Field(default_factory=dict)
    settings: dict[str, Any] = Field(default_factory=dict)


class GatewayConfigOut(BaseModel):
    id: int
    provider: str
    is_enabled: bool
    settings: dict[str, Any]
    has_credentials: bool

    model_config = {"from_attributes": True}


class PaymentInitResponse(BaseModel):
    provider: str
    payment_id: int
    status: str
    client_payload: dict[str, Any] = Field(default_factory=dict)


class CustomerOut(BaseModel):
    id: int
    name: Optional[str]
    phone: str

    model_config = {"from_attributes": True}


class PlatformReportSummary(BaseModel):
    shop_id: int
    shop_name: str
    shop_slug: str
    total_orders: int
    total_revenue: float
    paid_revenue: float
    products_count: int
    active_products: int
    total_stock_units: int
    low_stock_count: int


class PlatformShopReport(BaseModel):
    shop: ShopOut
    summary: PlatformReportSummary
    orders_by_status: dict[str, int]
    payment_by_status: dict[str, int]
    top_products: list[dict[str, Any]] = []
    low_stock: list[dict[str, Any]] = []
    recent_orders: list[dict[str, Any]] = []
