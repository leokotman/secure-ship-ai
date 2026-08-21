"""Tests for Auth0 JWT verification middleware."""

import json
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.security import HTTPAuthorizationCredentials

from secureship.auth import JWKSCache, get_kid_from_token, verify_admin_token
from secureship.config import settings


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def mock_auth0_audience(monkeypatch: pytest.MonkeyPatch):
    """Mock AUTH0_AUDIENCE setting for tests."""
    monkeypatch.setattr(settings, "auth0_audience", "https://secureship-api.example.com")
    monkeypatch.setattr(settings, "auth0_domain", "test.auth0.com")


@pytest.fixture
def rsa_key_pair() -> tuple[bytes, bytes]:
    """Generate an RSA key pair for testing."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


@pytest.fixture
def jwk_from_public_key(rsa_key_pair: tuple[bytes, bytes]) -> dict[str, Any]:
    """Convert public key to JWK format."""
    _, public_pem = rsa_key_pair
    public_key = serialization.load_pem_public_key(public_pem)
    # Use PyJWT's built-in method to export to JWK
    jwk_dict = jwt.algorithms.RSAAlgorithm.to_jwk(public_key, as_dict=True)
    jwk_dict["kid"] = "test-kid-123"
    jwk_dict["use"] = "sig"
    jwk_dict["alg"] = "RS256"
    return jwk_dict


@pytest.fixture
def valid_token(rsa_key_pair: tuple[bytes, bytes]) -> str:
    """Create a valid JWT token signed with the test private key."""
    private_pem, _ = rsa_key_pair
    now = datetime.utcnow()
    payload = {
        "sub": "auth0|user123",
        "aud": settings.auth0_audience,
        "iss": f"https://{settings.auth0_domain}/",
        "exp": int((now + timedelta(days=1)).timestamp()),
        "iat": int((now - timedelta(seconds=10)).timestamp()),
    }
    token = jwt.encode(
        payload,
        private_pem,
        algorithm="RS256",
        headers={"kid": "test-kid-123"},
    )
    return token


@pytest.fixture
def expired_token(rsa_key_pair: tuple[bytes, bytes]) -> str:
    """Create an expired JWT token."""
    private_pem, _ = rsa_key_pair
    now = datetime.utcnow()
    payload = {
        "sub": "auth0|user123",
        "aud": settings.auth0_audience,
        "iss": f"https://{settings.auth0_domain}/",
        "exp": int((now - timedelta(hours=1)).timestamp()),
        "iat": int((now - timedelta(hours=2)).timestamp()),
    }
    token = jwt.encode(
        payload,
        private_pem,
        algorithm="RS256",
        headers={"kid": "test-kid-123"},
    )
    return token


@pytest.fixture
def token_wrong_audience(rsa_key_pair: tuple[bytes, bytes]) -> str:
    """Create a token with wrong audience."""
    private_pem, _ = rsa_key_pair
    now = datetime.utcnow()
    payload = {
        "sub": "auth0|user123",
        "aud": "wrong_audience",
        "iss": f"https://{settings.auth0_domain}/",
        "exp": int((now + timedelta(days=1)).timestamp()),
        "iat": int((now - timedelta(seconds=10)).timestamp()),
    }
    token = jwt.encode(
        payload,
        private_pem,
        algorithm="RS256",
        headers={"kid": "test-kid-123"},
    )
    return token


@pytest.fixture
def token_wrong_issuer(rsa_key_pair: tuple[bytes, bytes]) -> str:
    """Create a token with wrong issuer."""
    private_pem, _ = rsa_key_pair
    now = datetime.utcnow()
    payload = {
        "sub": "auth0|user123",
        "aud": settings.auth0_audience,
        "iss": "https://wrong.auth0.com/",
        "exp": int((now + timedelta(days=1)).timestamp()),
        "iat": int((now - timedelta(seconds=10)).timestamp()),
    }
    token = jwt.encode(
        payload,
        private_pem,
        algorithm="RS256",
        headers={"kid": "test-kid-123"},
    )
    return token


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestJWKSCache:
    """Test JWKS caching logic."""

    @pytest.mark.asyncio
    async def test_jwks_cache_stores_and_reuses(self, jwk_from_public_key: dict[str, Any]):
        """Cache should store JWKS and reuse without refetching within TTL."""
        cache = JWKSCache(ttl_seconds=3600)
        mock_jwks = {"keys": [jwk_from_public_key]}

        mock_response = MagicMock()
        mock_response.json.return_value = mock_jwks
        mock_async_client = AsyncMock()
        mock_async_client.get = AsyncMock(return_value=mock_response)
        mock_async_client.aclose = AsyncMock()

        with patch("secureship.auth.httpx.AsyncClient", return_value=mock_async_client):
            # First call should fetch
            result1 = await cache.get_jwks()
            assert result1 == mock_jwks

            # Second call should use cache (no refetch)
            result2 = await cache.get_jwks()
            assert result2 == mock_jwks
            mock_async_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_jwks_cache_is_expired(self):
        """Cache should detect expiration based on TTL."""
        cache = JWKSCache(ttl_seconds=0)  # Immediate expiry
        cache.jwks_data = {"keys": []}
        cache.cached_at = datetime.utcnow()

        assert cache.is_expired()

    @pytest.mark.asyncio
    async def test_jwks_cache_fetch_failure_uses_stale_data(
        self, jwk_from_public_key: dict[str, Any]
    ):
        """If fetch fails, cache should return stale data if available."""
        cache = JWKSCache(ttl_seconds=0)  # Expired
        cache.jwks_data = {"keys": [jwk_from_public_key]}
        cache.cached_at = datetime.utcnow() - timedelta(hours=1)

        mock_async_client = AsyncMock()
        mock_async_client.get.side_effect = Exception("Network error")
        mock_async_client.aclose = AsyncMock()

        with patch("secureship.auth.httpx.AsyncClient", return_value=mock_async_client):
            result = await cache.get_jwks()
            assert result == {"keys": [jwk_from_public_key]}

    @pytest.mark.asyncio
    async def test_jwks_cache_fetch_failure_no_stale_data_raises(self):
        """If fetch fails and no stale data, should raise 503."""
        cache = JWKSCache(ttl_seconds=3600)
        cache.jwks_data = None

        mock_async_client = AsyncMock()
        mock_async_client.get.side_effect = Exception("Network error")
        mock_async_client.aclose = AsyncMock()

        with patch("secureship.auth.httpx.AsyncClient", return_value=mock_async_client):
            from fastapi import HTTPException

            with pytest.raises(HTTPException) as exc_info:
                await cache.get_jwks()
            assert exc_info.value.status_code == 503


class TestGetKidFromToken:
    """Test kid extraction from token header."""

    def test_get_kid_from_valid_token(self, valid_token: str):
        """Should extract kid from token header."""
        kid = get_kid_from_token(valid_token)
        assert kid == "test-kid-123"

    def test_get_kid_from_malformed_token(self):
        """Should return None for malformed token."""
        kid = get_kid_from_token("not.a.token")
        assert kid is None


class TestVerifyAdminToken:
    """Test JWT token verification."""

    @pytest.mark.asyncio
    async def test_verify_admin_token_success(
        self, valid_token: str, jwk_from_public_key: dict[str, Any]
    ):
        """Valid token with correct claims should be verified."""
        mock_jwks = {"keys": [jwk_from_public_key]}

        with patch("secureship.auth._jwks_cache.get_jwks", new_callable=AsyncMock) as mock_get_jwks:
            mock_get_jwks.return_value = mock_jwks

            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=valid_token)
            payload = await verify_admin_token(credentials)

            assert payload["sub"] == "auth0|user123"
            assert payload["aud"] == settings.auth0_audience
            assert payload["iss"] == f"https://{settings.auth0_domain}/"

    @pytest.mark.asyncio
    async def test_verify_admin_token_expired(
        self, expired_token: str, jwk_from_public_key: dict[str, Any]
    ):
        """Expired token should raise 401."""
        mock_jwks = {"keys": [jwk_from_public_key]}

        with patch("secureship.auth._jwks_cache.get_jwks", new_callable=AsyncMock) as mock_get_jwks:
            mock_get_jwks.return_value = mock_jwks

            from fastapi import HTTPException

            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
            with pytest.raises(HTTPException) as exc_info:
                await verify_admin_token(credentials)
            assert exc_info.value.status_code == 401
            assert "expired" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_verify_admin_token_wrong_audience(
        self, token_wrong_audience: str, jwk_from_public_key: dict[str, Any]
    ):
        """Token with wrong audience should raise 401."""
        mock_jwks = {"keys": [jwk_from_public_key]}

        with patch("secureship.auth._jwks_cache.get_jwks", new_callable=AsyncMock) as mock_get_jwks:
            mock_get_jwks.return_value = mock_jwks

            from fastapi import HTTPException

            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=token_wrong_audience
            )
            with pytest.raises(HTTPException) as exc_info:
                await verify_admin_token(credentials)
            assert exc_info.value.status_code == 401
            assert "audience" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_verify_admin_token_wrong_issuer(
        self, token_wrong_issuer: str, jwk_from_public_key: dict[str, Any]
    ):
        """Token with wrong issuer should raise 401."""
        mock_jwks = {"keys": [jwk_from_public_key]}

        with patch("secureship.auth._jwks_cache.get_jwks", new_callable=AsyncMock) as mock_get_jwks:
            mock_get_jwks.return_value = mock_jwks

            from fastapi import HTTPException

            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token_wrong_issuer)
            with pytest.raises(HTTPException) as exc_info:
                await verify_admin_token(credentials)
            assert exc_info.value.status_code == 401
            assert "issuer" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_verify_admin_token_no_kid_in_header(
        self, rsa_key_pair: tuple[bytes, bytes], jwk_from_public_key: dict[str, Any]
    ):
        """Token without kid in header should raise 401."""
        private_pem, _ = rsa_key_pair
        now = datetime.utcnow()
        payload = {
            "sub": "auth0|user123",
            "aud": settings.auth0_audience,
            "iss": f"https://{settings.auth0_domain}/",
            "exp": int((now + timedelta(days=1)).timestamp()),
            "iat": int((now - timedelta(seconds=10)).timestamp()),
        }
        # Encode without kid in header
        token = jwt.encode(
            payload,
            private_pem,
            algorithm="RS256",
        )

        mock_jwks = {"keys": [jwk_from_public_key]}

        with patch("secureship.auth._jwks_cache.get_jwks", new_callable=AsyncMock) as mock_get_jwks:
            mock_get_jwks.return_value = mock_jwks

            from fastapi import HTTPException

            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            with pytest.raises(HTTPException) as exc_info:
                await verify_admin_token(credentials)
            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_admin_token_kid_not_in_jwks(
        self, valid_token: str, jwk_from_public_key: dict[str, Any]
    ):
        """Token with kid not in JWKS should raise 401."""
        # Modify kid in JWK so it doesn't match token's kid
        jwk_from_public_key["kid"] = "different-kid"
        mock_jwks = {"keys": [jwk_from_public_key]}

        with patch("secureship.auth._jwks_cache.get_jwks", new_callable=AsyncMock) as mock_get_jwks:
            mock_get_jwks.return_value = mock_jwks

            from fastapi import HTTPException

            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=valid_token)
            with pytest.raises(HTTPException) as exc_info:
                await verify_admin_token(credentials)
            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_admin_token_malformed_token(
        self, jwk_from_public_key: dict[str, Any]
    ):
        """Malformed token should raise 401."""
        mock_jwks = {"keys": [jwk_from_public_key]}

        with patch("secureship.auth._jwks_cache.get_jwks", new_callable=AsyncMock) as mock_get_jwks:
            mock_get_jwks.return_value = mock_jwks

            from fastapi import HTTPException

            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.here")
            with pytest.raises(HTTPException) as exc_info:
                await verify_admin_token(credentials)
            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_admin_token_jwks_fetch_failure(self):
        """If JWKS fetch fails, should raise 503."""
        from fastapi import HTTPException

        with patch("secureship.auth._jwks_cache.get_jwks", new_callable=AsyncMock) as mock_get_jwks:
            mock_get_jwks.side_effect = HTTPException(
                status_code=503, detail="Auth0 service unavailable"
            )

            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="some.token.here")
            with pytest.raises(HTTPException) as exc_info:
                await verify_admin_token(credentials)
            assert exc_info.value.status_code == 503
