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

if TYPE_CHECKING:
    from ..core.ast import AST

from .login import LoginAST

# Registry mapping AST names to their classes
# Note: Some ASTs have heavy dependencies (pandas, etc.) and are imported lazily
AST_REGISTRY: dict[str, type["AST"]] = {
    "login": LoginAST,
}

# Flag to track if lazy ASTs have been loaded
_lazy_asts_loaded = False


def _load_lazy_asts() -> None:
    """Load ASTs with heavy dependencies on first access."""
    global _lazy_asts_loaded
    if _lazy_asts_loaded:
        return

    try:
        from .auto import BiRenewAST

        AST_REGISTRY["bi_renew"] = BiRenewAST
    except ImportError:
        # Dependencies not available (e.g., pandas not installed)
        pass

    _lazy_asts_loaded = True


def get_ast_class(ast_name: str) -> type["AST"] | None:
    """
    Get the AST class for a given name.

    Args:
        ast_name: The name of the AST (e.g., 'login', 'bi_renew')

    Returns:
        The AST class if found, None otherwise
    """
    _load_lazy_asts()
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
    _load_lazy_asts()
    return list(AST_REGISTRY.keys())
