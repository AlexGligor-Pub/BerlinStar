"""importuri: ce a creat fiecare sesiune/rand + revert

Revision ID: imp03revert
Revises: imp02async
Create Date: 2026-09-15 21:00:00.000000

Un import se poate anula (revert): stergem ce a creat, dar pastram ce a fost
folosit sau modificat intre timp. Pentru asta retinem explicit ce a creat
fiecare rand (`import_rows.created`: client nou, cazare, anvelope, masini in
garaj) si sesiunea (`import_sessions.created`: locuri de cazare, profiluri,
coduri DOT, dimensiuni noi). Sesiunile existente nu au aceste date; pentru
importul de clienti revertul se bazeaza pe `import_rows.client_id`.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "imp03revert"
down_revision = "imp02async"
branch_labels = None
depends_on = None

_JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.add_column("import_rows", sa.Column("created", _JSON, nullable=True))
    op.add_column("import_sessions", sa.Column("created", _JSON, nullable=True))
    op.add_column("import_sessions", sa.Column("reverted_by", sa.String(100), nullable=True))
    op.add_column("import_sessions", sa.Column("reverted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("import_sessions", "reverted_at")
    op.drop_column("import_sessions", "reverted_by")
    op.drop_column("import_sessions", "created")
    op.drop_column("import_rows", "created")
