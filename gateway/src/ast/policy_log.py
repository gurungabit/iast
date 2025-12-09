import time
from typing import TYPE_CHECKING

import structlog

from .login import validate_policy_number
from .base import AST

if TYPE_CHECKING:
    from ..services.tn3270.host import Host

log = structlog.get_logger()


class PolicyLogAST(AST):
    """
    Simple AST that logs each policy number after login/logoff.
    """

    name = "policy_log"
    description = "Login, log each policy number, and log off"

    def validate_item(self, item_id: str) -> bool:
        return validate_policy_number(item_id)

    def process_single_item(self, host: "Host", item_id: str, index: int, total: int):
        log.info("Logging policy", policy=item_id, index=index, total=total)
        return True, "", {"policyNumber": item_id, "status": "logged"}

    def logoff(self, host: "Host"):
        """
        Basic logoff flow reused from LoginAST behavior.
        """
        screenshots: list[str] = []

        log.info("Logoff: pressing PF3...")
        host.pf(3)

        log.info("Logoff: waiting for termination message...")
        if not host.wait_for_text("TSO Applications Menu terminated", timeout=30):
            return False, "Failed to exit TSO Applications", screenshots

        screenshots.append(host.show_screen("Menu Terminated"))

        log.info("Logoff: issuing logoff command...")
        host.type_text("logoff")
        host.enter()

        screenshots.append(host.show_screen("After Logoff"))
        time.sleep(0.5)

        return True, "", screenshots
