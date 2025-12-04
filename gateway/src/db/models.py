# ============================================================================
# Database Models - Single Table Design
# ============================================================================
"""
Pydantic models for DynamoDB single table design.

Table: terminal
===============
PK                    SK                        Entity
──────────────────────────────────────────────────────────
USER#<userId>         PROFILE                   User profile
USER#<userId>         SESSION#<sessionId>       User's session
SESSION#<sessionId>   EXECUTION#<execId>        Session's AST execution
EXECUTION#<execId>    POLICY#<policyNum>        Execution's policy result

GSI1: GSI1PK (email) -> SK for user lookup by email
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# Key prefixes (must match client.py)
class KeyPrefix:
    USER = "USER#"
    SESSION = "SESSION#"
    EXECUTION = "EXECUTION#"
    POLICY = "POLICY#"
    PROFILE = "PROFILE"


class ExecutionStatus(str, Enum):
    """Status of an AST execution."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class PolicyStatus(str, Enum):
    """Status of a policy processing result."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


# ============================================================================
# User Model
# ============================================================================


class User(BaseModel):
    """User account."""

    user_id: str
    email: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime | None = None

    def to_dynamodb(self) -> dict[str, Any]:
        """Convert to DynamoDB item format (single table)."""
        return {
            "PK": f"{KeyPrefix.USER}{self.user_id}",
            "SK": KeyPrefix.PROFILE,
            "GSI1PK": self.email,  # For email lookup
            "user_id": self.user_id,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dynamodb(cls, item: dict[str, Any]) -> "User":
        """Create from DynamoDB item."""
        return cls(
            user_id=item["user_id"],
            email=item["email"],
            created_at=datetime.fromisoformat(item["created_at"]),
            updated_at=(
                datetime.fromisoformat(item["updated_at"])
                if item.get("updated_at")
                else None
            ),
        )


# ============================================================================
# Session Model
# ============================================================================


class Session(BaseModel):
    """User terminal session."""

    session_id: str
    user_id: str
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.now)
    last_activity: datetime = Field(default_factory=datetime.now)

    def to_dynamodb(self) -> dict[str, Any]:
        """Convert to DynamoDB item format (single table)."""
        return {
            "PK": f"{KeyPrefix.USER}{self.user_id}",
            "SK": f"{KeyPrefix.SESSION}{self.session_id}",
            "session_id": self.session_id,
            "user_id": self.user_id,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
        }

    @classmethod
    def from_dynamodb(cls, item: dict[str, Any]) -> "Session":
        """Create from DynamoDB item."""
        return cls(
            session_id=item["session_id"],
            user_id=item["user_id"],
            status=item.get("status", "active"),
            created_at=datetime.fromisoformat(item["created_at"]),
            last_activity=datetime.fromisoformat(item["last_activity"]),
        )


# ============================================================================
# AST Execution Model
# ============================================================================


class ASTExecution(BaseModel):
    """AST execution instance."""

    execution_id: str
    session_id: str
    ast_name: str
    status: ExecutionStatus = ExecutionStatus.PENDING
    progress: int = 0  # 0-100
    total_items: int = 0
    completed_items: int = 0
    params: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | None = None
    error: str | None = None
    started_at: datetime = Field(default_factory=datetime.now)
    completed_at: datetime | None = None

    def to_dynamodb(self) -> dict[str, Any]:
        """Convert to DynamoDB item format (single table)."""
        return {
            "PK": f"{KeyPrefix.SESSION}{self.session_id}",
            "SK": f"{KeyPrefix.EXECUTION}{self.execution_id}",
            "execution_id": self.execution_id,
            "session_id": self.session_id,
            "ast_name": self.ast_name,
            "status": self.status.value,
            "progress": self.progress,
            "total_items": self.total_items,
            "completed_items": self.completed_items,
            "params": self.params,
            "result": self.result,
            "error": self.error,
            "started_at": self.started_at.isoformat(),
            "completed_at": (
                self.completed_at.isoformat() if self.completed_at else None
            ),
        }

    @classmethod
    def from_dynamodb(cls, item: dict[str, Any]) -> "ASTExecution":
        """Create from DynamoDB item."""
        return cls(
            execution_id=item["execution_id"],
            session_id=item["session_id"],
            ast_name=item["ast_name"],
            status=ExecutionStatus(item["status"]),
            progress=int(item.get("progress", 0)),
            total_items=int(item.get("total_items", 0)),
            completed_items=int(item.get("completed_items", 0)),
            params=item.get("params", {}),
            result=item.get("result"),
            error=item.get("error"),
            started_at=datetime.fromisoformat(item["started_at"]),
            completed_at=(
                datetime.fromisoformat(item["completed_at"])
                if item.get("completed_at")
                else None
            ),
        )


# ============================================================================
# Policy Result Model
# ============================================================================


class PolicyResult(BaseModel):
    """Result of processing a single policy."""

    execution_id: str
    policy_number: str  # 9 char alphanumeric
    status: PolicyStatus = PolicyStatus.PENDING
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None
    error: str | None = None
    screenshots: list[str] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)

    def to_dynamodb(self) -> dict[str, Any]:
        """Convert to DynamoDB item format (single table)."""
        return {
            "PK": f"{KeyPrefix.EXECUTION}{self.execution_id}",
            "SK": f"{KeyPrefix.POLICY}{self.policy_number}",
            "execution_id": self.execution_id,
            "policy_number": self.policy_number,
            "status": self.status.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": (
                self.completed_at.isoformat() if self.completed_at else None
            ),
            "duration_ms": self.duration_ms,
            "error": self.error,
            "screenshots": self.screenshots,
            "data": self.data,
        }

    @classmethod
    def from_dynamodb(cls, item: dict[str, Any]) -> "PolicyResult":
        """Create from DynamoDB item."""
        return cls(
            execution_id=item["execution_id"],
            policy_number=item["policy_number"],
            status=PolicyStatus(item["status"]),
            started_at=(
                datetime.fromisoformat(item["started_at"])
                if item.get("started_at")
                else None
            ),
            completed_at=(
                datetime.fromisoformat(item["completed_at"])
                if item.get("completed_at")
                else None
            ),
            duration_ms=item.get("duration_ms"),
            error=item.get("error"),
            screenshots=item.get("screenshots", []),
            data=item.get("data", {}),
        )
