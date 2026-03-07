from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent.parent / "knowledge_base" / "big_data_context.md"

_ROLE_CONTEXT = (
    "You are assisting a Senior Big Data Engineer / Tech Lead at Circana (formerly IRI + NPD). "
    "Circana is a market research and consumer insights company. "
    "The engineer works on the Liquid Data platform, a large-scale CPG/retail analytics system. "
    "The tech stack includes Apache Spark (PySpark + Scala), Hadoop/HDFS/YARN, Apache Hive/HiveQL, "
    "Azure Data Lake Storage Gen2 (ADLS), Microsoft SQL Server, and Azure DevOps."
)


class ContextManager:
    """Builds context strings for Gemini prompts."""

    def __init__(self) -> None:
        self._base_knowledge: str = ""
        self._file_contexts: dict[str, str] = {}  # meeting_id -> combined file context

    def load_knowledge_base(self) -> None:
        """Load the static big-data knowledge base from disk."""
        try:
            self._base_knowledge = _KNOWLEDGE_BASE_PATH.read_text(encoding="utf-8")
            logger.info("Knowledge base loaded (%d chars)", len(self._base_knowledge))
        except FileNotFoundError:
            logger.warning("Knowledge base not found at %s", _KNOWLEDGE_BASE_PATH)
            self._base_knowledge = ""

    def add_file_context(self, meeting_id: str, filename: str, summary: str) -> None:
        """Append a processed file summary to a meeting's context."""
        existing = self._file_contexts.get(meeting_id, "")
        entry = f"\n\n--- File: {filename} ---\n{summary}"
        self._file_contexts[meeting_id] = existing + entry

    def get_context(
        self,
        meeting_id: Optional[str] = None,
        system_prompt: str = "",
    ) -> str:
        """Assemble and return the full context string for a Gemini call."""
        parts: list[str] = [_ROLE_CONTEXT]

        if self._base_knowledge:
            parts.append("=== Domain Knowledge ===\n" + self._base_knowledge)

        if system_prompt:
            parts.append("=== Meeting Instructions ===\n" + system_prompt)

        if meeting_id and meeting_id in self._file_contexts:
            parts.append("=== Uploaded File Context ===\n" + self._file_contexts[meeting_id])

        return "\n\n".join(parts)

    def clear_file_context(self, meeting_id: str) -> None:
        self._file_contexts.pop(meeting_id, None)
