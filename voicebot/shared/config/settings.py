"""
Centralized configuration management using Pydantic Settings.
All services import from this shared config to ensure consistency.
"""

from __future__ import annotations

import os
from enum import Enum
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    DEV = "dev"
    DEVELOPMENT = "dev" # allow 'dev' as value
    STAGING = "uat"
    UAT = "uat"
    PRODUCTION = "prod"
    PROD = "prod"


class RedisSettings(BaseSettings):
    """Redis connection configuration."""
    model_config = SettingsConfigDict(extra="ignore")
    host: str = Field(default="localhost", alias="REDIS_HOST")
    port: int = Field(default=6379, alias="REDIS_PORT")
    password: Optional[str] = Field(default=None, alias="REDIS_PASSWORD")
    db: int = Field(default=0, alias="REDIS_DB")
    session_ttl: int = Field(default=3600, alias="REDIS_SESSION_TTL")

    @property
    def url(self) -> str:
        auth = f":{self.password}@" if self.password else ""
        return f"redis://{auth}{self.host}:{self.port}/{self.db}"


class PostgresSettings(BaseSettings):
    """PostgreSQL connection configuration."""
    model_config = SettingsConfigDict(extra="ignore")
    host: str = Field(default="localhost", alias="POSTGRES_HOST")
    port: int = Field(default=5432, alias="POSTGRES_PORT")
    user: str = Field(default="voicebot", alias="POSTGRES_USER")
    password: str = Field(default="voicebot_secret", alias="POSTGRES_PASSWORD")
    db: str = Field(default="voicebot", alias="POSTGRES_DB")

    @property
    def url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.db}"
        )


class KafkaSettings(BaseSettings):
    """Kafka event bus configuration."""
    model_config = SettingsConfigDict(extra="ignore")
    bootstrap_servers: str = Field(
        default="localhost:9092", alias="KAFKA_BOOTSTRAP_SERVERS"
    )
    consumer_group: str = Field(
        default="voicebot-group", alias="KAFKA_CONSUMER_GROUP"
    )


class LiveKitSettings(BaseSettings):
    """LiveKit WebRTC server configuration."""
    model_config = SettingsConfigDict(extra="ignore")
    url: str = Field(default="ws://localhost:7880", alias="LIVEKIT_URL")
    api_key: str = Field(default="", alias="LIVEKIT_API_KEY")
    api_secret: str = Field(default="", alias="LIVEKIT_API_SECRET")


class STTSettings(BaseSettings):
    """Speech-to-Text service configuration."""
    model_config = SettingsConfigDict(extra="ignore")
    provider: str = Field(default="deepgram", alias="STT_PROVIDER")
    deepgram_api_key: str = Field(default="", alias="DEEPGRAM_API_KEY")
    whisper_model_size: str = Field(default="base", alias="WHISPER_MODEL_SIZE")


class LLMSettings(BaseSettings):
    """Large Language Model service configuration."""
    model_config = SettingsConfigDict(extra="ignore")
    provider: str = Field(default="openai", alias="LLM_PROVIDER")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    anthropic_model: str = Field(
        default="claude-sonnet-4-20250514", alias="ANTHROPIC_MODEL"
    )
    max_tokens: int = Field(default=1024, alias="LLM_MAX_TOKENS")
    temperature: float = Field(default=0.7, alias="LLM_TEMPERATURE")
    streaming: bool = Field(default=True, alias="LLM_STREAMING")


class TTSSettings(BaseSettings):
    """Text-to-Speech service configuration."""
    model_config = SettingsConfigDict(extra="ignore")
    provider: str = Field(default="elevenlabs", alias="TTS_PROVIDER")
    elevenlabs_api_key: str = Field(default="", alias="ELEVENLABS_API_KEY")
    elevenlabs_voice_id: str = Field(
        default="21m00Tcm4TlvDq8ikWAM", alias="ELEVENLABS_VOICE_ID"
    )
    cache_enabled: bool = Field(default=True, alias="TTS_CACHE_ENABLED")
    cache_ttl: int = Field(default=3600, alias="TTS_CACHE_TTL")


class SecuritySettings(BaseSettings):
    """Security and authentication configuration."""
    model_config = SettingsConfigDict(extra="ignore")
    jwt_secret_key: str = Field(
        default="change-me-in-production", alias="JWT_SECRET_KEY"
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=30, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    encryption_key: str = Field(default="", alias="ENCRYPTION_KEY")


class ObservabilitySettings(BaseSettings):
    """Monitoring and tracing configuration."""
    model_config = SettingsConfigDict(extra="ignore")
    prometheus_port: int = Field(default=9090, alias="PROMETHEUS_PORT")
    grafana_port: int = Field(default=3000, alias="GRAFANA_PORT")
    jaeger_endpoint: str = Field(
        default="http://localhost:14268/api/traces",
        alias="JAEGER_ENDPOINT",
    )
    enable_tracing: bool = Field(default=True, alias="ENABLE_TRACING")
    enable_metrics: bool = Field(default=True, alias="ENABLE_METRICS")


class AppSettings(BaseSettings):
    """Root application settings — flat for environment variable compatibility."""
    model_config = SettingsConfigDict(extra="ignore", case_sensitive=False)

    env: str = Field(default="dev", alias="APP_ENV")
    debug: bool = Field(default=True, alias="APP_DEBUG")
    log_level: str = Field(default="INFO", alias="APP_LOG_LEVEL")

    # --- Flattened AI Service Keys (Critical for .env loading) ---
    stt_provider: str = Field(default="deepgram", alias="STT_PROVIDER")
    deepgram_api_key: str = Field(default="", alias="DEEPGRAM_API_KEY")
    whisper_model_size: str = Field(default="base", alias="WHISPER_MODEL_SIZE")

    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(default="claude-sonnet-4-20250514", alias="ANTHROPIC_MODEL")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    openrouter_default_model: str = Field(default="meta-llama/llama-3.3-70b-instruct", alias="OPENROUTER_DEFAULT_MODEL")

    # Classifier LLM — used for intent/sentiment/interceptor classification tasks.
    # Override via env vars or per-bot via bot_config["classifier_llm_provider"].
    # Supported: groq | openrouter | anthropic | gemini  (empty = auto-pick)
    classifier_llm_provider: str = Field(default="", alias="CLASSIFIER_LLM_PROVIDER")
    classifier_llm_model: str = Field(default="", alias="CLASSIFIER_LLM_MODEL")

    # Session inactivity timeout — how long (seconds) the bot waits in LISTENING
    # state before ending the call. Per-bot override via bot_config.inactivity_timeout_seconds.
    inactivity_timeout_seconds: int = Field(default=60, alias="INACTIVITY_TIMEOUT_SECONDS")
    serper_api_key: str = Field(default="", alias="SERPER_API_KEY")

    tts_provider: str = Field(default="elevenlabs", alias="TTS_PROVIDER")
    elevenlabs_api_key: str = Field(default="", alias="ELEVENLABS_API_KEY")
    elevenlabs_voice_id: str = Field(default="21m00Tcm4TlvDq8ikWAM", alias="ELEVENLABS_VOICE_ID")

    # --- Other configs (can stay nested if we use double underscores, but keeping them simple) ---
    postgres_url: Optional[str] = Field(default=None, alias="DATABASE_URL")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # LiveKit / WebRTC (optional)
    livekit_url: str = Field(default="", alias="LIVEKIT_URL")
    # Browser-visible signaling URL (when unset, LIVEKIT_URL is used). Use for Docker/IPv6 issues, e.g. ws://127.0.0.1:7880
    livekit_client_url: str = Field(default="", alias="LIVEKIT_CLIENT_URL")
    livekit_api_key: str = Field(default="", alias="LIVEKIT_API_KEY")
    livekit_api_secret: str = Field(default="", alias="LIVEKIT_API_SECRET")

    # JWT (REST auth when debug=False)
    jwt_secret_key: str = Field(default="change-me-in-production", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")


def _resolve_env_file() -> str:
    """Pick the first existing env file; map development → dev so .env.dev is used."""
    env = os.getenv("APP_ENV", "dev").lower()
    if env in ("development", "develop"):
        env = "dev"
    primary = f".env.{env}"
    if os.path.exists(primary):
        return primary
    return ".env" if os.path.exists(".env") else primary


@lru_cache()
def get_settings() -> AppSettings:
    """
    Cached settings factory with environment-specific .env loading.
    """
    return AppSettings(_env_file=_resolve_env_file())
