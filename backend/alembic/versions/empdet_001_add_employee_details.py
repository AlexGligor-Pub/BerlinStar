"""add employee_details table (dosar de personal / date legale)

Revision ID: empdet_001
Revises: zzb1kk2ll3mm4
Create Date: 2026-06-01 00:00:00.000000

"""
from __future__ import annotations
from alembic import op


revision = "empdet_001"
down_revision = "zzb1kk2ll3mm4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS employee_details (
            employee_id                INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
            account_id                 INTEGER NOT NULL REFERENCES accounts(id),
            company_id                 INTEGER REFERENCES companies(id) ON DELETE SET NULL,

            -- Identitate
            cnp                        VARCHAR(13),
            nif                        VARCHAR(20),
            nationality                VARCHAR(100),
            country_of_origin          VARCHAR(100),
            id_series                  VARCHAR(10),
            id_number                  VARCHAR(20),
            id_issuer                  VARCHAR(200),
            id_issued_date             DATE,
            birth_date                 DATE,
            birth_place                VARCHAR(200),

            -- Contact & domiciliu
            phone                      VARCHAR(50),
            personal_email             VARCHAR(255),
            address_domicile           TEXT,
            address_residence          TEXT,

            -- Contract individual de munca (CIM)
            contract_number            VARCHAR(50),
            contract_date              DATE,
            activity_start_date        DATE,
            contract_type              VARCHAR(30),
            contract_duration_months   INTEGER,
            probation_end_date         DATE,

            -- Job
            job_title                  VARCHAR(200),
            cor_code                   VARCHAR(10),
            department                 VARCHAR(200),
            work_norm                  VARCHAR(30),
            hours_per_day              NUMERIC(4, 2),
            base_salary_gross          NUMERIC(12, 2),
            seniority_months           INTEGER,

            -- Banca
            bank_name                  VARCHAR(200),
            iban                       VARCHAR(34),

            -- Medical (medicina muncii)
            medical_check_date         DATE,
            medical_check_expiry       DATE,

            -- Altele
            marital_status             VARCHAR(30),
            dependents_count           INTEGER,
            education                  TEXT,
            emergency_contact_name     VARCHAR(200),
            emergency_contact_phone    VARCHAR(50),
            emergency_contact_relation VARCHAR(100),

            created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at                 TIMESTAMPTZ
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_employee_details_account_id ON employee_details (account_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_employee_details_company_id ON employee_details (company_id)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_employee_details_company_id")
    op.execute("DROP INDEX IF EXISTS ix_employee_details_account_id")
    op.execute("DROP TABLE IF EXISTS employee_details")
