# ============================================================================
# Ping/Pong Messages
# ============================================================================

from typing import Any, Literal

from .base import BaseMessage
from .types import MessageType


class PingMessage(BaseMessage):
    """Heartbeat ping."""

    type: Literal[MessageType.PING] = MessageType.PING
    meta: dict[str, Any] | None = None


class PongMessage(BaseMessage):
    """Heartbeat pong."""

    type: Literal[MessageType.PONG] = MessageType.PONG
    meta: dict[str, Any] | None = None
