"""AI Proxy Service - proxies chat requests to external AI providers."""
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


async def proxy_chat(
    messages: List[Dict[str, str]],
    model: str,
    api_key: str,
    provider: str,
) -> str:
    """
    Proxy a chat completion request to an external AI provider.

    Args:
        messages: List of message dicts with 'role' and 'content' keys.
        model: The model identifier (e.g., 'gpt-4o', 'claude-sonnet-4-20250514').
        api_key: The user's API key for the provider.
        provider: One of 'openai', 'anthropic', 'deepseek'.

    Returns:
        The assistant's response content as a string.
    """
    if provider in ("openai", "deepseek"):
        return await _call_openai_compatible(messages, model, api_key, provider)
    elif provider == "anthropic":
        return await _call_anthropic(messages, model, api_key)
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