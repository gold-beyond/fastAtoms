"""AI Proxy Router - proxies chat requests to external AI providers."""
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.ai_proxy import proxy_chat, proxy_chat_stream

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["ai-proxy"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatProxyRequest(BaseModel):
    messages: List[ChatMessage]
    model: str
    api_key: Optional[str] = None
    provider: Optional[str] = None


class ChatProxyResponse(BaseModel):
    content: str


@router.post("/proxy", response_model=ChatProxyResponse)
async def chat_proxy(
    data: ChatProxyRequest,
):
    """Proxy a chat completion request to an external AI provider."""
    try:
        messages_dicts = [{"role": m.role, "content": m.content} for m in data.messages]
        content = await proxy_chat(
            messages=messages_dicts,
            model=data.model,
            api_key=data.api_key,
            provider=data.provider,
        )
        return ChatProxyResponse(content=content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Chat proxy error: %s", e)
        raise HTTPException(status_code=502, detail="系统异常，请稍后重试。")


async def _stream_events(data: ChatProxyRequest):
    """Generate SSE events from streaming proxy response."""
    messages_dicts = [{"role": m.role, "content": m.content} for m in data.messages]
    try:
        async for token in proxy_chat_stream(
            messages=messages_dicts,
            model=data.model,
            api_key=data.api_key,
            provider=data.provider,
        ):
            yield f"data: {json.dumps({'token': token})}\n\n".encode("utf-8")
        yield f"data: {json.dumps({'done': True})}\n\n".encode("utf-8")
    except Exception as e:
        logger.error("Stream error: %s", e)
        yield f"data: {json.dumps({'error': '系统异常，请稍后重试。'})}\n\n".encode("utf-8")


@router.post("/proxy/stream")
async def chat_proxy_stream(
    data: ChatProxyRequest,
):
    """Stream a chat completion response using SSE."""
    return StreamingResponse(
        _stream_events(data),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )