"""Pydantic schemas for the eFactura admin/user API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


# ---------- AnafSettings ----------

class AnafSettingsBase(BaseModel):
    use_test_env: bool = True
    payment_terms_days: int = Field(default=30, ge=0, le=365)
    default_invoice_type: Literal["380", "381", "386", "751"] = "380"
    auto_upload: bool = False
    auto_upload_delay_minutes: int = Field(default=60, ge=0, le=10080)
    deadline_alert_email: str | None = None
    validate_schematron: bool = False


class AnafSettingsOut(AnafSettingsBase):
    id: int
    company_id: int
    last_sync_at: datetime | None = None

    model_config = {"from_attributes": True}


class AnafSettingsUpdate(BaseModel):
    use_test_env: bool | None = None
    payment_terms_days: int | None = None
    default_invoice_type: Literal["380", "381", "386", "751"] | None = None
    auto_upload: bool | None = None
    auto_upload_delay_minutes: int | None = None
    deadline_alert_email: str | None = None
    validate_schematron: bool | None = None


# ---------- Token status ----------

class AnafTokenStatus(BaseModel):
    company_id: int
    connected: bool
    expires_at: datetime | None = None
    days_until_expiry: int | None = None
    state: Literal["disconnected", "connected", "expiring_soon", "expired"] = "disconnected"


# ---------- Company summary (for admin list) ----------

class CompanyEFacturaSummary(BaseModel):
    company_id: int
    account_id: int
    name: str
    cui: int
    is_vat_payer: bool | None = None
    settings: AnafSettingsOut | None = None
    token_status: AnafTokenStatus


# ---------- eFactura records ----------

class EFacturaRecordOut(BaseModel):
    id: int
    company_id: int
    receipt_id: int | None = None
    cui: str
    direction: str
    standard: str
    invoice_type: str
    index_incarcare: int | None = None
    status: str
    anaf_stare: str | None = None
    anaf_error_message: str | None = None
    download_id: int | None = None
    upload_attempts: int
    invoice_issue_date: date
    deadline_transmit: date
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------- Validation pre-upload ----------

class ValidationIssue(BaseModel):
    field: str
    message: str
    severity: Literal["error", "warning"] = "error"


class ValidationResult(BaseModel):
    receipt_id: int
    is_valid: bool
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []


# ---------- Audit mapping ----------

class MappingAuditEntry(BaseModel):
    receipt_id: int
    factura_serie: str | None = None
    factura_nr: int | None = None
    titlu: str | None = None
    issues: list[str] = []


# ---------- Global settings (mutate din .env in UI) ----------

class EFacturaGlobalSettingsOut(BaseModel):
    id: int
    fernet_key_set: bool  # nu expunem cheia in clar — doar prezenta
    fernet_key_preview: str | None = None  # primele 6 caractere pentru identificare
    anaf_auth_url: str
    anaf_token_url: str
    anaf_api_base_prod: str
    anaf_api_base_test: str
    default_redirect_uri: str
    frontend_callback_redirect: str
    scheduler_enabled: bool
    scheduler_running: bool = False
    oauth_client_id: str | None = None
    has_oauth_client_secret: bool = False
    updated_at: datetime | None = None


class EFacturaGlobalSettingsUpdate(BaseModel):
    fernet_key: str | None = None             # paste manual; sau "AUTO" pentru a regenera
    anaf_auth_url: str | None = None
    anaf_token_url: str | None = None
    anaf_api_base_prod: str | None = None
    anaf_api_base_test: str | None = None
    default_redirect_uri: str | None = None
    frontend_callback_redirect: str | None = None
    scheduler_enabled: bool | None = None
    oauth_client_id: str | None = None
    oauth_client_secret: str | None = None  # plain — server cripteaza


class TestCheck(BaseModel):
    name: str
    ok: bool
    detail: str


class GlobalTestResult(BaseModel):
    ok: bool
    checks: list[TestCheck]


# ---------- Received (SPV cache) ----------

class ReceivedRowOut(BaseModel):
    id: int
    id_solicitare: int
    tip: str | None = None
    data_creare: str | None = None
    cif_emitent: str | None = None
    nume_emitent: str | None = None
    cif_beneficiar: str | None = None
    nume_beneficiar: str | None = None
    detalii: str | None = None
    downloaded: bool
    is_read: bool
    read_at: datetime | None = None
    paid: bool = False
    paid_at: datetime | None = None
    response_zip_s3_key: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaginatedReceivedOut(BaseModel):
    items: list[ReceivedRowOut]
    total: int
    page: int
    page_size: int
    unread_count: int = 0


class PaginatedRecordsOut(BaseModel):
    items: list[EFacturaRecordOut]
    total: int
    page: int
    page_size: int


# ---------- Invoice details (parser UBL) ----------

class PartyInfoOut(BaseModel):
    name: str | None = None
    cui: str | None = None
    registration_id: str | None = None
    address_line: str | None = None
    city: str | None = None
    country_subentity: str | None = None
    country_code: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


class InvoiceLineOutSchema(BaseModel):
    line_id: str | None = None
    description: str | None = None
    quantity: str | None = None
    unit_code: str | None = None
    unit_price: str | None = None
    line_net: str | None = None
    vat_percent: str | None = None
    vat_category: str | None = None


class TaxSubtotalOutSchema(BaseModel):
    taxable_amount: str | None = None
    tax_amount: str | None = None
    percent: str | None = None
    category: str | None = None


class InvoiceDetailsOutSchema(BaseModel):
    doc_type: str
    invoice_number: str | None = None
    issue_date: str | None = None
    due_date: str | None = None
    currency: str | None = None
    invoice_type_code: str | None = None
    note: str | None = None
    supplier: PartyInfoOut
    customer: PartyInfoOut
    payment_iban: str | None = None
    payment_bank: str | None = None
    payment_terms: str | None = None
    lines: list[InvoiceLineOutSchema] = []
    tax_breakdown: list[TaxSubtotalOutSchema] = []
    total_without_vat: str | None = None
    total_vat: str | None = None
    total_with_vat: str | None = None
    payable_amount: str | None = None
    prepaid_amount: str | None = None


class MarkReadOut(BaseModel):
    ok: bool = True
    is_read: bool
    read_at: datetime | None = None


class MarkPaidIn(BaseModel):
    paid: bool = True


class MarkPaidOut(BaseModel):
    ok: bool = True
    paid: bool
    paid_at: datetime | None = None
