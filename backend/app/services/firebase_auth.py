"""Firebase Phone Auth — verify ID tokens issued by the client SDK."""

from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from typing import Any

from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_firebase_app = None


def normalize_phone(raw: str | None) -> str:
    """Normalize to digits; prefer last 10 for Indian mobiles."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    elif len(digits) > 10:
        digits = digits[-10:]
    return digits


def phone_lookup_candidates(raw: str | None) -> list[str]:
    """Possible DB phone forms for a Firebase / user-entered number."""
    digits = re.sub(r"\D", "", raw or "")
    candidates: list[str] = []
    if not digits:
        return candidates
    candidates.append(digits)
    last10 = digits[-10:] if len(digits) >= 10 else digits
    if last10 not in candidates:
        candidates.append(last10)
    with91 = f"91{last10}" if len(last10) == 10 else None
    if with91 and with91 not in candidates:
        candidates.append(with91)
    e164 = f"+{digits}" if not (raw or "").startswith("+") else (raw or "").strip()
    # also store form without plus used occasionally
    if e164.lstrip("+") not in candidates:
        candidates.append(e164.lstrip("+"))
    # unique preserve order
    seen: set[str] = set()
    out: list[str] = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def firebase_enabled() -> bool:
    settings = get_settings()
    return bool(settings.firebase_credentials_json or settings.firebase_credentials_path)


@lru_cache
def _init_firebase() -> Any:
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    settings = get_settings()
    if not firebase_enabled():
        raise RuntimeError("Firebase credentials are not configured")

    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app

    if settings.firebase_credentials_json.strip():
        info = json.loads(settings.firebase_credentials_json)
        cred = credentials.Certificate(info)
    else:
        cred = credentials.Certificate(settings.firebase_credentials_path)

    _firebase_app = firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin initialized")
    return _firebase_app


def verify_firebase_id_token(id_token: str) -> dict[str, Any]:
    """
    Verify a Firebase ID token from the client.
    Returns claims including phone_number (E.164).
    """
    token = (id_token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Missing Firebase ID token")

    try:
        _init_firebase()
        from firebase_admin import auth

        claims = auth.verify_id_token(token)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("Firebase token verify failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token") from exc

    phone = claims.get("phone_number") or claims.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Firebase token has no phone number")

    return {
        "uid": claims.get("uid"),
        "phone_number": phone,
        "phone": normalize_phone(phone),
        "claims": claims,
    }
