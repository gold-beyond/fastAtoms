"""AI Proxy Router - proxies chat requests to external AI providers."""
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ai_proxy import proxy_chat

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
        raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")