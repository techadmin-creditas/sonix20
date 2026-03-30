from typing import Dict, Type, List, Any, Optional
from voicebot.core.tools.base import BaseTool
from voicebot.core.tools.implementations.knowledge_search import SearchKnowledgeTool
from voicebot.core.tools.implementations.appointment_booking import BookAppointmentTool
from voicebot.core.tools.implementations.secondary_tools import GetAppointmentsTool, RememberUserFactTool, WeatherTool
from voicebot.core.tools.implementations.end_voice_session import EndVoiceSessionTool
from voicebot.core.tools.implementations.banking_tools import (
    VerifyCustomerTool, GetAccountBalanceTool, GetLoanStatusTool
)

# Registry of all available tool classes
_TOOL_CLASSES: Dict[str, Type[BaseTool]] = {
    "search_knowledge":    SearchKnowledgeTool,
    "book_appointment":    BookAppointmentTool,
    "get_appointments":    GetAppointmentsTool,
    "remember_user_fact":  RememberUserFactTool,
    "get_weather":         WeatherTool,
    "end_voice_session":   EndVoiceSessionTool,
    "verify_customer":     VerifyCustomerTool,
    "get_account_balance": GetAccountBalanceTool,
    "get_loan_status":     GetLoanStatusTool,
}

class ToolRegistry:
    """
    Central registry to manage and instantiate tools.
    """
    @staticmethod
    def get_tool_class(name: str) -> Optional[Type[BaseTool]]:
        """Get the tool class by its name."""
        return _TOOL_CLASSES.get(name)

    @staticmethod
    def get_available_tool_names() -> List[str]:
        """List all tool names that are implemented in the registry."""
        return list(_TOOL_CLASSES.keys())

    @staticmethod
    def instantiate_tool(
        name: str,
        session: Any = None,
        db: Any = None,
        data_access_policy: Any = None,
        brain: Any = None,
    ) -> Optional[BaseTool]:
        """Create an instance of a tool with the provided context."""
        tool_cls = ToolRegistry.get_tool_class(name)
        if tool_cls:
            if name == "end_voice_session":
                return tool_cls(session=session, db=db, data_access_policy=data_access_policy, brain=brain)
            return tool_cls(session=session, db=db, data_access_policy=data_access_policy)
        return None
