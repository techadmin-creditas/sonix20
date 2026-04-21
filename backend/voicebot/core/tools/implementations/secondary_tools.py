from typing import Any, Dict, Optional
from voicebot.core.tools.base import BaseTool

class GetAppointmentsTool(BaseTool):
    """
    Tool to retrieve upcoming appointments.
    """
    @property
    def name(self) -> str:
        return "get_appointments"

    @property
    def description(self) -> str:
        return "Retrieve upcoming appointments from the system."

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "user_name": {"type": "string", "description": "Filter by user name (optional)"}
            },
            "required": []
        }

    async def execute(self, user_name: Optional[str] = None, **kwargs) -> str:
        if not self.db:
            return "Appointments are not available right now."

        da = kwargs.get("data_access") or self.data_access_policy
        if da.get("appointments_match_session_user") and self.session and self.session.user_id:
            user_name = self.session.user_id
        appts = await self.db.get_appointments(user_name=user_name, limit=5, data_access=da)
        if appts:
            lines = [f"{a['user_name']} on {a['date']} at {a['time']} ({a['reason'] or 'no reason given'})" for a in appts]
            result = "Upcoming appointments: " + "; ".join(lines)
        else:
            result = "No upcoming appointments found."
            
        await self.log_call({"user_name": user_name}, result)
        return result


class RememberUserFactTool(BaseTool):
    """
    Tool to save user-specific facts.
    """
    @property
    def name(self) -> str:
        return "remember_user_fact"

    @property
    def description(self) -> str:
        return "Save an important fact or preference shared by the user."

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "fact": {"type": "string", "description": "The fact to remember"},
                "category": {"type": "string", "description": "Category (e.g., identity, preference, business)"}
            },
            "required": ["fact"]
        }

    async def execute(self, fact: str = "", category: str = "general", **kwargs) -> str:
        if not self.db or not self.session:
            return "Noted."
        
        await self.db.save_user_fact(
            fact=fact, category=category,
            session_id=self.session.session_id,
            user_id=self.session.user_id
        )
        result = "Got it, I'll remember: " + fact
        await self.log_call({"fact": fact, "category": category}, result)
        return result


class WeatherTool(BaseTool):
    """
    Mock weather tool.
    """
    @property
    def name(self) -> str:
        return "get_weather"

    @property
    def description(self) -> str:
        return "Get current weather for a city."

    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "Name of the city"}
            },
            "required": ["city"]
        }

    async def execute(self, city: str = "your city", **kwargs) -> str:
        da = kwargs.get("data_access") or self.data_access_policy
        weather_cfg = (da.get("integrations") or {}).get("weather") or da.get("weather") or {}
        url_t = weather_cfg.get("url_template") or weather_cfg.get("url")
        if not url_t:
            result = (
                "Weather is not configured for this bot. "
                "Set data_access_policy.integrations.weather.url_template in the admin UI "
                "(use {city} placeholder; optional ${API_KEY} from environment)."
            )
            await self.log_call({"city": city}, result)
            return result
        try:
            from voicebot.shared.policy import expand_env_in_str
            import httpx

            url = expand_env_in_str(str(url_t).replace("{city}", city))
            method = (weather_cfg.get("method") or "GET").upper()
            headers = weather_cfg.get("headers") if isinstance(weather_cfg.get("headers"), dict) else {}
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.request(method, url, headers=headers)
                r.raise_for_status()
                if "application/json" in (r.headers.get("content-type") or ""):
                    result = r.text[:2000]
                else:
                    result = r.text[:2000]
        except Exception as e:
            result = f"Weather request failed: {e!s}"
        await self.log_call({"city": city}, result)
        return result
