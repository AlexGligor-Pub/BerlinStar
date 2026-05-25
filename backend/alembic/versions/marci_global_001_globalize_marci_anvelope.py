"""globalize marci_anvelope (drop account_id, add status/proposed_by, deduplicate)

Revision ID: marci_global_001
Revises: fdl_003
Create Date: 2026-05-25 22:00:00.000000

Transformare:
- Marcile de anvelope erau per-cont (account_id FK).
- Devin globale: o singura sursa de adevar pentru toate conturile.
- Marcile existente sunt deduplicate dupa LOWER(TRIM(nume)) si raman
  ca 'approved' (cf. cerintei "sa te folosesti si de marcile care exista").
- Coloana account_id devine proposed_by_account_id (cine a propus).
- Indexul unic case-insensitive previne duplicate viitoare.
"""
from __future__ import annotations
from alembic import op


revision = "marci_global_001"
down_revision = "fdl_003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Adauga noile coloane (initial nullable ca sa nu sparga randuri existente).
    op.execute("ALTER TABLE marci_anvelope ADD COLUMN IF NOT EXISTS status VARCHAR(16)")
    op.execute("ALTER TABLE marci_anvelope ADD COLUMN IF NOT EXISTS proposed_by_account_id INTEGER")
    op.execute("ALTER TABLE marci_anvelope ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ")
    op.execute("ALTER TABLE marci_anvelope ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ")

    # 2. Backfill: toate marcile existente devin approved si proposed_by = vechiul account_id.
    op.execute(
        "UPDATE marci_anvelope "
        "SET status = 'approved', "
        "    proposed_by_account_id = account_id, "
        "    approved_at = COALESCE(created_at, NOW()) "
        "WHERE status IS NULL"
    )

    # 3. Deduplicare: pentru fiecare grup de marci cu acelasi LOWER(TRIM(nume))
    #    (peste toate conturile), pastreaza min(id) si repointa FK-urile.
    op.execute(
        """
        WITH masters AS (
            SELECT MIN(id) AS master_id, LOWER(TRIM(nume)) AS key
            FROM marci_anvelope
            WHERE is_deleted = false
            GROUP BY LOWER(TRIM(nume))
        ),
        dupes AS (
            SELECT m.id AS dupe_id, masters.master_id
            FROM marci_anvelope m
            JOIN masters ON LOWER(TRIM(m.nume)) = masters.key
            WHERE m.is_deleted = false AND m.id <> masters.master_id
        )
        UPDATE anvelope a
        SET marca_id = d.master_id
        FROM dupes d
        WHERE a.marca_id = d.dupe_id
        """
    )
    op.execute(
        """
        WITH masters AS (
            SELECT MIN(id) AS master_id, LOWER(TRIM(nume)) AS key
            FROM marci_anvelope
            WHERE is_deleted = false
            GROUP BY LOWER(TRIM(nume))
        ),
        dupes AS (
            SELECT m.id AS dupe_id, masters.master_id
            FROM marci_anvelope m
            JOIN masters ON LOWER(TRIM(m.nume)) = masters.key
            WHERE m.is_deleted = false AND m.id <> masters.master_id
        )
        UPDATE montaj_roti mr
        SET marca_id = d.master_id
        FROM dupes d
        WHERE mr.marca_id = d.dupe_id
        """
    )
    # Soft-delete duplicatele dupa ce FK-urile au fost mutate.
    op.execute(
        """
        WITH masters AS (
            SELECT MIN(id) AS master_id, LOWER(TRIM(nume)) AS key
            FROM marci_anvelope
            WHERE is_deleted = false
            GROUP BY LOWER(TRIM(nume))
        )
        UPDATE marci_anvelope m
        SET is_deleted = true, deleted_at = NOW()
        FROM masters
        WHERE LOWER(TRIM(m.nume)) = masters.key
          AND m.id <> masters.master_id
          AND m.is_deleted = false
        """
    )

    # 4. Constraints definitive.
    op.execute("ALTER TABLE marci_anvelope ALTER COLUMN status SET NOT NULL")
    op.execute("ALTER TABLE marci_anvelope ALTER COLUMN status SET DEFAULT 'approved'")

    # 5. FK pe proposed_by_account_id catre accounts.
    op.execute(
        "ALTER TABLE marci_anvelope "
        "ADD CONSTRAINT fk_marci_anvelope_proposed_by_account_id_accounts "
        "FOREIGN KEY (proposed_by_account_id) REFERENCES accounts(id) ON DELETE SET NULL"
    )

    # 6. Drop indexul vechi si coloana account_id (FK + index implicit).
    op.execute("DROP INDEX IF EXISTS ix_marci_anvelope_account_id_is_deleted_id")
    op.execute("ALTER TABLE marci_anvelope DROP CONSTRAINT IF EXISTS marci_anvelope_account_id_fkey")
    op.execute(
        "ALTER TABLE marci_anvelope DROP CONSTRAINT IF EXISTS fk_marci_anvelope_account_id_accounts"
    )
    op.execute("ALTER TABLE marci_anvelope DROP COLUMN IF EXISTS account_id")

    # 7. Indexuri noi.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_marci_anvelope_nume_lower "
        "ON marci_anvelope (LOWER(TRIM(nume))) WHERE is_deleted = false"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_marci_anvelope_status_is_deleted "
        "ON marci_anvelope (status, is_deleted, nume)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_marci_anvelope_proposed_by "
        "ON marci_anvelope (proposed_by_account_id)"
    )


def downgrade() -> None:
    # Reverse pasii (best-effort — pierde infos de status/propunator).
    op.execute("DROP INDEX IF EXISTS ix_marci_anvelope_proposed_by")
    op.execute("DROP INDEX IF EXISTS ix_marci_anvelope_status_is_deleted")
    op.execute("DROP INDEX IF EXISTS uq_marci_anvelope_nume_lower")

    op.execute("ALTER TABLE marci_anvelope ADD COLUMN IF NOT EXISTS account_id INTEGER")
    # Pune ca proprietar contul propunator (pentru randurile seed sistem va fi NULL).
    op.execute("UPDATE marci_anvelope SET account_id = proposed_by_account_id")
    op.execute(
        "ALTER TABLE marci_anvelope "
        "ADD CONSTRAINT fk_marci_anvelope_account_id_accounts "
        "FOREIGN KEY (account_id) REFERENCES accounts(id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_marci_anvelope_account_id_is_deleted_id "
        "ON marci_anvelope (account_id, is_deleted, id)"
    )

    op.execute(
        "ALTER TABLE marci_anvelope DROP CONSTRAINT IF EXISTS fk_marci_anvelope_proposed_by_account_id_accounts"
    )
    op.execute("ALTER TABLE marci_anvelope DROP COLUMN IF EXISTS rejected_at")
    op.execute("ALTER TABLE marci_anvelope DROP COLUMN IF EXISTS approved_at")
    op.execute("ALTER TABLE marci_anvelope DROP COLUMN IF EXISTS proposed_by_account_id")
    op.execute("ALTER TABLE marci_anvelope DROP COLUMN IF EXISTS status")
