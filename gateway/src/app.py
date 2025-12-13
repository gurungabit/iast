# ============================================================================
# TN3270 Gateway Application - WebSocket Version
# ============================================================================

import asyncio
import signal

import structlog

from .core import get_config
from .services import (
    close_ws_server,
    get_tn3270_manager,
    get_ws_server,
    init_tn3270_manager,
    init_ws_server,
)

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer(pad_event_to=0, pad_level=False),
    ],
    wrapper_class=structlog.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()

_shutdown_event: asyncio.Event | None = None


async def shutdown(sig: signal.Signals | None = None) -> None:
    """Graceful shutdown handler."""
    if sig:
        log.info("Received shutdown signal", signal=sig.name)
    else:
        log.info("Shutting down")

    # Destroy all TN3270 sessions
    try:
        tn3270_manager = get_tn3270_manager()
        await tn3270_manager.destroy_all_sessions()
    except RuntimeError:
        pass

    # Close WebSocket server
    await close_ws_server()

    log.info("Shutdown complete")

    # Signal main loop to exit
    if _shutdown_event:
        _shutdown_event.set()


async def async_main() -> None:
    """Async main entry point."""
    global _shutdown_event
    _shutdown_event = asyncio.Event()

    config = get_config()

    log.info(
        "Starting TN3270 Gateway (WebSocket mode)",
        ws_port=8080,
        tn3270_host=config.tn3270.host,
        tn3270_port=config.tn3270.port,
        tn3270_max_sessions=config.tn3270.max_sessions,
    )

    # Initialize DynamoDB client (validates connection)
    from .db import get_dynamodb_client

    get_dynamodb_client(config.dynamodb)

    # Initialize WebSocket server
    ws_server = await init_ws_server(host="0.0.0.0", port=8080)

    # Create output sender function that sends via WebSocket
    async def send_output(session_id: str, message: str) -> None:
        """Send output to API via WebSocket."""
        await ws_server.send_to_session(session_id, message)

    # Initialize TN3270 manager with output sender
    tn3270_manager = init_tn3270_manager(config.tn3270, send_output)
    await tn3270_manager.start()

    # Set up WebSocket handlers
    async def on_message(session_id: str, message: str) -> None:
        """Handle incoming message from API."""
        await tn3270_manager.handle_message(session_id, message)

    async def on_session_closed(session_id: str) -> None:
        """Handle WebSocket connection closed."""
        log.info("WebSocket closed, destroying session", session_id=session_id)
        await tn3270_manager.destroy_session(session_id, "websocket_closed")

    ws_server.set_handlers(
        on_message=on_message,
        on_session_closed=on_session_closed,
    )

    # Start WebSocket server
    await ws_server.start()

    # Setup signal handlers
    loop = asyncio.get_running_loop()

    def handle_signal(sig: signal.Signals) -> None:
        asyncio.create_task(shutdown(sig))

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, handle_signal, sig)

    log.info("TN3270 Gateway ready, waiting for connections on port 8080...")

    # Keep running until shutdown
    await _shutdown_event.wait()


def main() -> None:
    """Main entry point."""
    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        # Run cleanup synchronously
        asyncio.run(shutdown())


if __name__ == "__main__":
    main()
