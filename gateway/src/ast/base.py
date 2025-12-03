# ============================================================================
# AST Base Class
# ============================================================================
"""
Base class for all AST (Automated Streamlined Transaction) scripts.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, TYPE_CHECKING

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
    TIMEOUT = "timeout"


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

    def run(self, host: Host, **kwargs: Any) -> ASTResult:
        """
        Run the AST script.

        Args:
            host: The Host automation interface
            **kwargs: Additional parameters for the AST

        Returns:
            ASTResult with execution status and data
        """
        log.info(f"Starting AST: {self.name}", ast=self.name, kwargs=kwargs)

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
                status=result.status.value,
                duration=result.duration,
            )

        except TimeoutError as e:
            result.status = ASTStatus.TIMEOUT
            result.error = str(e)
            result.message = f"Timeout: {e}"
            log.warning(f"AST timeout: {self.name}", ast=self.name, error=str(e))

        except Exception as e:
            result.status = ASTStatus.FAILED
            result.error = str(e)
            result.message = f"Error: {e}"
            log.exception(f"AST failed: {self.name}", ast=self.name)

        finally:
            result.completed_at = datetime.now()

        self._result = result
        return result

    @abstractmethod
    def execute(self, host: Host, **kwargs: Any) -> ASTResult:
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
