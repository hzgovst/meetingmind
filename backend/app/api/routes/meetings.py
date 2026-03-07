from __future__ import annotations

import uuid
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_gemini_client, get_context_manager
from app.core.context_manager import ContextManager
from app.core.gemini_client import GeminiClient
from app.models.meeting import AISuggestion, Meeting, Task, TranscriptSegment
from app.schemas.meeting import (
    ActionItem,
    AISuggestionRead,
    AISuggestionUpdate,
    MeetingCreate,
    MeetingDetail,
    MeetingRead,
    MeetingUpdate,
    SummaryResponse,
    TaskRead,
    TaskUpdate,
    TranscriptSegmentRead,
)
from app.templates.standup import STANDUP_SYSTEM_PROMPT
from app.templates.production_review import PRODUCTION_REVIEW_SYSTEM_PROMPT
from app.templates.incident_support import INCIDENT_SUPPORT_SYSTEM_PROMPT
from app.templates.knowledge_transfer import KNOWLEDGE_TRANSFER_SYSTEM_PROMPT

router = APIRouter(prefix="/api/meetings", tags=["meetings"])
logger = logging.getLogger(__name__)

_TEMPLATE_MAP = {
    "standup": STANDUP_SYSTEM_PROMPT,
    "production_review": PRODUCTION_REVIEW_SYSTEM_PROMPT,
    "incident_support": INCIDENT_SUPPORT_SYSTEM_PROMPT,
    "knowledge_transfer": KNOWLEDGE_TRANSFER_SYSTEM_PROMPT,
}


def _get_system_prompt(meeting_type: str) -> str:
    return _TEMPLATE_MAP.get(meeting_type, "")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_meeting_or_404(meeting_id: str, db: AsyncSession) -> Meeting:
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=List[MeetingRead])
async def list_meetings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Meeting).order_by(Meeting.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=MeetingRead, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    payload: MeetingCreate,
    db: AsyncSession = Depends(get_db),
):
    meeting = Meeting(
        id=str(uuid.uuid4()),
        title=payload.title,
        meeting_type=payload.meeting_type,
    )
    db.add(meeting)
    await db.flush()
    await db.refresh(meeting)
    return meeting


@router.get("/{meeting_id}", response_model=MeetingDetail)
async def get_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Meeting)
        .options(
            selectinload(Meeting.segments),
            selectinload(Meeting.tasks),
            selectinload(Meeting.suggestions),
        )
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.put("/{meeting_id}", response_model=MeetingRead)
@router.patch("/{meeting_id}", response_model=MeetingRead)
async def update_meeting(
    meeting_id: str,
    payload: MeetingUpdate,
    db: AsyncSession = Depends(get_db),
):
    meeting = await _get_meeting_or_404(meeting_id, db)
    update_data = payload.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(meeting, key, value)
    await db.flush()
    await db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    meeting = await _get_meeting_or_404(meeting_id, db)
    await db.delete(meeting)


# ---------------------------------------------------------------------------
# Transcript
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/transcript", response_model=List[TranscriptSegmentRead])
async def get_transcript(meeting_id: str, db: AsyncSession = Depends(get_db)):
    await _get_meeting_or_404(meeting_id, db)
    result = await db.execute(
        select(TranscriptSegment)
        .where(TranscriptSegment.meeting_id == meeting_id)
        .order_by(TranscriptSegment.timestamp)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/tasks", response_model=List[TaskRead])
async def get_tasks(meeting_id: str, db: AsyncSession = Depends(get_db)):
    await _get_meeting_or_404(meeting_id, db)
    result = await db.execute(
        select(Task)
        .where(Task.meeting_id == meeting_id)
        .order_by(Task.created_at)
    )
    return result.scalars().all()


@router.put("/{meeting_id}/tasks/{task_id}", response_model=TaskRead)
@router.patch("/{meeting_id}/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    meeting_id: str,
    task_id: str,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
):
    await _get_meeting_or_404(meeting_id, db)
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.meeting_id == meeting_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(task, key, value)
    await db.flush()
    await db.refresh(task)
    return task


# ---------------------------------------------------------------------------
# AI Suggestions
# ---------------------------------------------------------------------------

@router.get("/{meeting_id}/suggestions", response_model=List[AISuggestionRead])
async def get_suggestions(meeting_id: str, db: AsyncSession = Depends(get_db)):
    await _get_meeting_or_404(meeting_id, db)
    result = await db.execute(
        select(AISuggestion)
        .where(AISuggestion.meeting_id == meeting_id)
        .order_by(AISuggestion.created_at.desc())
    )
    return result.scalars().all()


@router.put("/{meeting_id}/suggestions/{sugg_id}", response_model=AISuggestionRead)
@router.patch("/{meeting_id}/suggestions/{sugg_id}", response_model=AISuggestionRead)
async def update_suggestion(
    meeting_id: str,
    sugg_id: str,
    payload: AISuggestionUpdate,
    db: AsyncSession = Depends(get_db),
):
    await _get_meeting_or_404(meeting_id, db)
    result = await db.execute(
        select(AISuggestion).where(
            AISuggestion.id == sugg_id,
            AISuggestion.meeting_id == meeting_id,
        )
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(suggestion, key, value)
    await db.flush()
    await db.refresh(suggestion)
    return suggestion


@router.post("/{meeting_id}/suggestions/{sugg_id}/dismiss", response_model=AISuggestionRead)
async def dismiss_suggestion(
    meeting_id: str,
    sugg_id: str,
    db: AsyncSession = Depends(get_db),
):
    await _get_meeting_or_404(meeting_id, db)
    result = await db.execute(
        select(AISuggestion).where(
            AISuggestion.id == sugg_id,
            AISuggestion.meeting_id == meeting_id,
        )
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    suggestion.dismissed = True
    await db.flush()
    await db.refresh(suggestion)
    return suggestion


# ---------------------------------------------------------------------------
# Post-meeting summary
# ---------------------------------------------------------------------------

@router.post("/{meeting_id}/summary", response_model=SummaryResponse)
async def generate_summary(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    gemini: GeminiClient = Depends(get_gemini_client),
    ctx_mgr: ContextManager = Depends(get_context_manager),
):
    meeting = await _get_meeting_or_404(meeting_id, db)

    seg_result = await db.execute(
        select(TranscriptSegment)
        .where(TranscriptSegment.meeting_id == meeting_id)
        .order_by(TranscriptSegment.timestamp)
    )
    segments = seg_result.scalars().all()
    full_transcript = "\n".join(
        f"[{s.timestamp:.1f}s] {s.speaker}: {s.content}" for s in segments
    )

    task_result = await db.execute(
        select(Task).where(Task.meeting_id == meeting_id)
    )
    tasks = [{"description": t.description, "assignee": t.assignee} for t in task_result.scalars().all()]

    system_prompt = _get_system_prompt(meeting.meeting_type)
    context = ctx_mgr.get_context(meeting_id=meeting_id, system_prompt=system_prompt)

    summary_data = await gemini.generate_summary(full_transcript, meeting.meeting_type, tasks)

    import json
    meeting.summary = json.dumps(summary_data)
    await db.flush()

    # Normalize action_items to list of ActionItem objects
    raw_items = summary_data.get("action_items", [])
    normalized_items: list[ActionItem] = []
    for item in raw_items:
        if isinstance(item, dict):
            normalized_items.append(ActionItem(
                description=item.get("description", str(item)),
                owner=item.get("owner") or item.get("assignee"),
            ))
        else:
            normalized_items.append(ActionItem(description=str(item)))

    return SummaryResponse(
        executive_summary=summary_data.get("executive_summary", ""),
        key_decisions=summary_data.get("key_decisions", []),
        action_items=normalized_items,
        follow_up_questions=summary_data.get("follow_up_questions", []),
    )
