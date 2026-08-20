"""FastAPI application entry point."""

import logging
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .chat import stream_chat_response
from .config import settings
from .database import (
    append_chat_message,
    get_transcript,
    load_session_data,
    update_session_state,
)
from .session import SessionState, session_manager
from .tools import execute_tool

logger = logging.getLogger(__name__)

app = FastAPI(title="SecureShip", version="0.2.0")

_EPHEMERAL_OTP_STATES: set[str] = {
    SessionState.CODE_SENT.value,
    SessionState.AWAITING_CODE.value,
}

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


class VerifySmsRequest(BaseModel):
    """Explicit SMS code verification from the frontend modal."""

    session_id: str = Field(..., min_length=1)
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class VerifySmsResponse(BaseModel):
    verified: bool
    state: str
    reason: str | None = None


def _normalize_rehydrated_state(state: str) -> str:
    """Collapse transient OTP states to anonymous on page reload."""
    if state in _EPHEMERAL_OTP_STATES:
        return SessionState.ANONYMOUS.value
    return state


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "version": "0.2.0"}


@app.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    """Chat endpoint — streams Ollama response with tool-calling loop.

    Loads full conversation history from DB so the model has context for the
    whole identity verification flow, not just the current turn.

    The final chunk in the stream is a null-byte prefixed JSON metadata event
    carrying the updated session state so the frontend can update its store.
    """
    session_id = request.session_id or str(uuid.uuid4())
    session = session_manager.get_or_create(session_id)

    # Restore durable state + case facts from DB (survives server restarts)
    try:
        db_state, db_customer_id, db_case_facts = await load_session_data(session_id)
        normalized_db_state = _normalize_rehydrated_state(db_state)
        if (
            session.state == SessionState.ANONYMOUS
            and normalized_db_state != SessionState.ANONYMOUS.value
        ):
            session.state = SessionState(normalized_db_state)
        if session.customer_id is None and db_customer_id is not None:
            session.customer_id = db_customer_id
        if not session.case_facts and db_case_facts:
            session.case_facts = db_case_facts
        session_manager.update(session)
    except Exception:
        logger.exception(
            "Failed to load session data from DB for session_id=%s", session_id
        )

    # Persist user turn before streaming so DB has it even if the stream fails
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

    # Load full conversation history (FC #2 — full context for the tool loop)
    try:
        messages = await get_transcript(session_id)
    except Exception:
        logger.exception("Failed to load transcript for session_id=%s", session_id)
        messages = [{"role": "user", "content": request.message}]

    async def generate():  # type: ignore[return]
        assistant_chunks: list[str] = []
        try:
            async for chunk in stream_chat_response(messages, session_id, session):
                if chunk.startswith("\x00"):
                    # State metadata event — pass through but don't add to transcript
                    yield chunk
                else:
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
            # Sync final session state + case facts to DB
            updated = session_manager.get(session_id) or session
            try:
                await update_session_state(
                    session_id,
                    updated.state.value,
                    updated.customer_id,
                    updated.case_facts or None,
                )
            except Exception:
                logger.exception(
                    "Failed to sync session state for session_id=%s", session_id
                )

    response = StreamingResponse(generate(), media_type="text/event-stream")
    response.headers["x-session-id"] = session_id
    # Header carries the state at request-start; the null-byte event carries the final state
    response.headers["x-session-state"] = session.state.value
    return response


class SessionResponse(BaseModel):
    state: str
    messages: list[dict[str, str]]


@app.get("/session/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    requesting_session_id: str | None = None,
) -> SessionResponse:
    """Return the persisted state and transcript for a session.

    Called by the frontend on mount to re-hydrate state and message history
    when the user reloads the page mid-conversation.

    Ownership check: a session may only be read by itself, or by another session
    that shares the same non-null customer_id (i.e., same verified customer).
    This stops one verified customer from reading a different customer's
    transcript by guessing a session_id.
    """
    # Default: treat the caller as requesting their own session
    caller_id = requesting_session_id or session_id

    if caller_id != session_id:
        # Both sessions must resolve to the same verified customer
        _, target_customer_id, _ = await load_session_data(session_id)
        _, caller_customer_id, _ = await load_session_data(caller_id)
        if (
            target_customer_id is None
            or caller_customer_id is None
            or target_customer_id != caller_customer_id
        ):
            raise HTTPException(status_code=403, detail="Access denied")

    db_state, _, _ = await load_session_data(session_id)
    safe_state = _normalize_rehydrated_state(db_state)
    transcript = await get_transcript(session_id)
    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in transcript
        if m.get("role") in ("user", "assistant")
    ]
    return SessionResponse(state=safe_state, messages=messages)


@app.post("/verify-sms", response_model=VerifySmsResponse)
async def verify_sms(request: VerifySmsRequest) -> VerifySmsResponse | JSONResponse:
    """Explicit SMS code verification — called directly from the frontend modal.

    Delegates to the same `check_verification_code` tool used in the chat flow
    so the logic and limits (expiry, max attempts) are enforced in one place.
    """
    result = await execute_tool(
        "check_verification_code",
        {"code": request.code},
        request.session_id,
    )

    updated = session_manager.get(request.session_id)
    state = updated.state.value if updated else SessionState.ANONYMOUS.value

    # Sync to DB regardless of outcome
    if updated:
        try:
            await update_session_state(
                request.session_id,
                updated.state.value,
                updated.customer_id,
            )
        except Exception:
            logger.exception(
                "Failed to sync session state after /verify-sms for session_id=%s",
                request.session_id,
            )

    status = str(result.get("status", ""))
    reason: str | None = None
    if status == "expired":
        reason = "expired"
    elif status == "incorrect_code":
        reason = "incorrect_code"
    elif status == "max_attempts_exceeded":
        reason = "max_attempts_exceeded"
    elif status == "code_resent":
        reason = "code_resent"
    elif status == "error":
        reason = "no_active_code"

    payload = VerifySmsResponse(
        verified=(status == "verified"),
        state=state,
        reason=reason,
    )

    status_map: dict[str, int] = {
        "verified": 200,
        "incorrect_code": 401,
        "expired": 410,
        "max_attempts_exceeded": 429,
        "error": 409,
    }
    response_status = status_map.get(status, 400)
    if response_status == 200:
        return payload
    return JSONResponse(status_code=response_status, content=payload.model_dump())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "secureship.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
