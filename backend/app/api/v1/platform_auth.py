from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_platform, require_platform_permission
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models import Permission, PlatformUser, Role, RolePermission, UserRole
from app.schemas import (
    ChangePasswordRequest,
    PermissionOut,
    PlatformLoginRequest,
    PlatformUserCreate,
    PlatformUserOut,
    RoleOut,
    TokenResponse,
)

router = APIRouter(prefix="/platform", tags=["platform"])


def _user_permissions(user: PlatformUser) -> list[str]:
    perms: set[str] = set()
    for ur in user.roles:
        for rp in ur.role.permissions:
            perms.add(rp.permission.code)
    return sorted(perms)


def _user_out(user: PlatformUser) -> PlatformUserOut:
    return PlatformUserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        roles=[ur.role.name for ur in user.roles],
    )


@router.post("/auth/login", response_model=TokenResponse)
def platform_login(body: PlatformLoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(
        select(PlatformUser)
        .options(
            joinedload(PlatformUser.roles)
            .joinedload(UserRole.role)
            .joinedload(Role.permissions)
            .joinedload(RolePermission.permission)
        )
        .where(PlatformUser.username == body.username)
    )
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User inactive")

    perms = _user_permissions(user)
    role = user.roles[0].role.name if user.roles else None
    claims = {"kind": "platform", "permissions": perms, "role": role}
    return TokenResponse(
        access_token=create_access_token(str(user.id), claims),
        refresh_token=create_refresh_token(str(user.id), claims),
        must_change_password=user.must_change_password,
    )


@router.get("/auth/me", response_model=PlatformUserOut)
def platform_me(
    user: PlatformUser = Depends(require_platform),
    db: Session = Depends(get_db),
):
    db_user = db.scalar(
        select(PlatformUser)
        .options(joinedload(PlatformUser.roles).joinedload(UserRole.role))
        .where(PlatformUser.id == user.id)
    )
    return _user_out(db_user or user)


@router.post("/auth/change-password")
def change_password(
    body: ChangePasswordRequest,
    user: PlatformUser = Depends(require_platform),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    db.commit()
    return {"message": "Password updated"}


@router.get("/users", response_model=list[PlatformUserOut])
def list_users(
    _: PlatformUser = Depends(require_platform_permission("users.manage")),
    db: Session = Depends(get_db),
):
    users = db.scalars(
        select(PlatformUser).options(joinedload(PlatformUser.roles).joinedload(UserRole.role))
    ).unique().all()
    return [_user_out(u) for u in users]


@router.post("/users", response_model=PlatformUserOut)
def create_user(
    body: PlatformUserCreate,
    _: PlatformUser = Depends(require_platform_permission("users.manage")),
    db: Session = Depends(get_db),
):
    if db.scalar(select(PlatformUser).where(PlatformUser.username == body.username)):
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.scalar(select(PlatformUser).where(PlatformUser.email == body.email)):
        raise HTTPException(status_code=400, detail="Email already exists")
    user = PlatformUser(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        must_change_password=True,
    )
    db.add(user)
    db.flush()
    for role_id in body.role_ids:
        if db.get(Role, role_id):
            db.add(UserRole(user_id=user.id, role_id=role_id))
    db.commit()
    db.refresh(user)
    user = db.scalar(
        select(PlatformUser)
        .options(joinedload(PlatformUser.roles).joinedload(UserRole.role))
        .where(PlatformUser.id == user.id)
    )
    return _user_out(user)


@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    _: PlatformUser = Depends(require_platform),
    db: Session = Depends(get_db),
):
    roles = db.scalars(
        select(Role).options(
            joinedload(Role.permissions).joinedload(RolePermission.permission)
        )
    ).unique().all()
    return [
        RoleOut(
            id=r.id,
            name=r.name,
            description=r.description,
            permissions=[rp.permission.code for rp in r.permissions],
        )
        for r in roles
    ]


@router.get("/permissions", response_model=list[PermissionOut])
def list_permissions(
    _: PlatformUser = Depends(require_platform),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Permission)).all()
