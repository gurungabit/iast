# ============================================================================
# Valkey Channel Helpers (matching @terminal/shared)
# ============================================================================

"""
Channel naming conventions:
- tn3270.control         - Global control channel for TN3270 session creation
- tn3270.input.<id>      - Input to TN3270 (keystrokes from user)
- tn3270.output.<id>     - Output from TN3270 (terminal output)
"""


def get_tn3270_input_channel(session_id: str) -> str:
    """Get the input channel for a TN3270 session."""
    return f"tn3270.input.{session_id}"


def get_tn3270_output_channel(session_id: str) -> str:
    """Get the output channel for a TN3270 session."""
    return f"tn3270.output.{session_id}"


# Control channel for TN3270 gateway instances
TN3270_CONTROL_CHANNEL = "tn3270.control"
