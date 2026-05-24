"""AI Proxy Service - proxies chat requests to external AI providers."""
import json
import logging
from typing import AsyncGenerator, List, Dict, Any, Optional

from core.config import settings

logger = logging.getLogger(__name__)


def _resolve_api_key(api_key: Optional[str], provider: Optional[str]) -> str:
    """Resolve API key from request or environment variables."""
    if api_key:
        return api_key
    if provider == "deepseek":
        return getattr(settings, "deepseek_api_key", "")
    elif provider == "openai":
        return getattr(settings, "openai_api_key", "")
    elif provider == "anthropic":
        return getattr(settings, "anthropic_api_key", "")
    return ""


def _resolve_provider(provider: Optional[str], model: str) -> str:
    """Resolve provider from request or infer from model name."""
    if provider:
        return provider
    model_lower = model.lower()
    if "deepseek" in model_lower:
        return "deepseek"
    elif "gpt" in model_lower or "o1" in model_lower or "o3" in model_lower:
        return "openai"
    elif "claude" in model_lower:
        return "anthropic"
    return "deepseek"


async def proxy_chat(
    messages: List[Dict[str, str]],
    model: str,
    api_key: Optional[str] = None,
    provider: Optional[str] = None,
) -> str:
    """
    Proxy a chat completion request to an external AI provider.

    Args:
        messages: List of message dicts with 'role' and 'content' keys.
        model: The model identifier (e.g., 'gpt-4o', 'claude-sonnet-4-20250514').
        api_key: The user's API key for the provider (optional, falls back to env).
        provider: One of 'openai', 'anthropic', 'deepseek' (optional, inferred from model).

    Returns:
        The assistant's response content as a string.
    """
    provider = _resolve_provider(provider, model)
    resolved_api_key = _resolve_api_key(api_key, provider)
    if not resolved_api_key:
        raise ValueError(f"No API key configured for provider '{provider}'. Set {provider.upper()}_API_KEY environment variable.")

    if provider in ("openai", "deepseek"):
        return await _call_openai_compatible(messages, model, resolved_api_key, provider)
    elif provider == "anthropic":
        return await _call_anthropic(messages, model, resolved_api_key)
    else:
        raise ValueError(f"Unsupported provider: {provider}")


async def _call_openai_compatible(
    messages: List[Dict[str, str]],
    model: str,
    api_key: str,
    provider: str,
) -> str:
    """Call OpenAI-compatible API (OpenAI or DeepSeek)."""
    from openai import AsyncOpenAI

    base_url = None
    if provider == "deepseek":
        base_url = "https://api.deepseek.com"

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"OpenAI-compatible API error ({provider}): {e}")
        raise


async def _call_anthropic(
    messages: List[Dict[str, str]],
    model: str,
    api_key: str,
) -> str:
    """Call Anthropic API."""
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=api_key)

    # Separate system message from conversation messages
    system_content = ""
    chat_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_content = msg["content"]
        else:
            chat_messages.append({"role": msg["role"], "content": msg["content"]})

    # Ensure messages alternate properly and start with user
    if not chat_messages or chat_messages[0]["role"] != "user":
        chat_messages.insert(0, {"role": "user", "content": "Hello"})

    try:
        kwargs: Dict[str, Any] = {
            "model": model,
            "max_tokens": 4096,
            "messages": chat_messages,
        }
        if system_content:
            kwargs["system"] = system_content

        response = await client.messages.create(**kwargs)
        # Extract text from content blocks
        text_parts = []
        for block in response.content:
            if hasattr(block, "text"):
                text_parts.append(block.text)
        return "".join(text_parts)
    except Exception as e:
        logger.error(f"Anthropic API error: {e}")
        raise


async def proxy_chat_stream(
    messages: List[Dict[str, str]],
    model: str,
    api_key: Optional[str] = None,
    provider: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream a chat completion request to an external AI provider.
    Yields tokens as they are received.
    """
    provider = _resolve_provider(provider, model)
    resolved_api_key = _resolve_api_key(api_key, provider)
    if not resolved_api_key:
        raise ValueError(f"No API key configured for provider '{provider}'.")

    if provider in ("openai", "deepseek"):
        async for token in _call_openai_compatible_stream(messages, model, resolved_api_key, provider):
            yield token
    elif provider == "anthropic":
        async for token in _call_anthropic_stream(messages, model, resolved_api_key):
            yield token
    else:
        raise ValueError(f"Unsupported provider: {provider}")


async def _call_openai_compatible_stream(
    messages: List[Dict[str, str]],
    model: str,
    api_key: str,
    provider: str,
) -> AsyncGenerator[str, None]:
    """Call OpenAI-compatible API with streaming (OpenAI or DeepSeek)."""
    from openai import AsyncOpenAI

    base_url = None
    if provider == "deepseek":
        base_url = "https://api.deepseek.com"

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield delta.content
    except Exception as e:
        logger.error(f"OpenAI-compatible streaming error ({provider}): {e}")
        raise


async def _call_anthropic_stream(
    messages: List[Dict[str, str]],
    model: str,
    api_key: str,
) -> AsyncGenerator[str, None]:
    """Call Anthropic API with streaming."""
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=api_key)

    system_content = ""
    chat_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_content = msg["content"]
        else:
            chat_messages.append({"role": msg["role"], "content": msg["content"]})

    if not chat_messages or chat_messages[0]["role"] != "user":
        chat_messages.insert(0, {"role": "user", "content": "Hello"})

    try:
        kwargs: Dict[str, Any] = {
            "model": model,
            "max_tokens": 4096,
            "messages": chat_messages,
            "stream": True,
        }
        if system_content:
            kwargs["system"] = system_content

        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text
    except Exception as e:
        logger.error(f"Anthropic streaming error: {e}")
        raise