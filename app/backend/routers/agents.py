"""Agent management and multi-agent chat routes."""
import asyncio
import json
import logging
from typing import AsyncGenerator

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

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])
logger = logging.getLogger(__name__)


def _sse_event(data: dict) -> bytes:
    """Safely serialize a dict to an SSE event byte string.
    Returns pre-encoded UTF-8 bytes to avoid any dependency on locale encoding."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")


def _safe_error(msg: str) -> str:
    """Convert any message to an ASCII-safe string."""
    return msg.encode("ascii", errors="replace").decode("ascii")


async def _keepalive_wrapper(
    event_gen: AsyncGenerator[bytes, None],
    heartbeat_sec: float = 10.0,
) -> AsyncGenerator[bytes, None]:
    """Wrap an SSE byte generator with periodic keep-alive comments.

    The underlying AI streaming call may take 5-30 seconds before producing
    the first token.  Without any data on the wire during that gap,
    the Vite proxy or the browser may tear down the connection with
    ``net::ERR_ABORTED``.  This wrapper injects ``: heartbeat`` SSE
    comments (legal no-ops per the SSE spec) so that the TCP connection
    stays visibly alive.
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=2)
    stream_done = False

    async def _feed():
        nonlocal stream_done
        try:
            async for data in event_gen:
                await queue.put(data)
        finally:
            stream_done = True
            await queue.put(None)

    feed_task = asyncio.create_task(_feed())

    try:
        while not stream_done:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=heartbeat_sec)
            except asyncio.TimeoutError:
                yield b": heartbeat\n\n"
                continue
            if item is None:
                break
            yield item
    finally:
        if not feed_task.done():
            feed_task.cancel()


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



@router.post("/team/chat/stream")
async def team_chat_stream(
    request: TeamChatRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Team Mode: streaming SSE — each agent's work is streamed in real-time."""
    orchestrator = AgentOrchestrator(db)

    async def _event_stream():
        async def _inner():
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
                yield _sse_event({"type": "done"})
            except Exception as e:
                logger.error(f"Team stream error: {e}")
                yield _sse_event({"type": "error", "error": _safe_error(str(e))})
                yield _sse_event({"type": "done"})

        async for chunk in _keepalive_wrapper(_inner()):
            yield chunk
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


@router.post("/chat/stream")
async def chat_with_agent_stream(
    request: AgentChatRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a chat completion from a specific agent using SSE."""
    orchestrator = AgentOrchestrator(db)

    async def _event_stream():
        async def _inner():
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
                yield _sse_event({"done": True, "agent_id": request.agent_id})
            except Exception as e:
                logger.error(f"Agent stream error: {e}")
                yield _sse_event({"error": _safe_error(str(e))})
                yield _sse_event({"done": True, "agent_id": request.agent_id})

        async for chunk in _keepalive_wrapper(_inner()):
            yield chunk

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
