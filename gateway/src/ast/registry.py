# ============================================================================
# AST Registry - Central registry for all AST classes
# ============================================================================
"""
Maps AST names to their implementing classes.

This registry is used by the TN3270 manager to instantiate the correct AST
class when running an automated transaction.

To add a new AST:
1. Create the AST class in src/ast/ (or src/ast/auto/ for batch processors)
2. Import it in this file
3. Add an entry to AST_REGISTRY with the AST name as key
"""

from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from ..core.ast import AST

from .login import LoginAST

log = structlog.get_logger()

# Registry mapping AST names to their classes
AST_REGISTRY: dict[str, type["AST"]] = {
    "login": LoginAST,
}

# Try to load BiRenewAST - it has heavy dependencies (pandas, ibm_db, etc.)
try:
    from .auto import BiRenewAST

    AST_REGISTRY["bi_renew"] = BiRenewAST
    log.info("Loaded BiRenewAST into registry")
except ImportError as e:
    log.warning("BiRenewAST not available - missing dependencies", error=str(e))
except Exception as e:
    log.error("Failed to load BiRenewAST", error=str(e), exc_info=True)


def get_ast_class(ast_name: str) -> type["AST"] | None:
    """
    Get the AST class for a given name.

    Args:
        ast_name: The name of the AST (e.g., 'login', 'bi_renew')

    Returns:
        The AST class if found, None otherwise
    """
    return AST_REGISTRY.get(ast_name)


def register_ast(name: str, ast_class: type["AST"]) -> None:
    """
    Register a new AST class.

    Args:
        name: The name to register the AST under
        ast_class: The AST class to register
    """
    AST_REGISTRY[name] = ast_class


def list_ast_names() -> list[str]:
    """
    List all registered AST names.

    Returns:
        List of registered AST names
    """
    return list(AST_REGISTRY.keys())
