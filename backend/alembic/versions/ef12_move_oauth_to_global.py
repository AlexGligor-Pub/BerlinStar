"""muta OAuth ANAF (client_id/secret/redirect_uri) din anaf_settings in efactura_global_settings

Revision ID: ef12oauthglb
Revises: ef11accpwd
Create Date: 2026-05-18 10:00:00.000000

Inainte: fiecare companie isi tinea propriile credentiale OAuth in anaf_settings.
Dupa: BerlinStar se inregistreaza o singura data la anaf.ro/InregOauth iar
credentialele OAuth sunt globale in efactura_global_settings (singleton).

Backfill: daca exista o singura companie cu credentiale setate, le promovam la global.
Daca exista mai multe, alegem prima (admin va trebui sa verifice manual dupa migrare).
"""
from alembic import op
import sqlalchemy as sa


revision = "ef12oauthglb"
down_revision = "ef11accpwd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 0. PRE-CHECK: refuza migrarea daca mai multe perechi distincte de
    #    credentiale OAuth exista in anaf_settings — altfel pierdem date silent.
    #    Adminul trebuie sa-si aleaga explicit perechea pe care o promoveaza.
    bind = op.get_bind()
    distinct_pairs = bind.execute(
        sa.text(
            """
            SELECT COUNT(*) FROM (
                SELECT DISTINCT client_id, client_secret_enc
                FROM anaf_settings
                WHERE client_id IS NOT NULL
                  AND client_secret_enc IS NOT NULL
            ) t
            """
        )
    ).scalar() or 0
    if distinct_pairs > 1:
        raise RuntimeError(
            f"Migrarea ef12oauthglb nu poate continua: detectate {distinct_pairs} "
            "perechi distincte de credentiale OAuth in anaf_settings. "
            "Inainte de upgrade, alege manual perechea care merge la global: "
            "UPDATE efactura_global_settings SET oauth_client_id=..., "
            "oauth_client_secret_enc=... WHERE id=1; "
            "apoi sterge celelalte: UPDATE anaf_settings SET client_id=NULL, "
            "client_secret_enc=NULL WHERE client_id <> '<perechea pastrata>'."
        )

    # 1. Adauga coloane globale
    op.add_column(
        "efactura_global_settings",
        sa.Column("oauth_client_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "efactura_global_settings",
        sa.Column("oauth_client_secret_enc", sa.Text(), nullable=True),
    )

    # 2. Backfill: promoveaza unica pereche valida (verificata la pasul 0) la
    #    global, doar daca global nu are deja credentiale.
    op.execute(
        """
        UPDATE efactura_global_settings g
        SET oauth_client_id = s.client_id,
            oauth_client_secret_enc = s.client_secret_enc
        FROM (
            SELECT DISTINCT client_id, client_secret_enc
            FROM anaf_settings
            WHERE client_id IS NOT NULL
              AND client_secret_enc IS NOT NULL
            LIMIT 1
        ) s
        WHERE g.id = 1
          AND g.oauth_client_id IS NULL
        """
    )

    # 3. Drop coloanele per-companie
    op.drop_column("anaf_settings", "redirect_uri")
    op.drop_column("anaf_settings", "client_secret_enc")
    op.drop_column("anaf_settings", "client_id")


def downgrade() -> None:
    # NU completam automat anaf_settings cu valoarea globala — daca cheia Fernet
    # a fost rotita dupa upgrade, secret-ul global nu mai poate fi decriptat in
    # contextul vechi. Adminul trebuie sa repopulze manual credentiale pe
    # companiile care le aveau anterior.
    op.add_column(
        "anaf_settings",
        sa.Column("client_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "anaf_settings",
        sa.Column("client_secret_enc", sa.Text(), nullable=True),
    )
    op.add_column(
        "anaf_settings",
        sa.Column("redirect_uri", sa.String(500), nullable=True),
    )

    op.drop_column("efactura_global_settings", "oauth_client_secret_enc")
    op.drop_column("efactura_global_settings", "oauth_client_id")
