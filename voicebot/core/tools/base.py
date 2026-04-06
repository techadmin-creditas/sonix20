from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from voicebot.shared.logging.logger import logger

class BaseTool(ABC):
    """
    Abstract base class for all bot tools.
    Each tool must define its name, description, and parameter schema.
    """
    def __init__(self, session: Any = None, db: Any = None, data_access_policy: Any = None, brain: Any = None):
        self.session = session
        self.db = db
        self.data_access_policy = data_access_policy or {}
        self.brain = brain

    @property
    @abstractmethod
    def name(self) -> str:
        """The identifier used by the LLM to call this tool."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Instruction to the LLM on when and how to use this tool."""
        pass

    @property
    def parameters(self) -> Dict[str, Any]:
        """JSON Schema for the tool's input parameters."""
        pass

    @property
    def safety_instructions(self) -> str:
        """
        Instructions the Agentic Brain should follow when using this specific tool.
        Use this to provide negative constraints (e.g. "Do NOT guess the account number")
        or mandatory behavioral instructions.
        """
        return ""

    @abstractmethod
    async def execute(self, **kwargs) -> str:
        """Perform the actual tool logic and return a text response."""
        pass

    async def log_call(self, args: Dict[str, Any], result: str):
        """Helper to log tool activity to the database if available."""
        if self.db and self.session:
            await self.db.log_tool_call(self.session.session_id, self.name, args, result)
