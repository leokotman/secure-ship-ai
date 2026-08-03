"""Regression tests for session state rehydration in chat/session endpoints."""

import uuid
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest

from secureship.main import (
    ChatRequest,
    SessionResponse,
    VerifySmsRequest,
    chat,
    get_session,
    verify_sms,
)
from secureship.session import Session, SessionManager, SessionState


async def _stream_only_state_event() -> AsyncGenerator[str, None]:
    """Yield only the final metadata event used by the frontend."""
    yield '\x00{"s":"anonymous","sid":"sess-1"}'


async def _mock_stream_chat_response(
    *_args: object, **_kwargs: object
) -> AsyncGenerator[str, None]:
    """Mocked chat streamer used by route tests."""
    async for chunk in _stream_only_state_event():
        yield chunk


@pytest.mark.asyncio
async def test_chat_does_not_restore_ephemeral_otp_states() -> None:
    """DB state code_sent/awaiting_code must not reactivate OTP UI on reload."""
    mgr = SessionManager()
    session_id = "sess-1"

    with (
        patch("secureship.main.session_manager", mgr),
        patch(
            "secureship.main.load_session_data",
            new=AsyncMock(return_value=(SessionState.CODE_SENT.value, None, {})),
        ),
        patch("secureship.main.append_chat_message", new=AsyncMock()),
        patch("secureship.main.get_transcript", new=AsyncMock(return_value=[])),
        patch("secureship.main.update_session_state", new=AsyncMock()),
        patch("secureship.main.stream_chat_response", new=_mock_stream_chat_response),
    ):
        request = ChatRequest(message="hi", session_id=session_id)
        response = await chat(request)

        chunks = [chunk async for chunk in response.body_iterator]
        assert chunks == ['\x00{"s":"anonymous","sid":"sess-1"}']

        restored = mgr.get(session_id)
        assert restored is not None
        assert restored.state == SessionState.ANONYMOUS


@pytest.mark.asyncio
async def test_chat_restores_verified_state() -> None:
    """Durable non-ephemeral states are still restored from DB."""
    mgr = SessionManager()
    session_id = "sess-verified"
    customer_id = uuid.uuid4()

    with (
        patch("secureship.main.session_manager", mgr),
        patch(
            "secureship.main.load_session_data",
            new=AsyncMock(
                return_value=(
                    SessionState.VERIFIED.value,
                    customer_id,
                    {"tracking_number": "TRK-123"},
                )
            ),
        ),
        patch("secureship.main.append_chat_message", new=AsyncMock()),
        patch("secureship.main.get_transcript", new=AsyncMock(return_value=[])),
        patch("secureship.main.update_session_state", new=AsyncMock()),
        patch("secureship.main.stream_chat_response", new=_mock_stream_chat_response),
    ):
        request = ChatRequest(message="status?", session_id=session_id)
        response = await chat(request)
        _ = [chunk async for chunk in response.body_iterator]

        restored = mgr.get(session_id)
        assert restored is not None
        assert restored.state == SessionState.VERIFIED
        assert restored.customer_id == customer_id
        assert restored.case_facts == {"tracking_number": "TRK-123"}


@pytest.mark.asyncio
async def test_get_session_masks_ephemeral_states() -> None:
    """Session hydration endpoint must never return OTP-only states on reload."""
    with (
        patch(
            "secureship.main.load_session_data",
            new=AsyncMock(return_value=(SessionState.AWAITING_CODE.value, None, {})),
        ),
        patch(
            "secureship.main.get_transcript",
            new=AsyncMock(
                return_value=[
                    {"role": "user", "content": "hello"},
                    {"role": "assistant", "content": "hi"},
                    {"role": "tool", "content": "ignore"},
                ]
            ),
        ),
    ):
        response: SessionResponse = await get_session("sess-2")

    assert response.state == SessionState.ANONYMOUS.value
    assert response.messages == [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi"},
    ]


@pytest.mark.asyncio
async def test_verify_sms_resends_code_when_state_is_code_sent() -> None:
    """If no active code exists but state=code_sent, verify endpoint resends OTP."""
    session = Session(session_id="sess-resend")
    session.state = SessionState.CODE_SENT
    session.pending_customer_id = uuid.uuid4()
    session.phone = "+14155550005"

    with (
        patch(
            "secureship.main.session_manager.get",
            side_effect=[session, session],
        ),
        patch(
            "secureship.main.execute_tool",
            new=AsyncMock(
                side_effect=[
                    {
                        "status": "error",
                        "message": "No verification code has been sent",
                    },
                    {"status": "code_sent", "expires_in_minutes": 10},
                ]
            ),
        ) as mock_execute,
        patch("secureship.main.update_session_state", new=AsyncMock()),
    ):
        response = await verify_sms(
            VerifySmsRequest(session_id="sess-resend", code="111111")
        )

    assert response.verified is False
    assert response.state == SessionState.CODE_SENT.value
    assert response.reason == "code_resent"
    assert mock_execute.await_count == 2


@pytest.mark.asyncio
async def test_verify_sms_incorrect_code_returns_reason() -> None:
    """Incorrect code path should report reason for better UX messaging."""
    session = Session(session_id="sess-incorrect")
    session.state = SessionState.AWAITING_CODE

    with (
        patch("secureship.main.session_manager.get", return_value=session),
        patch(
            "secureship.main.execute_tool",
            new=AsyncMock(return_value={"status": "incorrect_code"}),
        ),
        patch("secureship.main.update_session_state", new=AsyncMock()),
    ):
        response = await verify_sms(
            VerifySmsRequest(session_id="sess-incorrect", code="000000")
        )

    assert response.verified is False
    assert response.reason == "incorrect_code"
