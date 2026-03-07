from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.api.deps import get_gemini_client, get_context_manager
from app.core.audio_processor import AudioProcessor
from app.core.intelligence import IntelligenceEngine
from app.core.task_extractor import TaskExtractor
from app.database import SessionLocal
from app.models.meeting import AISuggestion, Meeting, Task, TranscriptSegment
from app.templates.standup import STANDUP_SYSTEM_PROMPT
from app.templates.production_review import PRODUCTION_REVIEW_SYSTEM_PROMPT
from app.templates.incident_support import INCIDENT_SUPPORT_SYSTEM_PROMPT
from app.templates.knowledge_transfer import KNOWLEDGE_TRANSFER_SYSTEM_PROMPT

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)

_TEMPLATE_MAP = {
    "standup": STANDUP_SYSTEM_PROMPT,
    "production_review": PRODUCTION_REVIEW_SYSTEM_PROMPT,
    "incident_support": INCIDENT_SUPPORT_SYSTEM_PROMPT,
    "knowledge_transfer": KNOWLEDGE_TRANSFER_SYSTEM_PROMPT,
}

# How many transcript segments to accumulate before attempting tasks/suggestions
_SUGGESTION_SEGMENT_INTERVAL = 5


async def _send_json(ws: WebSocket, data: dict) -> None:
    try:
        await ws.send_text(json.dumps(data))
    except Exception:
        pass  # client already disconnected


@router.websocket("/ws/{meeting_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: str):
    await websocket.accept()

    gemini = get_gemini_client()
    ctx_mgr = get_context_manager()

    # Fetch meeting type to select correct system prompt
    meeting_type = "standup"
    async with SessionLocal() as db:
        result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
        meeting = result.scalar_one_or_none()
        if not meeting:
            await _send_json(websocket, {"type": "status", "message": "Meeting not found"})
            await websocket.close(code=1008)
            return
        meeting_type = meeting.meeting_type

    system_prompt = _TEMPLATE_MAP.get(meeting_type, "")
    context = ctx_mgr.get_context(meeting_id=meeting_id, system_prompt=system_prompt)

    audio_processor = AudioProcessor(gemini_client=gemini, context=context)
    intelligence = IntelligenceEngine(gemini_client=gemini)
    task_extractor = TaskExtractor(gemini_client=gemini)

    transcript_buffer: list[str] = []
    segment_count = 0

    await _send_json(websocket, {"type": "status", "message": "connected"})

    try:
        while True:
            data = await websocket.receive()

            # Handle binary audio frames
            if "bytes" in data and data["bytes"]:
                chunk: bytes = data["bytes"]
                result = await audio_processor.push_chunk(chunk)

                if result and result.text:
                    segment_id = str(uuid.uuid4())
                    segment_count += 1
                    transcript_buffer.append(f"{result.speaker}: {result.text}")

                    # Persist transcript segment
                    async with SessionLocal() as db:
                        segment = TranscriptSegment(
                            id=segment_id,
                            meeting_id=meeting_id,
                            speaker=result.speaker,
                            content=result.text,
                            timestamp=result.timestamp,
                        )
                        db.add(segment)
                        await db.commit()

                    await _send_json(websocket, {
                        "type": "transcript",
                        "id": segment_id,
                        "speaker": result.speaker,
                        "text": result.text,
                        "timestamp": result.timestamp,
                        "confidence": result.confidence,
                    })

                    # Periodically run suggestions and task extraction
                    if segment_count % _SUGGESTION_SEGMENT_INTERVAL == 0:
                        recent_text = "\n".join(transcript_buffer[-20:])
                        full_text = "\n".join(transcript_buffer)

                        # Run both concurrently
                        suggestions, tasks = await asyncio.gather(
                            intelligence.generate_suggestions(
                                meeting_id, recent_text, meeting_type, context
                            ),
                            task_extractor.extract(full_text, context),
                        )

                        async with SessionLocal() as db:
                            for s in suggestions:
                                sugg = AISuggestion(
                                    id=str(uuid.uuid4()),
                                    meeting_id=meeting_id,
                                    suggestion_type=s.get("type", "suggest"),
                                    content=s.get("content", ""),
                                )
                                db.add(sugg)
                                await _send_json(websocket, {
                                    "type": "suggestion",
                                    "id": sugg.id,
                                    "suggestion_type": sugg.suggestion_type,
                                    "content": sugg.content,
                                })

                            for t in tasks:
                                task = Task(
                                    id=str(uuid.uuid4()),
                                    meeting_id=meeting_id,
                                    description=t.get("description", ""),
                                    assignee=t.get("assignee"),
                                )
                                db.add(task)
                                await _send_json(websocket, {
                                    "type": "task",
                                    "id": task.id,
                                    "description": task.description,
                                    "assignee": task.assignee,
                                })

                            await db.commit()

            # Handle text control messages
            elif "text" in data and data["text"]:
                try:
                    msg = json.loads(data["text"])
                except json.JSONDecodeError:
                    continue

                if msg.get("action") == "flush":
                    result = await audio_processor.flush()
                    if result and result.text:
                        async with SessionLocal() as db:
                            segment = TranscriptSegment(
                                id=str(uuid.uuid4()),
                                meeting_id=meeting_id,
                                speaker=result.speaker,
                                content=result.text,
                                timestamp=result.timestamp,
                            )
                            db.add(segment)
                            await db.commit()
                        transcript_buffer.append(f"{result.speaker}: {result.text}")
                        await _send_json(websocket, {
                            "type": "transcript",
                            "speaker": result.speaker,
                            "text": result.text,
                            "timestamp": result.timestamp,
                        })
                    await _send_json(websocket, {"type": "status", "message": "flushed"})

                elif msg.get("action") == "ping":
                    await _send_json(websocket, {"type": "status", "message": "pong"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for meeting %s", meeting_id)
        # Flush remaining audio
        try:
            result = await audio_processor.flush()
            if result and result.text:
                async with SessionLocal() as db:
                    segment = TranscriptSegment(
                        id=str(uuid.uuid4()),
                        meeting_id=meeting_id,
                        speaker=result.speaker,
                        content=result.text,
                        timestamp=result.timestamp,
                    )
                    db.add(segment)
                    await db.commit()
        except Exception as exc:
            logger.warning("Flush on disconnect failed: %s", exc)
    except Exception as exc:
        logger.error("WebSocket error for meeting %s: %s", meeting_id, exc)
        await _send_json(websocket, {"type": "status", "message": f"error: {exc}"})
