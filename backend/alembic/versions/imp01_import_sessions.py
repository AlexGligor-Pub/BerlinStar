"""sesiuni de import din fisiere (istoric + randuri de rezolvat)

Revision ID: imp01import
Revises: ai01settings
Create Date: 2026-09-15 10:00:00.000000

Importul de clienti din CSV (Configurări › Import › Clienți) nu mai arunca
randurile cu probleme: le pastreaza intr-o sesiune, iar administratorul le
completeaza si le importa sau le respinge. Vezi app/models/import_session.py.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "imp01import"
down_revision = "ai01settings"
branch_labels = None
depends_on = None

_JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "import_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("filename", sa.String(255), nullable=True),
        sa.Column("encoding", sa.String(20), nullable=True),
        sa.Column("delimiter", sa.String(5), nullable=True),
        sa.Column("columns_recognized", _JSON, nullable=True),
        sa.Column("file_warnings", _JSON, nullable=True),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="fk_import_sessions_account_id_accounts"),
        sa.PrimaryKeyConstraint("id", name="pk_import_sessions"),
    )
    op.create_index("ix_import_sessions_account_id_kind_id", "import_sessions", ["account_id", "kind", "id"])

    op.create_table(
        "import_rows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("issue", sa.String(20), nullable=True),
        sa.Column("original", _JSON, nullable=False),
        sa.Column("values", _JSON, nullable=False),
        sa.Column("messages", _JSON, nullable=True),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("resolved_by", sa.String(100), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["session_id"], ["import_sessions.id"], name="fk_import_rows_session_id_import_sessions", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="fk_import_rows_account_id_accounts"),
        sa.ForeignKeyConstraint(["client_id"], ["clienti.id"], name="fk_import_rows_client_id_clienti"),
        sa.PrimaryKeyConstraint("id", name="pk_import_rows"),
    )
    op.create_index(
        "ix_import_rows_session_id_status_row_number", "import_rows", ["session_id", "status", "row_number"]
    )
    op.create_index("ix_import_rows_account_id_status", "import_rows", ["account_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_import_rows_account_id_status", table_name="import_rows")
    op.drop_index("ix_import_rows_session_id_status_row_number", table_name="import_rows")
    op.drop_table("import_rows")
    op.drop_index("ix_import_sessions_account_id_kind_id", table_name="import_sessions")
    op.drop_table("import_sessions")
