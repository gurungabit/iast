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
5. Exit TSO and logoff
"""

from datetime import datetime
from typing import TYPE_CHECKING, Any

import structlog

from .base import AST, ASTResult, ASTStatus

if TYPE_CHECKING:
    from ..services.tn3270.host import Host

log = structlog.get_logger()


class LoginAST(AST):
    """
    Automated login to TK4- TSO system.

    Performs complete login/logoff cycle for testing connectivity
    and automation capabilities.

    Required parameters:
        - username: TSO username
        - password: TSO password
    """

    name = "login"
    description = "Login to TSO and logoff"

    def execute(self, host: Host, **kwargs: Any) -> ASTResult:
        """
        Execute the login automation.

        Args:
            host: The Host automation interface
            **kwargs: Required parameters:
                - username: Username for login
                - password: Password for login

        Returns:
            ASTResult with execution status
        """
        username = kwargs.get("username")
        password = kwargs.get("password")

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
            data={"username": username},
        )

        screenshots: list[str] = []

        try:
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

            # breakpoint()  # <-- DEBUG: Remove after debugging
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

            # Success!
            result.status = ASTStatus.SUCCESS
            result.message = f"Successfully logged in and out as {username}"
            result.screenshots = screenshots

            log.info("Login AST completed successfully", username=username)

        except Exception as e:
            result.status = ASTStatus.FAILED
            result.error = str(e)
            log.exception(f"Login AST failed error: {result.error}", username=username)
            result.message = f"Error during login: {e}"
            screenshots.append(host.show_screen("Error State"))
            result.screenshots = screenshots
            log.exception("Login AST failed", username=username)

        return result
