from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_shop_by_slug, require_customer
from app.core.crypto import encrypt_dict
from app.core.security import create_access_token, create_refresh_token
from app.db.session import get_db
from app.models import (
    Cart,
    CartItem,
    Customer,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    Payment,
    PaymentGatewayConfig,
    PaymentProvider,
    PaymentStatus,
    Product,
    ProductVariant,
)
from app.schemas import (
    CartItemIn,
    CartOut,
    CheckoutRequest,
    CouponValidateRequest,
    CouponValidateResponse,
    CustomerOut,
    GatewayConfigIn,
    GatewayConfigOut,
    OTPRequest,
    OTPVerify,
    OrderOut,
    PaymentInitResponse,
    TokenResponse,
)
from app.api.deps import require_shop_user
from app.services.coupons import apply_coupon, validate_coupon
from app.services.otp import otp_service
from app.services.payments import get_provider

router = APIRouter(prefix="/shops/{slug}", tags=["storefront"])


@router.post("/customer/auth/otp/request")
def customer_otp_request(slug: str, body: OTPRequest, db: Session = Depends(get_db)):
    get_shop_by_slug(slug, db)
    try:
        return otp_service.request_otp("customer", slug, body.phone)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc


@router.post("/customer/auth/otp/verify", response_model=TokenResponse)
def customer_otp_verify(slug: str, body: OTPVerify, db: Session = Depends(get_db)):
    shop = get_shop_by_slug(slug, db)
    if not otp_service.verify_otp("customer", slug, body.phone, body.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    customer = db.scalar(
        select(Customer).where(Customer.shop_id == shop.id, Customer.phone == body.phone)
    )
    if not customer:
        customer = Customer(shop_id=shop.id, phone=body.phone, name=body.name)
        db.add(customer)
        db.commit()
        db.refresh(customer)
    elif body.name:
        customer.name = body.name
        db.commit()
    claims = {"kind": "customer", "shop_id": shop.id}
    return TokenResponse(
        access_token=create_access_token(str(customer.id), claims),
        refresh_token=create_refresh_token(str(customer.id), claims),
    )


@router.get("/customer/me", response_model=CustomerOut)
def customer_me(ctx=Depends(require_customer)):
    _, customer = ctx
    return customer


def _get_or_create_cart(db: Session, shop_id: int, customer_id: int) -> Cart:
    cart = db.scalar(
        select(Cart).where(Cart.shop_id == shop_id, Cart.customer_id == customer_id)
    )
    if not cart:
        cart = Cart(shop_id=shop_id, customer_id=customer_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def _cart_out(db: Session, cart: Cart) -> CartOut:
    items_out = []
    subtotal = 0.0
    cart = db.scalar(
        select(Cart)
        .options(
            joinedload(Cart.items)
            .joinedload(CartItem.variant)
            .joinedload(ProductVariant.product)
            .joinedload(Product.images)
        )
        .where(Cart.id == cart.id)
    )
    for item in cart.items:
        price = float(item.variant.price)
        line = price * item.quantity
        subtotal += line
        images = item.variant.product.images
        items_out.append(
            {
                "id": item.id,
                "variant_id": item.variant_id,
                "quantity": item.quantity,
                "product_name": item.variant.product.name,
                "variant_name": item.variant.name,
                "unit_price": price,
                "line_total": line,
                "image_url": images[0].url if images else None,
            }
        )
    return CartOut(id=cart.id, items=items_out, subtotal=subtotal)


@router.get("/cart", response_model=CartOut)
def get_cart(slug: str, db: Session = Depends(get_db), ctx=Depends(require_customer)):
    shop, customer = ctx
    cart = _get_or_create_cart(db, shop.id, customer.id)
    return _cart_out(db, cart)


@router.post("/cart/items", response_model=CartOut)
def add_cart_item(
    slug: str, body: CartItemIn, db: Session = Depends(get_db), ctx=Depends(require_customer)
):
    shop, customer = ctx
    variant = db.scalar(
        select(ProductVariant).where(
            ProductVariant.id == body.variant_id, ProductVariant.shop_id == shop.id
        )
    )
    if not variant or not variant.is_active:
        raise HTTPException(status_code=404, detail="Variant not found")
    if variant.stock < body.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    cart = _get_or_create_cart(db, shop.id, customer.id)
    existing = db.scalar(
        select(CartItem).where(CartItem.cart_id == cart.id, CartItem.variant_id == variant.id)
    )
    if existing:
        existing.quantity += body.quantity
    else:
        db.add(
            CartItem(
                shop_id=shop.id,
                cart_id=cart.id,
                variant_id=variant.id,
                quantity=body.quantity,
            )
        )
    db.commit()
    return _cart_out(db, cart)


@router.delete("/cart/items/{item_id}", response_model=CartOut)
def remove_cart_item(
    slug: str, item_id: int, db: Session = Depends(get_db), ctx=Depends(require_customer)
):
    shop, customer = ctx
    cart = _get_or_create_cart(db, shop.id, customer.id)
    item = db.scalar(
        select(CartItem).where(
            CartItem.id == item_id, CartItem.cart_id == cart.id, CartItem.shop_id == shop.id
        )
    )
    if item:
        db.delete(item)
        db.commit()
    return _cart_out(db, cart)


@router.post("/cart/validate-coupon", response_model=CouponValidateResponse)
def validate_cart_coupon(
    slug: str,
    body: CouponValidateRequest,
    db: Session = Depends(get_db),
    ctx=Depends(require_customer),
):
    shop, _ = ctx
    coupon, discount = validate_coupon(db, shop, body.code, body.subtotal)
    return CouponValidateResponse(
        code=coupon.code,
        discount_amount=discount,
        total=round(body.subtotal - discount, 2),
    )


@router.post("/checkout", response_model=OrderOut)
def checkout(
    slug: str, body: CheckoutRequest, db: Session = Depends(get_db), ctx=Depends(require_customer)
):
    shop, customer = ctx
    try:
        provider_enum = PaymentProvider(body.payment_provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid payment provider") from exc

    gateway = db.scalar(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.shop_id == shop.id,
            PaymentGatewayConfig.provider == provider_enum,
            PaymentGatewayConfig.is_enabled.is_(True),
        )
    )
    if not gateway and provider_enum != PaymentProvider.cod:
        raise HTTPException(status_code=400, detail="Payment provider not enabled for this shop")
    if provider_enum == PaymentProvider.cod and not gateway:
        # auto-allow COD
        pass

    cart = _get_or_create_cart(db, shop.id, customer.id)
    cart = db.scalar(
        select(Cart)
        .options(
            joinedload(Cart.items)
            .joinedload(CartItem.variant)
            .joinedload(ProductVariant.product)
        )
        .where(Cart.id == cart.id)
    )
    cart_data = _cart_out(db, cart)
    if not cart_data.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    discount_amount = 0.0
    coupon_code = None
    coupon_obj = None
    if body.coupon_code:
        coupon_obj, discount_amount = validate_coupon(db, shop, body.coupon_code, cart_data.subtotal)
        coupon_code = coupon_obj.code

    order_number = f"Z{shop.id}-{uuid.uuid4().hex[:8].upper()}"
    order = Order(
        shop_id=shop.id,
        customer_id=customer.id,
        order_number=order_number,
        status=OrderStatus.pending,
        payment_status=PaymentStatus.pending,
        payment_provider=provider_enum,
        subtotal=cart_data.subtotal,
        discount_amount=discount_amount,
        coupon_code=coupon_code,
        total=round(cart_data.subtotal - discount_amount, 2),
        shipping_address=body.shipping_address,
        notes=body.notes,
    )
    db.add(order)
    db.flush()

    if coupon_obj:
        apply_coupon(db, coupon_obj)

    for item in cart.items:
        variant = item.variant if item.variant else db.get(ProductVariant, item.variant_id)
        if variant.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {variant.sku}")
        variant.stock -= item.quantity
        db.add(
            OrderItem(
                shop_id=shop.id,
                order_id=order.id,
                variant_id=variant.id,
                product_name=variant.product.name if variant.product else "Product",
                variant_name=variant.name,
                unit_price=variant.price,
                quantity=item.quantity,
                line_total=float(variant.price) * item.quantity,
            )
        )

    db.add(
        OrderStatusHistory(
            shop_id=shop.id, order_id=order.id, status=OrderStatus.pending, note="Order placed"
        )
    )

    strategy = get_provider(provider_enum.value)
    status, client_payload, external_id = strategy.create_payment(order, gateway)
    payment = Payment(
        shop_id=shop.id,
        order_id=order.id,
        provider=provider_enum,
        external_id=external_id,
        amount=order.total,
        status=status,
        raw_payload={"client": client_payload},
    )
    db.add(payment)
    if provider_enum == PaymentProvider.cod:
        order.payment_status = PaymentStatus.pending
        order.status = OrderStatus.confirmed

    for item in list(cart.items):
        db.delete(item)
    db.commit()

    order = db.scalar(
        select(Order).options(joinedload(Order.items)).where(Order.id == order.id)
    )
    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        status=order.status.value,
        payment_status=order.payment_status.value,
        payment_provider=order.payment_provider.value,
        subtotal=float(order.subtotal),
        discount_amount=float(order.discount_amount or 0),
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


@router.get("/orders", response_model=list[OrderOut])
def my_orders(slug: str, db: Session = Depends(get_db), ctx=Depends(require_customer)):
    shop, customer = ctx
    orders = db.scalars(
        select(Order)
        .options(joinedload(Order.items))
        .where(Order.shop_id == shop.id, Order.customer_id == customer.id)
        .order_by(Order.id.desc())
    ).unique().all()
    return [
        OrderOut(
            id=o.id,
            order_number=o.order_number,
            status=o.status.value,
            payment_status=o.payment_status.value,
            payment_provider=o.payment_provider.value,
            subtotal=float(o.subtotal),
            discount_amount=float(o.discount_amount or 0),
            coupon_code=o.coupon_code,
            total=float(o.total),
            shipping_address=o.shipping_address or {},
            created_at=o.created_at,
            items=[
                {
                    "product_name": i.product_name,
                    "variant_name": i.variant_name,
                    "quantity": i.quantity,
                    "unit_price": float(i.unit_price),
                    "line_total": float(i.line_total),
                }
                for i in o.items
            ],
        )
        for o in orders
    ]


@router.get("/payments/methods", response_model=list[GatewayConfigOut])
def payment_methods(slug: str, db: Session = Depends(get_db)):
    shop = get_shop_by_slug(slug, db)
    configs = db.scalars(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.shop_id == shop.id,
            PaymentGatewayConfig.is_enabled.is_(True),
        )
    ).all()
    if not any(c.provider == PaymentProvider.cod for c in configs):
        return [
            GatewayConfigOut(
                id=0, provider="cod", is_enabled=True, settings={}, has_credentials=False
            )
        ] + [
            GatewayConfigOut(
                id=c.id,
                provider=c.provider.value,
                is_enabled=c.is_enabled,
                settings=c.settings or {},
                has_credentials=bool(c.credentials_encrypted),
            )
            for c in configs
        ]
    return [
        GatewayConfigOut(
            id=c.id,
            provider=c.provider.value,
            is_enabled=c.is_enabled,
            settings=c.settings or {},
            has_credentials=bool(c.credentials_encrypted),
        )
        for c in configs
    ]


@router.get("/admin/payments/gateways", response_model=list[GatewayConfigOut])
def list_gateways(slug: str, db: Session = Depends(get_db), ctx=Depends(require_shop_user)):
    shop, _ = ctx
    configs = db.scalars(
        select(PaymentGatewayConfig).where(PaymentGatewayConfig.shop_id == shop.id)
    ).all()
    return [
        GatewayConfigOut(
            id=c.id,
            provider=c.provider.value,
            is_enabled=c.is_enabled,
            settings=c.settings or {},
            has_credentials=bool(c.credentials_encrypted),
        )
        for c in configs
    ]


@router.put("/admin/payments/gateways", response_model=GatewayConfigOut)
def upsert_gateway(
    slug: str, body: GatewayConfigIn, db: Session = Depends(get_db), ctx=Depends(require_shop_user)
):
    shop, _ = ctx
    try:
        provider = PaymentProvider(body.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid provider") from exc
    config = db.scalar(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.shop_id == shop.id,
            PaymentGatewayConfig.provider == provider,
        )
    )
    encrypted = encrypt_dict(body.credentials) if body.credentials else None
    if not config:
        config = PaymentGatewayConfig(
            shop_id=shop.id,
            provider=provider,
            is_enabled=body.is_enabled,
            credentials_encrypted=encrypted,
            settings=body.settings,
        )
        db.add(config)
    else:
        config.is_enabled = body.is_enabled
        config.settings = body.settings
        if body.credentials:
            config.credentials_encrypted = encrypted
    db.commit()
    db.refresh(config)
    return GatewayConfigOut(
        id=config.id,
        provider=config.provider.value,
        is_enabled=config.is_enabled,
        settings=config.settings or {},
        has_credentials=bool(config.credentials_encrypted),
    )


@router.post("/payments/webhooks/{provider}")
async def payment_webhook(slug: str, provider: str, payload: dict, db: Session = Depends(get_db)):
    shop = get_shop_by_slug(slug, db)
    try:
        strategy = get_provider(provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    config = db.scalar(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.shop_id == shop.id,
            PaymentGatewayConfig.provider == PaymentProvider(provider),
        )
    )
    external_id, status = strategy.handle_webhook(payload, config)
    if not external_id:
        return {"ok": True, "matched": False}
    payment = db.scalar(
        select(Payment).where(Payment.shop_id == shop.id, Payment.external_id == external_id)
    )
    if not payment:
        return {"ok": True, "matched": False}
    payment.status = status
    payment.raw_payload = payload
    order = db.get(Order, payment.order_id)
    if order:
        order.payment_status = status
        if status == PaymentStatus.paid:
            order.status = OrderStatus.confirmed
    db.commit()
    return {"ok": True, "matched": True, "status": status.value}
