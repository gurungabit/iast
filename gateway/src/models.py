# ============================================================================
# Message Models (matching @terminal/shared)
# ============================================================================

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """Message types matching the TypeScript shared package."""

    DATA = "data"
    RESIZE = "resize"
    PING = "ping"
    PONG = "pong"
    ERROR = "error"
    SESSION_CREATE = "session.create"
    SESSION_DESTROY = "session.destroy"
    SESSION_CREATED = "session.created"
    SESSION_DESTROYED = "session.destroyed"


# ----------------------------------------------------------------------------
# Base Message
# ----------------------------------------------------------------------------


class BaseMessage(BaseModel):
    """Base message with common fields."""

    session_id: str = Field(alias="sessionId")
    timestamp: int = Field(
        default_factory=lambda: int(datetime.now().timestamp() * 1000)
    )
    encoding: str = "utf-8"
    seq: int = 0
    payload: str = ""

    model_config = {"populate_by_name": True}


# ----------------------------------------------------------------------------
# Data Message
# ----------------------------------------------------------------------------


class DataMessage(BaseMessage):
    """Terminal data (input/output)."""

    type: Literal[MessageType.DATA] = MessageType.DATA
    meta: dict[str, Any] | None = None


# ----------------------------------------------------------------------------
# Resize Message - meta contains cols/rows
# ----------------------------------------------------------------------------


class ResizeMeta(BaseModel):
    """Resize metadata."""

    cols: int
    rows: int


class ResizeMessage(BaseMessage):
    """Terminal resize event."""

    type: Literal[MessageType.RESIZE] = MessageType.RESIZE
    meta: ResizeMeta


# ----------------------------------------------------------------------------
# Ping/Pong Messages
# ----------------------------------------------------------------------------


class PingMessage(BaseMessage):
    """Heartbeat ping."""

    type: Literal[MessageType.PING] = MessageType.PING
    meta: dict[str, Any] | None = None


class PongMessage(BaseMessage):
    """Heartbeat pong."""

    type: Literal[MessageType.PONG] = MessageType.PONG
    meta: dict[str, Any] | None = None


# ----------------------------------------------------------------------------
# Error Message - meta contains code/details
# ----------------------------------------------------------------------------


class ErrorMeta(BaseModel):
    """Error metadata."""

    code: str
    details: dict[str, Any] | None = None


class ErrorMessage(BaseMessage):
    """Error response."""

    type: Literal[MessageType.ERROR] = MessageType.ERROR
    meta: ErrorMeta


# ----------------------------------------------------------------------------
# Session Messages
# ----------------------------------------------------------------------------


class SessionCreateMeta(BaseModel):
    """Session create metadata."""

    shell: str | None = None
    cols: int | None = None
    rows: int | None = None
    env: dict[str, str] | None = None
    cwd: str | None = None


class SessionCreateMessage(BaseMessage):
    """Request to create a PTY session."""

    type: Literal[MessageType.SESSION_CREATE] = MessageType.SESSION_CREATE
    meta: SessionCreateMeta | None = None


class SessionDestroyMessage(BaseMessage):
    """Request to destroy a PTY session."""

    type: Literal[MessageType.SESSION_DESTROY] = MessageType.SESSION_DESTROY
    meta: dict[str, Any] | None = None


class SessionCreatedMeta(BaseModel):
    """Session created metadata."""

    shell: str
    pid: int | None = None


class SessionCreatedMessage(BaseMessage):
    """PTY session created confirmation."""

    type: Literal[MessageType.SESSION_CREATED] = MessageType.SESSION_CREATED
    meta: SessionCreatedMeta


class SessionDestroyedMeta(BaseModel):
    """Session destroyed metadata."""

    exit_code: int | None = Field(default=None, alias="exitCode")
    signal: str | None = None

    model_config = {"populate_by_name": True}


class SessionDestroyedMessage(BaseMessage):
    """PTY session destroyed confirmation."""

    type: Literal[MessageType.SESSION_DESTROYED] = MessageType.SESSION_DESTROYED
    meta: SessionDestroyedMeta | None = None


# ----------------------------------------------------------------------------
# Message Union & Helpers
# ----------------------------------------------------------------------------

MessageEnvelope = (
    DataMessage
    | ResizeMessage
    | PingMessage
    | PongMessage
    | ErrorMessage
    | SessionCreateMessage
    | SessionDestroyMessage
    | SessionCreatedMessage
    | SessionDestroyedMessage
)


def parse_message(raw: str | bytes) -> MessageEnvelope:
    """Parse a raw JSON message into the appropriate message type."""
    import json

    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")

    data = json.loads(raw)
    msg_type = data.get("type")

    match msg_type:
        case MessageType.DATA:
            return DataMessage.model_validate(data)
        case MessageType.RESIZE:
            return ResizeMessage.model_validate(data)
        case MessageType.PING:
            return PingMessage.model_validate(data)
        case MessageType.PONG:
            return PongMessage.model_validate(data)
        case MessageType.ERROR:
            return ErrorMessage.model_validate(data)
        case MessageType.SESSION_CREATE:
            return SessionCreateMessage.model_validate(data)
        case MessageType.SESSION_DESTROY:
            return SessionDestroyMessage.model_validate(data)
        case MessageType.SESSION_CREATED:
            return SessionCreatedMessage.model_validate(data)
        case MessageType.SESSION_DESTROYED:
            return SessionDestroyedMessage.model_validate(data)
        case _:
            raise ValueError(f"Unknown message type: {msg_type}")


def serialize_message(msg: MessageEnvelope) -> str:
    """Serialize a message to JSON."""
    return msg.model_dump_json(by_alias=True)


def create_data_message(session_id: str, data: str) -> DataMessage:
    """Create a data message."""
    return DataMessage(session_id=session_id, payload=data)


def create_error_message(session_id: str, code: str, message: str) -> ErrorMessage:
    """Create an error message."""
    return ErrorMessage(
        session_id=session_id,
        payload=message,
        meta=ErrorMeta(code=code),
    )


def create_session_created_message(
    session_id: str, shell: str, pid: int
) -> SessionCreatedMessage:
    """Create a session created message."""
    return SessionCreatedMessage(
        session_id=session_id,
        meta=SessionCreatedMeta(shell=shell, pid=pid),
    )


def create_session_destroyed_message(
    session_id: str, reason: str
) -> SessionDestroyedMessage:
    """Create a session destroyed message."""
    return SessionDestroyedMessage(
        session_id=session_id,
        payload=reason,
        meta=SessionDestroyedMeta(),
    )
