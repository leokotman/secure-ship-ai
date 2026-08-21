"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enum for shipment statuses — must be created before the shipments table
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status') THEN
                CREATE TYPE shipment_status AS ENUM (
                    'label_created',
                    'in_transit',
                    'out_for_delivery',
                    'delivered',
                    'exception'
                );
            END IF;
        END
        $$;
    """)

    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("phone_number", sa.String(), unique=True, nullable=False),
        sa.Column("address", sa.String(), nullable=False),
    )

    op.create_table(
        "shipments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tracking_number", sa.String(), unique=True, nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "label_created",
                "in_transit",
                "out_for_delivery",
                "delivered",
                "exception",
                name="shipment_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("carrier", sa.String(), nullable=False),
        sa.Column("origin", sa.String(), nullable=False),
        sa.Column("destination", sa.String(), nullable=False),
        sa.Column("estimated_delivery", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_update", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_shipments_customer_id", "shipments", ["customer_id"])

    op.create_table(
        "packages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "shipment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shipments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(10, 2), nullable=False),
        sa.Column("declared_value", sa.Numeric(10, 2), nullable=False),
    )
    op.create_index("ix_packages_shipment_id", "packages", ["shipment_id"])

    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            sa.String(255),
            unique=True,
            nullable=False,
        ),
        sa.Column("state", sa.String(50), nullable=False, server_default="anonymous"),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "case_facts",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "transcript",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_conversations_session_id", "conversations", ["session_id"])

    op.create_table(
        "identities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            sa.String(255),
            unique=True,
            nullable=False,
        ),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("state", sa.String(50), nullable=False, server_default="anonymous"),
        sa.Column("first_name", sa.String(), nullable=True),
        sa.Column("last_name", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_identities_session_id", "identities", ["session_id"])


def downgrade() -> None:
    op.drop_table("identities")
    op.drop_table("conversations")
    op.drop_table("packages")
    op.drop_table("shipments")
    op.drop_table("customers")
    op.execute("DROP TYPE IF EXISTS shipment_status")
