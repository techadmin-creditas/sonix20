# How to Add New Capabilities (Scopes) to the Voice Bot

Adding a brand new capability/scope to your Voice Bot is incredibly simple and developer-friendly. Because the frontend UI pulls its state dynamically from the backend API, new features practically "wire themselves up" by just writing the logic.

Here are the 3 steps to build and ship a new Capability (using an imaginary `flight_booking` scope as an example):

## Step 1: Create the Tool in Python

First, write your actual tool logic. Create a new file (e.g. `voicebot/core/tools/implementations/flight_tools.py`) and implement your `BaseTool`:

```python
from typing import Any, Dict
from voicebot.core.tools.base import BaseTool

class SearchFlightsTool(BaseTool):
    @property
    def name(self) -> str: return "search_flights"
    
    @property
    def description(self) -> str: return "Search for available flights based on departure and destination."
    
    @property
    def parameters(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "destination": {"type": "string"}
            },
            "required": ["destination"]
        }

    async def execute(self, destination: str, **kwargs) -> str:
        # Fetch flights logic here
        return f"Flights available to {destination} on Friday."
```

Once written, don't forget to map it inside the `ToolRegistry` (`voicebot/core/tools/registry.py`) so the bot engine is aware the tool class exists!

---

## Step 2: Add it to the Orchestrator Scope Engine

Open `voicebot/core/orchestrator/brain.py` and simply add your new Scope and its corresponding tools to the `_SCOPE_TOOL_NAMES` dictionary located at the top of the file:

```python
_SCOPE_TOOL_NAMES = {
    "knowledge": ("search_knowledge",),
    "appointments": ("book_appointment", "get_appointments"),
    "banking": ("verify_customer", "get_account_balance", "get_loan_status"),
    
    # Add your new scope here!
    "flight_booking": ("search_flights", "purchase_ticket")
}
```

> [!NOTE]
> **🎉 AT THIS POINT IT IS ALREADY LIVE ON THE UI!** 
> Because the React UI hits the `/metadata/scopes` API, it will automatically detect `"flight_booking"` and instantly render a brand new tile for it in the Data Access Manager. It will default to a wrench icon (🔧) and label it "Flight Booking".

---

## Step 3: (Optional) Prettify it in the UI

If you want to give your new scope a custom icon, a beautifully worded description, or dynamic integration URLs, open `obsidian-command/src/pages/BotConfig.tsx` and just append your new scope key to the map blocks:

```tsx
const SCOPE_ICONS: Record<string, string> = {
  // ... existing scopes
  flight_booking: '✈️' 
};

const SCOPE_DESCS: Record<string, string> = {
  // ... existing scopes
  flight_booking: 'Search and book airline tickets for callers.'
};
```

### External API Integrations
If your new tool relies on an external REST API (like the Weather integration) rather than internal SQLite lookups, you can configure it so that admins can paste their API keys and Endpoint URLs directly in the UI. 

To enable the Integration text box for your scope on the frontend, simply add it to this Set in `BotConfig.tsx`:
```tsx
const INTEGRATION_SCOPES = new Set(['weather', 'flight_booking']);
```

And that's it! By making the Data Access panel entirely metadata-driven, you only ever need to map the backend logic, and the UI catches up safely and instantly to offer it to non-coders.
