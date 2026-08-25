"""Tests for CORS origins config and Ollama timeout user copy."""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from secureship.chat import _stream_ollama
from secureship.config import Settings


def test_cors_origins_parsed_from_env_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "https://app.example.com, https://admin.example.com",
    )
    settings = Settings(_env_file=None)
    assert settings.cors_origin_list == [
        "https://app.example.com",
        "https://admin.example.com",
    ]


def test_cors_origins_default_localhost(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    settings = Settings(_env_file=None)
    assert "http://localhost:3000" in settings.cors_origin_list


@pytest.mark.asyncio
async def test_stream_ollama_timeout_yields_user_friendly_message() -> None:
    mock_client = MagicMock()

    async def _aenter(_self=None):
        return mock_client

    async def _aexit(*_args):
        return None

    mock_client.__aenter__ = _aenter
    mock_client.__aexit__ = _aexit

    # client.stream(...) is used as async context manager that raises on enter
    stream_cm = MagicMock()
    stream_cm.__aenter__.side_effect = httpx.TimeoutException("timed out")
    stream_cm.__aexit__ = _aexit
    mock_client.stream = MagicMock(return_value=stream_cm)

    with (
        patch("secureship.chat.httpx.AsyncClient", return_value=mock_client),
        patch("secureship.chat.settings.ollama_max_retries", 1),
    ):
        chunks = [c async for c in _stream_ollama([{"role": "user", "content": "hi"}])]

    assert chunks == ["Sorry, I took too long. Please try again."]
