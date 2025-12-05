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
from typing import Any, Callable, Literal, TYPE_CHECKING
from uuid import uuid4

import structlog

if TYPE_CHECKING:
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

    @abstractmethod
    def execute(self, host: "Host", **kwargs: Any) -> ASTResult:
        """
        Execute the AST automation logic.

        This method must be implemented by subclasses.

        Args:
            host: The Host automation interface
            **kwargs: Additional parameters

        Returns:
            ASTResult with execution status and data
        """
        raise NotImplementedError
