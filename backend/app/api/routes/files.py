from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_gemini_client, get_context_manager
from app.config import settings
from app.core.context_manager import ContextManager
from app.core.file_processor import FileProcessor
from app.core.gemini_client import GeminiClient
from app.models.meeting import Meeting
from app.schemas.meeting import FileUploadResponse

router = APIRouter(prefix="/api/meetings", tags=["files"])
logger = logging.getLogger(__name__)

_processor = FileProcessor()
_MAX_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024


@router.post(
    "/{meeting_id}/files",
    response_model=List[FileUploadResponse],
    status_code=status.HTTP_201_CREATED,
)
async def upload_files(
    meeting_id: str,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    gemini: GeminiClient = Depends(get_gemini_client),
    ctx_mgr: ContextManager = Depends(get_context_manager),
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    responses: list[FileUploadResponse] = []

    for upload in files:
        raw = await upload.read()

        if len(raw) > _MAX_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File '{upload.filename}' exceeds the {settings.MAX_FILE_SIZE_MB} MB limit.",
            )

        content_text, note = _processor.process(upload.filename or "upload", raw)

        if content_text:
            ai_summary = await gemini.process_file(content_text, upload.filename or "upload")
        else:
            ai_summary = note

        ctx_mgr.add_file_context(meeting_id, upload.filename or "upload", ai_summary)

        # Persist file context reference on the meeting row
        existing = meeting.file_context or ""
        meeting.file_context = (
            existing + f"\n---\nFile: {upload.filename}\n{ai_summary}"
        ).strip()

        responses.append(
            FileUploadResponse(
                filename=upload.filename or "upload",
                summary=ai_summary,
                size_bytes=len(raw),
            )
        )

    await db.flush()
    return responses
