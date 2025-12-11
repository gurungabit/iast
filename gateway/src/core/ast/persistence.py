# ============================================================================
# AST Persistence Helpers
# ============================================================================
"""
DynamoDB persistence helpers for AST execution tracking.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal, Optional

import structlog

from .base import ItemResult

if TYPE_CHECKING:
    from ...db import DynamoDBClient

log = structlog.get_logger()


class ASTPersistence:
    """Handles DynamoDB persistence for AST execution results."""

    def __init__(self, db: Optional["DynamoDBClient"] = None) -> None:
        self._db = db

    def set_db(self, db: "DynamoDBClient") -> None:
        """Set the DynamoDB client."""
        self._db = db

    def save_item_result(
        self,
        execution_id: str,
        item_id: str,
        status: Literal["success", "failed", "skipped"],
        duration_ms: int,
        started_at: datetime,
        completed_at: datetime,
        error: Optional[str] = None,
        item_data: Optional[dict] = None,
    ) -> None:
        """Save an item result to DynamoDB."""
        if not self._db:
            return

        data: dict[str, Any] = {
            "status": status,
            "duration_ms": duration_ms,
            "started_at": started_at.isoformat(),
            "completed_at": completed_at.isoformat(),
            "entity_type": "POLICY_RESULT",
        }
        if error:
            data["error"] = error
        if item_data:
            data["policy_data"] = item_data

        try:
            self._db.put_policy_result(
                execution_id=execution_id,
                policy_number=item_id,
                data=data,
            )
        except Exception as e:  # pragma: no cover - defensive logging
            log.warning("Failed to save item result", item=item_id, error=str(e))

    def create_execution_record(
        self,
        session_id: str,
        execution_id: str,
        ast_name: str,
        username: str,
        user_id: str,
        item_count: int,
        started_at: datetime,
    ) -> None:
        """Create an execution record in DynamoDB."""
        if not self._db:
            return

        try:
            self._db.put_execution(
                session_id=session_id,
                execution_id=execution_id,
                data={
                    "ast_name": ast_name,
                    "user_id": user_id,
                    "host_user": username,
                    "policy_count": item_count,
                    "status": "running",
                    "started_at": started_at.isoformat(),
                    "entity_type": "EXECUTION",
                },
            )
            log.info(
                "Created execution record",
                execution_id=execution_id,
                user_id=user_id,
            )
        except Exception as e:  # pragma: no cover - defensive logging
            log.warning("Failed to create execution record", error=str(e))

    def update_execution_record(
        self,
        session_id: str,
        execution_id: str,
        status: str,
        message: str,
        item_results: list[ItemResult],
        error: Optional[str] = None,
    ) -> None:
        """Update execution record with final status."""
        if not self._db:
            return

        try:
            updates: dict[str, Any] = {
                "status": status,
                "completed_at": datetime.now().isoformat(),
                "message": message,
            }

            if error:
                updates["error"] = error
            else:
                updates["success_count"] = sum(1 for r in item_results if r.status == "success")
                updates["failed_count"] = sum(1 for r in item_results if r.status == "failed")
                updates["skipped_count"] = sum(1 for r in item_results if r.status == "skipped")

            self._db.update_execution(
                session_id=session_id,
                execution_id=execution_id,
                updates=updates,
            )
            log.info(
                "Updated execution record",
                execution_id=execution_id,
                status=status,
            )
        except Exception as e:  # pragma: no cover - defensive logging
            log.warning("Failed to update execution record", error=str(e))
