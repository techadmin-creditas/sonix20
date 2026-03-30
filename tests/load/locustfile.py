"""
Load Testing with Locust — Voice Bot Platform.

Simulates concurrent WebSocket connections and measures:
  - Connection success rate
  - Session creation latency
  - WebSocket round-trip time
  - Throughput under load

Usage:
    locust -f tests/load/locustfile.py --host http://localhost:8000
    # Then open http://localhost:8089 for Locust web UI
"""

from locust import HttpUser, task, between, events
import json
import time


class VoiceBotUser(HttpUser):
    """Simulates a voice bot client."""

    wait_time = between(1, 3)
    session_id = None

    def on_start(self):
        """Create a session when the user starts."""
        response = self.client.post("/api/v1/sessions")
        if response.status_code == 200:
            data = response.json()
            self.session_id = data.get("session_id")

    @task(3)
    def create_session(self):
        """Test session creation endpoint."""
        start = time.time()
        response = self.client.post("/api/v1/sessions")
        latency = (time.time() - start) * 1000

        if response.status_code == 200:
            events.request.fire(
                request_type="POST",
                name="/api/v1/sessions",
                response_time=latency,
                response_length=len(response.content),
                exception=None,
                context={},
            )

    @task(2)
    def get_session(self):
        """Test session retrieval."""
        if self.session_id:
            self.client.get(f"/api/v1/sessions/{self.session_id}")

    @task(1)
    def health_check(self):
        """Test health endpoint (baseline)."""
        self.client.get("/health")

    @task(1)
    def guardrail_filter(self):
        """Test guardrail filtering."""
        self.client.post(
            "/filter",
            json={
                "text": "Hello, my card number is 4111111111111111",
                "direction": "input",
                "session_id": self.session_id or "test",
            },
        )


class VoiceBotWebSocketUser(HttpUser):
    """
    WebSocket load test user.
    NOTE: Locust's native WebSocket support is limited.
    For production load testing, use k6 or a custom WebSocket load tester.
    """

    wait_time = between(2, 5)

    @task
    def websocket_session(self):
        """Simulate a WebSocket session lifecycle."""
        # Create session
        response = self.client.post("/api/v1/sessions")
        if response.status_code == 200:
            session_id = response.json().get("session_id")
            # In a real test, you would connect via WebSocket
            # and send audio frames. Locust is REST-focused,
            # so for true WS testing, use k6.

    def on_stop(self):
        """Clean up when the user stops."""
        if hasattr(self, "session_id") and self.session_id:
            self.client.delete(f"/api/v1/sessions/{self.session_id}")
