"""Identity verification against the Customer database table."""

import uuid
from typing import Optional

from sqlalchemy import text

from .database import AsyncSessionLocal


async def verify_identity_db(
    first_name: str,
    last_name: str,
    phone: str,
    address_hint: Optional[str] = None,
) -> Optional[uuid.UUID]:
    """Return customer UUID if the provided fields match a Customer row; None otherwise.

    Primary path: name + phone (phone is unique — definitive identifier).
    Fallback path: name + phone + partial address (ILIKE containment) when address_hint
    is supplied after the primary check failed.
    Uses parameterized queries throughout — no SQL injection risk.
    """
    params: dict[str, str] = {"fn": first_name, "ln": last_name, "phone": phone}
    base = (
        "SELECT id FROM customers "
        "WHERE lower(trim(first_name)) = lower(trim(:fn)) "
        "AND lower(trim(last_name)) = lower(trim(:ln)) "
        "AND phone_number = :phone"
    )
    if address_hint:
        # Partial address as last-resort hint — safely bound, not interpolated
        params["hint"] = f"%{address_hint.strip()}%"
        base += " AND lower(address) LIKE lower(:hint)"
    async with AsyncSessionLocal() as db:
        result = await db.execute(text(base), params)
        row = result.fetchone()
        if row is None:
            return None
        return uuid.UUID(str(row[0]))
