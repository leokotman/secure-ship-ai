"""Shared pytest fixtures and configuration."""

import asyncio
import pytest
from sqlalchemy.exc import OperationalError
from secureship.database import engine, Base


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the entire test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Create test database tables before running tests.

    If database is unavailable, skip silently (tests that need it will skip).
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    except (OperationalError, OSError):
        # Database unavailable — skip table setup
        yield
