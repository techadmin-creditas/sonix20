from typing import Any, Dict
from voicebot.core.tools.base import BaseTool

class BookAppointmentTool(BaseTool):
    """
    Tool to book appointments in the SQL database.
    """
    @property
    def name(self) -> str:
        return "book_appointment"

    @property
    def description(self) -> str:
        return "Book an appointment or meeting for a user."

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "user_name": {"type": "string", "description": "Full name of the person"},
                "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                "time": {"type": "string", "description": "Time in HH:MM format (24h)"},
                "reason": {"type": "string", "description": "Purpose of the appointment"}
            },
            "required": ["user_name", "date", "time"]
        }

    async def execute(self, user_name: str = "Guest", date: str = "", time: str = "", reason: str = "", **kwargs) -> str:
        if self.db:
            await self.db.book_appointment(
                user_name=user_name, date=date,
                time_str=time, reason=reason,
                session_id=self.session.session_id
            )
            result = f"Appointment confirmed for {user_name} on {date} at {time}. Reason: {reason or 'Not specified'}."
        else:
            result = f"Appointment booked for {user_name} on {date} at {time} (in-memory only)."
        
        await self.log_call({"user_name": user_name, "date": date, "time": time, "reason": reason}, result)
        return result
