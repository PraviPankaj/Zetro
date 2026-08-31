from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.seed_demo_catalog import seed_demo_catalog_if_empty
from app.models import (
    PaymentGatewayConfig,
    PaymentProvider,
    Permission,
    PlatformUser,
    Role,
    RolePermission,
    Shop,
    ShopStatus,
    ShopUser,
    ShopUserRole,
    ShopSubscription,
    SubscriptionPlan,
    SubscriptionStatus,
    UserRole,
)


DEFAULT_PERMISSIONS = [
    ("shops.manage", "Create and manage shops"),
    ("users.manage", "Manage platform users and roles"),
    ("plans.manage", "Manage subscription plans"),
    ("shops.view", "View shops"),
]


def seed_database(db: Session) -> None:
    settings = get_settings()

    for code, desc in DEFAULT_PERMISSIONS:
        if not db.scalar(select(Permission).where(Permission.code == code)):
            db.add(Permission(code=code, description=desc))
    db.flush()

    admin_role = db.scalar(select(Role).where(Role.name == "superadmin"))
    if not admin_role:
        admin_role = Role(name="superadmin", description="Full platform access")
        db.add(admin_role)
        db.flush()
        perms = db.scalars(select(Permission)).all()
        for p in perms:
            db.add(RolePermission(role_id=admin_role.id, permission_id=p.id))

    admin = db.scalar(
        select(PlatformUser).where(PlatformUser.username == settings.platform_default_username)
    )
    if not admin:
        admin = PlatformUser(
            username=settings.platform_default_username,
            email="admin@zetro.local",
            password_hash=hash_password(settings.platform_default_password),
            must_change_password=True,
            is_active=True,
        )
        db.add(admin)
        db.flush()
        db.add(UserRole(user_id=admin.id, role_id=admin_role.id))

    plans = [
        {
            "code": "free_trial",
            "name": "Free Trial",
            "description": "Use Zetro free for 7 days",
            "price": 0,
            "duration_days": 7,
            "is_trial": True,
            "features": {"max_products": 50, "online_payments": False},
        },
        {
            "code": "pro",
            "name": "Pro Plan",
            "description": "Full features for growing shops",
            "price": 999,
            "duration_days": 30,
            "is_trial": False,
            "features": {"max_products": 5000, "online_payments": True},
        },
        {
            "code": "enterprise",
            "name": "Enterprise",
            "description": "Unlimited catalog and priority support",
            "price": 4999,
            "duration_days": 30,
            "is_trial": False,
            "features": {"max_products": -1, "online_payments": True},
        },
    ]
    for plan in plans:
        existing = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == plan["code"]))
        if not existing:
            db.add(SubscriptionPlan(**plan))

    demo = db.scalar(select(Shop).where(Shop.slug == "abc"))
    if not demo:
        demo = Shop(
            name="ABC Kids",
            slug="abc",
            owner_phone="9999999999",
            description="Clothes, toys, and little treasures for growing explorers.",
            status=ShopStatus.active,
            created_by_id=admin.id if admin else None,
        )
        db.add(demo)
        db.flush()
        db.add(
            ShopUser(
                shop_id=demo.id,
                phone="9999999999",
                name="ABC Owner",
                role=ShopUserRole.owner,
                permissions={"catalog": True, "orders": True, "payments": True},
            )
        )
        db.commit()
        ensure_cod_gateway(db, demo.id)
        ensure_demo_subscription(db, demo.id)
        seed_demo_catalog_if_empty(db, demo)
    else:
        ensure_cod_gateway(db, demo.id)
        ensure_demo_subscription(db, demo.id)
        seed_demo_catalog_if_empty(db, demo)
        db.commit()


def ensure_demo_subscription(db: Session, shop_id: int) -> None:
    active = db.scalar(
        select(ShopSubscription).where(
            ShopSubscription.shop_id == shop_id,
            ShopSubscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.trial]),
        )
    )
    if active:
        return
    plan = db.scalar(
        select(SubscriptionPlan).where(
            SubscriptionPlan.code == "free_trial",
            SubscriptionPlan.is_active.is_(True),
        )
    )
    if not plan:
        return
    starts, ends = subscription_window(plan.duration_days)
    db.add(
        ShopSubscription(
            shop_id=shop_id,
            plan_id=plan.id,
            status=SubscriptionStatus.trial,
            starts_at=starts,
            ends_at=ends,
        )
    )
    db.commit()


def ensure_cod_gateway(db: Session, shop_id: int) -> None:
    existing = db.scalar(
        select(PaymentGatewayConfig).where(
            PaymentGatewayConfig.shop_id == shop_id,
            PaymentGatewayConfig.provider == PaymentProvider.cod,
        )
    )
    if not existing:
        db.add(
            PaymentGatewayConfig(
                shop_id=shop_id,
                provider=PaymentProvider.cod,
                is_enabled=True,
                settings={},
            )
        )
        db.commit()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def subscription_window(days: int) -> tuple[datetime, datetime]:
    start = utcnow()
    return start, start + timedelta(days=days)
