#!/usr/bin/env python3
"""
LLM Provider Diagnostic Script.

Tests all configured LLM models across different providers by sending a small 
test prompt and measuring Time-to-First-Token (TTFT) and total latency.
"""

import asyncio
import time
import os
import sys

# Ensure the root directory is in the path so we can import 'voicebot'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voicebot.shared.config import get_settings
from voicebot.services.llm.groq_provider import GroqStreamingProvider
from voicebot.services.llm.gemini_provider import GeminiStreamingProvider
from voicebot.services.llm.openai_provider import OpenAIStreamingProvider
from voicebot.services.llm.anthropic_provider import AnthropicStreamingProvider
from voicebot.services.llm.openrouter_provider import OpenRouterStreamingProvider

settings = get_settings()

def is_valid_key(key: str) -> bool:
    """Check if API key is valid (not empty or placeholder)."""
    if not key:
        return False
    # Treat template .env.example values as unset
    invalid_patterns = ["your_", "test_", "demo_", "xxxx", "1234"]
    key_lower = key.lower()
    return not any(p in key_lower for p in invalid_patterns)

async def test_model(model_name: str, provider_class: type, provider_name: str):
    """Test a specific model and return results."""
    print(f"Testing {provider_name} | {model_name}...", end=" ", flush=True)
    
    start_time = time.time()
    ttft = None
    full_response = ""
    
    try:
        # Initialize provider with specific model
        provider = provider_class(model=model_name)
        
        # Test completion
        async for resp in provider.stream_completion(
            system_prompt="You are a ultra-concise assistant. Respond with 'READY'.",
            messages=[{"role": "user", "content": "Ping."}],
            max_tokens=10
        ):
            if resp.content:
                if ttft is None:
                    ttft = (time.time() - start_time) * 1000
                full_response += resp.content
        
        total_latency = (time.time() - start_time) * 1000
        
        print(f"✅ Success! [TTFT: {ttft:.0f}ms | Total: {total_latency:.0f}ms]")
        return {
            "model": model_name,
            "provider": provider_name,
            "status": "PASS",
            "ttft": ttft,
            "total": total_latency,
            "response": full_response.strip()
        }
        
    except Exception as e:
        print(f"❌ Failed: {str(e)[:100]}")
        return {
            "model": model_name,
            "provider": provider_name,
            "status": "FAIL",
            "error": str(e)
        }

async def main():
    print("=" * 60)
    print("🚀 VOICE BOT LLM DIAGNOSTIC SCRIPT")
    print("=" * 60)
    
    tasks = []
    
    # ✅ GROQ
    if is_valid_key(settings.groq_api_key):
        for m in ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]:
            tasks.append(test_model(m, GroqStreamingProvider, "Groq"))
            
    # ✅ GEMINI
    if is_valid_key(settings.gemini_api_key):
        for m in ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash","gemini-2.5-flash-lite"]:
            tasks.append(test_model(m, GeminiStreamingProvider, "Gemini"))
            
    # ✅ OPENAI
    if is_valid_key(settings.openai_api_key):
        for m in ["gpt-4o", "gpt-4o-mini"]:
            tasks.append(test_model(m, OpenAIStreamingProvider, "OpenAI"))
            
    # ✅ ANTHROPIC
    if is_valid_key(settings.anthropic_api_key):
        for m in ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"]:
            tasks.append(test_model(m, AnthropicStreamingProvider, "Anthropic"))
            
    # ✅ OPENROUTER
    if is_valid_key(settings.openrouter_api_key):
        for m in ["google/gemini-2.0-flash-001", "google/gemini-2.0-flash-lite-001", "anthropic/claude-3-haiku"]:
            tasks.append(test_model(m, OpenRouterStreamingProvider, "OpenRouter"))

    if not tasks:
        print("❌ No valid API keys found in .env! Testing aborted.")
        return

    print(f"Found {len(tasks)} valid configurations. Running tests...\n")
    results = await asyncio.gather(*tasks)
    
    # Final Reporting
    print("\n" + "=" * 80)
    print(f"{'PROVIDER':<12} | {'MODEL':<35} | {'STATUS':<6} | {'TTFT':<8} | {'TOTAL':<8}")
    print("-" * 80)
    
    for r in results:
        status = r["status"]
        ttft = f"{r['ttft']:.0f}ms" if "ttft" in r else "-"
        total = f"{r['total']:.0f}ms" if "total" in r else "-"
        print(f"{r['provider']:<12} | {r['model']:<35} | {status:<6} | {ttft:<8} | {total:<8}")
        
    print("=" * 80)
    
    pass_count = len([r for r in results if r["status"] == "PASS"])
    print(f"\nFinal Result: {pass_count}/{len(results)} models operational.")

if __name__ == "__main__":
    asyncio.run(main())
