# ============================================================================
# Error Codes (matching @terminal/shared)
# ============================================================================


class ErrorCodes:
    """Error codes matching the TypeScript shared package."""

    # Authentication errors (E1xxx)
    AUTH_REQUIRED = "E1001"
    AUTH_INVALID_TOKEN = "E1002"
    AUTH_EXPIRED = "E1003"
    AUTH_INVALID_CREDENTIALS = "E1004"
    AUTH_USER_EXISTS = "E1005"
    AUTH_USER_NOT_FOUND = "E1006"

    # Session errors (E2xxx)
    SESSION_NOT_FOUND = "E2001"
    SESSION_LIMIT_REACHED = "E2002"
    SESSION_EXPIRED = "E2003"
    SESSION_INVALID = "E2004"

    # PTY errors (E3xxx)
    PTY_SPAWN_FAILED = "E3001"
    PTY_WRITE_FAILED = "E3002"
    PTY_READ_FAILED = "E3003"
    PTY_RESIZE_FAILED = "E3004"
    PTY_NOT_FOUND = "E3005"
    PTY_ALREADY_EXISTS = "E3006"

    # WebSocket errors (E4xxx)
    WS_CONNECTION_FAILED = "E4001"
    WS_MESSAGE_INVALID = "E4002"
    WS_CLOSED_ABNORMAL = "E4003"

    # Valkey errors (E5xxx)
    VALKEY_CONNECTION_FAILED = "E5001"
    VALKEY_PUBLISH_FAILED = "E5002"
    VALKEY_SUBSCRIBE_FAILED = "E5003"


class TerminalError(Exception):
    """Custom error with error code."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    def to_dict(self) -> dict[str, str]:
        """Convert to dictionary."""
        return {"code": self.code, "message": self.message}
