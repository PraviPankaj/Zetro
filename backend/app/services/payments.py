from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.orm import Session

from app.core.crypto import decrypt_dict
from app.models import Order, Payment, PaymentGatewayConfig, PaymentProvider, PaymentStatus


class PaymentProviderStrategy(ABC):
    provider: PaymentProvider

    @abstractmethod
    def create_payment(
        self, order: Order, config: PaymentGatewayConfig | None
    ) -> tuple[PaymentStatus, dict[str, Any], str | None]:
        """Returns status, client_payload, external_id."""

    def handle_webhook(
        self, payload: dict[str, Any], config: PaymentGatewayConfig | None
    ) -> tuple[str | None, PaymentStatus]:
        return None, PaymentStatus.pending


class CODProvider(PaymentProviderStrategy):
    provider = PaymentProvider.cod

    def create_payment(
        self, order: Order, config: PaymentGatewayConfig | None
    ) -> tuple[PaymentStatus, dict[str, Any], str | None]:
        return PaymentStatus.pending, {"message": "Pay cash on delivery"}, f"cod-{order.order_number}"


class RazorpayProvider(PaymentProviderStrategy):
    provider = PaymentProvider.razorpay

    def create_payment(
        self, order: Order, config: PaymentGatewayConfig | None
    ) -> tuple[PaymentStatus, dict[str, Any], str | None]:
        creds = decrypt_dict(config.credentials_encrypted) if config and config.credentials_encrypted else {}
        key_id = creds.get("key_id", "rzp_test_placeholder")
        external_id = f"order_rzp_{order.order_number}"
        return (
            PaymentStatus.pending,
            {
                "key_id": key_id,
                "amount": int(float(order.total) * 100),
                "currency": "INR",
                "order_id": external_id,
                "name": "Zetro Shop",
            },
            external_id,
        )

    def handle_webhook(
        self, payload: dict[str, Any], config: PaymentGatewayConfig | None
    ) -> tuple[str | None, PaymentStatus]:
        external_id = payload.get("payload", {}).get("payment", {}).get("entity", {}).get(
            "order_id"
        ) or payload.get("order_id")
        event = payload.get("event", "")
        if event in ("payment.captured", "order.paid") or payload.get("status") == "paid":
            return external_id, PaymentStatus.paid
        if event in ("payment.failed",) or payload.get("status") == "failed":
            return external_id, PaymentStatus.failed
        return external_id, PaymentStatus.pending


class CashfreeProvider(PaymentProviderStrategy):
    provider = PaymentProvider.cashfree

    def create_payment(
        self, order: Order, config: PaymentGatewayConfig | None
    ) -> tuple[PaymentStatus, dict[str, Any], str | None]:
        creds = decrypt_dict(config.credentials_encrypted) if config and config.credentials_encrypted else {}
        external_id = f"cf_{order.order_number}"
        return (
            PaymentStatus.pending,
            {
                "app_id": creds.get("app_id", "cf_test_placeholder"),
                "order_id": external_id,
                "order_amount": float(order.total),
                "order_currency": "INR",
                "payment_session_id": f"session_{external_id}",
            },
            external_id,
        )

    def handle_webhook(
        self, payload: dict[str, Any], config: PaymentGatewayConfig | None
    ) -> tuple[str | None, PaymentStatus]:
        data = payload.get("data", payload)
        external_id = data.get("order", {}).get("order_id") or data.get("order_id")
        status = (data.get("payment", {}) or {}).get("payment_status") or data.get("order_status")
        if status in ("SUCCESS", "PAID", "paid"):
            return external_id, PaymentStatus.paid
        if status in ("FAILED", "failed"):
            return external_id, PaymentStatus.failed
        return external_id, PaymentStatus.pending


PROVIDERS: dict[PaymentProvider, PaymentProviderStrategy] = {
    PaymentProvider.cod: CODProvider(),
    PaymentProvider.razorpay: RazorpayProvider(),
    PaymentProvider.cashfree: CashfreeProvider(),
}


def get_provider(name: str) -> PaymentProviderStrategy:
    try:
        enum_val = PaymentProvider(name)
    except ValueError as exc:
        raise ValueError(f"Unsupported payment provider: {name}") from exc
    return PROVIDERS[enum_val]
