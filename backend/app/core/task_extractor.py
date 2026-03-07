from __future__ import annotations

import logging
from typing import List

from app.core.gemini_client import GeminiClient

logger = logging.getLogger(__name__)


class TaskExtractor:
    """Extracts action items from meeting transcript text."""

    def __init__(self, gemini_client: GeminiClient) -> None:
        self._client = gemini_client

    async def extract(self, transcript: str, context: str) -> List[dict]:
        """
        Analyse the full transcript accumulated so far and return a list of
        task dicts: {"description": str, "assignee": str | None}.
        """
        if not transcript.strip():
            return []
        try:
            return await self._client.extract_tasks(transcript, context)
        except Exception as exc:
            logger.error("TaskExtractor.extract failed: %s", exc)
            return []
