from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)


class _TokenBucket:
    """Simple token-bucket rate limiter."""

    def __init__(self, rate_per_minute: int) -> None:
        self._rate = rate_per_minute
        self._tokens = float(rate_per_minute)
        self._interval = 60.0 / rate_per_minute  # seconds between tokens
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            # Refill tokens proportionally
            self._tokens = min(
                float(self._rate),
                self._tokens + elapsed * (self._rate / 60.0),
            )
            self._last_refill = now

            if self._tokens < 1:
                wait = self._interval - elapsed
                if wait > 0:
                    await asyncio.sleep(wait)
                self._tokens = 0.0
            else:
                self._tokens -= 1.0


class GeminiClient:
    """Thin async wrapper around the google-generativeai SDK."""

    def __init__(self) -> None:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self._primary = settings.GEMINI_MODEL
        self._fallback = settings.GEMINI_FALLBACK_MODEL
        self._limiter = _TokenBucket(settings.MAX_RPM)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _generate(self, model_name: str, prompt: str) -> str:
        await self._limiter.acquire()
        model = genai.GenerativeModel(model_name)
        response = await asyncio.get_event_loop().run_in_executor(
            None, lambda: model.generate_content(prompt)
        )
        return response.text

    async def _generate_with_fallback(self, prompt: str) -> str:
        try:
            return await self._generate(self._primary, prompt)
        except Exception as exc:
            if "429" in str(exc) or "quota" in str(exc).lower() or "rate" in str(exc).lower():
                logger.warning("Primary model rate-limited, falling back to %s", self._fallback)
                await asyncio.sleep(2)
                return await self._generate(self._fallback, prompt)
            raise

    @staticmethod
    def _parse_json(text: str) -> Any:
        """Extract and parse the first JSON block from a model response."""
        text = text.strip()
        # Strip markdown code fences
        for fence in ("```json", "```"):
            if text.startswith(fence):
                text = text[len(fence):]
                break
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text.strip())

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def transcribe_audio(self, audio_data: bytes, context: str) -> dict:
        """
        Transcribe audio bytes.

        Returns: {"speaker": str, "text": str, "confidence": float}
        """
        prompt = (
            f"{context}\n\n"
            "You are a professional meeting transcription service. "
            "The following is a base64-encoded WebM/Opus audio chunk from a meeting recording. "
            "Transcribe it and identify the speaker if possible.\n\n"
            f"Audio data length: {len(audio_data)} bytes\n\n"
            "Respond ONLY with valid JSON in this exact format:\n"
            '{"speaker": "Speaker 1", "text": "<transcribed text>", "confidence": 0.95}\n\n'
            "If audio is silent or unclear, return an empty text field."
        )
        try:
            # Use the Files API for actual audio when available; fall back to prompt-only
            model = genai.GenerativeModel(self._primary)
            await self._limiter.acquire()

            import base64
            audio_b64 = base64.b64encode(audio_data).decode()

            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: model.generate_content([
                    {
                        "inline_data": {
                            "mime_type": "audio/webm",
                            "data": audio_b64,
                        }
                    },
                    (
                        "Transcribe this audio segment from a meeting. "
                        "Identify the speaker if possible. "
                        "Respond ONLY with valid JSON: "
                        '{"speaker": "Speaker 1", "text": "<text>", "confidence": 0.95}'
                    ),
                ]),
            )
            return self._parse_json(response.text)
        except Exception as exc:
            logger.warning("Audio transcription failed: %s — returning empty segment", exc)
            return {"speaker": "Speaker 1", "text": "", "confidence": 0.0}

    async def generate_suggestions(
        self, transcript: str, meeting_type: str, context: str
    ) -> list[dict]:
        """
        Generate real-time AI suggestions.

        Returns: [{"type": "ask_about"|"suggest"|"alert", "content": str}, ...]
        """
        prompt = (
            f"{context}\n\n"
            f"Meeting type: {meeting_type}\n\n"
            f"Recent transcript:\n{transcript}\n\n"
            "Based on the transcript above, generate up to 5 helpful suggestions for the meeting participant. "
            "Each suggestion must be one of three types:\n"
            "  - ask_about: a clarifying question to raise\n"
            "  - suggest: a recommendation or best practice to mention\n"
            "  - alert: a risk, blocker, or issue that deserves immediate attention\n\n"
            "Respond ONLY with a JSON array:\n"
            '[{"type": "ask_about", "content": "..."}, ...]'
        )
        try:
            text = await self._generate_with_fallback(prompt)
            result = self._parse_json(text)
            if isinstance(result, list):
                return result
            return []
        except Exception as exc:
            logger.warning("Suggestion generation failed: %s", exc)
            return []

    async def extract_tasks(self, transcript: str, context: str) -> list[dict]:
        """
        Extract action items from the transcript.

        Returns: [{"description": str, "assignee": str | null}, ...]
        """
        prompt = (
            f"{context}\n\n"
            f"Meeting transcript:\n{transcript}\n\n"
            "Extract all action items and tasks mentioned in this transcript. "
            "For each task, identify who it was assigned to (if mentioned). "
            "Respond ONLY with a JSON array:\n"
            '[{"description": "...", "assignee": "John"}, ...]'
        )
        try:
            text = await self._generate_with_fallback(prompt)
            result = self._parse_json(text)
            if isinstance(result, list):
                return result
            return []
        except Exception as exc:
            logger.warning("Task extraction failed: %s", exc)
            return []

    async def generate_summary(
        self, full_transcript: str, meeting_type: str, tasks: list
    ) -> dict:
        """
        Generate a comprehensive post-meeting summary.

        Returns:
            {
                "executive_summary": str,
                "key_decisions": [str, ...],
                "action_items": [str, ...],
                "follow_up_questions": [str, ...],
            }
        """
        tasks_text = "\n".join(
            f"- {t.get('description', '')} (assigned to: {t.get('assignee', 'unassigned')})"
            for t in tasks
        )
        prompt = (
            f"Meeting type: {meeting_type}\n\n"
            f"Full transcript:\n{full_transcript}\n\n"
            f"Identified tasks:\n{tasks_text}\n\n"
            "Generate a comprehensive meeting summary. "
            "Respond ONLY with valid JSON in this exact format:\n"
            "{\n"
            '  "executive_summary": "2-3 sentence overview",\n'
            '  "key_decisions": ["decision 1", "decision 2"],\n'
            '  "action_items": ["action 1", "action 2"],\n'
            '  "follow_up_questions": ["question 1", "question 2"]\n'
            "}"
        )
        try:
            text = await self._generate_with_fallback(prompt)
            return self._parse_json(text)
        except Exception as exc:
            logger.warning("Summary generation failed: %s", exc)
            return {
                "executive_summary": "Summary generation failed.",
                "key_decisions": [],
                "action_items": [],
                "follow_up_questions": [],
            }

    async def process_file(self, file_content: str, filename: str) -> str:
        """
        Summarize an uploaded file's content.

        Returns a concise string summary.
        """
        truncated = file_content[:8000]
        prompt = (
            f"You are reviewing a file named '{filename}' that was shared in a technical meeting.\n\n"
            f"File contents (possibly truncated):\n{truncated}\n\n"
            "Provide a concise summary (3-5 sentences) of what this file contains, "
            "its purpose, and any key technical details relevant to a Big Data engineering discussion."
        )
        try:
            return await self._generate_with_fallback(prompt)
        except Exception as exc:
            logger.warning("File processing failed: %s", exc)
            return f"Could not process file '{filename}'."
