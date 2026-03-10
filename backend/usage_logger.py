"""
Usage tracking middleware — emits page_view and user_session events via EventLogger.

Logs every authenticated request for operational monitoring. Skips static asset
requests (.js, .css, .png, etc.) to keep event volume manageable.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

import jwt


# Static file extensions to skip logging
_SKIP_EXTENSIONS = {
    ".js",
    ".css",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".map",
}


class UsageLoggingMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that emits page_view events via EventLogger."""

    def __init__(self, app, event_logger):
        super().__init__(app)
        self.event_logger = event_logger
        self._seen_sessions: set[str] = set()

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip static assets
        path = request.url.path
        if any(path.endswith(ext) for ext in _SKIP_EXTENSIONS):
            return await call_next(request)

        # Extract user identity from JWT (best effort)
        user_id = "anonymous"
        user_email = ""
        session_key = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                claims = jwt.decode(
                    auth_header[7:], options={"verify_signature": False}
                )
                user_id = claims.get("sub", "anonymous")
                user_email = claims.get("email", "")
                # Session key: user + day (coarse session bucketing)
                session_key = f"{user_id}:{claims.get('exp', '')}"
            except Exception:
                pass

        response = await call_next(request)

        # Emit events after response (non-blocking)
        try:
            # Emit user_session once per (user, token expiry) combination
            if session_key and user_id != "anonymous" and session_key not in self._seen_sessions:
                self._seen_sessions.add(session_key)
                self.event_logger.log("user_session", {
                    "user_id": user_id,
                    "user_email": user_email,
                })

            self.event_logger.log("page_view", {
                "user_id": user_id,
                "user_email": user_email,
                "method": request.method,
                "path": path,
                "status_code": response.status_code,
                "ip_address": request.client.host if request.client else "",
                "user_agent": request.headers.get("user-agent", ""),
            })
        except Exception:
            pass  # Never let logging failure break the request

        return response
