"""
Async Kafka event producer for publishing events across services.
Uses aiokafka for non-blocking event emission.
Falls back to logging if Kafka is unavailable (graceful degradation).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from voicebot.shared.models.events import VoiceEvent

logger = logging.getLogger(__name__)


class KafkaEventProducer:
    """
    Async wrapper around aiokafka producer.
    Handles connection lifecycle and provides a simple publish API.
    """

    def __init__(self, bootstrap_servers: str, client_id: str = "voicebot"):
        self._bootstrap_servers = bootstrap_servers
        self._client_id = client_id
        self._producer = None
        self._connected = False

    async def connect(self) -> None:
        """Initialize the Kafka producer connection."""
        try:
            from aiokafka import AIOKafkaProducer

            self._producer = AIOKafkaProducer(
                bootstrap_servers=self._bootstrap_servers,
                client_id=self._client_id,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                # Optimize for low latency
                linger_ms=5,
                acks=1,  # Leader ack only for speed
            )
            await self._producer.start()
            self._connected = True
            logger.info(
                "Kafka producer connected to %s", self._bootstrap_servers
            )
        except Exception as e:
            logger.warning(
                "Kafka connection failed (graceful degradation): %s", e
            )
            self._connected = False

    async def publish(self, topic: str, event: VoiceEvent) -> None:
        """
        Publish an event to a Kafka topic.
        Falls back to logging if Kafka is unavailable.
        """
        event_data = event.model_dump()

        if self._connected and self._producer:
            try:
                await self._producer.send_and_wait(topic, event_data)
                logger.debug(
                    "Published event %s to topic %s",
                    event.event_type,
                    topic,
                )
            except Exception as e:
                logger.error("Failed to publish to Kafka: %s", e)
                # Fallback: log the event
                logger.info("Event (fallback): %s", event_data)
        else:
            # Graceful degradation — log instead of publish
            logger.debug(
                "Kafka unavailable. Event logged: %s %s",
                event.event_type,
                event.session_id,
            )

    async def disconnect(self) -> None:
        """Cleanly shut down the producer."""
        if self._producer and self._connected:
            await self._producer.stop()
            self._connected = False
            logger.info("Kafka producer disconnected")
