"""
Custom exceptions for consistent error handling and UI propagation
across LLM, STT, and TTS providers.
"""

class VoiceBotError(Exception):
    """Base exception for all voice bot related errors."""
    def __init__(self, message: str, code: str = "GENERIC_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code

class ServiceExhaustedError(VoiceBotError):
    """Raised when a managed service (ElevenLabs, Deepgram, Groq) reports quota exhaustion (402/429)."""
    def __init__(self, message: str):
        super().__init__(message, code="SERVICE_EXHAUSTED")

class AuthError(VoiceBotError):
    """Raised when API keys are invalid or expired (401)."""
    def __init__(self, message: str):
        super().__init__(message, code="AUTH_FAILED")

class HandshakeError(VoiceBotError):
    """Raised when a WebSocket handshake or provider connection fails initial setup."""
    def __init__(self, message: str):
        super().__init__(message, code="HANDSHAKE_FAILED")
