"""Tests for structured logging redaction helpers."""

from secureship.logging_config import redact_sensitive


def test_redact_phone_numbers() -> None:
    event = {"event": "sms_sent", "phone": "+14155551234", "msg": "ok"}
    out = redact_sensitive(None, "info", event)
    assert out is not None
    assert out["phone"] == "[REDACTED]"


def test_redact_session_id() -> None:
    event = {"session_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "ok": True}
    out = redact_sensitive(None, "info", event)
    assert out is not None
    assert out["session_id"] == "[REDACTED]"


def test_redact_tokens_and_secrets() -> None:
    event = {
        "authorization": "Bearer secret-token",
        "access_token": "abc",
        "api_key": "xyz",
        "safe": "visible",
    }
    out = redact_sensitive(None, "info", event)
    assert out is not None
    assert out["authorization"] == "[REDACTED]"
    assert out["access_token"] == "[REDACTED]"
    assert out["api_key"] == "[REDACTED]"
    assert out["safe"] == "visible"


def test_redact_nested_and_message_text() -> None:
    event = {
        "detail": {"phone_number": "+442071838750", "note": "hi"},
        "message": "user +14155551234 session aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    }
    out = redact_sensitive(None, "info", event)
    assert out is not None
    assert out["detail"]["phone_number"] == "[REDACTED]"
    assert "+14155551234" not in out["message"]
    assert "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" not in out["message"]
    assert "[REDACTED]" in out["message"]
