# ============================================================================
# Login AST - Automated Login to TSO
# ============================================================================
"""
Automated login script for TK4- MVS system.

This AST performs a complete login/logoff cycle for each policy:
1. Phase 1: Login (Wait for Logon screen, enter credentials, navigate to TSO)
2. Phase 2: Process policy number
3. Phase 3: Logoff (Exit TSO and logoff)

Each policy gets its own full login/logoff cycle.
"""

import time
from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal

import structlog

from .base import AST

if TYPE_CHECKING:
    from ..services.tn3270.host import Host

log = structlog.get_logger()

PolicyStatus = Literal["success", "failed", "skipped"]


def validate_policy_number(policy_number: str) -> bool:
    """Validate a policy number format (9 char alphanumeric)."""
    return bool(policy_number and len(policy_number) == 9 and policy_number.isalnum())


class LoginAST(AST):
    """
    Automated login to TK4- TSO system.

    Performs a complete login/logoff cycle for each policy number.
    Each policy goes through all three phases:
    - Phase 1: Login
    - Phase 2: Process policy
    - Phase 3: Logoff

    Required parameters:
        - username: TSO username
        - password: TSO password

    Optional parameters:
        - policyNumbers: List of 9-char policy numbers to process
    """

    name = "login"
    description = "Login to TSO and process policies (full cycle per policy)"

    def _phase2_process_policy(
        self, host: "Host", policy_number: str
    ) -> tuple[bool, str, dict[str, Any]]:
        """
        Phase 2: Process a single policy number.

        Returns:
            Tuple of (success, error_message, policy_data)
        """
        log.info(f"Phase 2: Processing policy {policy_number}...")

        # TODO: In a real implementation, this would:
        # 1. Navigate to policy lookup screen
        # 2. Enter the policy number
        # 3. Read the policy data
        # 4. Extract relevant information

        # For now, simulate processing with a small delay
        time.sleep(0.5)  # Simulate processing time

        policy_data = {
            "policyNumber": policy_number,
            "status": "active",
        }

        return True, "", policy_data

    def _phase3_logoff(self, host: "Host") -> tuple[bool, str, list[str]]:
        """
        Phase 3: Logoff from TSO.

        Returns:
            Tuple of (success, error_message, screenshots)
        """
        screenshots: list[str] = []

        # Step 1: Exit with PF3
        log.info("Phase 3.1: Pressing PF3 to exit...")
        host.pf(3)

        # Step 2: Wait for termination message
        log.info("Phase 3.2: Waiting for termination message...")
        if not host.wait_for_text("TSO Applications Menu terminated", timeout=30):
            return False, "Failed to exit TSO Applications", screenshots

        screenshots.append(host.show_screen("Menu Terminated"))

        # Step 3: Logoff
        log.info("Phase 3.3: Logging off...")
        host.type_text("logoff")
        host.enter()

        screenshots.append(host.show_screen("After Logoff"))

        # Wait a moment for logoff to complete
        time.sleep(0.5)

        return True, "", screenshots

    def logoff(self, host: "Host") -> tuple[bool, str, list[str]]:
        """Implement abstract logoff using the existing phase."""
        return self._phase3_logoff(host)

    def validate_item(self, item_id: str) -> bool:
        return validate_policy_number(item_id)

    def process_single_item(
        self, host: "Host", item_id: str, index: int, total: int
    ) -> tuple[bool, str, dict[str, Any]]:
        return self._phase2_process_policy(host, item_id)
