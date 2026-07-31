"""FastAPI application entry point."""

import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from secureship.chat import stream_chat_response
from secureship.config import settings
from secureship.database import append_chat_turn, create_tables

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

    async def generate():
        assistant_chunks: list[str] = []
        for chunk in stream_chat_response(messages):
            assistant_chunks.append(chunk)
            yield chunk

        assistant_message = "".join(assistant_chunks)
        await append_chat_turn(
            session_id=session_id,
            user_message=request.message,
            assistant_message=assistant_message,
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
