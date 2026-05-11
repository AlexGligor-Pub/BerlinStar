"""add_email_templates

Revision ID: zz4dd5ee6ff7
Revises: zz3cc4dd5ee6
Create Date: 2026-05-11 00:00:00.000000

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = 'zz4dd5ee6ff7'
down_revision = 'zz3cc4dd5ee6'
branch_labels = None
depends_on = None

_DEFAULT_TEMPLATES = [
    {
        "scenario": "client_nou",
        "subject": "Bun venit, {client_name}! — {company_name}",
        "title": "Bun venit la {company_name}",
        "body": (
            "<p>Stimate/Stimată <strong>{client_name}</strong>,</p>"
            "<p>Vă mulțumim că ați ales <strong>{company_name}</strong>! "
            "Suntem bucuroși să vă avem ca și client.</p>"
            "<p>Dacă aveți întrebări, nu ezitați să ne contactați.</p>"
            "<p>Cu stimă,<br><strong>{company_name}</strong></p>"
        ),
        "enabled": True,
    },
    {
        "scenario": "reminder_plata",
        "subject": "Reminder plată — Factură {factura_nr} — {company_name}",
        "title": "Reminder plată factură {factura_nr}",
        "body": (
            "<p>Stimate/Stimată <strong>{client_name}</strong>,</p>"
            "<p>Vă reamintim că factura <strong>nr. {factura_nr}</strong> "
            "în valoare de <strong>{amount} RON</strong> este scadentă. "
            "Vă rugăm să efectuați plata cât mai curând posibil.</p>"
            "<p>Cu stimă,<br><strong>{company_name}</strong></p>"
        ),
        "enabled": True,
    },
    {
        "scenario": "expirare",
        "subject": "Anvelopele dumneavoastră sunt pregătite — {company_name}",
        "title": "Notificare expirare hotel anvelope",
        "body": (
            "<p>Stimate/Stimată <strong>{client_name}</strong>,</p>"
            "<p>Vă informăm că perioada de depozitare a anvelopelor pentru autovehiculul "
            "<strong>{vehicle_plate}</strong> expiră pe <strong>{expiry_date}</strong>.</p>"
            "<p>Vă invităm să ne contactați pentru a ridica anvelopele sau a reînnoi contractul.</p>"
            "<p>Cu stimă,<br><strong>{company_name}</strong></p>"
        ),
        "enabled": True,
    },
]


def upgrade() -> None:
    op.create_table(
        "email_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("scenario", sa.String(50), nullable=False, unique=True),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="1"),
    )
    table = sa.table(
        "email_templates",
        sa.column("scenario", sa.String),
        sa.column("subject", sa.String),
        sa.column("title", sa.String),
        sa.column("body", sa.Text),
        sa.column("enabled", sa.Boolean),
    )
    op.bulk_insert(table, _DEFAULT_TEMPLATES)


def downgrade() -> None:
    op.drop_table("email_templates")
