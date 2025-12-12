# ============================================================================
# AST Runner - Execution Orchestration
# ============================================================================
"""
Orchestration layer for running AST scripts.

This module handles the execution flow, choosing between sequential and parallel
execution modes, setting up contexts, and managing persistence.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import uuid4

import structlog

from ...db import get_dynamodb_client
from .base import ASTResult, ASTStatus
from .executor import ExecutionContext, ParallelExecutor, SequentialExecutor
from .persistence import ASTPersistence

if TYPE_CHECKING:
    from ...services.tn3270.host import Host
    from .base import AST

log = structlog.get_logger()


def run_ast(
    ast: "AST",
    host: "Host | None" = None,
    execution_id: str | None = None,
    parallel: bool = False,
    **kwargs: Any,
) -> ASTResult:
    """
    Run an AST script.

    Automatically chooses sequential or parallel execution based on:
    1. Whether the AST supports parallel (supports_parallel=True)
    2. Whether parallel was requested (parallel=True)

    Args:
        ast: The AST instance to run
        host: The Host automation interface (required for sequential, None for parallel)
        execution_id: Optional execution ID (generated if not provided)
        parallel: Whether to use parallel execution (default: False)
        **kwargs: Additional parameters for the AST
            - username: Required - TSO username
            - password: Required - TSO password
            - policyNumbers or items: List of items to process
            - userId: App user ID (default: anonymous)
            - sessionId: Session ID for persistence
            - maxSessions: Max ATI sessions for parallel (default: 5)
            - hostAddress: TN3270 host for parallel mode
            - hostPort: TN3270 port for parallel mode
            - secure: Use TLS for parallel mode (default: False)

    Returns:
        ASTResult with execution status and data
    """
    # Extract parallel from kwargs if not passed directly
    # This handles the case where params dict is spread into kwargs
    use_parallel = parallel or kwargs.pop("parallel", False)

    if use_parallel and ast.supports_parallel:
        return _run_parallel(ast, execution_id, **kwargs)

    if use_parallel and not ast.supports_parallel:
        log.warning(
            f"Parallel execution requested but not supported by {ast.name}",
            ast=ast.name,
        )

    return _run_sequential(ast, host, execution_id, **kwargs)


def _run_sequential(
    ast: "AST",
    host: "Host | None",
    execution_id: str | None = None,
    **kwargs: Any,
) -> ASTResult:
    """Run the AST sequentially using existing host session."""
    if host is None:
        return ASTResult(
            status=ASTStatus.FAILED,
            started_at=datetime.now(),
            completed_at=datetime.now(),
            message="Host session required for sequential execution",
            error="ValidationError: host cannot be None for sequential mode",
        )

    ast._execution_id = execution_id or str(uuid4())
    log.info(
        f"Starting AST (sequential): {ast.name}",
        ast=ast.name,
        execution_id=ast._execution_id,
    )

    username = kwargs.get("username")
    password = kwargs.get("password")
    raw_items = ast.prepare_items(**kwargs)
    app_user_id = kwargs.get("userId", "anonymous")
    ast._session_id = kwargs.get("sessionId", ast._execution_id)

    if not username or not password:
        return ASTResult(
            status=ASTStatus.FAILED,
            started_at=datetime.now(),
            completed_at=datetime.now(),
            message="Missing required parameters: username and password are required",
            error="ValidationError: username and password must be provided",
        )

    persistence = ASTPersistence(get_dynamodb_client())
    context = ExecutionContext(
        ast=ast,
        username=username,
        password=password,
        user_id=app_user_id,
        session_id=ast._session_id,
        execution_id=ast._execution_id,
        items=raw_items,
        persistence=persistence,
    )

    executor = SequentialExecutor()
    result = executor.execute(host, context)

    ast._result = result
    return result


def _run_parallel(
    ast: "AST",
    execution_id: str | None = None,
    **kwargs: Any,
) -> ASTResult:
    """Run the AST in parallel using independent ATI sessions."""
    ast._execution_id = execution_id or str(uuid4())
    log.info(
        f"Starting AST (parallel): {ast.name}",
        ast=ast.name,
        execution_id=ast._execution_id,
    )

    max_sessions = kwargs.get("maxSessions", 5)
    host_address = kwargs.get("hostAddress", "localhost")
    host_port = kwargs.get("hostPort", 3270)
    secure = kwargs.get("secure", False)

    log.info(
        f"Starting AST (parallel): {ast.name}",
        ast=ast.name,
        execution_id=ast._execution_id,
        max_sessions=max_sessions,
        host=host_address,
    )

    username = kwargs.get("username")
    password = kwargs.get("password")
    raw_items = ast.prepare_items(**kwargs)
    app_user_id = kwargs.get("userId", "anonymous")
    ast._session_id = kwargs.get("sessionId", ast._execution_id)

    if not username or not password:
        return ASTResult(
            status=ASTStatus.FAILED,
            started_at=datetime.now(),
            completed_at=datetime.now(),
            message="Missing required parameters: username and password are required",
            error="ValidationError: username and password must be provided",
        )

    persistence = ASTPersistence(get_dynamodb_client())
    context = ExecutionContext(
        ast=ast,
        username=username,
        password=password,
        user_id=app_user_id,
        session_id=ast._session_id,
        execution_id=ast._execution_id,
        items=raw_items,
        persistence=persistence,
        host_config={
            "host": host_address,
            "port": host_port,
            "secure": secure,
        },
    )

    executor = ParallelExecutor(
        max_sessions=max_sessions,
        host=host_address,
        port=host_port,
        secure=secure,
    )

    try:
        result = executor.execute(None, context)
    finally:
        executor.shutdown()

    ast._result = result
    return result
