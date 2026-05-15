"""add location_id to report_employee_daily

Revision ID: mr02empdaily_loc
Revises: mr01reports001
Create Date: 2026-05-15

Adaugă coloana location_id (cu FK către locations + ON DELETE SET NULL) pentru a
permite filtrarea/breakdown-ul per locație la angajați. Index nou pe
(employee_id, location_id) pentru query-urile de detalii angajat. Datele
existente rămân NULL — un weekly_refresh al raportului `employee_daily` din
AdminV2 le va re-popula.
"""
from alembic import op
import sqlalchemy as sa


revision = "mr02empdaily_loc"
down_revision = "mr01reports001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "report_employee_daily",
        sa.Column("location_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_report_employee_daily_location",
        "report_employee_daily",
        "locations",
        ["location_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_report_employee_daily_employee_location",
        "report_employee_daily",
        ["employee_id", "location_id"],
    )
    # Recream UNIQUE-ul ca să includă și location_id — altfel un angajat care
    # lucrează în 2 locații în aceeași zi cu același (item_type, categorie,
    # departament) ar produce duplicate. Folosim COALESCE pentru a permite NULL.
    op.execute("DROP INDEX IF EXISTS uq_report_employee_daily")
    op.execute(
        "CREATE UNIQUE INDEX uq_report_employee_daily ON report_employee_daily "
        "(report_date, account_id, COALESCE(location_id, 0), COALESCE(employee_id, 0), "
        "COALESCE(item_type, ''), COALESCE(category_id, 0), COALESCE(department_id, 0))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_report_employee_daily")
    op.execute(
        "CREATE UNIQUE INDEX uq_report_employee_daily ON report_employee_daily "
        "(report_date, account_id, COALESCE(employee_id, 0), COALESCE(item_type, ''), "
        "COALESCE(category_id, 0), COALESCE(department_id, 0))"
    )
    op.drop_index(
        "ix_report_employee_daily_employee_location",
        table_name="report_employee_daily",
    )
    op.drop_constraint(
        "fk_report_employee_daily_location",
        "report_employee_daily",
        type_="foreignkey",
    )
    op.drop_column("report_employee_daily", "location_id")
