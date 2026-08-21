"""Database setup and chat session persistence."""

import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from sqlalchemy import DateTime, String, func, select
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .config import settings


class Base(DeclarativeBase):
    """Base declarative class for SQLAlchemy models."""


class Conversation(Base):
    """Persisted transcript and identity-gate state per chat session."""

    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    # Identity-gate state — mirrors SessionState enum in session.py
    state: Mapped[str] = mapped_column(String(50), nullable=False, default="anonymous")
    # Set once the customer is verified; null until then
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True, default=None
    )
    # Transactional facts extracted by the model — never summarized (see chat.py)
    case_facts: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    transcript: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


engine = create_async_engine(settings.database_url, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def create_tables() -> None:
    """Create DB tables required for the current app version."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def append_chat_turn(
    session_id: str, user_message: str, assistant_message: str
) -> None:
    """Append a user and assistant turn to the persisted transcript for a session."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation).where(Conversation.session_id == session_id)
        )
        record = result.scalar_one_or_none()

        if record is None:
            record = Conversation(
                session_id=session_id,
                transcript=[
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": assistant_message},
                ],
            )
            db.add(record)
        else:
            transcript = list(record.transcript)
            transcript.append({"role": "user", "content": user_message})
            transcript.append({"role": "assistant", "content": assistant_message})
            record.transcript = transcript

        await db.commit()


async def append_chat_message(
    session_id: str, role: Literal["user", "assistant"], content: str
) -> None:
    """Append a single message to the persisted transcript for a session."""
    if not content:
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation).where(Conversation.session_id == session_id)
        )
        record = result.scalar_one_or_none()

        if record is None:
            record = Conversation(
                session_id=session_id,
                transcript=[{"role": role, "content": content}],
            )
            db.add(record)
        else:
            transcript = list(record.transcript)
            transcript.append({"role": role, "content": content})
            record.transcript = transcript

        await db.commit()


async def get_transcript(session_id: str) -> list[dict[str, Any]]:
    """Return the full conversation history for a session (user + assistant turns)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation).where(Conversation.session_id == session_id)
        )
        record = result.scalar_one_or_none()
        if record is None:
            return []
        return list(record.transcript)


async def update_session_state(
    session_id: str,
    state: str,
    customer_id: Optional[uuid.UUID] = None,
    case_facts: Optional[dict[str, Any]] = None,
) -> None:
    """Sync state, optional customer_id, and optional case_facts to the Conversation row."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation).where(Conversation.session_id == session_id)
        )
        record = result.scalar_one_or_none()
        if record is None:
            record = Conversation(
                session_id=session_id,
                state=state,
                transcript=[],
            )
            db.add(record)
        else:
            record.state = state
            if customer_id is not None:
                record.customer_id = customer_id
            if case_facts is not None:
                record.case_facts = case_facts
        await db.commit()


async def load_session_data(
    session_id: str,
) -> tuple[str, Optional[uuid.UUID], dict[str, Any]]:
    """Return (state, customer_id, case_facts) persisted for a session.

    Used on every request to hydrate the in-memory session from the DB so that
    transactional facts and verification state survive server restarts.
    Returns defaults (anonymous state, no customer, empty facts) if no record exists.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation).where(Conversation.session_id == session_id)
        )
        record = result.scalar_one_or_none()
        if record is None:
            return ("anonymous", None, {})
        return (record.state, record.customer_id, dict(record.case_facts or {}))
