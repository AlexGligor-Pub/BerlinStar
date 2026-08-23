"""registru de plati pe bon (avans / plata / restituire)

Revision ID: pay01pay
Revises: usr01users
Create Date: 2026-08-19 10:00:00.000000

Separa MISCARILE DE BANI de LINIILE bonului. Motivul: un avans nu e o reducere —
daca l-am pune ca linie negativa ar scadea baza de TVA (in eFactura ajunge
AllowanceCharge), deci am raporta TVA mai mic decat datorat. Liniile descriu ce
s-a vandut; tabelul de aici descrie cand si cum au circulat banii.

`receipts.pay_method` / `partial_pay` rămân si se recalculeaza din registru
(vezi services/payments_service.py), ca rapoartele si filtrele existente sa
functioneze neschimbat. Bonurile fara inregistrari in registru se comporta exact
ca inainte, deci NU e nevoie de backfill pe cele ~90k existente.
"""
import sqlalchemy as sa
from alembic import op


revision = "pay01pay"
down_revision = "usr01users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "receipt_payments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("receipt_id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.Enum("avans", "plata", "restituire", name="payment_kind"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "method",
            sa.Enum("Cash", "Card", "OP", "Alta", name="payment_method"),
            nullable=False,
            server_default="Cash",
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("employee_id", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["receipt_id"], ["receipts.id"], name="fk_receipt_payments_receipt_id_receipts", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["account_id"], ["accounts.id"], name="fk_receipt_payments_account_id_accounts"
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"], ["employees.id"], name="fk_receipt_payments_employee_id_employees", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_receipt_payments"),
        sa.CheckConstraint("amount > 0", name="ck_receipt_payments_amount_positive"),
    )
    op.create_index("ix_receipt_payments_receipt_id_id", "receipt_payments", ["receipt_id", "id"])
    op.create_index("ix_receipt_payments_account_id_id", "receipt_payments", ["account_id", "id"])


def downgrade() -> None:
    op.drop_index("ix_receipt_payments_account_id_id", table_name="receipt_payments")
    op.drop_index("ix_receipt_payments_receipt_id_id", table_name="receipt_payments")
    op.drop_table("receipt_payments")
    op.execute("DROP TYPE IF EXISTS payment_kind")
    op.execute("DROP TYPE IF EXISTS payment_method")
