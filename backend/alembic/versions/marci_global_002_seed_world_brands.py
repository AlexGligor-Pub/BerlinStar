"""seed world tire brands into global marci_anvelope

Revision ID: marci_global_002
Revises: marci_global_001
Create Date: 2026-05-25 22:05:00.000000

Insereaza ~60 brand-uri mondiale de anvelope. Foloseste NOT EXISTS pe
LOWER(TRIM(nume)) ca sa nu suprascrie marcile deja existente preluate din
conturile clientilor (cf. cerintei "sa te folosesti si de marcile care
exista deja in baza de date").
"""
from __future__ import annotations
from alembic import op


revision = "marci_global_002"
down_revision = "marci_global_001"
branch_labels = None
depends_on = None


WORLD_BRANDS: list[str] = [
    # Premium globale
    "Michelin", "Continental", "Pirelli", "Bridgestone", "Goodyear",
    "Dunlop", "Hankook", "Yokohama", "Toyo", "Nokian",
    "Cooper", "Falken", "BFGoodrich", "Kumho", "Vredestein",
    # Europene
    "Kleber", "Firestone", "General Tire", "Semperit", "Fulda",
    "Sava", "Debica", "Avon", "Tigar", "Viking",
    "Lassa", "Petlas", "Matador", "Barum", "Riken",
    "Orium", "Diplomat", "Uniroyal", "Sebring", "Premiorri",
    # Asiatice
    "Nexen", "Maxxis", "Sumitomo", "Nitto", "Federal",
    "Roadstone", "Kenda", "Achilles", "Triangle", "Linglong",
    "Westlake", "Sailun", "Chengshan", "Wanli", "GT Radial",
    "Apollo", "MRF", "JK Tyre", "CEAT", "BKT",
    # Off-road / specialty
    "Mickey Thompson", "Hercules", "Mastercraft", "Goodride", "Pace",
    "Imperial", "Tristar", "Marshal",
]


def _sql_quote(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def upgrade() -> None:
    values_clause = ", ".join(f"({_sql_quote(nume)})" for nume in WORLD_BRANDS)
    # Inserare doar pentru cele care nu exista deja (case-insensitive).
    # proposed_by_account_id NULL = seed sistem (vs. propusa de un user).
    op.execute(
        f"""
        INSERT INTO marci_anvelope (nume, status, proposed_by_account_id, approved_at, created_at, is_deleted)
        SELECT v.nume, 'approved', NULL, NOW(), NOW(), false
        FROM (VALUES {values_clause}) AS v(nume)
        WHERE NOT EXISTS (
            SELECT 1 FROM marci_anvelope existing
            WHERE LOWER(TRIM(existing.nume)) = LOWER(TRIM(v.nume))
              AND existing.is_deleted = false
        )
        """
    )


def downgrade() -> None:
    names_csv = ", ".join(_sql_quote(nume) for nume in WORLD_BRANDS)
    # Sterge doar randurile seed (proposed_by_account_id NULL) ai caror nume
    # apar in lista, ca sa nu atingem propunerile reale.
    op.execute(
        f"""
        DELETE FROM marci_anvelope
        WHERE proposed_by_account_id IS NULL
          AND nume IN ({names_csv})
        """
    )
