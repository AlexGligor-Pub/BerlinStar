from __future__ import annotations
from datetime import date, datetime, timezone
from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AnafSettings(Base):
    __tablename__ = "anaf_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    use_test_env: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    default_invoice_type: Mapped[str] = mapped_column(String(5), nullable=False, default="380")
    auto_upload: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auto_upload_delay_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    deadline_alert_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    validate_schematron: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AnafToken(Base):
    __tablename__ = "anaf_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    cui: Mapped[str] = mapped_column(String(20), nullable=False)
    access_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    token_type: Mapped[str] = mapped_column(String(50), nullable=False, default="Bearer")
    scope: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EFacturaRecord(Base):
    __tablename__ = "efactura_records"
    __table_args__ = (
        Index("ix_efactura_status", "status"),
        Index("ix_efactura_deadline", "deadline_transmit"),
        Index("ix_efactura_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    receipt_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True
    )
    cui: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False, default="sent")
    xml_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    xml_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    standard: Mapped[str] = mapped_column(String(10), nullable=False, default="UBL")
    invoice_type: Mapped[str] = mapped_column(String(10), nullable=False, default="380")
    index_incarcare: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    data_creare_anaf: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    anaf_stare: Mapped[str | None] = mapped_column(String(50), nullable=True)
    anaf_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    response_zip_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    response_seal_valid: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    upload_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invoice_issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    deadline_transmit: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EFacturaGlobalSettings(Base):
    """Singleton (id=1) — toate setarile globale eFactura mutate din .env in DB.

    fernet_key e auto-generat la primul GET daca lipseste. Daca se schimba sau se sterge,
    toate AnafToken-urile criptate cu cheia veche devin inutilizabile (re-conectare cu USB necesara).
    """
    __tablename__ = "efactura_global_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fernet_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    anaf_auth_url: Mapped[str] = mapped_column(
        String(500), nullable=False,
        default="https://logincert.anaf.ro/anaf-oauth2/v1/authorize",
    )
    anaf_token_url: Mapped[str] = mapped_column(
        String(500), nullable=False,
        default="https://logincert.anaf.ro/anaf-oauth2/v1/token",
    )
    anaf_api_base_prod: Mapped[str] = mapped_column(
        String(500), nullable=False,
        default="https://api.anaf.ro/prod/FCTEL/rest",
    )
    anaf_api_base_test: Mapped[str] = mapped_column(
        String(500), nullable=False,
        default="https://api.anaf.ro/test/FCTEL/rest",
    )
    default_redirect_uri: Mapped[str] = mapped_column(
        String(500), nullable=False,
        default="http://localhost:8000/api/efactura/callback",
    )
    frontend_callback_redirect: Mapped[str] = mapped_column(
        String(500), nullable=False,
        default="http://localhost:2000/efactura",
    )
    # OAuth ANAF credentials — globale pentru toata platforma BerlinStar.
    # BerlinStar se inregistreaza O DATA la https://www.anaf.ro/InregOauth si
    # toate companiile clientilor folosesc aceste credentiale.
    oauth_client_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    oauth_client_secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduler_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TaskRun(Base):
    """Istoricul rularii joburilor APScheduler eFactura.

    Folosit de AdminV2 -> Logs pentru a vedea ce a rulat, cand, cu ce status.
    """
    __tablename__ = "task_runs"
    __table_args__ = (
        Index("ix_task_runs_job_id", "job_id"),
        Index("ix_task_runs_started_at", "started_at"),
        Index("ix_task_runs_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    items_processed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    items_failed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    triggered_by: Mapped[str] = mapped_column(String(32), nullable=False, default="schedule")


class ScheduledJobOverride(Base):
    """Overrides salvate in DB pentru schedule-ul joburilor APScheduler.

    Daca exista un rand pentru un job_id, la pornirea scheduler-ului folosim
    cron_expression-ul din DB in loc de default-ul hardcoded in cod.
    """
    __tablename__ = "scheduled_job_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    cron_expression: Mapped[str | None] = mapped_column(String(128), nullable=True)
    trigger_type: Mapped[str] = mapped_column(String(16), nullable=False, default="cron")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class EFacturaReceivedIndex(Base):
    __tablename__ = "efactura_received_index"
    __table_args__ = (
        UniqueConstraint("company_id", "id_solicitare", name="ux_efactura_received_unique"),
        Index("ix_efactura_received_company", "company_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False)
    cui: Mapped[str] = mapped_column(String(20), nullable=False)
    id_solicitare: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tip: Mapped[str | None] = mapped_column(String(50), nullable=True)
    data_creare: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cif_emitent: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nume_emitent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cif_beneficiar: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nume_beneficiar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    detalii: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    downloaded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    response_zip_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
