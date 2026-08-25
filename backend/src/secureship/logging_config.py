"""Structured logging with sensitive-field redaction."""

from __future__ import annotations

import logging
import re
from typing import Any

import structlog

_PHONE_RE = re.compile(r"\+[1-9]\d{7,14}")
_UUID_RE = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
)

_SENSITIVE_KEYS = frozenset(
    {
        "phone",
        "phone_number",
        "session_id",
        "sid",
        "authorization",
        "access_token",
        "refresh_token",
        "id_token",
        "api_key",
        "auth_token",
        "twilio_auth_token",
        "sms_code",
        "code",
        "token",
        "password",
        "secret",
        "client_secret",
    }
)


def _redact_string(value: str) -> str:
    value = _PHONE_RE.sub("[REDACTED]", value)
    value = _UUID_RE.sub("[REDACTED]", value)
    return value


def _redact_value(key: str | None, value: Any) -> Any:
    if key is not None and key.lower() in _SENSITIVE_KEYS:
        return "[REDACTED]"
    if isinstance(value, dict):
        return {k: _redact_value(str(k), v) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact_value(None, item) for item in value]
    if isinstance(value, str):
        return _redact_string(value)
    return value


def redact_sensitive(
    _logger: Any, _method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """structlog processor — redact phones, session IDs, tokens from log events."""
    return {k: _redact_value(k, v) for k, v in event_dict.items()}


def configure_logging(*, json_logs: bool = True, level: int = logging.INFO) -> None:
    """Configure stdlib + structlog with redaction. Safe to call once at startup."""
    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        redact_sensitive,
    ]

    if json_logs:
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
