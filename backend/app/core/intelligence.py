from __future__ import annotations

import asyncio
import logging
import time
from typing import List

from app.core.gemini_client import GeminiClient

logger = logging.getLogger(__name__)

# Minimum seconds between suggestion generation calls per meeting
_SUGGESTION_COOLDOWN = 30.0


class IntelligenceEngine:
    """Generates real-time AI suggestions from meeting transcript segments."""

    def __init__(self, gemini_client: GeminiClient) -> None:
        self._client = gemini_client
        self._last_run: dict[str, float] = {}

    async def generate_suggestions(
        self,
        meeting_id: str,
        transcript_text: str,
        meeting_type: str,
        context: str,
    ) -> List[dict]:
        """
        Throttled suggestion generation.  Returns an empty list if called too
        soon after the previous run for the same meeting.
        """
        now = time.monotonic()
        last = self._last_run.get(meeting_id, 0.0)
        if now - last < _SUGGESTION_COOLDOWN:
            return []

        self._last_run[meeting_id] = now
        try:
            return await self._client.generate_suggestions(
                transcript_text, meeting_type, context
            )
        except Exception as exc:
            logger.error("IntelligenceEngine: suggestion error for %s: %s", meeting_id, exc)
            return []

    def reset_cooldown(self, meeting_id: str) -> None:
        """Allow immediate suggestion generation (e.g., on manual trigger)."""
        self._last_run.pop(meeting_id, None)
