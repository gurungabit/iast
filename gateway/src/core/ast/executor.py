# ============================================================================
# AST Executors - Sequential and Parallel Execution
# ============================================================================
"""
Execution strategies for AST (Automated Streamlined Transaction) scripts.

Provides:
- SequentialExecutor: Login once, process all items sequentially, logoff once
- ParallelExecutor: Create N sessions, each logs in, processes batch, logs off
"""

import concurrent.futures
import contextlib
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal, Optional

import structlog
from tnz.ati import Ati

from .base import ASTResult, ASTStatus, ItemResult
from .persistence import ASTPersistence

if TYPE_CHECKING:
    from ...services.tn3270.host import Host
    from .base import AST

log = structlog.get_logger()


@dataclass
class ExecutionContext:
    """Context for AST execution."""

    ast: "AST"
    username: str
    password: str
    user_id: str
    session_id: str
    execution_id: str
    items: list[Any]
    persistence: ASTPersistence
    host_config: dict[str, Any] = field(default_factory=dict)


class ASTExecutor(ABC):
    """
    Base class for AST executors with shared execution logic.

    Subclasses implement _process_items() to define how items are processed
    (sequentially or in parallel).
    """

    def execute(
        self,
        host: Optional["Host"],
        context: ExecutionContext,
    ) -> ASTResult:
        """Execute the AST with the given context."""
        ast = context.ast
        raw_items = context.items

        result = ASTResult(
            status=ASTStatus.RUNNING,
            started_at=datetime.now(),
            data=self._get_initial_data(context),
        )

        item_results: list[ItemResult] = []

        # Create execution record
        context.persistence.create_execution_record(
            session_id=context.session_id,
            execution_id=context.execution_id,
            ast_name=ast.name,
            username=context.username,
            user_id=context.user_id,
            item_count=len(raw_items),
            started_at=result.started_at or datetime.now(),
        )

        try:
            if not raw_items:
                log.info("No items to process, returning early")
                result.status = ASTStatus.SUCCESS
                result.message = "No items to process"
                return result

            total = len(raw_items)
            log.info(f"Processing {total} items...", mode=self._mode_name)

            # Delegate to subclass for actual processing
            item_results = self._process_items(host, context, total)

            # Finalize result
            result = self._finalize_result(context, result, item_results, total)

        except Exception as e:
            result = self._handle_execution_error(context, result, item_results, e, host)

        finally:
            result.completed_at = datetime.now()

        return result

    @property
    @abstractmethod
    def _mode_name(self) -> str:
        """Return the execution mode name for logging."""
        ...

    @abstractmethod
    def _get_initial_data(self, context: ExecutionContext) -> dict[str, Any]:
        """Return initial data for the result."""
        ...

    @abstractmethod
    def _process_items(
        self,
        host: Optional["Host"],
        context: ExecutionContext,
        total: int,
    ) -> list[ItemResult]:
        """Process all items and return results. Implemented by subclasses."""
        ...

    def _create_item_result(
        self,
        item_id: str,
        status: Literal["success", "failed", "skipped"],
        item_start: datetime,
        error: str | None = None,
        item_data: dict | None = None,
    ) -> ItemResult:
        """Create an ItemResult with timing information."""
        item_end = datetime.now()
        duration_ms = int((item_end - item_start).total_seconds() * 1000)

        return ItemResult(
            item_id=item_id,
            status=status,
            started_at=item_start,
            completed_at=item_end,
            duration_ms=duration_ms,
            error=error,
            data=item_data or {},
        )

    def _record_item_result(
        self,
        context: ExecutionContext,
        item_result: ItemResult,
        current: int,
        total: int,
    ) -> None:
        """Report and persist an item result."""
        ast = context.ast

        # Report to callbacks
        ast.report_item_result(
            item_id=item_result.item_id,
            status=item_result.status,
            duration_ms=item_result.duration_ms,
            error=item_result.error,
            data=item_result.data,
        )

        # Persist
        context.persistence.save_item_result(
            execution_id=context.execution_id,
            item_id=item_result.item_id,
            status=item_result.status,
            duration_ms=item_result.duration_ms,
            started_at=item_result.started_at,
            completed_at=item_result.completed_at,
            error=item_result.error,
            item_data=item_result.data if item_result.data else None,
        )

        # Report progress
        message = f"Item {current}/{total}: "
        if item_result.status == "success":
            message += "Completed"
        elif item_result.status == "failed":
            message += f"Failed - {item_result.error}"
        else:
            message += "Skipped"

        ast.report_progress(
            current=current,
            total=total,
            current_item=item_result.item_id,
            item_status=item_result.status,
            message=message,
        )

    def _process_single_item_no_auth(
        self,
        host: "Host",
        context: ExecutionContext,
        item: Any,
        index: int,
        total: int,
    ) -> ItemResult:
        """Process a single item (assumes already authenticated)."""
        ast = context.ast
        item_id = ast.get_item_id(item)
        item_start = datetime.now()

        # Clear any screenshots from previous item
        ast.clear_screenshots()

        try:
            # Process
            ast.report_progress(
                current=index,
                total=total,
                current_item=item_id,
                item_status="running",
            )

            success, error, item_data = ast.process_single_item(host, item, index, total)
            if not success:
                raise Exception(f"Process failed: {error}")

            # Collect screenshots captured during processing
            if item_data is None:
                item_data = {}
            screenshots = ast.get_screenshots()
            if screenshots:
                item_data["screenshots"] = screenshots

            return self._create_item_result(
                item_id=item_id,
                status="success",
                item_start=item_start,
                item_data=item_data,
            )

        except Exception as e:
            log.warning("Item failed", item=item_id, error=str(e))

            # Capture the screen at time of error
            error_screen = None
            with contextlib.suppress(Exception):
                error_screen = host.show_screen("Current screen at error")

            # Collect any screenshots captured before the error
            error_item_data: dict[str, Any] = {}
            screenshots = ast.get_screenshots()
            if screenshots:
                error_item_data["screenshots"] = screenshots
            if error_screen:
                error_item_data["errorScreen"] = error_screen

            return self._create_item_result(
                item_id=item_id,
                status="failed",
                item_start=item_start,
                error=str(e),
                item_data=error_item_data if error_item_data else None,
            )

    def _finalize_result(
        self,
        context: ExecutionContext,
        result: ASTResult,
        item_results: list[ItemResult],
        total: int,
    ) -> ASTResult:
        """Finalize the execution result with counts and status."""
        ast = context.ast

        success_count = sum(1 for r in item_results if r.status == "success")
        failed_count = sum(1 for r in item_results if r.status == "failed")
        skipped_count = sum(1 for r in item_results if r.status == "skipped")

        if ast.is_cancelled:
            result.status = ASTStatus.CANCELLED
            result.message = "Cancelled by user"
            status = "cancelled"
        else:
            result.status = ASTStatus.SUCCESS
            result.message = (
                f"Processed {total} items "
                f"({success_count} success, {failed_count} failed, {skipped_count} skipped)"
            )
            status = "success"

        result.item_results = item_results
        result.data.update(
            {
                "successCount": success_count,
                "failedCount": failed_count,
                "skippedCount": skipped_count,
            }
        )

        context.persistence.update_execution_record(
            session_id=context.session_id,
            execution_id=context.execution_id,
            status=status,
            message=result.message or "",
            item_results=item_results,
        )

        log.info(
            f"AST {status}",
            mode=self._mode_name,
            username=context.username,
            success=success_count,
            failed=failed_count,
            skipped=skipped_count,
        )

        return result

    def _handle_execution_error(
        self,
        context: ExecutionContext,
        result: ASTResult,
        item_results: list[ItemResult],
        error: Exception,
        host: Optional["Host"],
    ) -> ASTResult:
        """Handle a fatal execution error."""
        result.status = ASTStatus.FAILED
        result.error = str(error)
        result.message = f"Error during execution: {error}"
        result.item_results = item_results

        context.persistence.update_execution_record(
            session_id=context.session_id,
            execution_id=context.execution_id,
            status="failed",
            message=result.message,
            item_results=item_results,
            error=str(error),
        )

        log.exception("AST failed", mode=self._mode_name, username=context.username)

        return result


class SequentialExecutor(ASTExecutor):
    """
    Execute AST items sequentially using an existing host session.

    Auth flow: Login once → Process all items → Logoff once
    """

    @property
    def _mode_name(self) -> str:
        return "sequential"

    def _get_initial_data(self, context: ExecutionContext) -> dict[str, Any]:
        return {
            "username": context.username,
            "policyCount": len(context.items),
            "mode": "sequential",
        }

    def _process_items(
        self,
        host: Optional["Host"],
        context: ExecutionContext,
        total: int,
    ) -> list[ItemResult]:
        """Process items sequentially: login once, process all, logoff once."""
        if host is None:
            raise ValueError("Host session required for sequential execution")

        ast = context.ast
        item_results: list[ItemResult] = []

        # ===== LOGIN ONCE =====
        log.info("Authenticating for sequential batch processing")
        ast.report_status(
            "Logging in...",
        )

        success, error = ast.authenticate(
            host,
            user=context.username,
            password=context.password,
            expected_keywords_after_login=ast.auth_expected_keywords,
            application=ast.auth_application,
            group=ast.auth_group,
        )
        if not success:
            raise Exception(f"Login failed: {error}")

        log.info("Authentication successful, processing items")

        try:
            # ===== PROCESS ALL ITEMS =====
            for idx, item in enumerate(context.items):
                # Check for pause/cancel
                if not ast.wait_if_paused():
                    log.info("AST cancelled by user")
                    break

                item_id = ast.get_item_id(item)

                # Validate item
                if not ast.validate_item(item):
                    item_result = self._create_item_result(
                        item_id=item_id,
                        status="skipped",
                        item_start=datetime.now(),
                        error="Invalid item",
                    )
                    item_results.append(item_result)
                    self._record_item_result(context, item_result, idx + 1, total)
                    continue

                # Process item (no auth/logoff per item)
                item_result = self._process_single_item_no_auth(host, context, item, idx + 1, total)
                item_results.append(item_result)
                self._record_item_result(context, item_result, idx + 1, total)

                if item_result.status == "success":
                    log.info(
                        "Item completed",
                        item=item_id,
                        duration_ms=item_result.duration_ms,
                    )

        finally:
            # ===== LOGOFF ONCE =====
            log.info("Logging off after batch processing")
            ast.report_progress(
                current=total,
                total=total,
                current_item=None,
                item_status="running",
                message="Logging off...",
            )
            try:
                success, error = ast.logoff(host)
                if not success:
                    log.warning("Logoff failed", error=error)
            except Exception as e:
                log.warning("Exception during logoff", error=str(e))

        return item_results


class ParallelExecutor(ASTExecutor):
    """
    Execute AST items in parallel using independent ATI sessions.

    Creates N sessions (default 5), divides items evenly among them.
    Each session: Login once → Process batch → Logoff once
    """

    def __init__(
        self,
        max_sessions: int = 5,
        host: str = "localhost",
        port: int = 3270,
        secure: bool = False,
        maxwait: int = 120,
        waitsleep: float = 1,
    ) -> None:
        self.max_sessions = max_sessions
        self.host_address = host
        self.port = port
        self.secure = secure
        self.maxwait = maxwait
        self.waitsleep = waitsleep
        self._results_lock = threading.Lock()

    @property
    def _mode_name(self) -> str:
        return "parallel"

    def _get_initial_data(self, context: ExecutionContext) -> dict[str, Any]:
        return {
            "username": context.username,
            "policyCount": len(context.items),
            "mode": "parallel",
            "maxSessions": self.max_sessions,
        }

    def _create_ati_session(self, session_name: str) -> Ati:
        """Create a new ATI session and connect to the host.

        Waits for the SIGNON screen to appear before returning.

        Raises:
            Exception: If session creation fails or SIGNON screen not found
        """
        ati = Ati()

        # Connection settings
        ati.set("SESSION_HOST", self.host_address)
        ati.set("SESSION_PORT", str(self.port))
        ati.set("SESSION_SSL", "1" if self.secure else "0")

        # TN3270E enhanced mode settings
        ati.set("SESSION_TN_ENHANCED", "1")
        ati.set("SESSION_DEVICE_TYPE", "IBM-3279-4-E")
        ati.set("SESSION_PS_SIZE", "43x80")

        # Configure timeouts BEFORE creating session
        ati.maxwait = self.maxwait
        ati.waitsleep = self.waitsleep
        ati.maxlostwarn = 0  # Suppress lost session warnings during wait

        # Create session
        ati.set("SESSION", session_name)

        # Wait for SIGNON screen to appear
        if not ati.wait(lambda: ati.scrhas("SIGNON")):
            raise Exception(
                f"SIGNON screen not found for session {session_name} "
                f"(RC={ati.rc}, SESLOST={ati.seslost})"
            )

        return ati

    def _process_batch_in_session(
        self,
        session_id: int,
        context: ExecutionContext,
        items_with_indices: list[tuple[Any, int]],
        total: int,
        results_collector: list[ItemResult],
        completed_counter: list[int],
    ) -> None:
        """Process a batch of items in a single ATI session.

        Each session: Login once → Process all items in batch → Logoff once
        """
        from ...services.tn3270.host import Host

        ast = context.ast
        session_name = f"SES_{context.execution_id[:8]}_{session_id}"
        ati = None

        try:
            # ===== CREATE SESSION =====
            log.info(
                "Creating ATI session for batch",
                session=session_name,
                items=len(items_with_indices),
            )
            ati = self._create_ati_session(session_name)
            tnz = ati.get_tnz()

            if not tnz:
                raise Exception(f"Failed to establish session {session_name}")

            host = Host(tnz, mode="ati")

            # ===== LOGIN ONCE =====
            log.info("Authenticating session", session=session_name)
            success, error = ast.authenticate(
                host,
                user=context.username,
                password=context.password,
                expected_keywords_after_login=ast.auth_expected_keywords,
                application=ast.auth_application,
                group=ast.auth_group,
            )
            if not success:
                raise Exception(f"Login failed for session {session_name}: {error}")

            log.info(
                "Session authenticated, processing batch",
                session=session_name,
                items=len(items_with_indices),
            )

            # ===== PROCESS ALL ITEMS IN BATCH =====
            for item, original_index in items_with_indices:
                if ast.is_cancelled:
                    log.info("AST cancelled, stopping batch", session=session_name)
                    break

                # Reuse the shared processing logic
                item_result = self._process_single_item_no_auth(
                    host, context, item, original_index, total
                )

                # Record result thread-safely
                with self._results_lock:
                    results_collector.append(item_result)
                    completed_counter[0] += 1
                    self._record_item_result(context, item_result, completed_counter[0], total)

            # ===== LOGOFF ONCE =====
            log.info("Logging off session after batch", session=session_name)
            try:
                success, error = ast.logoff(host)
                if not success:
                    log.warning("Logoff failed", session=session_name, error=error)
            except Exception as e:
                log.warning("Exception during logoff", session=session_name, error=str(e))

        except Exception as e:
            log.error(
                "Session batch failed",
                session=session_name,
                error=str(e),
            )
            # Mark all remaining items in this batch as failed
            for item, _original_index in items_with_indices:
                item_id = ast.get_item_id(item)
                # Check if already processed
                with self._results_lock:
                    already_processed = any(r.item_id == item_id for r in results_collector)
                    if not already_processed:
                        item_result = self._create_item_result(
                            item_id=item_id,
                            status="failed",
                            item_start=datetime.now(),
                            error=f"Session failed: {str(e)}",
                        )
                        results_collector.append(item_result)
                        completed_counter[0] += 1
                        self._record_item_result(context, item_result, completed_counter[0], total)

        finally:
            if ati is not None:
                with contextlib.suppress(Exception):
                    ati.drop("SESSION")

    def _process_items(
        self,
        host: Optional["Host"],
        context: ExecutionContext,
        total: int,
    ) -> list[ItemResult]:
        """Process items in parallel across N sessions with even distribution."""
        ast = context.ast
        item_results: list[ItemResult] = []
        completed_counter = [0]  # Use list to allow mutation in threads

        # Filter valid items and track skipped
        valid_items: list[tuple[Any, int]] = []
        for idx, item in enumerate(context.items):
            if not ast.validate_item(item):
                item_result = self._create_item_result(
                    item_id=ast.get_item_id(item),
                    status="skipped",
                    item_start=datetime.now(),
                    error="Invalid item",
                )
                item_results.append(item_result)
                completed_counter[0] += 1
                self._record_item_result(context, item_result, completed_counter[0], total)
            else:
                valid_items.append((item, idx + 1))

        if not valid_items:
            return item_results

        # Determine number of sessions (max 5, but not more than items)
        num_sessions = min(self.max_sessions, len(valid_items))

        # Distribute items evenly across sessions
        batches: list[list[tuple[Any, int]]] = [[] for _ in range(num_sessions)]
        for i, item_with_index in enumerate(valid_items):
            batches[i % num_sessions].append(item_with_index)

        log.info(
            "Distributing items across sessions",
            total_items=len(valid_items),
            num_sessions=num_sessions,
            items_per_session=[len(b) for b in batches],
        )

        # Process batches in parallel using thread pool
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=num_sessions,
            thread_name_prefix="ati-batch",
        ) as executor:
            futures = []
            for session_id, batch in enumerate(batches):
                if batch:  # Only create threads for non-empty batches
                    future = executor.submit(
                        self._process_batch_in_session,
                        session_id,
                        context,
                        batch,
                        total,
                        item_results,
                        completed_counter,
                    )
                    futures.append(future)

            # Wait for all batches to complete
            for future in concurrent.futures.as_completed(futures):
                try:
                    future.result()  # Raises exception if batch failed
                except Exception as e:
                    log.exception("Batch processing failed", error=str(e))

        return item_results

    def shutdown(self) -> None:
        """No-op for compatibility (thread pool is created per-execution now)."""
        pass
