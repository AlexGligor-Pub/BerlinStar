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
    # 1. Adauga coloane globale
    op.add_column(
        "efactura_global_settings",
        sa.Column("oauth_client_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "efactura_global_settings",
        sa.Column("oauth_client_secret_enc", sa.Text(), nullable=True),
    )

    # 2. Backfill: promoveaza prima pereche valida client_id+secret la global,
    #    doar daca global nu are deja credentiale.
    op.execute(
        """
        UPDATE efactura_global_settings g
        SET oauth_client_id = s.client_id,
            oauth_client_secret_enc = s.client_secret_enc
        FROM (
            SELECT client_id, client_secret_enc
            FROM anaf_settings
            WHERE client_id IS NOT NULL
              AND client_secret_enc IS NOT NULL
            ORDER BY id ASC
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

    # Best-effort restore: pune valorile globale pe TOATE companiile
    # (pierderea informatiei la upgrade nu se poate inversa exact)
    op.execute(
        """
        UPDATE anaf_settings s
        SET client_id = g.oauth_client_id,
            client_secret_enc = g.oauth_client_secret_enc
        FROM efactura_global_settings g
        WHERE g.id = 1
        """
    )

    op.drop_column("efactura_global_settings", "oauth_client_secret_enc")
    op.drop_column("efactura_global_settings", "oauth_client_id")
