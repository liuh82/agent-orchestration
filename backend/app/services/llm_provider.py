"""Unified LLM provider — routes provider:model to correct API endpoint.

Supports model IDs in format:
  - "provider:model-name" (e.g., "zai-coding-plan:glm-5", "openai:gpt-4o")
  - Direct model name without provider prefix (fallback to default provider)

Provider config via NEXUS_LLM_PROVIDERS env var (JSON):
  {"provider_name": {"base_url": "...", "api_key": "..."}, ...}
"""
import json
import logging
import os
import re
from typing import Any, Dict, Optional

import aiohttp

logger = logging.getLogger(__name__)

# Default config from environment variables (backward compatibility)
_DEFAULT_BASE_URL = os.getenv("NEXUS_LLM_API_BASE", "https://api.openai.com/v1")
_DEFAULT_API_KEY = os.getenv("NEXUS_LLM_API_KEY", "")
_DEFAULT_TIMEOUT = int(os.getenv("NEXUS_LLM_TIMEOUT", "120"))


class LLMProvider:
    """Unified LLM provider that routes model IDs to correct API endpoints."""

    def __init__(self):
        self.providers: Dict[str, Dict[str, str]] = {}
        self._default_provider: Optional[str] = None
        self._load_providers()

    def _load_providers(self):
        """Load provider configs from NEXUS_LLM_PROVIDERS env var."""
        raw = os.getenv("NEXUS_LLM_PROVIDERS", "")
        if raw:
            try:
                self.providers = json.loads(raw)
                if self.providers:
                    self._default_provider = next(iter(self.providers))
                    logger.info("Loaded %d LLM providers: %s", len(self.providers), list(self.providers.keys()))
            except json.JSONDecodeError:
                logger.error("Failed to parse NEXUS_LLM_PROVIDERS: %s", raw[:100])

        # Fallback: create a default provider from individual env vars
        if not self.providers and _DEFAULT_API_KEY:
            self.providers["default"] = {
                "base_url": _DEFAULT_BASE_URL,
                "api_key": _DEFAULT_API_KEY,
            }
            self._default_provider = "default"

    def parse_model_id(self, model_id: str) -> tuple:
        """Parse 'provider:model' -> (provider_name, model_name).

        Examples:
            "zai-coding-plan:glm-5" -> ("zai-coding-plan", "glm-5")
            "gpt-4o"                -> (default_provider, "gpt-4o")
        """
        if not model_id:
            return self._default_provider, ""

        if ":" in model_id:
            provider, model = model_id.split(":", 1)
            return provider, model

        return self._default_provider, model_id

    async def chat_completion(
        self,
        model_id: str,
        messages: list,
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        timeout: Optional[int] = None,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> str:
        """Route to correct provider and call OpenAI-compatible chat completion.

        Returns the assistant message content string.
        """
        provider_name, model_name = self.parse_model_id(model_id)
        config = self.providers.get(provider_name)

        if not config:
            raise ValueError(
                f"LLM provider '{provider_name}' not configured. "
                f"Available providers: {list(self.providers.keys())}. "
                f"Set NEXUS_LLM_PROVIDERS env var."
            )

        base_url = config.get("base_url", _DEFAULT_BASE_URL).rstrip("/")
        api_key = config.get("api_key", "")

        if not api_key:
            raise ValueError(f"API key not configured for provider '{provider_name}'")

        # Build messages with optional system prompt
        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": api_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        payload.update(kwargs)

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        url = f"{base_url}/chat/completions"
        effective_timeout = timeout or _DEFAULT_TIMEOUT

        logger.debug(
            "LLM call: provider=%s model=%s url=%s",
            provider_name, model_name, url,
        )

        aio_timeout = aiohttp.ClientTimeout(total=effective_timeout)
        async with aiohttp.ClientSession(timeout=aio_timeout) as session:
            async with session.post(url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise RuntimeError(
                        f"LLM API call failed: HTTP {resp.status}, {text[:500]}"
                    )
                data = await resp.json()
                content = data["choices"][0]["message"]["content"]
                # 清理 MiniMax 等模型的 thinking tokens（多种格式兼容）
                content = re.sub(r"<thinkin>.*?</thinkin>\s*", "", content, flags=re.DOTALL)
                content = re.sub(r"💭.*?🔖", "", content, flags=re.DOTALL)
                content = content.strip()
                return content

    def get_provider_info(self, model_id: str) -> Dict[str, str]:
        """Get provider info for a model ID (useful for logging/debugging)."""
        provider_name, model_name = self.parse_model_id(model_id)
        config = self.providers.get(provider_name, {})
        return {
            "provider": provider_name or "none",
            "model": model_name,
            "base_url": config.get("base_url", ""),
            "has_api_key": bool(config.get("api_key")),
        }


# Module-level singleton
llm_provider = LLMProvider()
