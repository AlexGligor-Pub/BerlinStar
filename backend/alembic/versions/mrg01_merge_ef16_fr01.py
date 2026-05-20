"""merge ef16recvpaid + fr01_source

Revision ID: mrg01_ef16_fr01
Revises: ef16recvpaid, fr01_source
Create Date: 2026-05-20 09:00:00.000000

"""
from __future__ import annotations


revision = "mrg01_ef16_fr01"
down_revision = ("ef16recvpaid", "fr01_source")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
