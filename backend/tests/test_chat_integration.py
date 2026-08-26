"""Integration tests: chat stream → forced tool → tool layer (mock Ollama, Week 5 Phase 5)."""

import json
import uuid
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest

from secureship.chat import stream_chat_response
from secureship.session import Session, SessionManager, SessionState


@pytest.fixture
def verified_session() -> Session:
    s = Session(session_id=str(uuid.uuid4()))
    s.state = SessionState.VERIFIED
    s.customer_id = uuid.uuid4()
    s.first_name = "Alex"
    return s


async def _collect_stream(
    messages: list[dict[str, str]],
    session_id: str,
    session: Session,
) -> tuple[str, dict | None]:
    """Collect streamed text and parse the trailing metadata event."""
    text_parts: list[str] = []
    meta: dict | None = None
    async for chunk in stream_chat_response(messages, session_id, session):
        if chunk.startswith("\x00"):
            meta = json.loads(chunk[1:])
        else:
            text_parts.append(chunk)
    return "".join(text_parts), meta


@pytest.mark.asyncio
async def test_verified_all_shipments_query_forces_lookup_when_llm_skips_tools(
    verified_session: Session,
) -> None:
    """Chat → tool: verified 'all orders' query forces lookup_shipments if LLM omits tools."""
    mgr = SessionManager()
    mgr._sessions[verified_session.session_id] = verified_session
    shipments = [
        {"id": "s1", "tracking_number": "SS2508000001", "status": "in_transit"},
        {"id": "s2", "tracking_number": "SS2508000002", "status": "delivered"},
    ]

    async def _empty_tools(*_args: object, **_kwargs: object) -> list[dict]:
        return []

    async def _fake_stream(*_args: object, **_kwargs: object) -> AsyncGenerator[str, None]:
        yield "Here are your shipments."

    with (
        patch("secureship.chat._MAX_TOOL_ROUNDS", 1),
        patch("secureship.tools.session_manager", mgr),
        patch("secureship.chat._call_ollama_for_tools", side_effect=_empty_tools),
        patch("secureship.chat._stream_ollama", side_effect=_fake_stream),
        patch(
            "secureship.tools._load_all_shipments_for_customer",
            new_callable=AsyncMock,
            return_value=shipments,
        ) as mock_load,
    ):
        text, meta = await _collect_stream(
            [{"role": "user", "content": "Show me all my orders"}],
            verified_session.session_id,
            verified_session,
        )

    mock_load.assert_awaited_once_with(verified_session.customer_id)
    assert meta is not None
    assert meta.get("shipment", {}).get("tool") == "lookup_shipments"
    assert len(meta["shipment"]["data"]["shipments"]) == 2


@pytest.mark.asyncio
async def test_verified_specific_tracking_forces_get_shipment_status(
    verified_session: Session,
) -> None:
    """Chat → tool: specific tracking query forces get_shipment_status when LLM skips tools."""
    mgr = SessionManager()
    mgr._sessions[verified_session.session_id] = verified_session
    tracking = "ADMIN-TEST-002"
    shipment = {"id": "s55", "tracking_number": tracking, "status": "in_transit"}

    async def _empty_tools(*_args: object, **_kwargs: object) -> list[dict]:
        return []

    async def _fake_stream(*_args: object, **_kwargs: object) -> AsyncGenerator[str, None]:
        yield f"Status for {tracking}."

    with (
        patch("secureship.chat._MAX_TOOL_ROUNDS", 1),
        patch("secureship.tools.session_manager", mgr),
        patch("secureship.chat._call_ollama_for_tools", side_effect=_empty_tools),
        patch("secureship.chat._stream_ollama", side_effect=_fake_stream),
        patch(
            "secureship.tools._load_shipment_for_customer_and_tracking",
            new_callable=AsyncMock,
            return_value=shipment,
        ) as mock_load,
    ):
        _text, meta = await _collect_stream(
            [{"role": "user", "content": f"What's the status of {tracking}?"}],
            verified_session.session_id,
            verified_session,
        )

    mock_load.assert_awaited_once_with(verified_session.customer_id, tracking)
    assert meta is not None
    assert meta.get("shipment", {}).get("tool") == "get_shipment_status"
    assert meta["shipment"]["data"]["shipment"]["tracking_number"] == tracking


@pytest.mark.asyncio
async def test_anonymous_shipment_query_does_not_force_tools() -> None:
    """Unverified users must not get forced shipment tool calls."""
    session = Session(session_id=str(uuid.uuid4()))
    mgr = SessionManager()
    mgr._sessions[session.session_id] = session

    async def _empty_tools(*_args: object, **_kwargs: object) -> list[dict]:
        return []

    async def _fake_stream(*_args: object, **_kwargs: object) -> AsyncGenerator[str, None]:
        yield "Please verify your identity first."

    with (
        patch("secureship.chat._MAX_TOOL_ROUNDS", 1),
        patch("secureship.tools.session_manager", mgr),
        patch("secureship.chat._call_ollama_for_tools", side_effect=_empty_tools),
        patch("secureship.chat._stream_ollama", side_effect=_fake_stream),
        patch(
            "secureship.tools._load_all_shipments_for_customer",
            new_callable=AsyncMock,
        ) as mock_load,
    ):
        text, meta = await _collect_stream(
            [{"role": "user", "content": "Show me all my shipments"}],
            session.session_id,
            session,
        )

    assert "verify" in text.lower()
    mock_load.assert_not_awaited()
    assert meta is not None
    assert "shipment" not in meta
