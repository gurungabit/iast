# ============================================================================
# AST (Automated Streamlined Transaction) Message Models
# ============================================================================

from typing import Any, Literal

from pydantic import BaseModel, Field

from .base import BaseMessage
from .types import MessageType


# ============================================================================
# AST Run
# ============================================================================


class ASTRunMeta(BaseModel):
    """AST run metadata."""

    ast_name: str = Field(alias="astName")
    """Name of the AST to run."""

    params: dict[str, Any] | None = None
    """Optional parameters for the AST."""

    class Config:
        populate_by_name = True


class ASTRunMessage(BaseMessage):
    """Request to run an AST."""

    type: Literal["ast.run"] = "ast.run"
    meta: ASTRunMeta


# ============================================================================
# AST Status
# ============================================================================


class ASTStatusMeta(BaseModel):
    """AST status metadata."""

    ast_name: str = Field(alias="astName")
    """Name of the AST."""

    status: Literal["pending", "running", "success", "failed", "timeout"]
    """Current status of the AST."""

    message: str | None = None
    """Optional status message."""

    error: str | None = None
    """Error details if failed."""

    duration: float | None = None
    """Execution duration in seconds."""

    data: dict[str, Any] | None = None
    """Additional data from the AST."""

    class Config:
        populate_by_name = True


class ASTStatusMessage(BaseMessage):
    """AST execution status update."""

    type: Literal["ast.status"] = "ast.status"
    meta: ASTStatusMeta


# ============================================================================
# Factory Functions
# ============================================================================


def create_ast_status_message(
    session_id: str,
    ast_name: str,
    status: Literal["pending", "running", "success", "failed", "timeout"],
    message: str | None = None,
    error: str | None = None,
    duration: float | None = None,
    data: dict[str, Any] | None = None,
) -> ASTStatusMessage:
    """Create an AST status message."""
    return ASTStatusMessage(
        session_id=session_id,
        payload=message or "",
        meta=ASTStatusMeta(
            ast_name=ast_name,
            status=status,
            message=message,
            error=error,
            duration=duration,
            data=data,
        ),
    )
