# ============================================================================
# Login AST - Automated Login to Host
# ============================================================================
"""
Automated login script for Host system.

This AST authenticates once, processes all policies, then logs off:
1. Phase 1: Login (authenticate to Host system)
2. Phase 2: Process all policy numbers sequentially
3. Phase 3: Logoff (sign off from Host)
"""
import time
from typing import TYPE_CHECKING, Any, Literal

import structlog

from ..core.ast import AST

if TYPE_CHECKING:
    from ..services.tn3270.host import Host

log = structlog.get_logger()

PolicyStatus = Literal["success", "failed", "skipped"]


def validate_policy_number(policy_number: str) -> bool:
    """Validate a policy number format (9 char alphanumeric)."""
    return bool(policy_number and len(policy_number) == 9 and policy_number.isalnum())


class LoginAST(AST):
    """
    Automated login to Host system.

    Authentication flow:
    - Sequential: Login once → Process all policies → Logoff once
    - Parallel: Each session logs in → Processes batch → Logs off

    Required parameters:
        - username: Host username
        - password: Host password

    Optional parameters:
        - policyNumbers: List of 9-char policy numbers to process
    """

    name = "login"
    description = "Login to TSO and process policies (full cycle per policy)"
    supports_parallel = True  # This AST supports parallel execution

    # Authentication configuration for Fire system
    auth_expected_keywords = ["Fire System Selection"]
    auth_application = "FIRE06"
    auth_group = "@OOFIRE"

    def logoff(
        self, host: "Host", target_screen_keywords: list[str] | None = None
    ) -> tuple[bool, str]:
        """Sign off from TSO system."""
        screenshots: list[str] = []

        # Step 1: Exit with PF3
        log.info("Phase 3.1: Pressing PF3 to exit...")
        host.pf(3)

        # Step 2: Wait for termination message
        log.info("Phase 3.2: Waiting for termination message...")
        if not host.wait_for_text("TSO Applications Menu terminated", timeout=30):
            return False, "Failed to exit TSO Applications"

        screenshots.append(host.show_screen("Menu Terminated"))

        # Step 3: Logoff
        log.info("Phase 3.3: Logging off...")
        host.type_text("logoff")
        host.enter()

        screenshots.append(host.show_screen("After Logoff"))

        # Wait a moment for logoff to complete
        time.sleep(0.5)

        return True, ""

    def authenticate(
        self,
        host: "Host",
        user: str,
        password: str,
        expected_keywords_after_login: list[str],
        application: str = "",
        group: str = "",
    ) -> tuple[bool, str]:

        screenshots = []
        if not host.wait_for_text("Logon", timeout=120):
            return False, "Timeout waiting for Logon screen"

        screenshots.append(host.show_screen("Logon Screen"))

        # Step 2: Enter username
        log.info(f"Phase 1.2: Entering username '{user}'...")
        host.fill_field_by_label("Logon", user)
        host.enter()

        # Step 3: Wait for password prompt and enter password
        log.info("Phase 1.3: Waiting for password prompt...")
        if not host.wait_for_text("ENTER CURRENT PASSWORD FOR", timeout=2):
            return False, "Failed to reach password prompt"

        screenshots.append(host.show_screen("Password Prompt"))

        # Enter password
        log.info("Phase 1.4: Entering password...")
        host.fill_field_at_position(1, 1, password)
        host.enter()

        # Step 4: Wait for Welcome message
        log.info("Phase 1.5: Waiting for Welcome message...")
        if not host.wait_for_text("Welcome to the TSO system", timeout=2):
            return False, "Failed to reach Welcome screen"

        screenshots.append(host.show_screen("Welcome Screen"))
        host.enter()

        # Step 5: Wait for fortune cookie
        log.info("Phase 1.6: Waiting for fortune cookie...")
        if not host.wait_for_text("fortune cookie", timeout=2):
            return False, "Failed to reach fortune cookie screen"

        screenshots.append(host.show_screen("Fortune Cookie"))
        host.enter()

        # Step 6: Wait for TSO Applications menu
        log.info("Phase 1.7: Waiting for TSO Applications menu...")
        if not host.wait_for_text("TSO Applications", timeout=2):
            return False, "Failed to reach TSO Applications menu"

        screenshots.append(host.show_screen("TSO Applications"))

        return True, ""

    def prepare_items(self, **kwargs: Any) -> list[Any]:
        """Prepare policy numbers to process.

        Override to fetch from external sources with progress reporting.
        Raise ASTError for fatal errors, return [] for graceful empty result.
        """
        self.report_status("Preparing policy list...")

        # Get policies from kwargs (default behavior)
        policies: list[Any] = kwargs.get("policyNumbers") or kwargs.get("items") or []

        # Example: Fetching from database with error handling
        # try:
        #     self.report_status("Fetching policies from database...")
        #     policies = db.get_policies(user_id=kwargs.get("userId"))
        # except DatabaseConnectionError as e:
        #     # Fatal error - raise to fail the AST
        #     raise ASTError(f"Database connection failed: {e}") from e
        # except DatabaseQueryError as e:
        #     # Non-fatal - log and return empty (AST completes with "No items")
        #     log.warning("Query failed, continuing with empty list", error=str(e))
        #     self.report_status(f"⚠️ Could not fetch policies: {e}")
        #     return []

        if policies:
            self.report_status(f"Found {len(policies)} policies to process")

        return policies

    def validate_item(self, item: Any) -> bool:
        return validate_policy_number(str(item))

    def process_single_item(
        self, host: "Host", item: Any, index: int, total: int
    ) -> tuple[bool, str, dict[str, Any]]:
        log.info("Starting policy processing", policy_number=item)
        self.report_status(f"Processing policy {item}")
        policy_number = str(item)
        self.capture_screenshot(host, f"{policy_number}_start")
        time.sleep(1)
        policy_data = {
            "policyNumber": policy_number,
            "status": "active",
        }

        return True, "", policy_data
