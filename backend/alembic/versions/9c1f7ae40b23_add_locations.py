"""add locations table (searchable country/city geo-targets)

Seeded from DataForSEO's own location list — see scripts/seed_locations.py.
The table is data-only; `alembic upgrade head` creates it empty and the seed
script fills it, so the migration stays fast and re-runnable.

Revision ID: 9c1f7ae40b23
Revises: d4e5f6a7b8c1
"""
from alembic import op
import sqlalchemy as sa

revision = "9c1f7ae40b23"
down_revision = "d4e5f6a7b8c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "locations",
        # DataForSEO's own location_code — not a surrogate key. Every research
        # endpoint takes this number directly.
        sa.Column("code", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("region", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("country_name", sa.String(length=120), nullable=False),
        sa.Column("country_iso", sa.String(length=2), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("language_code", sa.String(length=5), nullable=False, server_default="en"),
        sa.Column("search_blob", sa.String(length=600), nullable=False),
    )
    op.create_index("ix_locations_name", "locations", ["name"])
    op.create_index("ix_locations_country_name", "locations", ["country_name"])
    op.create_index("ix_locations_country_iso", "locations", ["country_iso"])
    op.create_index("ix_locations_kind", "locations", ["kind"])
    op.create_index("ix_locations_search_blob", "locations", ["search_blob"])
    # Country-scoped city search is the dropdown's main query.
    op.create_index("ix_locations_country_kind", "locations", ["country_iso", "kind"])


def downgrade() -> None:
    op.drop_index("ix_locations_country_kind", table_name="locations")
    op.drop_index("ix_locations_search_blob", table_name="locations")
    op.drop_index("ix_locations_kind", table_name="locations")
    op.drop_index("ix_locations_country_iso", table_name="locations")
    op.drop_index("ix_locations_country_name", table_name="locations")
    op.drop_index("ix_locations_name", table_name="locations")
    op.drop_table("locations")
