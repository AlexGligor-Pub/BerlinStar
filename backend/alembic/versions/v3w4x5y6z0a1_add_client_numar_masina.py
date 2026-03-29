"""add_client_numar_masina

Revision ID: v3w4x5y6z0a1
Revises: u2v3w4x5y6z0
Create Date: 2026-03-29

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v3w4x5y6z0a1'
down_revision: Union[str, None] = 'u2v3w4x5y6z0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clienti', sa.Column('numar_masina', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('clienti', 'numar_masina')
