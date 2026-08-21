"""Auth0 JWT verification for admin endpoints."""

import json
import logging
from datetime import datetime, timedelta
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()


class JWKSCache:
    """In-memory JWKS cache with TTL."""

    def __init__(self, ttl_seconds: int = 3600):
        self.ttl_seconds = ttl_seconds
        self.jwks_data: dict[str, Any] | None = None
        self.cached_at: datetime | None = None

    def is_expired(self) -> bool:
        """Check if cache has expired."""
        if self.cached_at is None:
            return True
        return datetime.utcnow() > self.cached_at + timedelta(seconds=self.ttl_seconds)

    async def get_jwks(self) -> dict[str, Any]:
        """Fetch and cache Auth0 JWKS."""
        if self.jwks_data and not self.is_expired():
            return self.jwks_data

        jwks_url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
        try:
            client = httpx.AsyncClient()
            response = await client.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            self.jwks_data = response.json()
            self.cached_at = datetime.utcnow()
            logger.debug("Fetched JWKS from Auth0")
            await client.aclose()
            return self.jwks_data
        except Exception as e:
            logger.error(f"Failed to fetch JWKS from Auth0: {e}")
            # Return cached data if fetch fails, even if expired
            if self.jwks_data:
                logger.warning("Using expired JWKS cache due to fetch failure")
                return self.jwks_data
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth0 service unavailable",
            )


_jwks_cache = JWKSCache()


def get_kid_from_token(token: str) -> str | None:
    """Extract kid (key ID) from JWT header without verifying."""
    try:
        header = jwt.get_unverified_header(token)
        return header.get("kid")
    except Exception as e:
        logger.error(f"Failed to extract kid from token: {e}")
        return None


async def verify_admin_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict[str, Any]:
    """Verify Auth0 JWT token and return payload.

    Validates:
    - Signature (via JWKS)
    - Expiry
    - Audience (aud)
    - Issuer (iss)
    """
    token = credentials.credentials
    logger.info(f"🔍 Verifying token (first 30 chars): {token[:30]}...")
    logger.info(f"📋 Expected audience: {settings.auth0_audience}")
    logger.info(f"📋 Expected issuer: https://{settings.auth0_domain}/")

    try:
        # Get JWKS to verify signature
        jwks = await _jwks_cache.get_jwks()

        # Extract kid from token header
        kid = get_kid_from_token(token)
        if not kid:
            logger.warning("No kid in token header")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format",
            )

        # Find the key in JWKS
        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break

        if not key:
            logger.warning(f"No matching key found for kid: {kid}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )

        # Reconstruct the public key from JWK
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))

        # Verify and decode the token
        payload = jwt.decode(
            token,
            public_key,  # type: ignore
            algorithms=["RS256"],
            audience=settings.auth0_audience,
            issuer=f"https://{settings.auth0_domain}/",
        )

        logger.debug(f"Token verified for sub: {payload.get('sub')}")
        return payload

    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidAudienceError:
        logger.warning("Invalid token audience")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience",
        )
    except jwt.InvalidIssuerError:
        logger.warning("Invalid token issuer")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token issuer",
        )
    except jwt.InvalidSignatureError:
        logger.warning("Invalid token signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature",
        )
    except jwt.DecodeError:
        logger.warning("Failed to decode token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


async def require_admin(
    payload: dict[str, Any] = Depends(verify_admin_token),
) -> dict[str, Any]:
    """FastAPI dependency: verify admin access.

    Returns the verified JWT payload for use in route handlers.
    """
    return payload
