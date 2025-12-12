# ============================================================================
# AST - Automated Streamlined Transactions
# ============================================================================
"""
AST (Automated Streamlined Transaction) scripts for TN3270 terminal automation.

Each AST is a self-contained automation script that performs a specific
transaction or workflow on the mainframe.
"""

from ..core.ast import (
    AST,
    ASTResult,
    ASTStatus,
    ItemResult,
    ItemResultCallback,
    ProgressCallback,
    run_ast,
)
from .login import LoginAST
from .registry import AST_REGISTRY, get_ast_class, list_ast_names, register_ast

__all__ = [
    "AST",
    "ASTResult",
    "ASTStatus",
    "ItemResult",
    "ProgressCallback",
    "ItemResultCallback",
    "LoginAST",
    "run_ast",
    # Registry
    "AST_REGISTRY",
    "get_ast_class",
    "register_ast",
    "list_ast_names",
]
