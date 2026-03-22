"""replace location_companies with company_id FK on locations

Revision ID: g8h9i0j1k2l3
Revises: f7a8b9c0d1e2
Create Date: 2026-03-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'g8h9i0j1k2l3'
down_revision = 'f7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the many-to-many table
    op.drop_index('ix_location_companies_location_id', table_name='location_companies')
    op.drop_table('location_companies')

    # Add simple FK column on locations
    op.add_column('locations', sa.Column('company_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_locations_company_id_companies',
        'locations', 'companies',
        ['company_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_locations_company_id_companies', 'locations', type_='foreignkey')
    op.drop_column('locations', 'company_id')

    op.create_table(
        'location_companies',
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('location_id', 'company_id'),
    )
    op.create_index('ix_location_companies_location_id', 'location_companies', ['location_id'])
