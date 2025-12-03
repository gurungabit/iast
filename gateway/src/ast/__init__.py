# ============================================================================
# AST - Automated Streamlined Transactions
# ============================================================================
"""
AST (Automated Streamlined Transaction) scripts for TN3270 terminal automation.

Each AST is a self-contained automation script that performs a specific
transaction or workflow on the mainframe.
"""

from .base import AST, ASTResult
from .login import LoginAST

__all__ = ["AST", "ASTResult", "LoginAST"]
