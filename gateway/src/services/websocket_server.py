# ============================================================================
# WebSocket Server for direct API communication
# ============================================================================
"""
WebSocket server for direct communication with API server.
Each WebSocket connection represents one terminal session.

The API server connects to this server and bridges browser
WebSocket connections to these gateway connections.
"""

import asyncio
import re
from collections.abc import Awaitable, Callable
from typing import Any

import structlog
import websockets
from websockets.server import WebSocketServerProtocol

from ..core import get_config

log = structlog.get_logger()

# Type for message handlers
MessageHandler = Callable[[str, str], Awaitable[None]]
SessionHandler = Callable[[str, WebSocketServerProtocol], Awaitable[None]]


class WebSocketServer:
    """WebSocket server for terminal gateway."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8080) -> None:
        self._host = host
        self._port = port
        self._server: websockets.WebSocketServer | None = None
        self._sessions: dict[str, WebSocketServerProtocol] = {}
        self._message_handler: MessageHandler | None = None
        self._session_created_handler: SessionHandler | None = None
        self._session_closed_handler: Callable[[str], Awaitable[None]] | None = None
        self._running = False

    def set_handlers(
        self,
        on_message: MessageHandler,
        on_session_created: SessionHandler | None = None,
        on_session_closed: Callable[[str], Awaitable[None]] | None = None,
    ) -> None:
        """Set message and session handlers."""
        self._message_handler = on_message
        self._session_created_handler = on_session_created
        self._session_closed_handler = on_session_closed

    async def start(self) -> None:
        """Start the WebSocket server."""
        self._running = True
        self._server = await websockets.serve(
            self._handle_connection,
            self._host,
            self._port,
        )
        log.info("WebSocket server started", host=self._host, port=self._port)

    async def stop(self) -> None:
        """Stop the WebSocket server."""
        self._running = False
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        log.info("WebSocket server stopped")

    async def send_to_session(self, session_id: str, message: str) -> bool:
        """Send a message to a specific session."""
        ws = self._sessions.get(session_id)
        if ws and ws.state.name == "OPEN":
            try:
                await ws.send(message)
                return True
            except Exception as e:
                log.error("Failed to send to session", session_id=session_id, error=str(e))
        return False

    def get_session_ws(self, session_id: str) -> WebSocketServerProtocol | None:
        """Get the WebSocket for a session."""
        return self._sessions.get(session_id)

    async def _handle_connection(
        self, websocket: WebSocketServerProtocol
    ) -> None:
        """Handle a new WebSocket connection."""
        # websockets v13+ removed path parameter - access via websocket.request.path
        path = websocket.request.path if hasattr(websocket, 'request') else websocket.path
        
        # Extract session ID from path: /session/<sessionId>
        match = re.match(r"/session/([a-zA-Z0-9-]+)", path)
        if not match:
            log.warning("Invalid WebSocket path", path=path)
            await websocket.close(4000, "Invalid path. Expected /session/<sessionId>")
            return

        session_id = match.group(1)
        log.info("WebSocket connection opened", session_id=session_id, path=path)

        # Register session
        self._sessions[session_id] = websocket

        # Notify session created
        if self._session_created_handler:
            try:
                await self._session_created_handler(session_id, websocket)
            except Exception:
                log.exception("Session created handler error", session_id=session_id)

        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    message = message.decode("utf-8")

                if self._message_handler:
                    try:
                        await self._message_handler(session_id, message)
                    except Exception:
                        log.exception("Message handler error", session_id=session_id)

        except websockets.ConnectionClosed:
            log.info("WebSocket connection closed", session_id=session_id)
        except Exception:
            log.exception("WebSocket error", session_id=session_id)
        finally:
            # Unregister session
            self._sessions.pop(session_id, None)

            # Notify session closed
            if self._session_closed_handler:
                try:
                    await self._session_closed_handler(session_id)
                except Exception:
                    log.exception("Session closed handler error", session_id=session_id)


# Singleton instance
_server: WebSocketServer | None = None


def get_ws_server() -> WebSocketServer:
    """Get the singleton WebSocket server."""
    if _server is None:
        raise RuntimeError("WebSocket server not initialized")
    return _server


async def init_ws_server(host: str = "0.0.0.0", port: int = 8080) -> WebSocketServer:
    """Initialize and start the WebSocket server."""
    global _server
    _server = WebSocketServer(host, port)
    return _server


async def close_ws_server() -> None:
    """Stop and close the WebSocket server."""
    global _server
    if _server:
        await _server.stop()
        _server = None
