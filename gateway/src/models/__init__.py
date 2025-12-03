# ============================================================================
# Models Module - Message Types (matching @terminal/shared)
# ============================================================================

from .base import BaseMessage
from .data import DataMessage, create_data_message
from .error import ErrorMessage, ErrorMeta, create_error_message
from .ping import PingMessage, PongMessage
from .resize import ResizeMeta, ResizeMessage
from .session import (
    SessionCreatedMessage,
    SessionCreatedMeta,
    SessionCreateMessage,
    SessionCreateMeta,
    SessionDestroyedMessage,
    SessionDestroyedMeta,
    SessionDestroyMessage,
    create_session_created_message,
    create_session_destroyed_message,
)
from .types import MessageEnvelope, MessageType
from .parser import parse_message, serialize_message

__all__ = [
    # Types
    "MessageType",
    "MessageEnvelope",
    # Base
    "BaseMessage",
    # Data
    "DataMessage",
    "create_data_message",
    # Resize
    "ResizeMessage",
    "ResizeMeta",
    # Ping/Pong
    "PingMessage",
    "PongMessage",
    # Error
    "ErrorMessage",
    "ErrorMeta",
    "create_error_message",
    # Session
    "SessionCreateMessage",
    "SessionCreateMeta",
    "SessionDestroyMessage",
    "SessionCreatedMessage",
    "SessionCreatedMeta",
    "SessionDestroyedMessage",
    "SessionDestroyedMeta",
    "create_session_created_message",
    "create_session_destroyed_message",
    # Parser
    "parse_message",
    "serialize_message",
]
