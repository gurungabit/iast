# ============================================================================
# AST Base Class and Types
# ============================================================================
"""
Base class and types for all AST (Automated Streamlined Transaction) scripts.
"""

import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable, Literal
from uuid import uuid4

import structlog

if TYPE_CHECKING:
    from ...services.tn3270.host import Host

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

    Subclasses must implement:
    - process_single_item: Per-item processing logic
    - logoff: How to sign off from the session

    Optional overrides:
    - authenticate: Custom authentication logic
    - validate_item: Item validation before processing
    - prepare_items: Fetch/prepare items from external sources
    - get_item_id: Extract ID from complex item types

    Example:
        class MyAST(AST):
            name = "my_ast"
            description = "Does something cool"

            def process_single_item(self, host, item, index, total):
                # Process the item
                return True, "", {"result": "data"}

            def logoff(self, host, target_screen_keywords=None):
                # Sign off logic
                return True, "", []
    """

    name: str = "base"
    description: str = "Base AST class"

    # Authentication configuration - subclasses should override these
    auth_expected_keywords: list[str] = []  # Keywords to verify successful login
    auth_application: str = ""  # Application name for login
    auth_group: str = ""  # Group name for login
    # Whether this AST supports parallel execution
    # Subclasses should set this to True if they can run in parallel
    supports_parallel: bool = False

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
        self._session_id: str = ""

        # Thread-local storage for screenshots (safe for parallel execution)
        self._thread_local = threading.local()

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

    # ------------------------------------------------------------------ #
    # Screenshot capture for item processing
    # ------------------------------------------------------------------ #
    def capture_screenshot(self, host: "Host", label: str = "") -> None:
        """Capture a screenshot during item processing.

        Call this from process_single_item() to capture screens at key points.
        Screenshots are automatically collected and saved with each item result.
        Thread-safe for parallel execution.

        Args:
            host: Host automation interface
            label: Optional label describing this screenshot (e.g., "After Submit")
        """
        try:
            screen = host.get_formatted_screen(show_row_numbers=False)
            if not hasattr(self._thread_local, "screenshots"):
                self._thread_local.screenshots = []
            self._thread_local.screenshots.append({"label": label, "screen": screen})
        except Exception as e:
            log.warning("Failed to capture screenshot", label=label, error=str(e))

    def clear_screenshots(self) -> None:
        """Clear screenshots for a new item. Called by executor before each item."""
        self._thread_local.screenshots = []

    def get_screenshots(self) -> list[dict[str, str]]:
        """Get screenshots captured during current item processing."""
        if not hasattr(self._thread_local, "screenshots"):
            return []
        return self._thread_local.screenshots.copy()

    # ------------------------------------------------------------------ #
    # Pause/Resume/Cancel
    # ------------------------------------------------------------------ #
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

    @property
    def execution_id(self) -> str:
        """Get the current execution ID."""
        return self._execution_id

    # ------------------------------------------------------------------ #
    # Progress Reporting
    # ------------------------------------------------------------------ #
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

    # ------------------------------------------------------------------ #
    # Authentication (common implementation)
    # ------------------------------------------------------------------ #
    def authenticate(
        self,
        host: "Host",
        user: str,
        password: str,
        expected_keywords_after_login: list[str],
        application: str = "",
        group: str = "",
    ) -> tuple[bool, str]:
        """Authenticate to the mainframe system.

        Common authentication logic that can be used by all AST subclasses.
        Override this method if you need custom authentication logic.

        Args:
            host: Host automation interface
            user: Username
            password: Password
            expected_keywords_after_login: List of text strings to expect after successful login
            application: Application name (optional)
            group: Group name (optional)

        Returns:
            Tuple of (success, error_message)
        """
        # Check if already at expected post-login screen (already authenticated)
        if expected_keywords_after_login:
            for keyword in expected_keywords_after_login:
                if host.screen_contains(keyword):
                    log.info("Already at expected screen", keyword=keyword)
                    return True, ""

        # Perform authentication
        log.info("Starting authentication", user=user)

        try:
            # if not host.wait_for_text("SIGNON", timeout=100):
            #     error_msg = "Failed to find SIGNON screen"
            #     log.error(error_msg)
            #     return False, error_msg
            # Fill userid field
            if not host.fill_field_by_label("Userid", user, case_sensitive=False):
                error_msg = "Failed to find Userid field"
                log.error(error_msg)
                return False, error_msg

            # Fill password field
            if not host.fill_field_by_label("Password", password, case_sensitive=False):
                error_msg = "Failed to find Password field"
                log.error(error_msg)
                return False, error_msg

            # Fill application field if provided
            if application and not host.fill_field_by_label(
                "Application", application, case_sensitive=False
            ):
                log.warning("Failed to find Application field", application=application)

            # Fill group field if provided
            if group and not host.fill_field_by_label(
                "Group", group, case_sensitive=False
            ):
                log.warning("Failed to find Group field", group=group)

            # Submit login
            host.enter()

            # Verify we reached expected screen
            if expected_keywords_after_login:
                for keyword in expected_keywords_after_login:
                    if host.wait_for_text(keyword):
                        log.info("Authentication successful", keyword=keyword)
                        return True, ""

                error_msg = f"Authentication may have failed - expected keywords not found: {expected_keywords_after_login}"
                log.error(error_msg)
                return False, error_msg

            log.info("Authentication completed")
            return True, ""

        except Exception as e:
            error_msg = f"Exception during authentication: {str(e)}"
            log.error("Exception during authentication", error=str(e), exc_info=True)
            return False, error_msg

    # ------------------------------------------------------------------ #
    # Abstract methods (must be implemented by subclasses)
    # ------------------------------------------------------------------ #
    @abstractmethod
    def logoff(
        self, host: "Host", target_screen_keywords: list[str] | None = None
    ) -> tuple[bool, str]:
        """Logoff flow implemented by subclasses.

        Args:
            host: Host automation interface
            target_screen_keywords: Optional list of keywords to verify sign-off reached target screen

        Returns:
            Tuple of (success, error_message)
        """
        raise NotImplementedError("Subclasses must implement logoff method")

    @abstractmethod
    def process_single_item(
        self,
        host: "Host",
        item: Any,
        index: int,
        total: int,
    ) -> tuple[bool, str, dict[str, Any]]:
        """Per-item processing implemented by subclasses.

        Args:
            host: Host automation interface
            item: The item to process (can be str, dict, or any type from prepare_items)
            index: Current item index (1-based)
            total: Total number of items

        Returns:
            Tuple of (success, error_message, item_data)
        """
        raise NotImplementedError(
            "Subclasses must implement process_single_item method"
        )

    # ------------------------------------------------------------------ #
    # Optional hooks for subclasses
    # ------------------------------------------------------------------ #
    def validate_item(self, item: Any) -> bool:
        """Override to validate an item.

        Args:
            item: The item to validate (can be str, dict, or any type)

        Returns:
            True if valid, False to skip this item
        """
        return True

    def get_item_id(self, item: Any) -> str:
        """Get a string identifier for an item (used for logging and recording).

        Override this if items are dicts or complex objects.

        Args:
            item: The item to get an ID for

        Returns:
            String identifier for the item
        """
        if isinstance(item, dict):
            # Try common key names for ID
            return str(
                item.get("id") or item.get("policyNumber") or item.get("name") or item
            )
        return str(item)

    def prepare_items(self, **kwargs: Any) -> list[Any]:
        """Prepare items to process.

        Override this method to fetch items from external sources (e.g., API, database).
        By default, returns items from kwargs['policyNumbers'] or kwargs['items'].

        Items can be any type (str, dict, etc.) - process_single_item should handle the type.

        Args:
            **kwargs: Parameters passed to execute()

        Returns:
            List of items to process (can be strings, dicts, or any type)
        """
        return kwargs.get("policyNumbers") or kwargs.get("items") or []
