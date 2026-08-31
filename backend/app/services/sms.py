from __future__ import annotations

import logging
from abc import ABC, abstractmethod

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class SMSProvider(ABC):
    @abstractmethod
    def send_otp(self, phone: str, otp: str) -> None:
        raise NotImplementedError


class ConsoleSMSProvider(SMSProvider):
    """Development provider — OTP is already logged by OTPService."""

    def send_otp(self, phone: str, otp: str) -> None:
        logger.info("SMS (console): OTP %s for %s", otp, phone)


class Fast2SMSSMSProvider(SMSProvider):
    """Fast2SMS — lowest cost OTP route in India (~₹0.10–0.18/SMS).

    Requires FAST2SMS_API_KEY. For production DLT, switch route to ``dlt`` and set
    FAST2SMS_SENDER_ID + FAST2SMS_DLT_TEMPLATE_ID.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.fast2sms_api_key
        self.route = settings.fast2sms_route
        self.sender_id = settings.fast2sms_sender_id
        self.dlt_template_id = settings.fast2sms_dlt_template_id

    def send_otp(self, phone: str, otp: str) -> None:
        if not self.api_key:
            raise RuntimeError("FAST2SMS_API_KEY is not configured")

        payload: dict[str, str] = {
            "route": self.route,
            "numbers": phone,
            "variables_values": otp,
        }
        if self.route == "dlt":
            if not self.sender_id or not self.dlt_template_id:
                raise RuntimeError(
                    "FAST2SMS_SENDER_ID and FAST2SMS_DLT_TEMPLATE_ID required for DLT route"
                )
            payload["sender_id"] = self.sender_id
            payload["message"] = self.dlt_template_id

        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                "https://www.fast2sms.com/dev/bulkV2",
                headers={"authorization": self.api_key},
                json=payload,
            )
            res.raise_for_status()
            data = res.json()
            if not data.get("return"):
                raise RuntimeError(data.get("message") or "Fast2SMS rejected the request")
        logger.info("Fast2SMS OTP sent to %s", phone[-4:].rjust(len(phone), "*"))


class MSG91SMSProvider(SMSProvider):
    """MSG91 — reliable DLT-compliant OTP (~₹0.15–0.25/SMS)."""

    def __init__(self) -> None:
        settings = get_settings()
        self.auth_key = settings.msg91_auth_key
        self.template_id = settings.msg91_otp_template_id

    def send_otp(self, phone: str, otp: str) -> None:
        if not self.auth_key or not self.template_id:
            raise RuntimeError("MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID are required")

        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                "https://control.msg91.com/api/v5/otp",
                params={
                    "mobile": f"91{phone}",
                    "otp": otp,
                    "otp_length": len(otp),
                    "template_id": self.template_id,
                },
                headers={"authkey": self.auth_key},
            )
            res.raise_for_status()
            data = res.json()
            if str(data.get("type", "")).lower() == "error":
                raise RuntimeError(data.get("message") or "MSG91 rejected the request")
        logger.info("MSG91 OTP sent to %s", phone[-4:].rjust(len(phone), "*"))


def get_sms_provider() -> SMSProvider:
    settings = get_settings()
    provider = settings.sms_provider.lower()
    if provider == "fast2sms":
        return Fast2SMSSMSProvider()
    if provider == "msg91":
        return MSG91SMSProvider()
    return ConsoleSMSProvider()


def send_otp_sms(phone: str, otp: str) -> None:
    get_sms_provider().send_otp(phone, otp)
