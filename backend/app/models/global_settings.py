from __future__ import annotations
from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class GlobalSettings(Base):
    __tablename__ = "global_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hotel_cazare_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hotel_scoatere_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hotel_montare_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Imagini per pozitie pentru modalul "Montare Roti" din POS (afisate langa fiecare roata).
    montare_stanga_fata_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_dreapta_fata_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_stanga_spate_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_dreapta_spate_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_rezerva_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    montare_nespecificat_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smtp_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(String(500), nullable=True)
    smtp_from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_from_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
    smtp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="0")

    # ── Abonament BerlinStar ───────────────────────────────────────────────
    # Pretul anual brut (TVA inclus), TVA-ul aplicabil si moneda in care
    # Stripe incaseaza efectiv (RON cu conversie EUR->RON la momentul platii).
    subscription_price_eur: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, server_default="700.00"
    )
    subscription_vat_percent: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, server_default="19.00"
    )
    subscription_currency_charge: Mapped[str] = mapped_column(
        String(3), nullable=False, server_default="RON"
    )
    subscription_invoice_series: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="BS-SUB"
    )
    subscription_next_invoice_number: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="1"
    )

    # Datele firmei emitente (BerlinStar SRL) — folosite la generarea facturii
    # pentru abonament catre clientii BerlinStar.
    issuer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    issuer_cui: Mapped[str | None] = mapped_column(String(20), nullable=True)
    issuer_reg_com: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issuer_legal_form: Mapped[str | None] = mapped_column(String(20), nullable=True)
    issuer_is_vat_payer: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="1"
    )
    issuer_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    issuer_street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    issuer_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issuer_county_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    issuer_postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    issuer_country_code: Mapped[str] = mapped_column(
        String(2), nullable=False, server_default="RO"
    )
    issuer_iban: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issuer_bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issuer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    issuer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Stripe (configurabil din AdminV2, nu .env) ─────────────────────────
    # publishable_key se serveste in clar la /api/subscription/config
    # (oricum e expusa in browser). secret_key + webhook_secret sunt criptate
    # cu Fernet-ul global din efactura_global_settings.
    stripe_publishable_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_secret_key_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    stripe_webhook_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    stripe_test_mode: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="1"
    )

    # ── ANAF emitent platforma (BerlinStar SRL) ────────────────────────────
    # Diferit de AnafSettings/AnafToken (acelea sunt per-company al clientilor).
    # Toggle test/prod, plus optiunea de a transmite efectiv in SPV.
    platform_anaf_use_test_env: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="1"
    )
    platform_anaf_auto_upload: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="1"
    )
