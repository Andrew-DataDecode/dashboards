"""
Chat session management — in-memory only.

Sessions are held in the app's in-memory dict. No SQLite persistence.
load_session() always returns [] (cold start = fresh session).
is_writable() always returns True (no DB dependency).
"""

from typing import Optional


class ChatLogger:
    def upsert_session(self, session_id: str, user_id: str = "", user_email: str = ""):
        pass  # in-memory only, nothing to persist

    def log_message(
        self,
        session_id: str,
        role: str,
        content: str = "",
        tool_calls: Optional[list] = None,
        chart_spec: Optional[dict] = None,
        tokens_in: int = 0,
        tokens_out: int = 0,
    ):
        pass  # in-memory only, nothing to persist

    def load_session(self, session_id: str) -> list[dict]:
        return []  # no persistence; caller falls back to empty history

    def is_writable(self) -> bool:
        return True
