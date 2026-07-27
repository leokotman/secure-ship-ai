"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from secureship.chat import stream_chat_response
from secureship.config import settings

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

    message: str
    session_id: str | None = None


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint that streams Claude responses.

    Args:
        request: Chat request with message and optional session_id

    Returns:
        Streaming response with text chunks from Claude
    """
    messages = [{"role": "user", "content": request.message}]

    def generate():
        for chunk in stream_chat_response(messages):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "secureship.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
