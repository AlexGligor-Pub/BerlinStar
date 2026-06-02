"""extend leaves with legal request data + digital consents

Revision ID: leavedet_001
Revises: empdet_001
Create Date: 2026-06-01 00:10:00.000000

"""
from __future__ import annotations
from alembic import op


revision = "leavedet_001"
down_revision = "empdet_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS request_date DATE")
    op.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS details_snapshot JSONB")
    op.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS employee_consent BOOLEAN NOT NULL DEFAULT false")
    op.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS employee_consent_at TIMESTAMPTZ")
    op.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS approver_consent BOOLEAN NOT NULL DEFAULT false")
    op.execute("ALTER TABLE leaves ADD COLUMN IF NOT EXISTS approver_name_snapshot VARCHAR(200)")


def downgrade() -> None:
    op.execute("ALTER TABLE leaves DROP COLUMN IF EXISTS approver_name_snapshot")
    op.execute("ALTER TABLE leaves DROP COLUMN IF EXISTS approver_consent")
    op.execute("ALTER TABLE leaves DROP COLUMN IF EXISTS employee_consent_at")
    op.execute("ALTER TABLE leaves DROP COLUMN IF EXISTS employee_consent")
    op.execute("ALTER TABLE leaves DROP COLUMN IF EXISTS details_snapshot")
    op.execute("ALTER TABLE leaves DROP COLUMN IF EXISTS request_date")
