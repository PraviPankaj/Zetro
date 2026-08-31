from __future__ import annotations

from datetime import timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.deps import bearer
from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, create_token, decode_token
from app.db.session import get_db
from app.schemas import OTPRequest, OTPVerify, RegisterShopResponse, RegistrationTokenResponse, ShopOut
from app.services.otp import otp_service
from app.services.shop_registration import (
    REGISTER_PURPOSE,
    REGISTER_SLUG,
    create_registered_shop,
    normalize_phone,
)

router = APIRouter(prefix="/register", tags=["shop-register"])


def require_registration_phone(
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
) -> str:
    if not creds:
        raise HTTPException(status_code=401, detail="Registration token required")
    try:
        payload = decode_token(creds.credentials)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid registration token") from exc
    if payload.get("kind") != "shop_register" or not payload.get("phone"):
        raise HTTPException(status_code=401, detail="Invalid registration token")
    return str(payload["phone"])


@router.post("/otp/request")
def register_otp_request(body: OTPRequest, db: Session = Depends(get_db)):
    del db
    try:
        phone = normalize_phone(body.phone)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        return otp_service.request_otp(REGISTER_PURPOSE, REGISTER_SLUG, phone)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc


@router.post("/otp/verify", response_model=RegistrationTokenResponse)
def register_otp_verify(body: OTPVerify, db: Session = Depends(get_db)):
    del db
    try:
        phone = normalize_phone(body.phone)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not otp_service.verify_otp(REGISTER_PURPOSE, REGISTER_SLUG, phone, body.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    settings = get_settings()
    token = create_token(
        phone,
        {"kind": "shop_register", "phone": phone},
        timedelta(minutes=settings.registration_token_expire_minutes),
    )
    return RegistrationTokenResponse(
        registration_token=token,
        expires_in=settings.registration_token_expire_minutes * 60,
        phone=phone,
    )


@router.post("/shop", response_model=RegisterShopResponse)
async def register_shop(
    name: str = Form(...),
    slug: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    phone: str = Depends(require_registration_phone),
    db: Session = Depends(get_db),
):
    shop, user = await create_registered_shop(db, phone, name, slug, logo)
    claims = {
        "kind": "shop_user",
        "shop_id": shop.id,
        "role": user.role.value,
        "permissions": list((user.permissions or {}).keys()),
    }
    return RegisterShopResponse(
        access_token=create_access_token(str(user.id), claims),
        refresh_token=create_refresh_token(str(user.id), claims),
        shop=ShopOut.model_validate(shop),
    )
