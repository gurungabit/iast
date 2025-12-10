# ============================================================================
# AST Executors - Sequential and Parallel Execution
# ============================================================================
"""
Execution strategies for AST (Automated Streamlined Transaction) scripts.

Provides:
- SequentialExecutor: Process items one at a time using existing host session
- ParallelExecutor: Process items in parallel using ATI sessions (up to N concurrent)
"""

import concurrent.futures
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal, Optional

import structlog
from tnz.ati import Ati

from .base import ASTResult, ASTStatus, ItemResult
from .persistence import ASTPersistence

if TYPE_CHECKING:
    from .base import AST
    from ...services.tn3270.host import Host

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
            result = self._handle_execution_error(
                context, result, item_results, e, host
            )

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
        error: Optional[str] = None,
        item_data: Optional[dict] = None,
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

    def _process_single_item(
        self,
        host: "Host",
        context: ExecutionContext,
        item: Any,
        index: int,
        total: int,
    ) -> ItemResult:
        """Process a single item through authenticate -> process -> logoff cycle."""
        ast = context.ast
        item_id = ast.get_item_id(item)
        item_start = datetime.now()

        # Clear any screenshots from previous item
        ast.clear_screenshots()

        try:
            # Authenticate
            ast.report_progress(
                current=index,
                total=total,
                current_item=item_id,
                item_status="running",
                message=f"Item {index}/{total}: Logging in",
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

            # Process
            ast.report_progress(
                current=index,
                total=total,
                current_item=item_id,
                item_status="running",
                message=f"Item {index}/{total}: Processing",
            )

            success, error, item_data = ast.process_single_item(
                host, item, index, total
            )
            if not success:
                raise Exception(f"Process failed: {error}")

            # Collect screenshots captured during processing
            if item_data is None:
                item_data = {}
            screenshots = ast.get_screenshots()
            if screenshots:
                item_data["screenshots"] = screenshots

            # Logoff
            ast.report_progress(
                current=index,
                total=total,
                current_item=item_id,
                item_status="running",
                message=f"Item {index}/{total}: Logging off",
            )

            success, error = ast.logoff(host)
            if not success:
                log.warning("Logoff failed", error=error)

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
            try:
                error_screen = host.get_formatted_screen(show_row_numbers=False)
            except Exception:
                pass

            # Collect any screenshots captured before the error
            error_item_data: dict[str, Any] = {}
            screenshots = ast.get_screenshots()
            if screenshots:
                error_item_data["screenshots"] = screenshots
            if error_screen:
                error_item_data["errorScreen"] = error_screen

            # Try recovery logoff
            try:
                ast.logoff(host)
            except Exception:
                pass

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
        """Process items sequentially using the existing host session."""
        if host is None:
            raise ValueError("Host session required for sequential execution")

        ast = context.ast
        item_results: list[ItemResult] = []

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

            # Process item
            item_result = self._process_single_item(host, context, item, idx + 1, total)
            item_results.append(item_result)
            self._record_item_result(context, item_result, idx + 1, total)

            if item_result.status == "success":
                log.info(
                    "Item completed", item=item_id, duration_ms=item_result.duration_ms
                )

        return item_results


class ParallelExecutor(ASTExecutor):
    """
    Execute AST items in parallel using independent ATI sessions.
    """

    def __init__(
        self,
        max_concurrent: int = 10,
        host: str = "localhost",
        port: int = 3270,
        secure: bool = False,
        maxwait: int = 30,
        waitsleep: float = 0.5,
    ) -> None:
        self.max_concurrent = max_concurrent
        self.host_address = host
        self.port = port
        self.secure = secure
        self.maxwait = maxwait
        self.waitsleep = waitsleep
        self._thread_pool = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_concurrent,
            thread_name_prefix="ati-parallel",
        )

    @property
    def _mode_name(self) -> str:
        return "parallel"

    def _get_initial_data(self, context: ExecutionContext) -> dict[str, Any]:
        return {
            "username": context.username,
            "policyCount": len(context.items),
            "mode": "parallel",
            "maxConcurrent": self.max_concurrent,
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

    def _process_item_in_session(
        self,
        context: ExecutionContext,
        item: Any,
        index: int,
        total: int,
    ) -> ItemResult:
        """Process a single item in its own ATI session."""
        from ...services.tn3270.host import Host

        ast = context.ast
        item_id = ast.get_item_id(item)
        item_start = datetime.now()
        session_name = f"SES_{context.execution_id[:8]}_{index}"
        ati = None

        try:
            ati = self._create_ati_session(session_name)
            tnz = ati.get_tnz()

            if not tnz:
                raise Exception(f"Failed to establish session {session_name}")

            host = Host(tnz)
            item_result = self._process_single_item(host, context, item, index, total)

            ati.drop("SESSION")
            return item_result

        except Exception as e:
            log.warning(
                "Parallel item failed", item=item_id, session=session_name, error=str(e)
            )

            if ati is not None:
                try:
                    ati.drop("SESSION")
                except Exception:
                    pass

            return self._create_item_result(
                item_id=item_id,
                status="failed",
                item_start=item_start,
                error=str(e),
            )

    def _process_items(
        self,
        host: Optional["Host"],
        context: ExecutionContext,
        total: int,
    ) -> list[ItemResult]:
        """Process items in parallel using thread pool."""
        ast = context.ast
        item_results: list[ItemResult] = []

        # Filter valid items and track skipped
        valid_tasks: list[tuple[Any, int]] = []
        for idx, item in enumerate(context.items):
            if not ast.validate_item(item):
                item_result = self._create_item_result(
                    item_id=ast.get_item_id(item),
                    status="skipped",
                    item_start=datetime.now(),
                    error="Invalid item",
                )
                item_results.append(item_result)
            else:
                valid_tasks.append((item, idx + 1))

        # Submit valid items to thread pool
        futures = {
            self._thread_pool.submit(
                self._process_item_in_session, context, item, index, total
            ): (item, index)
            for item, index in valid_tasks
        }

        # Collect results
        completed = 0
        for future in concurrent.futures.as_completed(futures):
            if ast.is_cancelled:
                for f in futures:
                    f.cancel()
                break

            item, index = futures[future]
            try:
                item_result = future.result()
                item_results.append(item_result)
                self._record_item_result(context, item_result, completed + 1, total)
                completed += 1

            except Exception as e:
                log.exception("Failed to get result", item=ast.get_item_id(item))
                item_result = self._create_item_result(
                    item_id=ast.get_item_id(item),
                    status="failed",
                    item_start=datetime.now(),
                    error=str(e),
                )
                item_results.append(item_result)

        return item_results

    def shutdown(self) -> None:
        """Shutdown the thread pool executor."""
        self._thread_pool.shutdown(wait=True)
