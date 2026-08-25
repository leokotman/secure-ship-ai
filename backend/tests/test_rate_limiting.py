"""Rate limiting tests for POST /chat (Week 5)."""

import uuid
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, Request

from secureship.main import ChatRequest, chat, enforce_chat_rate_limit
from secureship.rate_limit import RateLimiter
from secureship.session import SessionManager


def _mock_request(ip: str = "1.2.3.4") -> MagicMock:
    req = MagicMock(spec=Request)
    req.client = MagicMock()
    req.client.host = ip
    req.headers = {}
    return req


async def _mock_stream(
    *_args: object, **_kwargs: object
) -> AsyncGenerator[str, None]:
    yield "ok"


@pytest.mark.asyncio
async def test_chat_within_rate_limit_succeeds() -> None:
    mgr = SessionManager()
    sid = str(uuid.uuid4())
    limiter = RateLimiter(max_requests=30, window_seconds=60)

    with (
        patch("secureship.main.session_manager", mgr),
        patch("secureship.main.chat_rate_limiter", limiter),
        patch(
            "secureship.main.load_session_data",
            new=AsyncMock(return_value=("anonymous", None, {})),
        ),
        patch("secureship.main.append_chat_message", new=AsyncMock()),
        patch("secureship.main.get_transcript", new=AsyncMock(return_value=[])),
        patch("secureship.main.update_session_state", new=AsyncMock()),
        patch("secureship.main.stream_chat_response", new=_mock_stream),
    ):
        response = await chat(ChatRequest(message="hi", session_id=sid), _mock_request())
        chunks = [c async for c in response.body_iterator]
        assert chunks == ["ok"]


@pytest.mark.asyncio
async def test_chat_exceeding_rate_limit_returns_429() -> None:
    mgr = SessionManager()
    sid = str(uuid.uuid4())
    limiter = RateLimiter(max_requests=3, window_seconds=60)

    with (
        patch("secureship.main.session_manager", mgr),
        patch("secureship.main.chat_rate_limiter", limiter),
        patch(
            "secureship.main.load_session_data",
            new=AsyncMock(return_value=("anonymous", None, {})),
        ),
        patch("secureship.main.append_chat_message", new=AsyncMock()),
        patch("secureship.main.get_transcript", new=AsyncMock(return_value=[])),
        patch("secureship.main.update_session_state", new=AsyncMock()),
        patch("secureship.main.stream_chat_response", new=_mock_stream),
    ):
        for i in range(3):
            await chat(
                ChatRequest(message=f"msg {i}", session_id=sid),
                _mock_request(),
            )

        with pytest.raises(HTTPException) as exc_info:
            await chat(
                ChatRequest(message="one too many", session_id=sid),
                _mock_request(),
            )

    assert exc_info.value.status_code == 429
    assert "Retry-After" in exc_info.value.headers
    assert int(exc_info.value.headers["Retry-After"]) >= 1


def test_enforce_chat_rate_limit_uses_ip_fallback() -> None:
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    with patch("secureship.main.chat_rate_limiter", limiter):
        enforce_chat_rate_limit(None, "9.9.9.9")
        enforce_chat_rate_limit(None, "9.9.9.9")
        with pytest.raises(HTTPException) as exc_info:
            enforce_chat_rate_limit(None, "9.9.9.9")
        assert exc_info.value.status_code == 429
        # Different IP still allowed
        enforce_chat_rate_limit(None, "8.8.8.8")


def test_rate_limiter_falls_back_to_ip_when_no_session() -> None:
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    assert limiter.check("ip:9.9.9.9")[0] is True
    assert limiter.check("ip:9.9.9.9")[0] is True
    allowed, retry_after = limiter.check("ip:9.9.9.9")
    assert allowed is False
    assert retry_after >= 1
    assert limiter.check("ip:8.8.8.8")[0] is True
