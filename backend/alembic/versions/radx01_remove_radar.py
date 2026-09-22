"""elimina Radar AI

Revision ID: radx01remove
Revises: rad01radar
Create Date: 2026-09-22 20:00:00.000000

Radar AI a fost scos din aplicatie (serviciul, containerele, paginile, AdminV2).
Pleaca si datele lui: schema `radar` (tabelele serviciului), comutatorul
`global_settings.radar_enabled` si cheile/tarifele AI din `global_settings`,
folosite doar de Radar.

Downgrade-ul pune la loc doar coloanele, goale: cheile AI si istoricul Radar se
recupereaza numai din backup-ul facut inainte de update.
"""
from alembic import op
import sqlalchemy as sa


revision = "radx01remove"
down_revision = "rad01radar"
branch_labels = None
depends_on = None

_AI_COLUMNS = (
    "anthropic_api_key_enc",
    "google_places_api_key_enc",
    "ai_model",
    "ai_price_in_usd_mtok",
    "ai_price_out_usd_mtok",
)

# O baza de dev veche le avea in `public`, inainte sa se mute in schema `radar`.
_LEGACY_PUBLIC_TABLES = (
    "radar_discoveries",
    "radar_jobs",
    "radar_snapshots",
    "radar_settings",
    "radar_sources",
    "radar_worker_heartbeat",
    "radar_runs",
)


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        # Un container radar vechi, ramas pornit, tine blocari pe tabelele lui:
        # fara limita, backend-ul ar astepta la nesfarsit la pornire. Cu ea,
        # migrarea cade vizibil, se opresc containerele radar si se reia.
        op.execute("SET LOCAL lock_timeout = '30s'")
        op.execute("DROP SCHEMA IF EXISTS radar CASCADE")
        for table in _LEGACY_PUBLIC_TABLES:
            op.execute(f"DROP TABLE IF EXISTS public.{table} CASCADE")
    op.drop_column("global_settings", "radar_enabled")
    for column in _AI_COLUMNS:
        op.drop_column("global_settings", column)


def downgrade() -> None:
    op.add_column("global_settings", sa.Column("anthropic_api_key_enc", sa.Text(), nullable=True))
    op.add_column("global_settings", sa.Column("google_places_api_key_enc", sa.Text(), nullable=True))
    op.add_column("global_settings", sa.Column("ai_model", sa.String(80), nullable=True))
    op.add_column("global_settings", sa.Column("ai_price_in_usd_mtok", sa.Numeric(10, 4), nullable=True))
    op.add_column("global_settings", sa.Column("ai_price_out_usd_mtok", sa.Numeric(10, 4), nullable=True))
    op.add_column(
        "global_settings",
        sa.Column("radar_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
