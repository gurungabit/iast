# ============================================================================
# Resize Message
# ============================================================================

from typing import Literal

from pydantic import BaseModel

from .base import BaseMessage
from .types import MessageType


class ResizeMeta(BaseModel):
    """Resize metadata."""

    cols: int
    rows: int


class ResizeMessage(BaseMessage):
    """Terminal resize event."""

    type: Literal[MessageType.RESIZE] = MessageType.RESIZE
    meta: ResizeMeta
