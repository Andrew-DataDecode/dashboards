"""
In-memory rate limiter for chat API.

Per-user and global limits to prevent runaway API costs.
Uses a simple sliding window (list of timestamps per key).

Config via env vars:
  RATE_LIMIT_PER_USER: max chat messages per user per hour (default: 60)
  RATE_LIMIT_GLOBAL: max chat messages across all users per hour (default: 500)
"""

import os
import time
from collections import defaultdict


RATE_LIMIT_PER_USER = int(os.environ.get("RATE_LIMIT_PER_USER", "60"))
RATE_LIMIT_GLOBAL = int(os.environ.get("RATE_LIMIT_GLOBAL", "500"))
WINDOW_SECONDS = 3600  # 1 hour


class RateLimiter:
    def __init__(
        self,
        per_user_limit: int = RATE_LIMIT_PER_USER,
        global_limit: int = RATE_LIMIT_GLOBAL,
        window_seconds: int = WINDOW_SECONDS,
    ):
        self.per_user_limit = per_user_limit
        self.global_limit = global_limit
        self.window_seconds = window_seconds
        self._user_timestamps: dict[str, list[float]] = defaultdict(list)
        self._global_timestamps: list[float] = []

    def _prune(self, timestamps: list[float], now: float) -> list[float]:
        cutoff = now - self.window_seconds
        # Find first index that's within the window
        i = 0
        while i < len(timestamps) and timestamps[i] < cutoff:
            i += 1
        return timestamps[i:]

    def check(self, user_id: str) -> tuple[bool, str]:
        """Check if a request is allowed. Returns (allowed, reason)."""
        now = time.time()

        # Prune global
        self._global_timestamps = self._prune(self._global_timestamps, now)
        if len(self._global_timestamps) >= self.global_limit:
            remaining_secs = int(self._global_timestamps[0] + self.window_seconds - now)
            return (
                False,
                f"Global rate limit exceeded. Try again in {max(1, remaining_secs // 60)} minutes.",
            )

        # Prune per-user
        self._user_timestamps[user_id] = self._prune(
            self._user_timestamps[user_id], now
        )
        if len(self._user_timestamps[user_id]) >= self.per_user_limit:
            remaining_secs = int(
                self._user_timestamps[user_id][0] + self.window_seconds - now
            )
            return (
                False,
                f"Rate limit exceeded. Try again in {max(1, remaining_secs // 60)} minutes.",
            )

        return True, ""

    def record(self, user_id: str):
        """Record a successful request."""
        now = time.time()
        self._user_timestamps[user_id].append(now)
        self._global_timestamps.append(now)
