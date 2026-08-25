"""Input validation tests — message length, UUID session_id, E.164 phone (Week 5)."""

import uuid

import pytest
from pydantic import ValidationError

from secureship.main import ChatRequest, VerifySmsRequest
from secureship.session import Session, SessionState
from secureship.tools import _verify_identity
from secureship.validation import is_e164_phone, is_uuid_string


def test_chat_rejects_empty_message() -> None:
    with pytest.raises(ValidationError):
        ChatRequest(message="")


def test_chat_rejects_message_over_5000_chars() -> None:
    with pytest.raises(ValidationError):
        ChatRequest(message="x" * 5001)


def test_chat_accepts_message_at_5000_chars() -> None:
    req = ChatRequest(message="x" * 5000)
    assert len(req.message) == 5000


def test_chat_rejects_non_uuid_session_id() -> None:
    with pytest.raises(ValidationError):
        ChatRequest(message="hello", session_id="not-a-uuid")


def test_chat_accepts_uuid_session_id() -> None:
    sid = str(uuid.uuid4())
    req = ChatRequest(message="hello", session_id=sid)
    assert req.session_id == sid


def test_chat_allows_omitted_session_id() -> None:
    req = ChatRequest(message="hello")
    assert req.session_id is None


def test_verify_sms_rejects_non_uuid_session_id() -> None:
    with pytest.raises(ValidationError):
        VerifySmsRequest(session_id="sess-bad", code="123456")


def test_is_uuid_string() -> None:
    assert is_uuid_string(str(uuid.uuid4())) is True
    assert is_uuid_string("sess-1") is False


@pytest.mark.parametrize(
    ("phone", "ok"),
    [
        ("+14155551234", True),
        ("+442071838750", True),
        ("14155551234", False),
        ("+0123", False),
        ("not-a-phone", False),
        ("", False),
    ],
)
def test_is_e164_phone(phone: str, ok: bool) -> None:
    assert is_e164_phone(phone) is ok


@pytest.mark.asyncio
async def test_verify_identity_rejects_non_e164_phone() -> None:
    """Invalid phone format fails closed before any DB lookup."""
    session = Session(session_id=str(uuid.uuid4()))
    session.state = SessionState.ANONYMOUS

    from unittest.mock import AsyncMock, patch

    with patch(
        "secureship.tools.verify_identity_db", new_callable=AsyncMock
    ) as mock_db:
        result = await _verify_identity(
            session,
            {
                "first_name": "John",
                "last_name": "Doe",
                "phone": "555-1234",
            },
        )

    assert result["status"] == "invalid_phone"
    mock_db.assert_not_awaited()
