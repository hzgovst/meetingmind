from __future__ import annotations

import logging
from pathlib import Path
from typing import Tuple

logger = logging.getLogger(__name__)

_TEXT_EXTENSIONS = {
    ".py", ".scala", ".sql", ".hql", ".sh",
    ".yaml", ".yml", ".json", ".xml",
    ".txt", ".md", ".csv", ".log",
    ".toml", ".ini", ".cfg", ".conf",
}
_MAX_READ_BYTES = 500_000  # 500 KB cap for reading into memory


class FileProcessor:
    """Processes uploaded files and returns their textual content."""

    def process(self, filename: str, raw_bytes: bytes) -> Tuple[str, str]:
        """
        Process *raw_bytes* from an uploaded file.

        Returns (content_text, note) where content_text is the extracted text
        and note is a human-readable description of what was extracted.
        """
        suffix = Path(filename).suffix.lower()

        if suffix in _TEXT_EXTENSIONS:
            return self._read_text(raw_bytes, filename)

        if suffix == ".pdf":
            return self._read_pdf(raw_bytes, filename)

        # Unknown binary — return a placeholder
        note = f"Binary file '{filename}' ({len(raw_bytes)} bytes). Content not extractable."
        return "", note

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _read_text(raw_bytes: bytes, filename: str) -> Tuple[str, str]:
        data = raw_bytes[:_MAX_READ_BYTES]
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                text = data.decode(enc)
                note = f"Text file '{filename}' decoded successfully ({len(text)} chars)."
                return text, note
            except UnicodeDecodeError:
                continue
        note = f"Could not decode '{filename}' as text."
        return "", note

    @staticmethod
    def _read_pdf(raw_bytes: bytes, filename: str) -> Tuple[str, str]:
        # Attempt lightweight text extraction without heavy dependencies.
        # PDFs store text streams that often survive a naive bytes scan.
        try:
            raw_text = raw_bytes.decode("latin-1", errors="replace")
            # Heuristic: extract BT ... ET blocks (PDF text objects)
            import re
            fragments = re.findall(r"BT\s*(.*?)\s*ET", raw_text, re.DOTALL)
            if fragments:
                # Extract Tj / TJ operands
                lines: list[str] = []
                for frag in fragments:
                    for match in re.finditer(r"\(([^)]*)\)\s*Tj", frag):
                        lines.append(match.group(1))
                    for match in re.finditer(r"\[([^\]]*)\]\s*TJ", frag):
                        inner = re.findall(r"\(([^)]*)\)", match.group(1))
                        lines.append("".join(inner))
                text = "\n".join(lines).strip()
                if text:
                    note = f"PDF '{filename}': extracted {len(text)} chars via text-stream parsing."
                    return text, note

            note = f"PDF '{filename}': no readable text streams found. File noted for context."
            return "", note
        except Exception as exc:
            logger.warning("PDF extraction failed for %s: %s", filename, exc)
            note = f"PDF '{filename}': extraction error — file noted for context."
            return "", note
