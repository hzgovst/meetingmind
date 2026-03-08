from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

from app.config import settings
from app.core.gemini_client import GeminiClient

logger = logging.getLogger(__name__)

# Approximate bytes per second for WebM/Opus at 48 kHz mono (roughly 32 kbps observed).
# A realistic estimate ensures the buffer accumulates several seconds of audio before
# sending to the transcription API, so the WebM container headers are included in each chunk.
_BYTES_PER_SECOND_ESTIMATE = 4_000  # ~32 kbps / 8 bits
_BUFFER_THRESHOLD = _BYTES_PER_SECOND_ESTIMATE * settings.AUDIO_CHUNK_SECONDS


@dataclass
class TranscriptResult:
    speaker: str
    text: str
    timestamp: float
    confidence: float = 1.0


@dataclass
class AudioProcessor:
    gemini_client: GeminiClient
    context: str = ""
    _buffer: bytearray = field(default_factory=bytearray, init=False)
    _start_time: float = field(default_factory=time.monotonic, init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)

    async def push_chunk(self, chunk: bytes) -> TranscriptResult | None:
        """
        Buffer an incoming audio chunk.  Returns a TranscriptResult when the
        buffer is large enough to warrant a transcription call, otherwise None.
        """
        async with self._lock:
            self._buffer.extend(chunk)
            if len(self._buffer) >= _BUFFER_THRESHOLD:
                return await self._flush()
        return None

    async def flush(self) -> TranscriptResult | None:
        """Force-process whatever is in the buffer (e.g., on session end)."""
        async with self._lock:
            return await self._flush()

    async def _flush(self) -> TranscriptResult | None:
        if not self._buffer:
            return None

        audio_data = bytes(self._buffer)
        self._buffer.clear()
        timestamp = time.monotonic() - self._start_time

        try:
            result = await self.gemini_client.transcribe_audio(audio_data, self.context)
            text = result.get("text", "").strip()
            if not text:
                return None
            return TranscriptResult(
                speaker=result.get("speaker", "Speaker 1"),
                text=text,
                timestamp=timestamp,
                confidence=float(result.get("confidence", 1.0)),
            )
        except Exception as exc:
            logger.error("Audio flush failed: %s", exc)
            return None
