"""SQLAlchemy ORM models for the SecureShip domain."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# create_type=False — Alembic migration is the sole owner of CREATE TYPE
_shipment_status = ENUM(
    "label_created",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "exception",
    name="shipment_status",
    create_type=False,
)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    phone_number: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    address: Mapped[str] = mapped_column(String, nullable=False)

    shipments: Mapped[list["Shipment"]] = relationship(
        "Shipment", back_populates="customer", cascade="all, delete-orphan"
    )


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tracking_number: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    status: Mapped[str] = mapped_column(_shipment_status, nullable=False)
    carrier: Mapped[str] = mapped_column(String, nullable=False)
    origin: Mapped[str] = mapped_column(String, nullable=False)
    destination: Mapped[str] = mapped_column(String, nullable=False)
    estimated_delivery: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_update: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    customer: Mapped["Customer"] = relationship("Customer", back_populates="shipments")
    packages: Mapped[list["Package"]] = relationship(
        "Package", back_populates="shipment", cascade="all, delete-orphan"
    )


class Package(Base):
    __tablename__ = "packages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    shipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shipments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(String, nullable=False)
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    declared_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    shipment: Mapped["Shipment"] = relationship("Shipment", back_populates="packages")


class Identity(Base):
    """Persisted identity-gate state per chat session."""

    __tablename__ = "identities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    state: Mapped[str] = mapped_column(String(50), nullable=False, default="anonymous")
    first_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
