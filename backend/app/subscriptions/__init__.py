"""Subscription module for BerlinStar — annual paid plan via Stripe.

Submodules:
- fx_service: EUR -> RON conversion from BNR.
- stripe_service: PaymentIntent creation, webhook handling.
- invoice_service: UBL XML + PDF + SPV upload pipeline.
- platform_anaf_oauth: OAuth flow for BerlinStar SRL (platform issuer).
- notifications: subscription status helpers for navbar banner / lock.
"""
