"""add deleted_at to shipments

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add deleted_at column for soft delete support."""
    op.add_column(
        "shipments",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_shipments_deleted_at",
        "shipments",
        ["deleted_at"],
    )


def downgrade() -> None:
    """Remove deleted_at column."""
    op.drop_index("ix_shipments_deleted_at", table_name="shipments")
    op.drop_column("shipments", "deleted_at")
