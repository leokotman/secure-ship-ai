"""Database setup and chat session persistence."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func, select
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from secureship.config import settings


class Base(DeclarativeBase):
    """Base declarative class for SQLAlchemy models."""


class ChatSession(Base):
    """Persisted transcript per chat session."""

    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
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
            select(ChatSession).where(ChatSession.session_id == session_id)
        )
        record = result.scalar_one_or_none()

        if record is None:
            record = ChatSession(
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
