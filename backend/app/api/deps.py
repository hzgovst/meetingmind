from __future__ import annotations

from app.core.context_manager import ContextManager
from app.core.gemini_client import GeminiClient
from app.database import get_db  # re-export for convenience

__all__ = ["get_db", "get_gemini_client", "get_context_manager"]

# ---------------------------------------------------------------------------
# Singletons — created once at import time and reused across requests.
# ---------------------------------------------------------------------------

_gemini_client: GeminiClient | None = None
_context_manager: ContextManager | None = None


def get_gemini_client() -> GeminiClient:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client


def get_context_manager() -> ContextManager:
    global _context_manager
    if _context_manager is None:
        _context_manager = ContextManager()
        _context_manager.load_knowledge_base()
    return _context_manager
