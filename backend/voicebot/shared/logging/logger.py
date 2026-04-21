"""
Structured logging with correlation ID support for distributed tracing.
Every log entry includes session_id, request_id, and service name for
easy correlation across microservices.
"""

from __future__ import annotations

import logging
import sys
import json
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Optional


# Context variables for distributed tracing
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")
session_id_var: ContextVar[str] = ContextVar("session_id", default="")


class JSONFormatter(logging.Formatter):
    """
    Structured JSON log formatter for production environments.
    Outputs one JSON object per log line for easy ingestion by
    ELK / Loki / CloudWatch.
    """

    def __init__(self, service_name: str = "unknown"):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id_var.get(""),
            "session_id": session_id_var.get(""),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Include exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Include any extra fields attached to the record
        if hasattr(record, "extra_data"):
            log_entry["extra"] = record.extra_data

        return json.dumps(log_entry, default=str)


def setup_logger(
    service_name: str,
    level: str = "INFO",
    json_output: bool = True,
) -> logging.Logger:
    """
    Configure and return a logger for a specific microservice.

    Args:
        service_name: Name of the microservice (e.g. 'orchestrator')
        level: Log level string
        json_output: If True, use JSON formatter; else human-readable

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(service_name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Prevent duplicate handlers on repeat calls
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)

    if json_output:
        handler.setFormatter(JSONFormatter(service_name))
    else:
        handler.setFormatter(
            logging.Formatter(
                f"%(asctime)s | {service_name} | %(levelname)-8s | "
                f"%(name)s:%(funcName)s:%(lineno)d | %(message)s"
            )
        )

    logger.addHandler(handler)

    # Add File Handler for debugging
    try:
        from logging.handlers import RotatingFileHandler
        import os
        log_file = "/tmp/voicebot_unified.log"
        file_handler = RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=2)
        if json_output:
            file_handler.setFormatter(JSONFormatter(service_name))
        else:
            file_handler.setFormatter(
                logging.Formatter(
                    f"%(asctime)s | {service_name} | %(levelname)-8s | "
                    f"%(name)s:%(funcName)s:%(lineno)d | %(message)s"
                )
            )
        logger.addHandler(file_handler)
    except Exception:
        pass

    logger.propagate = False  # Avoid double-logging
    return logger


def generate_correlation_id() -> str:
    """Generate a new unique correlation ID for request tracing."""
    return str(uuid.uuid4())


class LoggerAdapter(logging.LoggerAdapter):
    """
    Logger adapter that automatically injects correlation/session context.
    Use this in request handlers to avoid repeating context params.
    """

    def process(
        self, msg: str, kwargs: dict[str, Any]
    ) -> tuple[str, dict[str, Any]]:
        extra = self.extra or {}
        prefix_parts = []
        if cid := correlation_id_var.get(""):
            prefix_parts.append(f"cid={cid[:8]}")
        if sid := session_id_var.get(""):
            prefix_parts.append(f"sid={sid[:8]}")
        prefix = f"[{' '.join(prefix_parts)}] " if prefix_parts else ""
        return f"{prefix}{msg}", kwargs


# Default logger instance for direct imports
logger = setup_logger("voicebot")
