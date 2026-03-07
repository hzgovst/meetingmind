from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

class _OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Meeting
# ---------------------------------------------------------------------------

class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    meeting_type: str = Field(..., min_length=1, max_length=64)


class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[str] = None
    summary: Optional[str] = None


class MeetingRead(_OrmBase):
    id: str
    title: str
    meeting_type: str
    status: str
    created_at: datetime
    updated_at: datetime
    summary: Optional[str] = None
    file_context: Optional[str] = None


class MeetingDetail(MeetingRead):
    segments: List[TranscriptSegmentRead] = []
    tasks: List[TaskRead] = []
    suggestions: List[AISuggestionRead] = []


# ---------------------------------------------------------------------------
# TranscriptSegment
# ---------------------------------------------------------------------------

class TranscriptSegmentRead(_OrmBase):
    id: str
    meeting_id: str
    speaker: str
    content: str
    timestamp: float
    created_at: datetime


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    description: str
    assignee: Optional[str] = None


class TaskUpdate(BaseModel):
    completed: Optional[bool] = None
    description: Optional[str] = None
    assignee: Optional[str] = None


class TaskRead(_OrmBase):
    id: str
    meeting_id: str
    description: str
    assignee: Optional[str] = None
    completed: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# AISuggestion
# ---------------------------------------------------------------------------

SuggestionType = Literal["ask_about", "suggest", "alert"]


class AISuggestionCreate(BaseModel):
    suggestion_type: SuggestionType
    content: str


class AISuggestionUpdate(BaseModel):
    dismissed: Optional[bool] = None


class AISuggestionRead(_OrmBase):
    id: str
    meeting_id: str
    suggestion_type: str
    content: str
    dismissed: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

class SummaryResponse(BaseModel):
    executive_summary: str
    key_decisions: List[str]
    action_items: List[str]
    follow_up_questions: List[str]


# ---------------------------------------------------------------------------
# File upload
# ---------------------------------------------------------------------------

class FileUploadResponse(BaseModel):
    filename: str
    summary: str
    size_bytes: int


# Forward-ref resolution
MeetingDetail.model_rebuild()
