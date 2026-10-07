"""programari online: configurare per locatie, program, servicii, chei API

Revision ID: onl01online
Revises: radx01remove
Create Date: 2026-09-26 21:00:00.000000

Tabele noi: booking_settings, booking_hours, booking_services, public_api_keys.
Pe `programari`: sursa programarii (intern/web/mcp), codul public dat
clientului, datele de contact si masina, IP-ul (doar pentru web).
Programarile existente primesc `source = 'intern'`.
"""
from alembic import op
import sqlalchemy as sa


revision = "onl01online"
down_revision = "radx01remove"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "booking_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", name="fk_booking_settings_account_id_accounts"), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="CASCADE", name="fk_booking_settings_location_id_locations"), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("site_name", sa.String(120), nullable=False, server_default="Vulcanizare Alex"),
        sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id", ondelete="SET NULL", name="fk_booking_settings_department_id_departments"), nullable=True),
        sa.Column("slot_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("lead_minutes", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("horizon_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("cancel_cutoff_minutes", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("closed_on_holidays", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_booking_settings"),
        sa.UniqueConstraint("account_id", "location_id", name="uq_booking_settings_account_id"),
    )
    op.create_table(
        "booking_hours",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("booking_settings_id", sa.Integer(), sa.ForeignKey("booking_settings.id", ondelete="CASCADE", name="fk_booking_hours_booking_settings_id_booking_settings"), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("open_time", sa.Time(), nullable=False),
        sa.Column("close_time", sa.Time(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_booking_hours"),
    )
    op.create_index("ix_booking_hours_booking_settings_id", "booking_hours", ["booking_settings_id"])
    op.create_table(
        "booking_services",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("booking_settings_id", sa.Integer(), sa.ForeignKey("booking_settings.id", ondelete="CASCADE", name="fk_booking_services_booking_settings_id_booking_settings"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id", name="pk_booking_services"),
    )
    op.create_index("ix_booking_services_booking_settings_id", "booking_services", ["booking_settings_id"])
    op.create_table(
        "public_api_keys",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("accounts.id", name="fk_public_api_keys_account_id_accounts"), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="CASCADE", name="fk_public_api_keys_location_id_locations"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("prefix", sa.String(16), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_public_api_keys"),
        sa.UniqueConstraint("key_hash", name="uq_public_api_keys_key_hash"),
    )
    op.create_index("ix_public_api_keys_account_id", "public_api_keys", ["account_id"])

    op.add_column("programari", sa.Column("source", sa.String(10), nullable=False, server_default="intern"))
    op.add_column("programari", sa.Column("public_ref", sa.String(12), nullable=True))
    op.add_column("programari", sa.Column("contact_nume", sa.String(100), nullable=True))
    op.add_column("programari", sa.Column("contact_telefon", sa.String(50), nullable=True))
    op.add_column("programari", sa.Column("telefon_normalizat", sa.String(20), nullable=True))
    op.add_column("programari", sa.Column("vehicul_marca", sa.String(60), nullable=True))
    op.add_column("programari", sa.Column("vehicul_model", sa.String(60), nullable=True))
    op.add_column("programari", sa.Column("vehicul_an", sa.SmallInteger(), nullable=True))
    op.add_column("programari", sa.Column("client_ip", sa.String(45), nullable=True))
    op.add_column("programari", sa.Column("booking_service_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_programari_booking_service_id_booking_services", "programari", "booking_services",
        ["booking_service_id"], ["id"], ondelete="SET NULL",
    )
    op.create_unique_constraint("uq_programari_account_id", "programari", ["account_id", "public_ref"])
    op.create_index(
        "ix_programari_account_id_telefon_normalizat", "programari", ["account_id", "telefon_normalizat"],
    )


def downgrade() -> None:
    op.drop_index("ix_programari_account_id_telefon_normalizat", table_name="programari")
    op.drop_constraint("uq_programari_account_id", "programari", type_="unique")
    op.drop_constraint("fk_programari_booking_service_id_booking_services", "programari", type_="foreignkey")
    for col in (
        "booking_service_id", "client_ip", "vehicul_an", "vehicul_model", "vehicul_marca",
        "telefon_normalizat", "contact_telefon", "contact_nume", "public_ref", "source",
    ):
        op.drop_column("programari", col)
    op.drop_index("ix_public_api_keys_account_id", table_name="public_api_keys")
    op.drop_table("public_api_keys")
    op.drop_index("ix_booking_services_booking_settings_id", table_name="booking_services")
    op.drop_table("booking_services")
    op.drop_index("ix_booking_hours_booking_settings_id", table_name="booking_hours")
    op.drop_table("booking_hours")
    op.drop_table("booking_settings")
