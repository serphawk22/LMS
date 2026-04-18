from typing import Any

import stripe

from app.config import settings


stripe.api_key = settings.stripe_api_key or ""


class PaymentService:
    def create_stripe_payment_intent(self, amount: int, currency: str = "usd", metadata: dict[str, Any] | None = None):
        if not settings.stripe_api_key:
            raise ValueError("Stripe API key is not configured.")

        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            metadata=metadata or {},
        )
        return intent

    def create_razorpay_order(self, amount: int, currency: str, receipt: str):
        # Implement Razorpay order creation
        return {"status": "created", "amount": amount, "currency": currency, "receipt": receipt}
