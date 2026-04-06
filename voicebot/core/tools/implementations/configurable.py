import httpx
import json
import logging
from typing import Any, Dict, Optional
from voicebot.core.tools.base import BaseTool

logger = logging.getLogger("configurable-tool")

class DynamicAPITool(BaseTool):
    """
    A generic tool that performs an external API call based on a dynamic configuration.
    Allows non-coders to create tools via the UI by providing a URL, method, and headers.
    """
    
    def __init__(self, config: Dict[str, Any], session: Any = None, db: Any = None, brain: Any = None):
        super().__init__(session=session, db=db, brain=brain)
        self._config = config
        self._name = config.get("name", "dynamic_tool")
        self._description = config.get("description", "A custom tool for specific tasks.")
        self._parameters = config.get("parameters", {"type": "object", "properties": {}})

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    @property
    def parameters(self) -> Dict[str, Any]:
        return self._parameters

    async def execute(self, **kwargs) -> str:
        """Execute the API call as configured."""
        method = self._config.get("method", "GET").upper()
        url_template = self._config.get("url_template", "")
        headers = self._config.get("headers", {})
        
        if not url_template:
            return "Configuration Error: No URL template provided for this tool."
            
        try:
            # Expand URL template if it contains placeholders like {id}
            url = url_template.format(**kwargs)
        except KeyError as e:
            return f"Missing required parameter for the tool: {e}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                if method == "GET":
                    r = await client.get(url, headers=headers, params=kwargs)
                elif method in ["POST", "PUT", "PATCH"]:
                    r = await client.request(method, url, headers=headers, json=kwargs)
                else:
                    return f"Unsupported method: {method}"
                
                r.raise_for_status()
                
                # Check for response path filtering (e.g. data.result)
                data = r.json()
                response_path = self._config.get("response_path")
                if response_path:
                    for key in response_path.split('.'):
                        if isinstance(data, dict):
                            data = data.get(key, {})
                        else:
                            break
                
                return json.dumps(data) if not isinstance(data, str) else data
                
        except Exception as e:
            logger.error("Dynamic tool execution failed: %s", e)
            return f"Error executing tool {self._name}: {str(e)}"
