"""Tests for the tool security gate — the single enforcement point (Epic F3)."""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from secureship.session import Session, SessionManager, SessionState
from secureship.tools import (
    _check_verification_code,
    _escalate_to_human,
    _send_verification_code,
    _verify_identity,
    execute_tool,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def anonymous_session() -> Session:
    return Session(session_id="test-anon")


@pytest.fixture
def verified_session() -> Session:
    s = Session(session_id="test-verified")
    s.state = SessionState.VERIFIED
    s.customer_id = uuid.uuid4()
    s.first_name = "John"
    s.phone = "+14155551234"
    return s


@pytest.fixture
def session_with_pending_customer() -> Session:
    s = Session(session_id="test-pending")
    s.state = SessionState.CODE_SENT
    s.pending_customer_id = uuid.uuid4()
    s.phone = "+14155559999"
    return s


# ── verify_identity tool ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_identity_match(anonymous_session: Session) -> None:
    """Matching identity sets pending_customer_id and state=CODE_SENT."""
    customer_uuid = uuid.uuid4()

    with patch(
        "secureship.tools.verify_identity_db", new_callable=AsyncMock
    ) as mock_db, patch(
        "secureship.tools.session_manager"
    ) as mock_mgr:
        mock_db.return_value = customer_uuid
        mock_mgr.get_or_create.return_value = anonymous_session
        mock_mgr.update.side_effect = lambda s: None

        result = await _verify_identity(
            anonymous_session,
            {
                "first_name": "John",
                "last_name": "Doe",
                "address": "123 Main St",
                "phone": "+14155551234",
            },
        )

    assert result["status"] == "ready_for_code"
    assert anonymous_session.state == SessionState.CODE_SENT
    assert anonymous_session.pending_customer_id == customer_uuid


@pytest.mark.asyncio
async def test_verify_identity_no_match(anonymous_session: Session) -> None:
    """Non-matching identity returns neutral failure — no 'customer not found' wording."""
    with patch(
        "secureship.tools.verify_identity_db", new_callable=AsyncMock
    ) as mock_db, patch(
        "secureship.tools.session_manager"
    ) as mock_mgr:
        mock_db.return_value = None
        mock_mgr.update.side_effect = lambda s: None

        result = await _verify_identity(
            anonymous_session,
            {
                "first_name": "Jane",
                "last_name": "Unknown",
                "address": "999 Nowhere",
                "phone": "+10000000000",
            },
        )

    assert result["status"] == "could_not_verify"
    # Verify neutral wording — no "found" or "not found" language
    assert "found" not in str(result).lower()
    assert anonymous_session.pending_customer_id is None


# ── check_verification_code tool ─────────────────────────────────────────────


def test_check_code_correct(session_with_pending_customer: Session) -> None:
    """Correct code promotes pending_customer_id to customer_id and sets VERIFIED."""
    session_with_pending_customer.sms_code = "123456"
    session_with_pending_customer.code_sent_at = datetime.now(timezone.utc)
    session_with_pending_customer.code_attempts = 0

    result = _check_verification_code(session_with_pending_customer, "123456")

    assert result["status"] == "verified"
    assert session_with_pending_customer.state == SessionState.VERIFIED
    expected_id = session_with_pending_customer.pending_customer_id
    assert session_with_pending_customer.customer_id == expected_id
    # Code must be cleared after use
    assert session_with_pending_customer.sms_code is None


def test_check_code_incorrect_increments_attempts(
    session_with_pending_customer: Session,
) -> None:
    """Incorrect code increments attempt counter without advancing state."""
    session_with_pending_customer.sms_code = "123456"
    session_with_pending_customer.code_sent_at = datetime.now(timezone.utc)
    session_with_pending_customer.code_attempts = 0

    result = _check_verification_code(session_with_pending_customer, "000000")

    assert result["status"] == "incorrect_code"
    assert session_with_pending_customer.state != SessionState.VERIFIED
    assert session_with_pending_customer.code_attempts == 1


def test_check_code_expired(session_with_pending_customer: Session) -> None:
    """Expired code resets state to collecting_identity."""
    session_with_pending_customer.sms_code = "123456"
    session_with_pending_customer.code_sent_at = datetime.now(timezone.utc) - timedelta(minutes=15)
    session_with_pending_customer.code_attempts = 0

    result = _check_verification_code(session_with_pending_customer, "123456")

    assert result["status"] == "expired"
    assert session_with_pending_customer.state == SessionState.COLLECTING_IDENTITY


def test_check_code_max_attempts_exceeded(session_with_pending_customer: Session) -> None:
    """Exceeding attempt limit returns max_attempts_exceeded regardless of code."""
    session_with_pending_customer.sms_code = "123456"
    session_with_pending_customer.code_sent_at = datetime.now(timezone.utc)
    session_with_pending_customer.code_attempts = 3  # already at MAX

    result = _check_verification_code(session_with_pending_customer, "123456")

    assert result["status"] == "max_attempts_exceeded"
    assert session_with_pending_customer.state != SessionState.VERIFIED


# ── send_verification_code tool ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_send_code_requires_pending_customer(anonymous_session: Session) -> None:
    """Cannot send code without a pending_customer_id."""
    result = await _send_verification_code(anonymous_session)
    assert result["status"] == "error"
    assert anonymous_session.sms_code is None


@pytest.mark.asyncio
async def test_send_code_transitions_to_awaiting_code(
    session_with_pending_customer: Session,
) -> None:
    """Successful send sets sms_code and transitions to AWAITING_CODE."""
    with patch("secureship.tools.send_sms"), patch(
        "secureship.tools.session_manager"
    ) as mock_mgr:
        mock_mgr.update.side_effect = lambda s: None
        result = await _send_verification_code(session_with_pending_customer)

    assert result["status"] == "code_sent"
    assert session_with_pending_customer.state == SessionState.AWAITING_CODE
    assert session_with_pending_customer.sms_code is not None
    assert len(session_with_pending_customer.sms_code) == 6


# ── escalate_to_human tool ────────────────────────────────────────────────────


def test_escalate_sets_state(anonymous_session: Session) -> None:
    """Escalation from anonymous state works and tags the session."""
    result = _escalate_to_human(anonymous_session)
    assert result["status"] == "escalated"
    assert anonymous_session.state == SessionState.ESCALATED_TO_HUMAN


def test_escalate_from_verified_preserves_first_name(verified_session: Session) -> None:
    """Escalation from verified state returns first_name for personalized greeting."""
    result = _escalate_to_human(verified_session)
    assert result["status"] == "escalated"
    assert result["first_name"] == "John"
    assert verified_session.state == SessionState.ESCALATED_TO_HUMAN


# ── execute_tool dispatcher ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_execute_tool_unknown_name() -> None:
    """Unknown tool names return an error without raising."""
    mgr = SessionManager()
    mgr.get_or_create("sess-x")
    with patch("secureship.tools.session_manager", mgr):
        result = await execute_tool("nonexistent_tool", {}, "sess-x")
    assert "error" in result
