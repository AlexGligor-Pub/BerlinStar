"""programari online: identificator public per garaj (adresa serverului MCP)

Revision ID: onl02slug
Revises: onl01online
Create Date: 2026-09-27 12:00:00.000000

`booking_settings.public_slug` apare in adresa serverului MCP (/mcp/<slug>).
Configurarile existente primesc un slug din numele site-ului, unic.
"""
from alembic import op
import sqlalchemy as sa

from app.utils.slug import slugify


revision = "onl02slug"
down_revision = "onl01online"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking_settings", sa.Column("public_slug", sa.String(60), nullable=True))
    op.create_unique_constraint("uq_booking_settings_public_slug", "booking_settings", ["public_slug"])

    conn = op.get_bind()
    taken: set[str] = set()
    rows = conn.execute(sa.text("SELECT id, site_name FROM booking_settings ORDER BY id")).all()
    for row_id, site_name in rows:
        base = slugify(site_name or "") or "garaj"
        slug, n = base, 2
        while slug in taken:
            slug, n = f"{base}-{n}", n + 1
        taken.add(slug)
        conn.execute(
            sa.text("UPDATE booking_settings SET public_slug = :s WHERE id = :i"), {"s": slug, "i": row_id},
        )


def downgrade() -> None:
    op.drop_constraint("uq_booking_settings_public_slug", "booking_settings", type_="unique")
    op.drop_column("booking_settings", "public_slug")
