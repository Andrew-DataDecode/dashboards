"""
Clerk JWT verification for FastAPI.

Verifies the Bearer token from the Authorization header using Clerk's JWKS
endpoint. Returns the decoded JWT claims on success, raises 401 on failure.

Environment variables:
  CLERK_PUBLISHABLE_KEY  – used to derive the JWKS URL (required)
"""

import os
import time

import httpx
import jwt
from fastapi import HTTPException, Request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_pk = os.environ.get("CLERK_PUBLISHABLE_KEY", "")


def _jwks_url() -> str:
    """Derive the Clerk JWKS URL from the publishable key.

    Clerk publishable keys encode the instance identifier after the prefix.
    The JWKS endpoint lives at the Clerk Frontend API domain.
    """
    # pk_test_xxx... or pk_live_xxx...
    # The Frontend API domain is <instance>.clerk.accounts.dev for dev,
    # or the custom domain for production.
    # Simplest approach: use the well-known Clerk API path.
    # Clerk docs: https://clerk.com/docs/references/backend/overview
    if not _pk:
        raise RuntimeError("CLERK_PUBLISHABLE_KEY environment variable is not set")

    # Extract the instance slug from the publishable key
    # Format: pk_test_<base64-encoded-frontend-api-url>
    import base64

    parts = _pk.split("_")
    if len(parts) < 3:
        raise RuntimeError("Invalid CLERK_PUBLISHABLE_KEY format")

    encoded = parts[2]
    # Add padding if needed
    padding = 4 - len(encoded) % 4
    if padding != 4:
        encoded += "=" * padding
    frontend_api = base64.b64decode(encoded).decode("utf-8").rstrip("$")

    return f"https://{frontend_api}/.well-known/jwks.json"


# ---------------------------------------------------------------------------
# JWKS cache (refreshed every 60 minutes)
# ---------------------------------------------------------------------------

_jwks_cache: dict = {"keys": [], "fetched_at": 0}
_JWKS_TTL = 3600  # seconds


def _get_jwks() -> list[dict]:
    """Fetch and cache the JWKS key set."""
    now = time.time()
    if _jwks_cache["keys"] and (now - _jwks_cache["fetched_at"]) < _JWKS_TTL:
        return _jwks_cache["keys"]

    url = _jwks_url()
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    keys = resp.json()["keys"]
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys


def _get_signing_key(token: str) -> jwt.algorithms.RSAAlgorithm:
    """Find the signing key matching the token's kid header."""
    headers = jwt.get_unverified_header(token)
    kid = headers.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing kid header")

    keys = _get_jwks()
    for key_data in keys:
        if key_data.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key_data)

    # Key not found — maybe rotated. Force refresh once.
    _jwks_cache["fetched_at"] = 0
    keys = _get_jwks()
    for key_data in keys:
        if key_data.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key_data)

    raise HTTPException(status_code=401, detail="No matching signing key found")


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


def _extract_token(request: Request) -> str:
    """Pull the Bearer token from the Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    return auth[7:]


async def require_auth(request: Request) -> dict:
    """FastAPI dependency: verify Clerk JWT and return decoded claims.

    Usage:
        @app.post("/api/chat")
        async def chat(request: ChatRequest, claims: dict = Depends(require_auth)):
            user_id = claims["sub"]
            ...
    """
    token = _extract_token(request)

    try:
        public_key = _get_signing_key(token)
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={
                "verify_aud": False,  # Clerk JWTs don't always set aud
                "verify_iss": False,  # Issuer varies by instance
            },
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def verify_session_cookie(request: Request) -> dict:
    """Verify Clerk JWT from the __session cookie.

    Same verification logic as require_auth but reads from the cookie
    instead of the Authorization header. Used for serving dashboard
    static files to browser requests.
    """
    token = request.cookies.get("__session")
    if not token:
        raise HTTPException(status_code=401, detail="Missing __session cookie")

    try:
        public_key = _get_signing_key(token)
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={
                "verify_aud": False,
                "verify_iss": False,
            },
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
