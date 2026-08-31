from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.security import decode_token
from app.db.session import get_db
from app.models import Customer, PlatformUser, Shop, ShopUser, UserRole

bearer = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    kind: str  # platform | shop_user | customer
    user_id: int
    shop_id: Optional[int] = None
    permissions: list[str] | None = None
    role: Optional[str] = None


def get_current_auth(
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> AuthContext:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(creds.credentials)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    kind = payload.get("kind")
    sub = payload.get("sub")
    if not kind or not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    return AuthContext(
        kind=kind,
        user_id=int(sub),
        shop_id=payload.get("shop_id"),
        permissions=payload.get("permissions") or [],
        role=payload.get("role"),
    )


def require_platform(
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[Session, Depends(get_db)],
) -> PlatformUser:
    if auth.kind != "platform":
        raise HTTPException(status_code=403, detail="Platform access required")
    user = db.get(PlatformUser, auth.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive")
    return user


def require_platform_permission(code: str):
    def _dep(
        auth: Annotated[AuthContext, Depends(get_current_auth)],
        user: Annotated[PlatformUser, Depends(require_platform)],
        db: Annotated[Session, Depends(get_db)],
    ) -> PlatformUser:
        if auth.permissions and code in auth.permissions:
            return user
        # reload permissions
        from app.models import Role, RolePermission

        db_user = db.scalar(
            select(PlatformUser)
            .options(
                joinedload(PlatformUser.roles)
                .joinedload(UserRole.role)
                .joinedload(Role.permissions)
                .joinedload(RolePermission.permission)
            )
            .where(PlatformUser.id == user.id)
        )
        perms: set[str] = set()
        role_names: list[str] = []
        if db_user:
            for ur in db_user.roles:
                role_names.append(ur.role.name)
                for rp in ur.role.permissions:
                    perms.add(rp.permission.code)
        if "superadmin" in role_names or code in perms:
            return user
        raise HTTPException(status_code=403, detail=f"Missing permission: {code}")

    return _dep


def get_shop_by_slug(slug: str, db: Session) -> Shop:
    shop = db.scalar(select(Shop).where(Shop.slug == slug))
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def require_shop_user(
    slug: str,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[Session, Depends(get_db)],
) -> tuple[Shop, ShopUser]:
    shop = get_shop_by_slug(slug, db)
    if auth.kind != "shop_user" or auth.shop_id != shop.id:
        raise HTTPException(status_code=403, detail="Shop admin access required")
    user = db.get(ShopUser, auth.user_id)
    if not user or not user.is_active or user.shop_id != shop.id:
        raise HTTPException(status_code=401, detail="Shop user inactive")
    return shop, user


def require_customer(
    slug: str,
    auth: Annotated[AuthContext, Depends(get_current_auth)],
    db: Annotated[Session, Depends(get_db)],
) -> tuple[Shop, Customer]:
    shop = get_shop_by_slug(slug, db)
    if auth.kind != "customer" or auth.shop_id != shop.id:
        raise HTTPException(status_code=403, detail="Customer access required")
    customer = db.get(Customer, auth.user_id)
    if not customer or customer.shop_id != shop.id:
        raise HTTPException(status_code=401, detail="Customer not found")
    return shop, customer
