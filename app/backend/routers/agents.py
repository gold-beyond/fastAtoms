"""Agent management and multi-agent chat routes."""
import json
import logging
from typing import Any, Dict, List

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from schemas.agents import (
    AgentChatRequest,
    AgentChatResponse,
    AgentListResponse,
    AgentResponse,
    TeamChatRequest,
)
from schemas.auth import UserResponse
from services.agent_orchestrator import AgentOrchestrator
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel

class TeamExecuteRequest(BaseModel):
    """Execute a user-confirmed plan."""
    messages: List[Dict[str, str]]
    plan: Dict[str, Any]  # {analysis, tasks: [{agent_id, title, description}], extra_instructions?}


router = APIRouter(prefix="/api/v1/agents", tags=["agents"])
logger = logging.getLogger(__name__)


def _sse_event(data: dict) -> bytes:
    """Safely serialize a dict to an SSE event byte string.
    Returns pre-encoded UTF-8 bytes to avoid any dependency on locale encoding."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")


def _safe_error(msg: str) -> str:
    """Convert any message to an ASCII-safe string."""
    return msg.encode("ascii", errors="replace").decode("ascii")


@router.get("", response_model=AgentListResponse)
async def list_agents(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all available agents (built-in + custom)."""
    orchestrator = AgentOrchestrator(db)
    agents = await orchestrator.get_available_agents(user_id=str(current_user.id))
    return AgentListResponse(agents=[AgentResponse(**a) for a in agents])


@router.post("/chat", response_model=AgentChatResponse)
async def chat_with_agent(
    request: AgentChatRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send message to a specific agent."""
    orchestrator = AgentOrchestrator(db)
    try:
        content = await orchestrator.chat_with_agent(
            agent_id=request.agent_id,
            messages=request.messages,
            user_id=str(current_user.id),
        )
        return AgentChatResponse(content=content, agent_id=request.agent_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=_safe_error(str(e)))
    except Exception as e:
        logger.error(f"Agent chat error: {e}")
        raise HTTPException(status_code=502, detail=f"AI service error: {_safe_error(str(e))}")


@router.post("/team/chat", response_model=AgentChatResponse)
async def team_chat(
    request: TeamChatRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Team Mode: Mike coordinates the conversation."""
    orchestrator = AgentOrchestrator(db)
    try:
        result = await orchestrator.team_chat(
            messages=request.messages,
            user_id=str(current_user.id),
        )
        return AgentChatResponse(
            content=result["content"],
            agent_id=result["agent_id"],
            tasks=result.get("tasks"),
        )
    except Exception as e:
        logger.error(f"Team chat error: {e}")
        raise HTTPException(status_code=502, detail=f"AI service error: {_safe_error(str(e))}")


@router.post("/team/chat/stream")
async def team_chat_stream(
    request: TeamChatRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Team Mode: streaming SSE — each agent's work is streamed in real-time."""
    orchestrator = AgentOrchestrator(db)

    async def _event_stream():
        try:
            async for event in orchestrator.team_chat_stream(
                messages=request.messages,
                user_id=str(current_user.id),
            ):
                yield _sse_event(event)
        except UnicodeEncodeError as e:
            err_msg = _safe_error(str(e))
            logger.error(f"Team stream encoding error: {err_msg}")
            yield _sse_event({"type": "error", "error": "Mike analysis failed: encoding error"})
        except Exception as e:
            logger.error(f"Team stream error: {e}")
            yield _sse_event({"type": "error", "error": _safe_error(str(e))})
        finally:
            logger.info("Team chat stream closed")

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/team/plan/stream")
async def team_plan_stream(
    request: TeamChatRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Phase 1: Mike analyzes and produces a plan for user review."""
    orchestrator = AgentOrchestrator(db)

    async def _event_stream():
        try:
            async for event in orchestrator.team_plan_stream(
                messages=request.messages,
                user_id=str(current_user.id),
            ):
                yield _sse_event(event)
        except UnicodeEncodeError as e:
            err_msg = _safe_error(str(e))
            logger.error(f"Team plan stream encoding error: {err_msg}")
            yield _sse_event({"type": "error", "error": "Mike plan failed: encoding error"})
        except Exception as e:
            logger.error(f"Team plan stream error: {e}")
            yield _sse_event({"type": "error", "error": _safe_error(str(e))})

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/team/execute/stream")
async def team_execute_stream(
    request: TeamExecuteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Phase 2: Execute a user-confirmed plan."""
    orchestrator = AgentOrchestrator(db)

    async def _event_stream():
        try:
            async for event in orchestrator.team_execute_stream(
                messages=request.messages,
                plan=request.plan,
                user_id=str(current_user.id),
            ):
                yield _sse_event(event)
        except UnicodeEncodeError as e:
            err_msg = _safe_error(str(e))
            logger.error(f"Team execute stream encoding error: {err_msg}")
            yield _sse_event({"type": "error", "error": "Execute failed: encoding error"})
        except Exception as e:
            logger.error(f"Team execute stream error: {e}")
            yield _sse_event({"type": "error", "error": _safe_error(str(e))})

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat/stream")
async def chat_with_agent_stream(
    request: AgentChatRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a chat completion from a specific agent using SSE."""
    orchestrator = AgentOrchestrator(db)

    async def _event_stream():
        try:
            async for token in orchestrator.chat_with_agent_stream(
                agent_id=request.agent_id,
                messages=request.messages,
                user_id=str(current_user.id),
            ):
                yield _sse_event({"token": token})
            yield _sse_event({"done": True, "agent_id": request.agent_id})
        except UnicodeEncodeError as e:
            err_msg = _safe_error(str(e))
            logger.error(f"Agent stream encoding error: {err_msg}")
            yield _sse_event({"error": "Agent request encoding error"})
        except Exception as e:
            logger.error(f"Agent stream error: {e}")
            yield _sse_event({"error": _safe_error(str(e))})

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
