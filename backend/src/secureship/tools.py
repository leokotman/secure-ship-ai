"""Ollama tool definitions and execution dispatcher.

This module is the single security enforcement point for tool calls.
All tools operate exclusively on the server-side session — never on
model- or user-supplied IDs or customer data (Epic F3).
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from .database import AsyncSessionLocal
from .identity import verify_identity_db
from .session import Session, SessionState, session_manager
from .sms import CODE_EXPIRY_MINUTES, MAX_CODE_ATTEMPTS, generate_code, send_sms

_MAX_CASE_FACT_DEPTH = 4
_MAX_CASE_FACT_LIST_ITEMS = 50
_MAX_CASE_FACT_DICT_ITEMS = 100
_MAX_CASE_FACT_KEY_LENGTH = 80
_MAX_CASE_FACT_STRING_LENGTH = 500

# ── Ollama-compatible tool schema definitions ─────────────────────────────────

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "verify_identity",
            "description": (
                "Verify a customer's identity against the customer database. "
                "First call: provide first_name, last_name, phone only — no address. "
                "If that returns could_not_verify, ask for a partial address (street "
                "number or town) and call again with fallback_address_hint set — this "
                "is the last resort before telling the customer you cannot verify them."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "first_name": {
                        "type": "string",
                        "description": "Customer's first name",
                    },
                    "last_name": {
                        "type": "string",
                        "description": "Customer's last name",
                    },
                    "phone": {
                        "type": "string",
                        "description": "Phone number in E.164 format (e.g. +14155551234)",
                    },
                    "fallback_address_hint": {
                        "type": "string",
                        "description": (
                            "ONLY set this on a retry after the first call returned "
                            "could_not_verify. Partial address (street number or town) "
                            "provided by the customer as a last resort. Leave empty on "
                            "the first call."
                        ),
                    },
                },
                "required": ["first_name", "last_name", "phone"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_verification_code",
            "description": (
                "Send a 6-digit SMS verification code to the customer's registered phone. "
                "Only call this after verify_identity has succeeded."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_verification_code",
            "description": (
                "Validate the 6-digit code entered by the customer. "
                "Checks expiry and attempt limits."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "The 6-digit code entered by the customer",
                    },
                },
                "required": ["code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": (
                "Escalate this conversation to a human agent. "
                "Call this when the customer explicitly asks to speak to a human."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_shipment_by_tracking_number",
            "description": (
                "Get a verified customer's shipment by tracking number. "
                "Uses server-side session identity and ignores any customer IDs."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_number": {
                        "type": "string",
                        "description": "Tracking number provided by the customer",
                    }
                },
                "required": ["tracking_number"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_latest_shipment",
            "description": (
                "Get the verified customer's most recent shipment when they do not "
                "have a tracking number or order ID. Uses server-side session identity "
                "only."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_case_facts",
            "description": (
                "Persist transactional facts from this conversation to a durable store "
                "that is included in every subsequent prompt. Call this immediately when "
                "you learn any of: tracking numbers, order IDs, shipment IDs, issue types, "
                "dates, amounts, expected delivery windows, or any other fact that must "
                "survive context summarisation. Pass only the fields you are adding or "
                "updating — existing fields are preserved."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tracking_numbers": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Tracking numbers mentioned by the customer",
                    },
                    "order_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Order IDs or reference numbers",
                    },
                    "issue_type": {
                        "type": "string",
                        "description": (
                            "Short label for the problem: lost, delayed, damaged, "
                            "wrong_item, refund_request, other"
                        ),
                    },
                    "claimed_amount": {
                        "type": "string",
                        "description": "Dollar amount stated by customer (e.g. '$247.83')",
                    },
                    "expected_delivery": {
                        "type": "string",
                        "description": (
                            "Date or window the customer expected delivery"
                            " (ISO-8601 or free text)"
                        ),
                    },
                    "notes": {
                        "type": "string",
                        "description": "Any additional free-form facts worth preserving",
                    },
                },
                "required": [],
            },
        },
    },
]


# ── Dispatcher ────────────────────────────────────────────────────────────────


async def execute_tool(
    name: str, args: dict[str, Any], session_id: str
) -> dict[str, Any]:
    """Dispatch a tool call for the given session.

    Security contract: all lookups use the server-side session keyed by session_id.
    No caller-supplied customer IDs are accepted as input.
    """
    session = session_manager.get_or_create(session_id)

    if name == "verify_identity":
        return await _verify_identity(session, args)
    if name == "send_verification_code":
        return await _send_verification_code(session)
    if name == "check_verification_code":
        return _check_verification_code(session, str(args.get("code", "")))
    if name == "escalate_to_human":
        return _escalate_to_human(session)
    if name == "get_shipment_by_tracking_number":
        return await _get_shipment_by_tracking_number(
            session, str(args.get("tracking_number", ""))
        )
    if name == "get_latest_shipment":
        return await _get_latest_shipment(session)
    if name == "update_case_facts":
        return _update_case_facts(session, args)

    return {"error": f"Unknown tool: {name}"}


# ── Tool implementations ──────────────────────────────────────────────────────


async def _verify_identity(session: Session, args: dict[str, Any]) -> dict[str, Any]:
    first_name = str(args.get("first_name", "")).strip()
    last_name = str(args.get("last_name", "")).strip()
    phone = str(args.get("phone", "")).strip()
    fallback_hint: str | None = args.get("fallback_address_hint") or None
    if fallback_hint:
        fallback_hint = str(fallback_hint).strip() or None

    # Store what the user provided for UI context (e.g. greeting by name)
    session.first_name = first_name
    session.last_name = last_name
    session.phone = phone
    session.state = SessionState.COLLECTING_IDENTITY
    session_manager.update(session)

    customer_id: uuid.UUID | None = await verify_identity_db(
        first_name, last_name, phone, fallback_hint
    )

    if customer_id:
        session.pending_customer_id = customer_id
        session.state = SessionState.CODE_SENT
        session_manager.update(session)
        # Issue OTP immediately on the server side so delivery does not depend
        # on an additional model-initiated tool call.
        send_result = await _send_verification_code(session)
        if send_result.get("status") in {"code_sent", "code_already_sent"}:
            return send_result
        return {"status": "ready_for_code", "next_step": "send_verification_code"}

    # Neutral failure — no "customer not found" wording (enumeration risk)
    return {"status": "could_not_verify", "next_step": "ask_customer_to_retry"}


async def _send_verification_code(session: Session) -> dict[str, Any]:
    if not session.pending_customer_id:
        return {"status": "error", "message": "Identity not yet confirmed"}

    if (
        session.sms_code
        and session.code_sent_at
        and session.state == SessionState.AWAITING_CODE
    ):
        elapsed = (datetime.now(timezone.utc) - session.code_sent_at).total_seconds()
        if elapsed <= CODE_EXPIRY_MINUTES * 60:
            return {
                "status": "code_already_sent",
                "expires_in_minutes": CODE_EXPIRY_MINUTES,
            }

    code = generate_code()
    phone = session.phone or ""

    send_sms(phone, code)

    session.sms_code = code
    session.code_sent_at = datetime.now(timezone.utc)
    session.code_attempts = 0
    session.state = SessionState.AWAITING_CODE
    session_manager.update(session)

    return {
        "status": "code_sent",
        "expires_in_minutes": CODE_EXPIRY_MINUTES,
    }


def _check_verification_code(session: Session, code: str) -> dict[str, Any]:
    if not session.sms_code or not session.code_sent_at:
        return {"status": "error", "message": "No verification code has been sent"}

    elapsed = (datetime.now(timezone.utc) - session.code_sent_at).total_seconds()
    if elapsed > CODE_EXPIRY_MINUTES * 60:
        session.sms_code = None
        session.state = SessionState.COLLECTING_IDENTITY
        session_manager.update(session)
        return {
            "status": "expired",
            "message": "Code expired — please re-verify your identity",
        }

    session.code_attempts += 1
    session_manager.update(session)

    if session.code_attempts >= MAX_CODE_ATTEMPTS:
        session.sms_code = None
        session.code_sent_at = None
        session.code_attempts = 0
        session.state = SessionState.COLLECTING_IDENTITY
        session_manager.update(session)
        return {
            "status": "max_attempts_exceeded",
            "message": "Too many incorrect attempts. Please start over.",
        }

    if code.strip() != session.sms_code:
        remaining = max(0, MAX_CODE_ATTEMPTS - session.code_attempts)
        return {"status": "incorrect_code", "attempts_remaining": remaining}

    # Success — promote pending_customer_id to authoritative customer_id
    session.customer_id = session.pending_customer_id
    session.state = SessionState.VERIFIED
    session.sms_code = None  # one-time use
    session_manager.update(session)

    return {"status": "verified"}


def _escalate_to_human(session: Session) -> dict[str, Any]:
    session.state = SessionState.ESCALATED_TO_HUMAN
    session_manager.update(session)
    return {
        "status": "escalated",
        "first_name": session.first_name,
    }


async def _get_latest_shipment(session: Session) -> dict[str, Any]:
    """Return the latest shipment for this verified session's customer only."""
    if not session.verified or session.customer_id is None:
        return {"status": "not_verified", "shipment": None}

    try:
        shipment = await _load_latest_shipment_for_customer(session.customer_id)
    except Exception:
        return {"status": "unavailable", "shipment": None}

    if shipment is None:
        return {"status": "no_shipments", "shipment": None}
    return {"status": "ok", "shipment": shipment}


async def _get_shipment_by_tracking_number(
    session: Session, tracking_number: str
) -> dict[str, Any]:
    """Return one verified customer's shipment matched by tracking number."""
    if not session.verified or session.customer_id is None:
        return {"status": "not_verified", "shipment": None}

    normalized = tracking_number.strip()
    if not normalized:
        return {"status": "missing_tracking_number", "shipment": None}

    try:
        shipment = await _load_shipment_for_customer_and_tracking(
            session.customer_id, normalized
        )
    except Exception:
        return {"status": "unavailable", "shipment": None}

    if shipment is None:
        return {"status": "not_found", "shipment": None}
    return {"status": "ok", "shipment": shipment}


async def _load_latest_shipment_for_customer(
    customer_id: uuid.UUID,
) -> dict[str, Any] | None:
    """Load latest shipment + packages scoped to one customer ID."""
    async with AsyncSessionLocal() as db:
        shipment_result = await db.execute(
            text("""
                SELECT
                    id,
                    tracking_number,
                    status,
                    carrier,
                    origin,
                    destination,
                    estimated_delivery,
                    last_update
                FROM shipments
                WHERE customer_id = :customer_id
                ORDER BY last_update DESC
                LIMIT 1
                """),
            {"customer_id": customer_id},
        )
        row = shipment_result.fetchone()
        if row is None:
            return None

        shipment_id = uuid.UUID(str(row[0]))
        package_result = await db.execute(
            text("""
                SELECT description, weight_kg, declared_value
                FROM packages
                WHERE shipment_id = :shipment_id
                ORDER BY description ASC
                """),
            {"shipment_id": shipment_id},
        )
        packages = [
            {
                "description": str(p[0]),
                "weight_kg": str(p[1]),
                "declared_value": str(p[2]),
            }
            for p in package_result.fetchall()
        ]

        estimated_delivery = row[6].isoformat() if row[6] else None
        last_update = row[7].isoformat() if row[7] else None

        return {
            "id": str(shipment_id),
            "tracking_number": str(row[1]),
            "status": str(row[2]),
            "carrier": str(row[3]),
            "origin": str(row[4]),
            "destination": str(row[5]),
            "estimated_delivery": estimated_delivery,
            "last_update": last_update,
            "packages": packages,
        }


async def _load_shipment_for_customer_and_tracking(
    customer_id: uuid.UUID,
    tracking_number: str,
) -> dict[str, Any] | None:
    """Load one shipment by tracking number for a specific verified customer."""
    async with AsyncSessionLocal() as db:
        shipment_result = await db.execute(
            text("""
                SELECT
                    id,
                    tracking_number,
                    status,
                    carrier,
                    origin,
                    destination,
                    estimated_delivery,
                    last_update
                FROM shipments
                WHERE customer_id = :customer_id
                  AND tracking_number = :tracking_number
                LIMIT 1
                """),
            {"customer_id": customer_id, "tracking_number": tracking_number},
        )
        row = shipment_result.fetchone()
        if row is None:
            return None

        shipment_id = uuid.UUID(str(row[0]))
        package_result = await db.execute(
            text("""
                SELECT description, weight_kg, declared_value
                FROM packages
                WHERE shipment_id = :shipment_id
                ORDER BY description ASC
                """),
            {"shipment_id": shipment_id},
        )
        packages = [
            {
                "description": str(p[0]),
                "weight_kg": str(p[1]),
                "declared_value": str(p[2]),
            }
            for p in package_result.fetchall()
        ]

        estimated_delivery = row[6].isoformat() if row[6] else None
        last_update = row[7].isoformat() if row[7] else None

        return {
            "id": str(shipment_id),
            "tracking_number": str(row[1]),
            "status": str(row[2]),
            "carrier": str(row[3]),
            "origin": str(row[4]),
            "destination": str(row[5]),
            "estimated_delivery": estimated_delivery,
            "last_update": last_update,
            "packages": packages,
        }


def _update_case_facts(session: Session, args: dict[str, Any]) -> dict[str, Any]:
    """Merge caller-supplied facts into the session's persistent case facts block.

    Existing keys are kept; arrays are replaced (not appended) so the model can
    correct mistakes. Returns the full updated block so the model can confirm.
    """
    # Security hardening: keep keys dynamic, but sanitize untrusted model output
    # before persisting and reinjecting it into future prompts.
    updates: dict[str, Any] = {}
    for raw_key, raw_value in args.items():
        if raw_value is None:
            continue
        key = str(raw_key).strip().replace("\x00", "")[:_MAX_CASE_FACT_KEY_LENGTH]
        if not key:
            continue
        updates[key] = _sanitize_case_fact_value(raw_value)

    session.case_facts.update(updates)
    session_manager.update(session)
    return {"status": "ok", "case_facts": session.case_facts}


def _sanitize_case_fact_value(value: Any, depth: int = 0) -> Any:
    """Sanitize arbitrary JSON-like values from tool arguments.

    Keeps key/value flexibility while enforcing bounded, prompt-safe content.
    """
    if depth > _MAX_CASE_FACT_DEPTH:
        return ""

    if isinstance(value, str):
        return value.strip().replace("\x00", "")[:_MAX_CASE_FACT_STRING_LENGTH]

    if isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, list):
        sanitized_items = [
            _sanitize_case_fact_value(item, depth + 1)
            for item in value[:_MAX_CASE_FACT_LIST_ITEMS]
        ]
        return [item for item in sanitized_items if item not in (None, "")]

    if isinstance(value, dict):
        sanitized_dict: dict[str, Any] = {}
        for raw_key, raw_val in list(value.items())[:_MAX_CASE_FACT_DICT_ITEMS]:
            key = str(raw_key).strip().replace("\x00", "")[:_MAX_CASE_FACT_KEY_LENGTH]
            if not key:
                continue
            sanitized = _sanitize_case_fact_value(raw_val, depth + 1)
            if sanitized in (None, ""):
                continue
            sanitized_dict[key] = sanitized
        return sanitized_dict

    return str(value).strip().replace("\x00", "")[:_MAX_CASE_FACT_STRING_LENGTH]
