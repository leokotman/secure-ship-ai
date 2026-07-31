"""Chat message handling and Claude API integration."""

from typing import Any, Generator, cast

import anthropic

from secureship.config import settings

# Use the most cost-effective model; upgrade to sonnet/opus only if needed
DEFAULT_MODEL = "claude-3-5-haiku-20241022"

# NOTE: will be replaced with the full SECURITY RULES block in Week 2
SYSTEM_PROMPT = (
    "You are SecureShip, a helpful shipment support bot. "
    "Help customers check their shipment status. "
    "For now, you can have a friendly conversation. "
    "Later, we'll add identity verification and shipment lookups."
)

# Module-level client — avoids re-reading the API key on every request
_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)


def stream_chat_response(messages: list[dict[str, Any]]) -> Generator[str, None, None]:
    """
    Stream a response from Claude API.

    Yields text chunks as they arrive from the API.

    Args:
        messages: List of chat messages in role/content format

    Yields:
        Text chunks from Claude's response
    """
    with _client.messages.stream(
        model=DEFAULT_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=cast(list[Any], messages),
    ) as stream:
        for text in stream.text_stream:
            yield text
