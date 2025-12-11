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
        log.info("🔒 Signing off from terminal session...")
        max_backoff_count = 20
        while not host.wait_for_text("Exit Menu", timeout=0.8) and max_backoff_count > 0:
            host.pf(15)
            max_backoff_count -= 1

        host.fill_field_at_position(36, 5, "1")
        host.enter()

        # Check for target screen or default SIGNON
        target_keywords = target_screen_keywords or ["**** SIGNON ****", "SIGNON"]
        for keyword in target_keywords:
            if host.wait_for_text(keyword, timeout=10):
                log.info("✅ Signed off successfully.", keyword=keyword)
                return True, ""

        return False, "Failed to sign off"

    def validate_item(self, item: Any) -> bool:
        return validate_policy_number(str(item))

    def process_single_item(
        self, host: "Host", item: Any, index: int, total: int
    ) -> tuple[bool, str, dict[str, Any]]:
        self.capture_screenshot(host, f"policy_{index}_start")
        log.info("Starting policy processing", policy_number=item)
        policy_number = str(item)
        policy_data = {
            "policyNumber": policy_number,
            "status": "active",
        }

        return True, "", policy_data
