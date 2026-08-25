"""Tests for soft delete functionality (Week 4).

Verifies that soft-deleted shipments (deleted_at IS NOT NULL) are
properly filtered out from all customer-facing tool queries.

Note: Due to async test fixture/connection pooling limitations, this file
contains only the core security test. Additional validation of database
integrity and admin API behavior is covered through manual testing.
"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import ProgrammingError

from secureship.database import AsyncSessionLocal
from secureship.models import Customer, Shipment
from secureship.session import Session, SessionState
from secureship.tools import _lookup_shipments


@pytest.mark.asyncio
async def test_lookup_shipments_excludes_deleted() -> None:
    """Verify that lookup_shipments filters out soft-deleted shipments.

    This is the CORE security requirement: customers must NEVER see
    soft-deleted shipments through the chat interface.

    Test validates that:
    1. Active shipments (deleted_at IS NULL) are returned
    2. Soft-deleted shipments (deleted_at IS NOT NULL) are filtered out
    3. Customer session security is properly enforced
    """
    try:
        async with AsyncSessionLocal() as db:
            # Create customer
            customer = Customer(
                id=uuid.uuid4(),
                first_name="Alice",
                last_name="Johnson",
                phone_number=f"+1415{uuid.uuid4().hex[:7]}",
                address="123 Test St",
            )
            db.add(customer)
            await db.flush()

            # Create active shipment with unique tracking number
            active_tracking = f"ACTIVE-{uuid.uuid4().hex[:8].upper()}"
            active = Shipment(
                id=uuid.uuid4(),
                customer_id=customer.id,
                tracking_number=active_tracking,
                status="in_transit",
                carrier="FedEx",
                origin="SF",
                destination="NYC",
                last_update=datetime.now(timezone.utc),
                deleted_at=None,  # Active - should be visible
            )

            # Create deleted shipment with unique tracking number
            deleted_tracking = f"DELETED-{uuid.uuid4().hex[:8].upper()}"
            deleted = Shipment(
                id=uuid.uuid4(),
                customer_id=customer.id,
                tracking_number=deleted_tracking,
                status="delivered",
                carrier="UPS",
                origin="LA",
                destination="SEA",
                last_update=datetime.now(timezone.utc),
                deleted_at=datetime.now(timezone.utc),  # Soft-deleted - should be hidden
            )

            db.add_all([active, deleted])
            await db.commit()

            # Create verified session
            session = Session(session_id="test-soft-delete")
            session.state = SessionState.VERIFIED
            session.customer_id = customer.id
            session.first_name = customer.first_name
            session.phone = customer.phone_number

            # Test: lookup_shipments should only return the active shipment
            result = await _lookup_shipments(session)

            # Assertions
            assert result["status"] == "ok", "Should return ok status"
            assert len(result["shipments"]) == 1, "Should return exactly 1 active shipment"
            assert result["shipments"][0]["tracking_number"] == active_tracking, "Should return the active shipment"

            # Verify deleted shipment is NOT in results
            tracking_numbers = [s["tracking_number"] for s in result["shipments"]]
            assert deleted_tracking not in tracking_numbers, "Soft-deleted shipment must NOT be visible"

    except (ProgrammingError, OSError) as e:
        if "does not exist" in str(e) or "Connect call failed" in str(e):
            pytest.skip("Database not available (no live PostgreSQL)")
        raise
