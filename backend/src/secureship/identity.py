"""Identity verification against the Customer database table."""

import uuid
from typing import Optional

from sqlalchemy import text

from .database import AsyncSessionLocal


async def verify_identity_db(
    first_name: str,
    last_name: str,
    address: str,
    phone: str,
) -> Optional[uuid.UUID]:
    """Return customer UUID if all four fields match a Customer row; None otherwise.

    Uses parameterized queries — no string interpolation, no SQL injection risk.
    Case- and whitespace-insensitive on name/address; exact match on phone (E.164).
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text(
                "SELECT id FROM customers "
                "WHERE lower(trim(first_name)) = lower(trim(:fn)) "
                "AND lower(trim(last_name)) = lower(trim(:ln)) "
                "AND lower(trim(address)) = lower(trim(:addr)) "
                "AND phone_number = :phone"
            ),
            {"fn": first_name, "ln": last_name, "addr": address, "phone": phone},
        )
        row = result.fetchone()
        if row is None:
            return None
        return uuid.UUID(str(row[0]))
