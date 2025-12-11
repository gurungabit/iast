# ============================================================================
# Base Message
# ============================================================================

from datetime import datetime

from pydantic import BaseModel, Field


class BaseMessage(BaseModel):
    """Base message with common fields."""

    session_id: str = Field(alias="sessionId")
    timestamp: int = Field(default_factory=lambda: int(datetime.now().timestamp() * 1000))
    encoding: str = "utf-8"
    seq: int = 0
    payload: str = ""

    model_config = {"populate_by_name": True}
