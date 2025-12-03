# ============================================================================
# Terminal Gateway Package
# ============================================================================

from .app import main
from .channels import (
    GATEWAY_CONTROL_CHANNEL,
    get_pty_control_channel,
    get_pty_input_channel,
    get_pty_output_channel,
)
from .config import Config, PTYConfig, ValkeyConfig, get_config
from .errors import ErrorCodes, TerminalError
from .models import (
    DataMessage,
    ErrorMessage,
    MessageEnvelope,
    MessageType,
    PingMessage,
    PongMessage,
    ResizeMessage,
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
from .pty_manager import PTYManager, PTYSession, get_pty_manager, init_pty_manager
from .valkey_client import (
    ValkeyClient,
    close_valkey_client,
    get_valkey_client,
    init_valkey_client,
)

__all__ = [
    # App
    "main",
    # Channels
    "get_pty_input_channel",
    "get_pty_output_channel",
    "get_pty_control_channel",
    "GATEWAY_CONTROL_CHANNEL",
    # Config
    "Config",
    "ValkeyConfig",
    "PTYConfig",
    "get_config",
    # Errors
    "ErrorCodes",
    "TerminalError",
    # Models
    "MessageType",
    "DataMessage",
    "ResizeMessage",
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
    # PTY Manager
    "PTYManager",
    "PTYSession",
    "get_pty_manager",
    "init_pty_manager",
    # Valkey Client
    "ValkeyClient",
    "get_valkey_client",
    "init_valkey_client",
    "close_valkey_client",
]
