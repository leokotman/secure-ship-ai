"""Chat message handling and Claude API integration."""

from typing import Any, Generator, cast

import anthropic

from secureship.config import settings

# Use the most cost-effective model; upgrade to sonnet/opus only if needed
DEFAULT_MODEL = "claude-3-5-haiku-20241022"


def get_chat_response(messages: list[dict[str, Any]]) -> str:
    """
    Get a response from Claude API.

    Args:
        messages: List of messages in OpenAI format (role, content)

    Returns:
        Claude's response text
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    response = client.messages.create(
        model=DEFAULT_MODEL,
        max_tokens=1024,
        system="You are SecureShip, a helpful shipment support bot. "
        "Help customers check their shipment status. "
        "For now, you can have a friendly conversation. "
        "Later, we'll add identity verification and shipment lookups.",
        messages=cast(list[Any], messages),
    )

    text_block = response.content[0]
    if isinstance(text_block, anthropic.types.TextBlock):
        return text_block.text
    return str(text_block)


def stream_chat_response(messages: list[dict[str, Any]]) -> Generator[str, None, None]:
    """
    Stream a response from Claude API.

    Yields text chunks as they arrive from the API.

    Args:
        messages: List of messages in OpenAI format (role, content)

    Yields:
        Text chunks from Claude's response
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    with client.messages.stream(
        model=DEFAULT_MODEL,
        max_tokens=1024,
        system="You are SecureShip, a helpful shipment support bot. "
        "Help customers check their shipment status. "
        "For now, you can have a friendly conversation. "
        "Later, we'll add identity verification and shipment lookups.",
        messages=cast(list[Any], messages),
    ) as stream:
        for text in stream.text_stream:
            yield text
