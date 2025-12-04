# ============================================================================
# Login AST - Automated Login to TSO
# ============================================================================
"""
Automated login script for TK4- MVS system.

This AST performs the complete login sequence:
1. Wait for Logon screen
2. Enter username (herc01)
3. Enter password (CUL8TR)
4. Navigate through welcome screens
5. Optionally process policy numbers
6. Exit TSO and logoff
"""

import time
from datetime import datetime
from typing import TYPE_CHECKING, Any

import structlog

from .base import AST, ASTResult, ASTStatus, ItemResult
from ..db import get_dynamodb_client

if TYPE_CHECKING:
    from ..services.tn3270.host import Host

log = structlog.get_logger()


def validate_policy_number(policy_number: str) -> bool:
    """Validate a policy number format (9 char alphanumeric)."""
    if not policy_number or len(policy_number) != 9:
        return False
    return policy_number.isalnum()


class LoginAST(AST):
    """
    Automated login to TK4- TSO system.

    Performs complete login/logoff cycle for testing connectivity
    and automation capabilities. Optionally processes a list of
    policy numbers with progress tracking.

    Required parameters:
        - username: TSO username
        - password: TSO password

    Optional parameters:
        - policyNumbers: List of 9-char policy numbers to process
    """

    name = "login"
    description = "Login to TSO and optionally process policies"

    def execute(self, host: "Host", **kwargs: Any) -> ASTResult:
        """
        Execute the login automation.

        Args:
            host: The Host automation interface
            **kwargs: Required parameters:
                - username: Username for login
                - password: Password for login
                - policyNumbers: Optional list of policy numbers to process

        Returns:
            ASTResult with execution status
        """
        username = kwargs.get("username")
        password = kwargs.get("password")
        policy_numbers: list[str] = kwargs.get("policyNumbers", []) or []
        
        # App user info (the person using the web app)
        app_user_id: str = kwargs.get("userId", "anonymous")
        app_session_id: str = kwargs.get("sessionId", self._execution_id)

        # Validate required parameters
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
            data={
                "username": username,
                "policyCount": len(policy_numbers),
            },
        )

        screenshots: list[str] = []
        item_results: list[ItemResult] = []

        # Get DynamoDB client for persistence
        try:
            db = get_dynamodb_client()
        except Exception as e:
            log.warning("DynamoDB not available, continuing without persistence", error=str(e))
            db = None

        # Create execution record in DynamoDB
        if db:
            try:
                db.put_execution(
                    session_id=app_session_id,
                    execution_id=self._execution_id,
                    data={
                        "ast_name": self.name,
                        "user_id": app_user_id,
                        "host_user": username,
                        "policy_count": len(policy_numbers),
                        "status": "running",
                        "started_at": result.started_at.isoformat(),
                        "entity_type": "EXECUTION",
                    },
                )
                log.info("Created execution record", execution_id=self._execution_id, user_id=app_user_id)
            except Exception as e:
                log.warning("Failed to create execution record", error=str(e))

        try:
            # ================================================================
            # Phase 1: Login
            # ================================================================

            # Step 1: Wait for Logon screen (up to 2 minutes)
            log.info("Step 1: Waiting for Logon screen...")
            if not host.wait_for_text(
                "Logon",
                timeout=120,
            ):
                result.status = ASTStatus.TIMEOUT
                result.current_screen = host.show_screen("Current Screen on Timeout")
                result.message = "Timeout waiting for Logon screen"
                return result

            screenshots.append(host.show_screen("Logon Screen"))

            # Step 2: Enter username
            log.info(f"Step 2: Entering username '{username}'...")
            host.fill_field_by_label("Logon", username)
            host.enter()

            # Step 3: Wait for password prompt and enter password
            log.info("Step 3: Waiting for password prompt...")
            if not host.wait_for_text(
                "ENTER CURRENT PASSWORD FOR",
                timeout=30,
            ):
                result.status = ASTStatus.FAILED
                result.message = "Failed to reach password prompt"
                return result

            screenshots.append(host.show_screen("Password Prompt"))

            # Enter password (cursor should already be positioned)
            log.info("Step 3b: Entering password...")
            host.fill_field_at_position(1, 1, password)
            host.enter()

            # Step 4: Wait for Welcome message
            log.info("Step 4: Waiting for Welcome message...")
            if not host.wait_for_text(
                "Welcome to the TSO system",
                timeout=60,
            ):
                result.status = ASTStatus.FAILED
                result.message = "Failed to reach Welcome screen"
                return result

            screenshots.append(host.show_screen("Welcome Screen"))
            host.enter()

            # Step 5: Wait for fortune cookie
            log.info("Step 5: Waiting for fortune cookie...")
            if not host.wait_for_text(
                "fortune cookie",
                timeout=30,
            ):
                result.status = ASTStatus.FAILED
                result.message = "Failed to reach fortune cookie screen"
                return result

            screenshots.append(host.show_screen("Fortune Cookie"))
            host.enter()

            # Step 6: Wait for TSO Applications menu
            log.info("Step 6: Waiting for TSO Applications menu...")
            if not host.wait_for_text(
                "TSO Applications",
                timeout=30,
            ):
                result.status = ASTStatus.FAILED
                result.message = "Failed to reach TSO Applications menu"
                return result

            screenshots.append(host.show_screen("TSO Applications"))

            # ================================================================
            # Phase 2: Process Policy Numbers (if any)
            # ================================================================

            if policy_numbers:
                total_policies = len(policy_numbers)
                log.info(f"Processing {total_policies} policy numbers...")

                for idx, policy_number in enumerate(policy_numbers):
                    current = idx + 1

                    # Report progress: starting this policy
                    self.report_progress(
                        current=current,
                        total=total_policies,
                        current_item=policy_number,
                        item_status="running",
                        message=f"Processing policy {current}/{total_policies}",
                    )

                    item_start = datetime.now()

                    # Validate policy number format
                    if not validate_policy_number(policy_number):
                        item_end = datetime.now()
                        duration_ms = int(
                            (item_end - item_start).total_seconds() * 1000
                        )

                        item_result = ItemResult(
                            item_id=policy_number,
                            status="skipped",
                            started_at=item_start,
                            completed_at=item_end,
                            duration_ms=duration_ms,
                            error="Invalid policy number format",
                        )
                        item_results.append(item_result)

                        self.report_item_result(
                            item_id=policy_number,
                            status="skipped",
                            duration_ms=duration_ms,
                            error="Invalid policy number format",
                        )

                        # Save skipped policy to DynamoDB
                        if db:
                            try:
                                db.put_policy_result(
                                    execution_id=self._execution_id,
                                    policy_number=policy_number,
                                    data={
                                        "status": "skipped",
                                        "duration_ms": duration_ms,
                                        "error": "Invalid policy number format",
                                        "started_at": item_start.isoformat(),
                                        "completed_at": item_end.isoformat(),
                                        "entity_type": "POLICY_RESULT",
                                    },
                                )
                            except Exception as e:
                                log.warning("Failed to save policy result", policy=policy_number, error=str(e))

                        self.report_progress(
                            current=current,
                            total=total_policies,
                            current_item=policy_number,
                            item_status="skipped",
                        )
                        continue

                    try:
                        # TODO: In a real implementation, this would:
                        # 1. Navigate to policy lookup screen
                        # 2. Enter the policy number
                        # 3. Read the policy data

                        # For now, simulate processing with a small delay
                        log.info(f"Processing policy: {policy_number}")
                        time.sleep(0.5)  # Simulate processing time

                        item_end = datetime.now()
                        duration_ms = int(
                            (item_end - item_start).total_seconds() * 1000
                        )

                        # Simulate success (in real implementation, check actual result)
                        item_result = ItemResult(
                            item_id=policy_number,
                            status="success",
                            started_at=item_start,
                            completed_at=item_end,
                            duration_ms=duration_ms,
                            data={"policyNumber": policy_number, "status": "active"},
                        )
                        item_results.append(item_result)

                        self.report_item_result(
                            item_id=policy_number,
                            status="success",
                            duration_ms=duration_ms,
                            data={"policyNumber": policy_number, "status": "active"},
                        )

                        # Save successful policy to DynamoDB
                        if db:
                            try:
                                db.put_policy_result(
                                    execution_id=self._execution_id,
                                    policy_number=policy_number,
                                    data={
                                        "status": "success",
                                        "duration_ms": duration_ms,
                                        "started_at": item_start.isoformat(),
                                        "completed_at": item_end.isoformat(),
                                        "policy_data": {"policyNumber": policy_number, "status": "active"},
                                        "entity_type": "POLICY_RESULT",
                                    },
                                )
                            except Exception as e:
                                log.warning("Failed to save policy result", policy=policy_number, error=str(e))

                        self.report_progress(
                            current=current,
                            total=total_policies,
                            current_item=policy_number,
                            item_status="success",
                        )

                    except Exception as e:
                        item_end = datetime.now()
                        duration_ms = int(
                            (item_end - item_start).total_seconds() * 1000
                        )

                        item_result = ItemResult(
                            item_id=policy_number,
                            status="failed",
                            started_at=item_start,
                            completed_at=item_end,
                            duration_ms=duration_ms,
                            error=str(e),
                        )
                        item_results.append(item_result)

                        self.report_item_result(
                            item_id=policy_number,
                            status="failed",
                            duration_ms=duration_ms,
                            error=str(e),
                        )

                        # Save failed policy to DynamoDB
                        if db:
                            try:
                                db.put_policy_result(
                                    execution_id=self._execution_id,
                                    policy_number=policy_number,
                                    data={
                                        "status": "failed",
                                        "duration_ms": duration_ms,
                                        "error": str(e),
                                        "started_at": item_start.isoformat(),
                                        "completed_at": item_end.isoformat(),
                                        "entity_type": "POLICY_RESULT",
                                    },
                                )
                            except Exception as e:
                                log.warning("Failed to save policy result", policy=policy_number, error=str(e))

                        self.report_progress(
                            current=current,
                            total=total_policies,
                            current_item=policy_number,
                            item_status="failed",
                        )

                        log.warning(
                            f"Failed to process policy {policy_number}",
                            error=str(e),
                        )

            # ================================================================
            # Phase 3: Logoff
            # ================================================================

            # Step 7: Exit with PF3
            log.info("Step 7: Pressing PF3 to exit...")
            host.pf(3)

            # Step 8: Wait for termination message
            log.info("Step 8: Waiting for termination message...")
            if not host.wait_for_text(
                "TSO Applications Menu terminated",
                timeout=30,
            ):
                result.status = ASTStatus.FAILED
                result.message = "Failed to exit TSO Applications"
                return result

            screenshots.append(host.show_screen("Menu Terminated"))

            # Step 9: Logoff
            log.info("Step 9: Logging off...")
            host.type_text("logoff")
            host.enter()

            screenshots.append(host.show_screen("After Logoff"))

            # Calculate summary
            success_count = sum(1 for r in item_results if r.status == "success")
            failed_count = sum(1 for r in item_results if r.status == "failed")
            skipped_count = sum(1 for r in item_results if r.status == "skipped")

            # Success!
            result.status = ASTStatus.SUCCESS
            if policy_numbers:
                result.message = (
                    f"Logged in as {username}, processed {len(policy_numbers)} policies "
                    f"({success_count} success, {failed_count} failed, {skipped_count} skipped)"
                )
            else:
                result.message = f"Successfully logged in and out as {username}"
            result.screenshots = screenshots
            result.item_results = item_results
            result.data["successCount"] = success_count
            result.data["failedCount"] = failed_count
            result.data["skippedCount"] = skipped_count

            # Update execution record with success
            if db:
                try:
                    db.update_execution(
                        session_id=app_session_id,
                        execution_id=self._execution_id,
                        updates={
                            "status": "success",
                            "completed_at": datetime.now().isoformat(),
                            "message": result.message,
                            "success_count": success_count,
                            "failed_count": failed_count,
                            "skipped_count": skipped_count,
                        },
                    )
                    log.info("Updated execution record", execution_id=self._execution_id, status="success")
                except Exception as e:
                    log.warning("Failed to update execution record", error=str(e))

            log.info("Login AST completed successfully", username=username)

        except Exception as e:
            result.status = ASTStatus.FAILED
            result.error = str(e)
            log.exception(f"Login AST failed error: {result.error}", username=username)
            result.message = f"Error during login: {e}"
            screenshots.append(host.show_screen("Error State"))
            result.screenshots = screenshots
            result.item_results = item_results

            # Update execution record with failure
            if db:
                try:
                    db.update_execution(
                        session_id=app_session_id,
                        execution_id=self._execution_id,
                        updates={
                            "status": "failed",
                            "completed_at": datetime.now().isoformat(),
                            "error": str(e),
                            "message": result.message,
                        },
                    )
                    log.info("Updated execution record", execution_id=self._execution_id, status="failed")
                except Exception as ex:
                    log.warning("Failed to update execution record", error=str(ex))

            log.exception("Login AST failed", username=username)

        return result
