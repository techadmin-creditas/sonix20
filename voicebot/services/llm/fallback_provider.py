"""
Multi-provider LLM wrapper: on quota / rate-limit exhaustion, try the next backend.
"""

from __future__ import annotations

import asyncio
import async_timeout
from typing import Any, AsyncIterator, List, Optional

from voicebot.shared.exceptions import ServiceExhaustedError, AuthError, VoiceBotError
from voicebot.shared.logging.logger import setup_logger
from voicebot.shared.models.tools import LLMResponse, ToolDefinition

logger = setup_logger("llm-fallback", "INFO")


class FallbackStreamingProvider:
    """Delegates stream_completion to an ordered list; retries on ServiceExhaustedError."""

    def __init__(self, providers: list[Any], labels: Optional[list[str]] = None) -> None:
        if not providers:
            raise ValueError("FallbackStreamingProvider requires at least one provider")
        self._providers = providers
        self._labels = labels or [f"p{i}" for i in range(len(providers))]

    async def stream_completion(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        tools: Optional[List[ToolDefinition]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        ttft_timeout: float = 2.0,
    ) -> AsyncIterator[LLMResponse]:
        last: Optional[Exception] = None
        n = len(self._providers)
        for i, prov in enumerate(self._providers):
            label = self._labels[i] if i < len(self._labels) else str(i)
            try:
                # 🛡️ TTFT Watchdog: If the primary provider doesn't yield ANYTHING in ttft_timeout,
                # we abort and try the next one. This prevents 10-20s hangs on rate-limited providers.
                
                iterator = prov.stream_completion(
                    system_prompt=system_prompt,
                    messages=messages,
                    tools=tools,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

                # Attempt to get the first chunk
                try:
                    # Give the LAST provider more grace (2x) so we don't return NOTHING if all are slow
                    effective_timeout = ttft_timeout if i < n - 1 else ttft_timeout * 2.0
                    async with async_timeout.timeout(effective_timeout):
                        first_chunk = await iterator.__anext__()
                        yield first_chunk
                except (asyncio.TimeoutError, StopAsyncIteration) as e:
                    if isinstance(e, asyncio.TimeoutError):
                        last = ServiceExhaustedError(f"TTFT Timeout (> {effective_timeout:.1f}s) for {label}")
                        if i + 1 < n:
                            logger.warning("🕒 LLM provider %s TTFT timeout, trying fallback", label)
                            continue
                        # If it's the last one, the 'raise last' at the end of the loop will catch it
                    else:
                        # Empty response
                        return

                # If we got the first token, stream the rest
                async for chunk in iterator:
                    yield chunk
                return
                
            except (ServiceExhaustedError, AuthError, VoiceBotError, asyncio.TimeoutError) as e:
                last = e
                if i + 1 < n:
                    logger.warning(
                        "LLM provider %s failed or exhausted (%s), trying fallback",
                        label,
                        e,
                    )
                    continue
                raise
        if last:
            raise last

    async def disconnect(self) -> None:
        for p in self._providers:
            if hasattr(p, "disconnect"):
                try:
                    await p.disconnect()
                except Exception as e:
                    logger.debug("disconnect %s: %s", type(p).__name__, e)

    async def _get_client(self) -> None:
        """Warm the primary provider when supported."""
        p0 = self._providers[0]
        if hasattr(p0, "_get_client"):
            await p0._get_client()
