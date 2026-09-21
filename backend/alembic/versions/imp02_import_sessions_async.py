"""sesiuni de import procesate in fundal (stare, progres, hash fisier)

Revision ID: imp02async
Revises: imp01import
Create Date: 2026-09-15 12:00:00.000000

Importul unui fisier mare dura secunde intregi intr-un singur request, fara nicio
reactie in pagina — si un al doilea click pornea acelasi import inca o data.
Acum request-ul doar creeaza sesiunea, iar randurile se proceseaza in fundal:
`state` + `processed_rows` alimenteaza bara de progres, `file_hash` opreste
acelasi fisier incarcat de doua ori.
"""
import sqlalchemy as sa
from alembic import op


revision = "imp02async"
down_revision = "imp01import"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("import_sessions", sa.Column("state", sa.String(20), nullable=False, server_default="done"))
    op.add_column("import_sessions", sa.Column("processed_rows", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("import_sessions", sa.Column("error", sa.Text(), nullable=True))
    op.add_column("import_sessions", sa.Column("file_hash", sa.String(64), nullable=True))
    # Sesiunile existente au fost procesate integral, sincron.
    op.execute("UPDATE import_sessions SET processed_rows = total_rows")
    op.create_index(
        "ix_import_sessions_account_id_file_hash", "import_sessions", ["account_id", "file_hash"]
    )


def downgrade() -> None:
    op.drop_index("ix_import_sessions_account_id_file_hash", table_name="import_sessions")
    op.drop_column("import_sessions", "file_hash")
    op.drop_column("import_sessions", "error")
    op.drop_column("import_sessions", "processed_rows")
    op.drop_column("import_sessions", "state")
