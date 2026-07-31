"""Chat message handling and Ollama API integration."""

import json
from collections.abc import Generator
from typing import Any

import httpx

from .config import settings

# NOTE: will be replaced with the full SECURITY RULES block in Week 2
SYSTEM_PROMPT = (
    "You are SecureShip, a helpful shipment support bot. "
    "Help customers check their shipment status. "
    "For now, you can have a friendly conversation. "
    "Later, we'll add identity verification and shipment lookups."
)


def stream_chat_response(messages: list[dict[str, Any]]) -> Generator[str, None, None]:
    """
    Stream a response from Ollama API.

    Yields text chunks as they arrive from the API.

    Args:
        messages: List of chat messages in role/content format

    Yields:
        Text chunks from the model response
    """
    payload: dict[str, Any] = {
        "model": settings.ollama_model,
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            *messages,
        ],
        "stream": True,
    }

    with httpx.Client(timeout=60.0) as client:
        with client.stream(
            "POST",
            f"{settings.ollama_host}/api/chat",
            json=payload,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue

                data = json.loads(line)
                content = data.get("message", {}).get("content", "")
                if isinstance(content, str) and content:
                    yield content
