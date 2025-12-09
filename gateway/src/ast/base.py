# ============================================================================
# AST Base Class
# ============================================================================
"""
Base class for all AST (Automated Streamlined Transaction) scripts.
"""

import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable, Literal, Optional
from uuid import uuid4

import structlog

from ..db import get_dynamodb_client

if TYPE_CHECKING:
    from ..db import DynamoDBClient
    from ..services.tn3270.host import Host

log = structlog.get_logger()


class ASTStatus(Enum):
    """Status of an AST execution."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


@dataclass
class ItemResult:
    """Result of processing a single item (e.g., policy)."""

    item_id: str
    status: Literal["success", "failed", "skipped"]
    started_at: datetime
    completed_at: datetime
    duration_ms: int
    error: str | None = None
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class ASTResult:
    """Result of an AST execution."""

    status: ASTStatus
    message: str = ""
    current_screen: str = ""
    data: dict[str, Any] = field(default_factory=lambda: {})
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None
    screenshots: list[str] = field(default_factory=lambda: [])
    item_results: list[ItemResult] = field(default_factory=lambda: [])

    @property
    def duration(self) -> float | None:
        """Get execution duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    @property
    def is_success(self) -> bool:
        """Check if execution was successful."""
        return self.status == ASTStatus.SUCCESS


# Type for progress callback
ProgressCallback = Callable[
    [
        int,
        int,
        str | None,
        Literal["pending", "running", "success", "failed", "skipped"] | None,
        str | None,
    ],
    None,
]

# Type for item result callback
ItemResultCallback = Callable[
    [
        str,
        Literal["success", "failed", "skipped"],
        int | None,
        str | None,
        dict[str, Any] | None,
    ],
    None,
]

# Type for pause state callback
PauseStateCallback = Callable[[bool, str | None], None]


class AST(ABC):
    """
    Base class for Automated Streamlined Transaction scripts.

    Subclasses must implement the `execute` method with the specific
    automation logic.

    Example:
        class MyAST(AST):
            name = "my_ast"
            description = "Does something cool"

            def execute(self, host: Host, **kwargs) -> ASTResult:
                # Automation logic here
                return ASTResult(status=ASTStatus.SUCCESS)
    """

    name: str = "base"
    description: str = "Base AST class"

    def __init__(self) -> None:
        self._result: ASTResult | None = None
        self._execution_id: str = ""
        self._on_progress: ProgressCallback | None = None
        self._on_item_result: ItemResultCallback | None = None
        self._on_pause_state: PauseStateCallback | None = None

        # Pause/resume synchronization
        self._pause_event = threading.Event()
        self._pause_event.set()  # Not paused by default
        self._is_paused = False
        self._cancelled = False
        self._db: Optional["DynamoDBClient"] = None
        self._session_id: str = ""

    def set_callbacks(
        self,
        on_progress: ProgressCallback | None = None,
        on_item_result: ItemResultCallback | None = None,
        on_pause_state: PauseStateCallback | None = None,
    ) -> None:
        """Set callbacks for progress, item results, and pause state."""
        self._on_progress = on_progress
        self._on_item_result = on_item_result
        self._on_pause_state = on_pause_state

    def pause(self) -> None:
        """Pause the AST execution. Will pause before the next policy."""
        if not self._is_paused:
            self._is_paused = True
            self._pause_event.clear()
            log.info("AST paused", ast=self.name, execution_id=self._execution_id)
            if self._on_pause_state:
                self._on_pause_state(
                    True, "AST paused - you can make manual adjustments"
                )

    def resume(self) -> None:
        """Resume the AST execution."""
        if self._is_paused:
            self._is_paused = False
            self._pause_event.set()
            log.info("AST resumed", ast=self.name, execution_id=self._execution_id)
            if self._on_pause_state:
                self._on_pause_state(False, "AST resumed")

    def cancel(self) -> None:
        """Cancel the AST execution."""
        self._cancelled = True
        self._pause_event.set()  # Unblock if paused
        log.info("AST cancelled", ast=self.name, execution_id=self._execution_id)

    def wait_if_paused(self, timeout: float | None = None) -> bool:
        """
        Block if paused, waiting for resume or cancel.

        Args:
            timeout: Optional timeout in seconds

        Returns:
            True if should continue, False if cancelled
        """
        if self._cancelled:
            return False

        # Wait for the pause event to be set (i.e., not paused)
        self._pause_event.wait(timeout=timeout)

        return not self._cancelled

    @property
    def is_paused(self) -> bool:
        """Check if the AST is currently paused."""
        return self._is_paused

    @property
    def is_cancelled(self) -> bool:
        """Check if the AST has been cancelled."""
        return self._cancelled

    def report_progress(
        self,
        current: int,
        total: int,
        current_item: str | None = None,
        item_status: (
            Literal["pending", "running", "success", "failed", "skipped"] | None
        ) = None,
        message: str | None = None,
    ) -> None:
        """Report progress to the callback."""
        if self._on_progress:
            self._on_progress(current, total, current_item, item_status, message)
        log.debug(
            "AST progress",
            ast=self.name,
            current=current,
            total=total,
            current_item=current_item,
            item_status=item_status,
        )

    def report_item_result(
        self,
        item_id: str,
        status: Literal["success", "failed", "skipped"],
        duration_ms: int | None = None,
        error: str | None = None,
        data: dict[str, Any] | None = None,
    ) -> None:
        """Report an item result to the callback."""
        if self._on_item_result:
            self._on_item_result(item_id, status, duration_ms, error, data)
        log.debug(
            "AST item result",
            ast=self.name,
            item_id=item_id,
            status=status,
            duration_ms=duration_ms,
        )

    def run(
        self,
        host: "Host",
        execution_id: str | None = None,
        **kwargs: Any,
    ) -> ASTResult:
        """
        Run the AST script.

        Args:
            host: The Host automation interface
            execution_id: Optional execution ID (generated if not provided)
            **kwargs: Additional parameters for the AST

        Returns:
            ASTResult with execution status and data
        """
        self._execution_id = execution_id or str(uuid4())
        log.info(
            f"Starting AST: {self.name}",
            ast=self.name,
            execution_id=self._execution_id,
            kwargs=kwargs,
        )

        result = ASTResult(
            status=ASTStatus.RUNNING,
            started_at=datetime.now(),
        )

        try:
            result = self.execute(host, **kwargs)
            result.started_at = result.started_at or datetime.now()

            if result.status == ASTStatus.RUNNING:
                result.status = ASTStatus.SUCCESS

            log.info(
                f"AST completed: {self.name}",
                ast=self.name,
                execution_id=self._execution_id,
                status=result.status.value,
                duration=result.duration,
            )

        except TimeoutError as e:
            result.status = ASTStatus.TIMEOUT
            result.error = str(e)
            result.message = f"Timeout: {e}"
            log.warning(
                f"AST timeout: {self.name}",
                ast=self.name,
                execution_id=self._execution_id,
                error=str(e),
            )

        except Exception as e:
            result.status = ASTStatus.FAILED
            result.error = str(e)
            result.message = f"Error: {e}"
            log.exception(
                f"AST failed: {self.name}",
                ast=self.name,
                execution_id=self._execution_id,
            )

        finally:
            result.completed_at = datetime.now()

        self._result = result
        return result

    @property
    def execution_id(self) -> str:
        """Get the current execution ID."""
        return self._execution_id

    # ------------------------------------------------------------------ #
    # Persistence helpers
    # ------------------------------------------------------------------ #
    def _init_db(self) -> None:
        """Initialize DynamoDB client, required for persistence."""
        self._db = get_dynamodb_client()

    def _save_item_result(
        self,
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
                execution_id=self._execution_id,
                policy_number=item_id,
                data=data,
            )
        except Exception as e:  # pragma: no cover - defensive logging
            log.warning("Failed to save item result", item=item_id, error=str(e))

    def _create_execution_record(
        self,
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
                session_id=self._session_id,
                execution_id=self._execution_id,
                data={
                    "ast_name": self.name,
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
                execution_id=self._execution_id,
                user_id=user_id,
            )
        except Exception as e:  # pragma: no cover - defensive logging
            log.warning("Failed to create execution record", error=str(e))

    def _update_execution_record(
        self,
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
                updates["success_count"] = sum(
                    1 for r in item_results if r.status == "success"
                )
                updates["failed_count"] = sum(
                    1 for r in item_results if r.status == "failed"
                )
                updates["skipped_count"] = sum(
                    1 for r in item_results if r.status == "skipped"
                )

            self._db.update_execution(
                session_id=self._session_id,
                execution_id=self._execution_id,
                updates=updates,
            )
            log.info(
                "Updated execution record",
                execution_id=self._execution_id,
                status=status,
            )
        except Exception as e:  # pragma: no cover - defensive logging
            log.warning("Failed to update execution record", error=str(e))

    # ------------------------------------------------------------------ #
    # Hooks for subclasses
    # ------------------------------------------------------------------ #
    def login(
        self, host: "Host", username: str, password: str
    ) -> tuple[bool, str, list[str]]:
        """
        Default login flow. Subclasses may override if needed.
        Returns (success, error_message, screenshots).
        """
        screenshots: list[str] = []

        log.info("Login: waiting for Logon screen...")
        if not host.wait_for_text("Logon", timeout=120):
            return False, "Timeout waiting for Logon screen", screenshots

        screenshots.append(host.show_screen("Logon Screen"))
        log.info("Login: entering username...")
        host.fill_field_by_label("Logon", username)
        host.enter()

        log.info("Login: waiting for password prompt...")
        if not host.wait_for_text("ENTER CURRENT PASSWORD FOR", timeout=30):
            return False, "Failed to reach password prompt", screenshots

        screenshots.append(host.show_screen("Password Prompt"))
        log.info("Login: entering password...")
        host.fill_field_at_position(1, 1, password)
        host.enter()

        log.info("Login: waiting for Welcome message...")
        if not host.wait_for_text("Welcome to the TSO system", timeout=60):
            return False, "Failed to reach Welcome screen", screenshots

        screenshots.append(host.show_screen("Welcome Screen"))
        host.enter()

        log.info("Login: waiting for fortune cookie...")
        if not host.wait_for_text("fortune cookie", timeout=30):
            return False, "Failed to reach fortune cookie screen", screenshots

        screenshots.append(host.show_screen("Fortune Cookie"))
        host.enter()

        log.info("Login: waiting for TSO Applications menu...")
        if not host.wait_for_text("TSO Applications", timeout=30):
            return False, "Failed to reach TSO Applications menu", screenshots

        screenshots.append(host.show_screen("TSO Applications"))

        return True, "", screenshots

    @abstractmethod
    def logoff(self, host: "Host") -> tuple[bool, str, list[str]]:
        """Logoff flow implemented by subclasses."""

    def validate_item(self, item_id: str) -> bool:
        """Override to validate an item identifier."""
        return True

    @abstractmethod
    def process_single_item(
        self,
        host: "Host",
        item_id: str,
        index: int,
        total: int,
    ) -> tuple[bool, str, dict[str, Any]]:
        """Per-item processing implemented by subclasses."""

    # ------------------------------------------------------------------ #
    # Execution helpers
    # ------------------------------------------------------------------ #
    def _record_item_result(
        self,
        item_id: str,
        status: Literal["success", "failed", "skipped"],
        item_start: datetime,
        item_results: list[ItemResult],
        current: int,
        total: int,
        error: Optional[str] = None,
        item_data: Optional[dict] = None,
    ) -> int:
        """Record an item result, report, and persist."""
        item_end = datetime.now()
        duration_ms = int((item_end - item_start).total_seconds() * 1000)

        item_result = ItemResult(
            item_id=item_id,
            status=status,
            started_at=item_start,
            completed_at=item_end,
            duration_ms=duration_ms,
            error=error,
            data=item_data or {},
        )
        item_results.append(item_result)

        self.report_item_result(
            item_id=item_id,
            status=status,
            duration_ms=duration_ms,
            error=error,
            data=item_data,
        )

        self._save_item_result(
            item_id=item_id,
            status=status,
            duration_ms=duration_ms,
            started_at=item_start,
            completed_at=item_end,
            error=error,
            item_data=item_data,
        )

        message = f"Item {current}/{total}: "
        if status == "success":
            message += "Completed"
        elif status == "failed":
            message += f"Failed - {error}"
        else:
            message += "Skipped"

        self.report_progress(
            current=current,
            total=total,
            current_item=item_id,
            item_status=status,
            message=message,
        )

        return duration_ms

    # ------------------------------------------------------------------ #
    # Execute
    # ------------------------------------------------------------------ #
    def execute(self, host: "Host", **kwargs: Any) -> ASTResult:
        """
        Default execute implementation: login, process each item, logoff.
        Subclasses may override, but typically only implement process_single_item/logoff.
        """
        username = kwargs.get("username")
        password = kwargs.get("password")
        raw_items: list[str] = kwargs.get("policyNumbers") or kwargs.get("items") or []
        app_user_id: str = kwargs.get("userId", "anonymous")
        self._session_id = kwargs.get("sessionId", self._execution_id)

        if not username or not password:
            return ASTResult(
                status=ASTStatus.FAILED,
                started_at=datetime.now(),
                completed_at=datetime.now(),
                message="Missing required parameters: username and password are required",
                error="ValidationError: username and password must be provided",
            )

        result = ASTResult(
            status=ASTStatus.RUNNING,
            started_at=datetime.now(),
            data={"username": username, "policyCount": len(raw_items)},
        )

        all_screenshots: list[str] = []
        item_results: list[ItemResult] = []

        self._init_db()
        self._create_execution_record(
            username,
            app_user_id,
            len(raw_items),
            result.started_at or datetime.now(),
        )

        try:
            if not raw_items:
                log.info("No items to process, doing single login/logoff cycle")
                success, error, screenshots = self.login(host, username, password)
                all_screenshots.extend(screenshots)
                if not success:
                    raise Exception(error)

                success, error, screenshots = self.logoff(host)
                all_screenshots.extend(screenshots)
                if not success:
                    raise Exception(error)

                result.status = ASTStatus.SUCCESS
                result.message = f"Successfully logged in and out as {username}"
            else:
                total = len(raw_items)
                log.info(f"Processing {total} items (full cycle each)...")

                for idx, item_id in enumerate(raw_items):
                    if not self.wait_if_paused():
                        log.info("AST cancelled by user")
                        result.status = ASTStatus.CANCELLED
                        result.message = "Cancelled by user"
                        break

                    item_start = datetime.now()
                    self.report_progress(
                        current=idx + 1,
                        total=total,
                        current_item=item_id,
                        item_status="running",
                        message=f"Item {idx + 1}/{total}: Logging in",
                    )

                    if not self.validate_item(item_id):
                        self._record_item_result(
                            item_id=item_id,
                            status="skipped",
                            item_start=item_start,
                            item_results=item_results,
                            current=idx + 1,
                            total=total,
                            error="Invalid item",
                        )
                        continue

                    try:
                        success, error, screenshots = self.login(
                            host, username, password
                        )
                        all_screenshots.extend(screenshots)
                        if not success:
                            raise Exception(f"Login failed: {error}")

                        self.report_progress(
                            current=idx + 1,
                            total=total,
                            current_item=item_id,
                            item_status="running",
                            message=f"Item {idx + 1}/{total}: Processing",
                        )
                        success, error, item_data = self.process_single_item(
                            host, item_id, idx + 1, total
                        )
                        if not success:
                            raise Exception(f"Process failed: {error}")

                        self.report_progress(
                            current=idx + 1,
                            total=total,
                            current_item=item_id,
                            item_status="running",
                            message=f"Item {idx + 1}/{total}: Logging off",
                        )
                        success, error, screenshots = self.logoff(host)
                        all_screenshots.extend(screenshots)
                        if not success:
                            raise Exception(f"Logoff failed: {error}")

                        duration_ms = self._record_item_result(
                            item_id=item_id,
                            status="success",
                            item_start=item_start,
                            item_results=item_results,
                            current=idx + 1,
                            total=total,
                            item_data=item_data,
                        )
                        log.info(
                            "Item completed successfully",
                            item=item_id,
                            duration_ms=duration_ms,
                        )

                    except Exception as e:
                        error_screen = None
                        try:
                            error_screen = host.get_formatted_screen(
                                show_row_numbers=False
                            )
                        except Exception:
                            pass

                        duration_ms = self._record_item_result(
                            item_id=item_id,
                            status="failed",
                            item_start=item_start,
                            item_results=item_results,
                            current=idx + 1,
                            total=total,
                            error=str(e),
                            item_data=(
                                {"errorScreen": error_screen} if error_screen else None
                            ),
                        )
                        log.warning(
                            "Item failed",
                            item=item_id,
                            error=str(e),
                            duration_ms=duration_ms,
                        )

                        try:
                            log.info("Attempting recovery logoff...")
                            self.logoff(host)
                        except Exception:
                            log.warning("Recovery logoff failed, continuing...")

                success_count = sum(1 for r in item_results if r.status == "success")
                failed_count = sum(1 for r in item_results if r.status == "failed")
                skipped_count = sum(1 for r in item_results if r.status == "skipped")

                if not self.is_cancelled:
                    result.status = ASTStatus.SUCCESS
                    result.message = (
                        f"Processed {total} items "
                        f"({success_count} success, {failed_count} failed, {skipped_count} skipped)"
                    )
                result.item_results = item_results
                result.data.update(
                    {
                        "successCount": success_count,
                        "failedCount": failed_count,
                        "skippedCount": skipped_count,
                    }
                )

            result.screenshots = all_screenshots

            if self.is_cancelled:
                self._update_execution_record(
                    "cancelled", result.message or "Cancelled by user", item_results
                )
                log.info("AST cancelled", username=username)
            else:
                self._update_execution_record(
                    "success", result.message or "", item_results
                )
                log.info("AST completed successfully", username=username)

        except Exception as e:
            result.status = ASTStatus.FAILED
            result.error = str(e)
            result.message = f"Error during execution: {e}"
            try:
                all_screenshots.append(host.show_screen("Error State"))
            except Exception:
                pass
            result.screenshots = all_screenshots
            result.item_results = item_results

            self._update_execution_record(
                "failed", result.message, item_results, error=str(e)
            )
            log.exception("AST failed", username=username)

        return result
