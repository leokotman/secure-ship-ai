"""Tests for chat prompt two-tool routing and tracking extraction (Week 5 Phase 1a)."""

import uuid

import pytest

from secureship.chat import _build_system_prompt, _extract_tracking_number
from secureship.session import Session, SessionState


@pytest.fixture
def verified_session() -> Session:
    s = Session(session_id="prompt-verified")
    s.state = SessionState.VERIFIED
    s.customer_id = uuid.uuid4()
    s.first_name = "Alex"
    return s


def test_system_prompt_teaches_all_vs_specific_tool_routing(
    verified_session: Session,
) -> None:
    """Prompt must explicitly map all-shipments vs specific-tracking to the two tools."""
    prompt = _build_system_prompt(verified_session)
    prompt_l = prompt.lower()

    assert "lookup_shipments" in prompt_l
    assert "get_shipment_status" in prompt_l

    # Explicit all-query examples (week5 locked wording)
    assert "my orders" in prompt_l
    assert "all shipments" in prompt_l
    assert "what do i have" in prompt_l

    # All → lookup_shipments (no tracking arg)
    assert "lookup_shipments" in prompt_l and "no args" in prompt_l
    assert "do not pass a tracking_number" in prompt_l

    # Specific → get_shipment_status
    assert "tracking number" in prompt_l
    assert "get_shipment_status" in prompt_l
    assert "focus your reply on that shipment only" in prompt_l

    # Must NOT teach the rejected single-tool fiction
    assert "lookup_shipments(customer_id" not in prompt
    assert "lookup_shipments(..., tracking_number" not in prompt
    assert 'lookup_shipments(customer_id=X, tracking_number="' not in prompt


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Show me all my orders", None),
        ("What shipments do I have?", None),
        ("Tell me about ADMIN-TEST-002", "ADMIN-TEST-002"),
        ("status of SS2608000059 please", "SS2608000059"),
        ("Where is 1Z999AA10123456784?", "1Z999AA10123456784"),
    ],
)
def test_extract_tracking_number(text: str, expected: str | None) -> None:
    assert _extract_tracking_number(text) == expected
