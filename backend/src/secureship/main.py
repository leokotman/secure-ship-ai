"""FastAPI application entry point."""

import logging
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .chat import stream_chat_response
from .config import settings
from .database import append_chat_message, create_tables

logger = logging.getLogger(__name__)

app = FastAPI(title="SecureShip", version="0.1.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    """Chat request payload."""

    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = None


@app.on_event("startup")
async def startup_event() -> None:
    """Create required database tables when the app starts."""
    await create_tables()


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}


@app.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    """
    Chat endpoint that streams Claude responses.

    Args:
        request: Chat request with message and optional session_id

    Returns:
        Streaming response with text chunks from Claude
    """
    session_id = request.session_id or str(uuid.uuid4())
    messages = [{"role": "user", "content": request.message}]

    # Persist the user turn before streaming so crashes/disconnects still retain input.
    try:
        await append_chat_message(
            session_id=session_id,
            role="user",
            content=request.message,
        )
    except Exception:
        logger.exception("Failed to persist user message for session_id=%s", session_id)
        raise HTTPException(
            status_code=503, detail="Chat service is temporarily unavailable"
        )

    async def generate():
        assistant_chunks: list[str] = []
        try:
            for chunk in stream_chat_response(messages):
                assistant_chunks.append(chunk)
                yield chunk
        finally:
            assistant_message = "".join(assistant_chunks)
            if assistant_message:
                try:
                    await append_chat_message(
                        session_id=session_id,
                        role="assistant",
                        content=assistant_message,
                    )
                except Exception:
                    logger.exception(
                        "Failed to persist assistant message for session_id=%s",
                        session_id,
                    )

    response = StreamingResponse(generate(), media_type="text/event-stream")
    response.headers["x-session-id"] = session_id
    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "secureship.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
