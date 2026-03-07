from __future__ import annotations

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_gemini_client, get_context_manager
from app.core.context_manager import ContextManager
from app.core.gemini_client import GeminiClient
from app.core.intelligence import IntelligenceEngine
from app.models.meeting import AISuggestion, Meeting, TranscriptSegment
from app.schemas.meeting import AISuggestionRead
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])
logger = logging.getLogger(__name__)

_engine = IntelligenceEngine.__new__(IntelligenceEngine)


class SuggestionGenerateRequest(BaseModel):
    meeting_id: str


@router.post("/generate", response_model=List[AISuggestionRead])
async def generate_suggestions(
    payload: SuggestionGenerateRequest,
    db: AsyncSession = Depends(get_db),
    gemini: GeminiClient = Depends(get_gemini_client),
    ctx_mgr: ContextManager = Depends(get_context_manager),
):
    result = await db.execute(select(Meeting).where(Meeting.id == payload.meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    seg_result = await db.execute(
        select(TranscriptSegment)
        .where(TranscriptSegment.meeting_id == payload.meeting_id)
        .order_by(TranscriptSegment.timestamp.desc())
        .limit(30)
    )
    segments = seg_result.scalars().all()
    transcript_text = "\n".join(
        f"{s.speaker}: {s.content}" for s in reversed(segments)
    )

    from app.templates.standup import STANDUP_SYSTEM_PROMPT
    from app.templates.production_review import PRODUCTION_REVIEW_SYSTEM_PROMPT
    from app.templates.incident_support import INCIDENT_SUPPORT_SYSTEM_PROMPT
    from app.templates.knowledge_transfer import KNOWLEDGE_TRANSFER_SYSTEM_PROMPT

    _TEMPLATE_MAP = {
        "standup": STANDUP_SYSTEM_PROMPT,
        "production_review": PRODUCTION_REVIEW_SYSTEM_PROMPT,
        "incident_support": INCIDENT_SUPPORT_SYSTEM_PROMPT,
        "knowledge_transfer": KNOWLEDGE_TRANSFER_SYSTEM_PROMPT,
    }
    system_prompt = _TEMPLATE_MAP.get(meeting.meeting_type, "")
    context = ctx_mgr.get_context(meeting_id=payload.meeting_id, system_prompt=system_prompt)

    engine = IntelligenceEngine(gemini_client=gemini)
    raw_suggestions = await engine.generate_suggestions(
        meeting_id=payload.meeting_id,
        transcript_text=transcript_text,
        meeting_type=meeting.meeting_type,
        context=context,
    )

    saved: list[AISuggestion] = []
    for s in raw_suggestions:
        suggestion = AISuggestion(
            id=str(uuid.uuid4()),
            meeting_id=payload.meeting_id,
            suggestion_type=s.get("type", "suggest"),
            content=s.get("content", ""),
        )
        db.add(suggestion)
        saved.append(suggestion)

    await db.flush()
    for s in saved:
        await db.refresh(s)

    return saved
