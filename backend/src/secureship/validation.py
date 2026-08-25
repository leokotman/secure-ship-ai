"""Shared input validators (UUID session IDs, E.164 phones)."""

from __future__ import annotations

import re
import uuid

# E.164: + then country code (non-zero) and subscriber number, 8–15 digits total after +
_E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")


def is_uuid_string(value: str) -> bool:
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def is_e164_phone(value: str) -> bool:
    return bool(_E164_RE.match(value.strip()))
