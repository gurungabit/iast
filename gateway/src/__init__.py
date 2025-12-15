# ============================================================================
# Terminal Gateway Package
# ============================================================================
"""
TN3270 Gateway for terminal sessions.

Structure:
    src/
    ├── core/           # Configuration, errors
    ├── models/         # Pydantic message models
    ├── services/       # WebSocket server, TN3270 manager
    └── app.py          # Application entry point
"""

from .core import (
    Config,
    ErrorCodes,
    TerminalError,
    TN3270Config,
    get_config,
)
from .models import (
    DataMessage,
    ErrorMessage,
    MessageEnvelope,
    MessageType,
    PingMessage,
    PongMessage,
    SessionCreatedMessage,
    SessionCreateMessage,
    SessionDestroyedMessage,
    SessionDestroyMessage,
    create_data_message,
    create_error_message,
    create_session_created_message,
    create_session_destroyed_message,
    parse_message,
    serialize_message,
)
from .services import (
    TN3270Manager,
    TN3270Renderer,
    TN3270Session,
    WebSocketServer,
    close_ws_server,
    get_tn3270_manager,
    get_ws_server,
    init_tn3270_manager,
    init_ws_server,
)

__all__ = [
    # App
    # Config
    "Config",
    "TN3270Config",
    "get_config",
    # Errors
    "ErrorCodes",
    "TerminalError",
    # Models
    "MessageType",
    "DataMessage",
    "PingMessage",
    "PongMessage",
    "ErrorMessage",
    "SessionCreateMessage",
    "SessionDestroyMessage",
    "SessionCreatedMessage",
    "SessionDestroyedMessage",
    "MessageEnvelope",
    "parse_message",
    "serialize_message",
    "create_data_message",
    "create_error_message",
    "create_session_created_message",
    "create_session_destroyed_message",
    # TN3270 Manager
    "TN3270Manager",
    "TN3270Session",
    "TN3270Renderer",
    "get_tn3270_manager",
    "init_tn3270_manager",
    # WebSocket Server
    "WebSocketServer",
    "get_ws_server",
    "init_ws_server",
    "close_ws_server",
]
