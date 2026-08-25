"""Simple in-memory rate limiter for /chat (session key, IP fallback)."""

from __future__ import annotations

import threading
import time
from collections import defaultdict


class RateLimiter:
    """Fixed-window counter: max_requests per window_seconds per key."""

    def __init__(self, max_requests: int = 30, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds). retry_after is 0 when allowed."""
        now = time.monotonic()
        with self._lock:
            hits = [t for t in self._hits[key] if now - t < self.window_seconds]
            if len(hits) >= self.max_requests:
                oldest = min(hits)
                retry_after = max(1, int(self.window_seconds - (now - oldest)) + 1)
                self._hits[key] = hits
                return False, retry_after
            hits.append(now)
            self._hits[key] = hits
            return True, 0


def rate_limit_key(session_id: str | None, client_ip: str | None) -> str:
    if session_id:
        return f"session:{session_id}"
    return f"ip:{client_ip or 'unknown'}"
