from __future__ import annotations

import logging
from typing import Optional

from app.core.config import get_settings
from app.core.crypto import generate_otp
from app.services.sms import send_otp_sms

logger = logging.getLogger(__name__)

_memory_store: dict[str, tuple[str, int]] = {}


class OTPService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._redis = None
        self._use_memory = self.settings.use_memory_otp
        if not self._use_memory:
            try:
                import redis

                client = redis.from_url(self.settings.redis_url, decode_responses=True)
                client.ping()
                self._redis = client
            except Exception as exc:  # noqa: BLE001
                logger.warning("Redis unavailable (%s); using in-memory OTP store", exc)
                self._use_memory = True

    def _key(self, purpose: str, shop_slug: str, phone: str) -> str:
        return f"otp:{purpose}:{shop_slug}:{phone}"

    def _rate_key(self, purpose: str, shop_slug: str, phone: str) -> str:
        return f"otp_rate:{purpose}:{shop_slug}:{phone}"

    def request_otp(self, purpose: str, shop_slug: str, phone: str) -> dict:
        key = self._key(purpose, shop_slug, phone)
        rate_key = self._rate_key(purpose, shop_slug, phone)
        otp = generate_otp(self.settings.otp_length)

        if self._redis and not self._use_memory:
            count = self._redis.incr(rate_key)
            if count == 1:
                self._redis.expire(rate_key, 3600)
            if count > self.settings.otp_rate_limit_per_hour:
                raise ValueError("OTP rate limit exceeded. Try again later.")
            self._redis.setex(key, self.settings.otp_ttl_seconds, otp)
        else:
            import time

            now = int(time.time())
            _memory_store[key] = (otp, now + self.settings.otp_ttl_seconds)
            rate = _memory_store.get(rate_key, ("0", now + 3600))
            count = int(rate[0]) + 1
            if count > self.settings.otp_rate_limit_per_hour and rate[1] > now:
                raise ValueError("OTP rate limit exceeded. Try again later.")
            _memory_store[rate_key] = (str(count), rate[1] if rate[1] > now else now + 3600)

        logger.info("OTP for %s/%s/%s = %s", purpose, shop_slug, phone, otp)
        if self.settings.sms_provider != "console":
            try:
                send_otp_sms(phone, otp)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Failed to send OTP SMS")
                raise ValueError("Could not send OTP. Try again later.") from exc

        result = {"message": "OTP sent", "expires_in": self.settings.otp_ttl_seconds}
        if (
            self.settings.sms_provider == "console"
            or self.settings.environment == "development"
            or self.settings.debug
        ):
            result["dev_otp"] = otp
        return result

    def verify_otp(self, purpose: str, shop_slug: str, phone: str, otp: str) -> bool:
        key = self._key(purpose, shop_slug, phone)
        if self._redis and not self._use_memory:
            stored = self._redis.get(key)
            if stored and stored == otp:
                self._redis.delete(key)
                return True
            return False

        import time

        entry = _memory_store.get(key)
        if not entry:
            return False
        stored, expires = entry
        if expires < int(time.time()):
            _memory_store.pop(key, None)
            return False
        if stored == otp:
            _memory_store.pop(key, None)
            return True
        return False


otp_service = OTPService()
