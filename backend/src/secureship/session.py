"""In-memory session state management. Migrates to PostgreSQL in Week 3."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class SessionState(str, Enum):
    ANONYMOUS = "anonymous"
    COLLECTING_IDENTITY = "collecting_identity"
    CODE_SENT = "code_sent"
    AWAITING_CODE = "awaiting_code"
    VERIFIED = "verified"
    ESCALATED_TO_HUMAN = "escalated_to_human"


@dataclass
class Session:
    session_id: str
    state: SessionState = SessionState.ANONYMOUS
    customer_id: Optional[uuid.UUID] = None
    pending_customer_id: Optional[uuid.UUID] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    sms_code: Optional[str] = None
    code_sent_at: Optional[datetime] = None
    code_attempts: int = 0
    # Transactional facts extracted from the conversation — never summarized away.
    # Persisted to DB and injected into every system prompt.
    case_facts: dict[str, Any] = field(default_factory=dict)
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def verified(self) -> bool:
        return self.state == SessionState.VERIFIED


class SessionManager:
    """Thread-safe in-memory session store backed by a plain dict.

    Sufficient for single-process dev; replace with a Redis/DB-backed store
    in production or when running multiple workers.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def get_or_create(self, session_id: str) -> Session:
        if session_id not in self._sessions:
            self._sessions[session_id] = Session(session_id=session_id)
        return self._sessions[session_id]

    def get(self, session_id: str) -> Optional[Session]:
        return self._sessions.get(session_id)

    def update(self, session: Session) -> None:
        self._sessions[session.session_id] = session


# Module-level singleton — imported by tools.py, identity.py, main.py
session_manager = SessionManager()
