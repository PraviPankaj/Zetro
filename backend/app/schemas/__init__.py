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
    shop_mode: Optional[str] = None

    @field_validator("shop_mode")
    @classmethod
    def validate_shop_mode(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        if value not in {"billing", "commerce", "both"}:
            raise ValueError("shop_mode must be billing, commerce, or both")
        return value


class ShopSettingsUpdate(BaseModel):
    storefront_theme: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    owner_phone: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    homepage_blocks: Optional[list[dict[str, Any]]] = None
    gst_enabled: Optional[bool] = None
    # Default GST % (used by products without their own rate)
    gst_rate: Optional[float] = Field(default=None, ge=0, le=100)
    # All GST slabs available to products, e.g. [0, 5, 12, 18, 28]
    gst_rates: Optional[list[float]] = None

    @field_validator("gst_rates")
    @classmethod
    def normalize_gst_rates(cls, value: Optional[list[float]]) -> Optional[list[float]]:
        if value is None:
            return None
        cleaned: list[float] = []
        for raw in value:
            rate = round(float(raw), 2)
            if rate < 0 or rate > 100:
                raise ValueError("GST rates must be between 0 and 100")
            if rate not in cleaned:
                cleaned.append(rate)
        return sorted(cleaned)


class ShopOut(BaseModel):
    id: int
    name: str
    slug: str
    status: str
    owner_phone: str
    description: Optional[str]
    logo_url: Optional[str] = None
    storefront_theme: str = "playful"
    shop_mode: str = "both"
    gst_enabled: bool = False
    gst_rate: float = 18
    gst_rates: list[float] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("gst_rates", mode="before")
    @classmethod
    def normalize_out_gst_rates(cls, value: object) -> list[float]:
        if not isinstance(value, list):
            return []
        return [float(v) for v in value]

    @field_validator("storefront_theme", mode="before")
    @classmethod
    def normalize_storefront_theme(cls, value: object) -> str:
        if not value or not isinstance(value, str):
            return "playful"
        return value if value in {"playful", "classic", "fresh", "minimal"} else "playful"

    @field_validator("shop_mode", mode="before")
    @classmethod
    def normalize_shop_mode(cls, value: object) -> str:
        if value in {"billing", "commerce", "both"}:
            return str(value)
        return "both"


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


class FirebaseAuthRequest(BaseModel):
    id_token: str
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


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None


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
    barcode: Optional[str] = None
    # GST % for this product; None = shop default
    gst_rate: Optional[float] = Field(default=None, ge=0, le=100)
    category_id: Optional[int] = None
    category_ids: list[int] = Field(default_factory=list)
    variants: list[VariantIn] = Field(default_factory=list)
    # Off storefront until owner enables
    is_active: bool = False


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
    barcode: Optional[str] = None
    # Set to a rate to override, or explicitly null to fall back to the shop default
    gst_rate: Optional[float] = Field(default=None, ge=0, le=100)
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
    barcode: Optional[str] = None
    gst_rate: Optional[float] = None
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
    coupon_code: Optional[str] = None


class CouponCreate(BaseModel):
    code: str
    title: str
    discount_type: str
    discount_value: float = Field(gt=0)
    min_order_amount: float = 0
    max_uses: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True


class CouponUpdate(BaseModel):
    title: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = Field(default=None, gt=0)
    min_order_amount: Optional[float] = None
    max_uses: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class CouponOut(BaseModel):
    id: int
    code: str
    title: str
    discount_type: str
    discount_value: float
    min_order_amount: float
    max_uses: Optional[int]
    used_count: int
    starts_at: Optional[datetime]
    ends_at: Optional[datetime]
    is_active: bool

    model_config = {"from_attributes": True}


class CouponValidateRequest(BaseModel):
    code: str
    subtotal: float


class CouponValidateResponse(BaseModel):
    code: str
    discount_amount: float
    total: float


class CustomerAdminOut(BaseModel):
    id: int
    name: Optional[str]
    phone: str
    email: Optional[str] = None
    order_count: int = 0
    total_spent: float = 0
    created_at: datetime


class InventoryItemOut(BaseModel):
    variant_id: int
    product_id: int
    product_name: str
    sku: str
    stock: int
    price: float
    is_active: bool


class BulkStockUpdate(BaseModel):
    updates: list[dict[str, Any]]


class OrderOut(BaseModel):
    id: int
    order_number: str
    status: str
    payment_status: str
    payment_provider: str
    channel: str = "online"
    subtotal: float
    discount_amount: float = 0
    tax_amount: float = 0
    round_off: float = 0
    coupon_code: Optional[str] = None
    total: float
    shipping_address: dict[str, Any]
    created_at: datetime
    items: list[dict[str, Any]] = []

    model_config = {"from_attributes": True}


class BarcodeStockIn(BaseModel):
    barcode: str
    quantity: int = Field(ge=1, default=1)
    # Used when creating a new product for an unknown barcode
    name: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    sku: Optional[str] = None
    gst_rate: Optional[float] = Field(default=None, ge=0, le=100)


class BarcodeBatchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(ge=0)
    quantity: int = Field(ge=1, le=5000)
    # Reuse an existing product's barcode; blank = generate a new in-store code
    barcode: Optional[str] = None
    # Attach to a specific existing product (from search) instead of matching by name
    product_id: Optional[int] = None
    # GST % to store on the product; None keeps the product's current / shop default
    gst_rate: Optional[float] = Field(default=None, ge=0, le=100)


class BarcodeBatchUpdate(BaseModel):
    price: Optional[float] = Field(default=None, ge=0)
    quantity: Optional[int] = Field(default=None, ge=1, le=5000)


class BarcodeBatchOut(BaseModel):
    id: int
    product_id: int
    variant_id: int
    barcode: str
    product_name: str
    price: float
    quantity: int
    status: str
    stock_applied: int
    print_count: int
    current_stock: int
    current_price: float
    gst_rate: Optional[float] = None
    created_at: datetime
    printed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None


class ProductSearchOut(BaseModel):
    product_id: int
    variant_id: int
    name: str
    barcode: Optional[str] = None
    price: float
    stock: int
    is_active: bool
    gst_rate: Optional[float] = None


class PosBillItemIn(BaseModel):
    variant_id: int
    quantity: int = Field(ge=1)
    unit_price: Optional[float] = Field(default=None, ge=0)


class PosBillCreate(BaseModel):
    items: list[PosBillItemIn] = Field(min_length=1)
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    notes: Optional[str] = None
    # Override shop GST for this bill; None = use shop setting
    apply_gst: Optional[bool] = None


class PosBillPreview(BaseModel):
    subtotal: float
    tax_amount: float
    round_off: float
    total: float
    gst_enabled: bool
    # Shop default rate (kept for backward compatibility); per-line rates are in items
    gst_rate: float
    # Tax grouped by rate: [{"rate": 18, "taxable": 100.0, "tax": 18.0}, ...]
    tax_breakup: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []


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


class ShopDashboard(BaseModel):
    summary: PlatformReportSummary
    orders_by_status: dict[str, int]
    payment_by_status: dict[str, int]
    top_products: list[dict[str, Any]] = []
    low_stock: list[dict[str, Any]] = []
    recent_orders: list[dict[str, Any]] = []
