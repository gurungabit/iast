# ============================================================================
# PTY Manager
# ============================================================================

import asyncio
import fcntl
import os
import pty
import select
import signal
import struct
import termios
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

import structlog

from ..core import ErrorCodes, PTYConfig, TerminalError
from ..models import (
    DataMessage,
    ResizeMessage,
    SessionCreateMessage,
    SessionDestroyMessage,
    create_data_message,
    create_error_message,
    create_session_created_message,
    create_session_destroyed_message,
    parse_message,
    serialize_message,
)

if TYPE_CHECKING:
    from .valkey import ValkeyClient

log = structlog.get_logger()


@dataclass
class PTYSession:
    """A PTY session."""

    session_id: str
    pid: int
    fd: int
    shell: str
    cols: int
    rows: int
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    _read_task: asyncio.Task[None] | None = field(default=None, repr=False)


class PTYManager:
    """Manages PTY sessions."""

    def __init__(self, config: PTYConfig, valkey: "ValkeyClient") -> None:
        self._config = config
        self._valkey = valkey
        self._sessions: dict[str, PTYSession] = {}

    async def start(self) -> None:
        """Start the PTY manager and subscribe to gateway control channel."""
        await self._valkey.subscribe_to_gateway_control(self._handle_gateway_control)
        await self._valkey.start_listening()
        log.info("PTY Manager started, listening for session requests")

    @property
    def session_count(self) -> int:
        """Get the number of active sessions."""
        return len(self._sessions)

    def get_session(self, session_id: str) -> PTYSession | None:
        """Get a session by ID."""
        return self._sessions.get(session_id)

    async def create_session(
        self,
        session_id: str,
        shell: str | None = None,
        cols: int | None = None,
        rows: int | None = None,
    ) -> PTYSession:
        """Create a new PTY session, or return existing one if already exists."""
        # If session already exists, just send a session.created message and return it
        existing = self._sessions.get(session_id)
        if existing:
            log.info("Reusing existing PTY session", session_id=session_id)
            # Send session created message so the client knows it's connected
            msg = create_session_created_message(
                session_id, existing.shell, existing.pid
            )
            await self._valkey.publish_output(session_id, serialize_message(msg))
            return existing

        if len(self._sessions) >= self._config.max_sessions:
            raise TerminalError(
                ErrorCodes.SESSION_LIMIT_REACHED, "Maximum sessions reached"
            )

        shell = shell or self._config.shell
        cols = cols or self._config.cols
        rows = rows or self._config.rows

        try:
            # Fork PTY
            pid, fd = pty.fork()

            if pid == 0:
                # Child process - exec shell
                os.environ["TERM"] = "xterm-256color"
                os.environ["SHELL"] = shell
                # Use -l for login shell to get proper init
                os.execvp(shell, [shell, "-l"])
            else:
                # Parent process
                # Set non-blocking
                flags = fcntl.fcntl(fd, fcntl.F_GETFL)
                fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

                # Set window size
                self._set_window_size(fd, cols, rows)

                session = PTYSession(
                    session_id=session_id,
                    pid=pid,
                    fd=fd,
                    shell=shell,
                    cols=cols,
                    rows=rows,
                )

                self._sessions[session_id] = session

                # Subscribe to input/control channels
                # Use default argument to capture session_id by value
                sid = session_id
                await self._valkey.subscribe_to_input(
                    session_id, lambda data, s=sid: self._handle_input(s, data)
                )
                await self._valkey.subscribe_to_control(
                    session_id, lambda data, s=sid: self._handle_control(s, data)
                )

                # Start reading output
                session._read_task = asyncio.create_task(self._read_output(session))

                log.info(
                    "Created PTY session",
                    session_id=session_id,
                    pid=pid,
                    shell=shell,
                    cols=cols,
                    rows=rows,
                )

                # Send session created message
                msg = create_session_created_message(session_id, shell, pid)
                await self._valkey.publish_output(session_id, serialize_message(msg))

                return session

        except OSError as e:
            log.exception("Failed to spawn PTY", session_id=session_id)
            raise TerminalError(ErrorCodes.PTY_SPAWN_FAILED, str(e)) from e

    async def destroy_session(self, session_id: str, reason: str = "closed") -> None:
        """Destroy a PTY session."""
        session = self._sessions.pop(session_id, None)
        if not session:
            return

        # Cancel read task
        if session._read_task:
            session._read_task.cancel()
            try:
                await session._read_task
            except asyncio.CancelledError:
                pass

        # Unsubscribe from channels
        await self._valkey.unsubscribe_session(session_id)

        # Terminate the process
        try:
            os.kill(session.pid, signal.SIGTERM)
            # Give it a moment to terminate gracefully
            await asyncio.sleep(0.1)
            try:
                os.kill(session.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        except ProcessLookupError:
            pass

        # Close file descriptor
        try:
            os.close(session.fd)
        except OSError:
            pass

        log.info("Destroyed PTY session", session_id=session_id, reason=reason)

        # Send session destroyed message
        msg = create_session_destroyed_message(session_id, reason)
        await self._valkey.publish_output(session_id, serialize_message(msg))

    async def resize_session(self, session_id: str, cols: int, rows: int) -> None:
        """Resize a PTY session."""
        session = self._sessions.get(session_id)
        if not session:
            raise TerminalError(ErrorCodes.PTY_NOT_FOUND, "PTY session not found")

        try:
            self._set_window_size(session.fd, cols, rows)
            session.cols = cols
            session.rows = rows
            session.last_activity = datetime.now()
            log.debug("Resized PTY", session_id=session_id, cols=cols, rows=rows)
        except OSError as e:
            raise TerminalError(ErrorCodes.PTY_RESIZE_FAILED, str(e)) from e

    async def write_to_session(self, session_id: str, data: str) -> None:
        """Write data to a PTY session."""
        session = self._sessions.get(session_id)
        if not session:
            raise TerminalError(ErrorCodes.PTY_NOT_FOUND, "PTY session not found")

        try:
            os.write(session.fd, data.encode("utf-8"))
            session.last_activity = datetime.now()
        except OSError as e:
            raise TerminalError(ErrorCodes.PTY_WRITE_FAILED, str(e)) from e

    async def destroy_all_sessions(self) -> None:
        """Destroy all PTY sessions."""
        session_ids = list(self._sessions.keys())
        for session_id in session_ids:
            await self.destroy_session(session_id, "shutdown")

    def _set_window_size(self, fd: int, cols: int, rows: int) -> None:
        """Set the window size of a PTY."""
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

    async def _read_output(self, session: PTYSession) -> None:
        """Read output from PTY and publish to Valkey."""
        loop = asyncio.get_event_loop()

        while True:
            try:
                # Wait for data to be available
                ready = await loop.run_in_executor(
                    None, self._wait_for_data, session.fd
                )

                if not ready:
                    # Timeout, check if process is still running
                    try:
                        pid, status = os.waitpid(session.pid, os.WNOHANG)
                        if pid != 0:
                            # Process has exited
                            log.debug(
                                "Process exited",
                                session_id=session.session_id,
                                pid=pid,
                                status=status,
                            )
                            break
                    except ChildProcessError:
                        # Process already reaped
                        break
                    continue

                # Read available data
                try:
                    data = os.read(session.fd, 4096)
                    if not data:
                        # EOF - process terminated
                        log.debug("Got EOF from PTY", session_id=session.session_id)
                        break

                    # Publish output
                    msg = create_data_message(
                        session.session_id, data.decode("utf-8", errors="replace")
                    )
                    await self._valkey.publish_output(
                        session.session_id, serialize_message(msg)
                    )
                    session.last_activity = datetime.now()

                except OSError as e:
                    log.debug(
                        "OSError reading from PTY",
                        session_id=session.session_id,
                        error=str(e),
                    )
                    break

            except asyncio.CancelledError:
                break
            except Exception:
                log.exception("Read output error", session_id=session.session_id)
                break

        # Session ended - clean up
        await self.destroy_session(session.session_id, "process_exited")

    def _wait_for_data(self, fd: int) -> bool:
        """Wait for data to be available on fd (blocking, run in executor).
        Returns True if data is available, False on timeout.
        """
        ready, _, _ = select.select([fd], [], [], 1.0)
        return len(ready) > 0

    async def _handle_input(self, session_id: str, raw_data: str) -> None:
        """Handle input from Valkey."""
        try:
            msg = parse_message(raw_data)
            if isinstance(msg, DataMessage):
                await self.write_to_session(session_id, msg.payload)
        except Exception:
            log.exception("Handle input error", session_id=session_id)

    async def _handle_control(self, session_id: str, raw_data: str) -> None:
        """Handle control messages from Valkey."""
        try:
            msg = parse_message(raw_data)

            if isinstance(msg, ResizeMessage):
                await self.resize_session(session_id, msg.meta.cols, msg.meta.rows)
            elif isinstance(msg, SessionDestroyMessage):
                await self.destroy_session(session_id, "user_requested")

        except TerminalError as e:
            error_msg = create_error_message(session_id, e.code, e.message)
            await self._valkey.publish_output(session_id, serialize_message(error_msg))
        except Exception:
            log.exception("Handle control error", session_id=session_id)

    async def _handle_gateway_control(self, raw_data: str) -> None:
        """Handle global gateway control messages (session creation)."""
        try:
            msg = parse_message(raw_data)

            if isinstance(msg, SessionCreateMessage):
                meta = msg.meta
                await self.create_session(
                    msg.session_id,
                    shell=meta.shell if meta else None,
                    cols=meta.cols if meta else None,
                    rows=meta.rows if meta else None,
                )

        except TerminalError as e:
            # Try to extract session_id from the message for error response
            try:
                parsed = parse_message(raw_data)
                if hasattr(parsed, "session_id"):
                    error_msg = create_error_message(
                        parsed.session_id, e.code, e.message
                    )
                    await self._valkey.publish_output(
                        parsed.session_id, serialize_message(error_msg)
                    )
            except Exception:
                pass
            log.warning("Gateway control error", error=str(e))
        except Exception:
            log.exception("Handle gateway control error")


# Singleton instance
_manager: PTYManager | None = None


def get_pty_manager() -> PTYManager:
    """Get the singleton PTY manager."""
    if _manager is None:
        raise RuntimeError("PTY manager not initialized")
    return _manager


def init_pty_manager(config: PTYConfig, valkey: "ValkeyClient") -> PTYManager:
    """Initialize and return the PTY manager."""
    global _manager
    _manager = PTYManager(config, valkey)
    return _manager
