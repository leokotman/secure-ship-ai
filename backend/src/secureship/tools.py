"""Ollama tool definitions and execution dispatcher.

This module is the single security enforcement point for tool calls.
All tools operate exclusively on the server-side session — never on
model- or user-supplied IDs or customer data (Epic F3).
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from .identity import verify_identity_db
from .session import Session, SessionState, session_manager
from .sms import CODE_EXPIRY_MINUTES, MAX_CODE_ATTEMPTS, generate_code, send_sms

# ── Ollama-compatible tool schema definitions ─────────────────────────────────

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "verify_identity",
            "description": (
                "Verify a customer's identity by matching their provided details "
                "against the customer database. Call this once you have collected "
                "first name, last name, address, and phone number from the conversation."
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
                    "address": {
                        "type": "string",
                        "description": "Customer's full address",
                    },
                    "phone": {
                        "type": "string",
                        "description": "Phone number in E.164 format (e.g. +14155551234)",
                    },
                },
                "required": ["first_name", "last_name", "address", "phone"],
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
    if name == "update_case_facts":
        return _update_case_facts(session, args)

    return {"error": f"Unknown tool: {name}"}


# ── Tool implementations ──────────────────────────────────────────────────────


async def _verify_identity(session: Session, args: dict[str, Any]) -> dict[str, Any]:
    first_name = str(args.get("first_name", "")).strip()
    last_name = str(args.get("last_name", "")).strip()
    address = str(args.get("address", "")).strip()
    phone = str(args.get("phone", "")).strip()

    # Store what the user provided for UI context (e.g. greeting by name)
    session.first_name = first_name
    session.last_name = last_name
    session.address = address
    session.phone = phone
    session.state = SessionState.COLLECTING_IDENTITY
    session_manager.update(session)

    customer_id: uuid.UUID | None = await verify_identity_db(
        first_name, last_name, address, phone
    )

    if customer_id:
        session.pending_customer_id = customer_id
        session.state = SessionState.CODE_SENT
        session_manager.update(session)
        # Neutral language — never "found" or "matched"
        return {"status": "ready_for_code", "next_step": "send_verification_code"}

    # Neutral failure — no "customer not found" wording (enumeration risk)
    return {"status": "could_not_verify", "next_step": "ask_customer_to_retry"}


async def _send_verification_code(session: Session) -> dict[str, Any]:
    if not session.pending_customer_id:
        return {"status": "error", "message": "Identity not yet confirmed"}

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

    if session.code_attempts > MAX_CODE_ATTEMPTS:
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


def _update_case_facts(session: Session, args: dict[str, Any]) -> dict[str, Any]:
    """Merge caller-supplied facts into the session's persistent case facts block.

    Existing keys are kept; arrays are replaced (not appended) so the model can
    correct mistakes. Returns the full updated block so the model can confirm.
    """
    # Drop None values the model may send for unused fields
    updates = {k: v for k, v in args.items() if v is not None}
    session.case_facts.update(updates)
    session_manager.update(session)
    return {"status": "ok", "case_facts": session.case_facts}
