# ============================================================================
# Valkey Channel Helpers (matching @terminal/shared)
# ============================================================================


def get_pty_input_channel(session_id: str) -> str:
    """Get the input channel for a PTY session."""
    return f"pty.input.{session_id}"


def get_pty_output_channel(session_id: str) -> str:
    """Get the output channel for a PTY session."""
    return f"pty.output.{session_id}"


def get_pty_control_channel(session_id: str) -> str:
    """Get the control channel for a PTY session."""
    return f"pty.control.{session_id}"


# Control channel for all gateway instances
GATEWAY_CONTROL_CHANNEL = "gateway.control"
