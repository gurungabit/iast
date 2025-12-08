"""Tests for the gateway application entrypoints."""

from __future__ import annotations

import asyncio
import gc
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

import src.app as app_module


class AppAsyncTests(unittest.IsolatedAsyncioTestCase):
    def tearDown(self) -> None:
        """Clean up any remaining coroutines after each test."""
        # Force garbage collection to clean up test artifacts
        gc.collect()
        super().tearDown()

    async def test_async_main_initializes_components(self) -> None:
        config = SimpleNamespace(
            valkey=SimpleNamespace(host="valkey", port=6379),
            tn3270=SimpleNamespace(host="host", port=23, max_sessions=2),
            dynamodb=SimpleNamespace(),
        )
        fake_valkey = SimpleNamespace(start_listening=AsyncMock())
        fake_manager = SimpleNamespace(start=AsyncMock())
        fake_loop = SimpleNamespace(add_signal_handler=lambda *args, **kwargs: None)

        with patch.object(app_module, "get_config", return_value=config), patch(
            "src.db.get_dynamodb_client"
        ) as mock_db, patch.object(
            app_module, "init_valkey_client", new=AsyncMock(return_value=fake_valkey)
        ) as mock_valkey, patch.object(
            app_module, "init_tn3270_manager", return_value=fake_manager
        ) as mock_manager, patch(
            "asyncio.get_running_loop", return_value=fake_loop
        ):
            task = asyncio.create_task(app_module.async_main())
            await asyncio.sleep(0)
            assert app_module._shutdown_event is not None
            app_module._shutdown_event.set()
            await task

        mock_db.assert_called_once_with(config.dynamodb)
        mock_valkey.assert_awaited_once()
        mock_manager.assert_called_once_with(config.tn3270, fake_valkey)
        fake_manager.start.assert_awaited_once()
        fake_valkey.start_listening.assert_awaited_once()
        app_module._shutdown_event = None

    async def test_shutdown_handles_manager_and_valkey(self) -> None:
        fake_manager = SimpleNamespace(destroy_all_sessions=AsyncMock())
        with patch("src.app.get_tn3270_manager", return_value=fake_manager, autospec=False), patch(
            "src.app.close_valkey_client", new=AsyncMock(), autospec=False
        ) as mock_close:
            app_module._shutdown_event = asyncio.Event()
            await app_module.shutdown()

        fake_manager.destroy_all_sessions.assert_awaited_once()
        mock_close.assert_awaited_once()
        assert app_module._shutdown_event is not None
        self.assertTrue(app_module._shutdown_event.is_set())
        app_module._shutdown_event = None

    def test_main_runs_async_main(self) -> None:
        def fake_run(coro):
            # Properly close the coroutine to avoid "never awaited" warning
            coro.close()

        with patch("asyncio.run", side_effect=fake_run) as mock_run:
            app_module.main()

        mock_run.assert_called_once()

    def test_main_handles_keyboard_interrupt(self) -> None:
        shutdown_called = False
        main_called = False

        async def fake_async_main():
            nonlocal main_called
            main_called = True
            # Simulate the function running but being interrupted

        async def fake_shutdown():
            nonlocal shutdown_called
            shutdown_called = True

        original_run = asyncio.run

        def fake_run(coro):
            if not hasattr(fake_run, "times"):
                fake_run.times = 0  # type: ignore[attr-defined]
            fake_run.times += 1  # type: ignore[attr-defined]
            if fake_run.times == 1:
                # First call: run the coroutine then raise KeyboardInterrupt
                result = original_run(coro)
                raise KeyboardInterrupt
            # Second call: run shutdown normally
            return original_run(coro)

        with patch.object(app_module, "async_main", new=fake_async_main), patch.object(
            app_module, "shutdown", new=fake_shutdown
        ), patch("asyncio.run", side_effect=fake_run) as mock_run:
            app_module.main()

        self.assertEqual(mock_run.call_count, 2)
        self.assertTrue(main_called)
        self.assertTrue(shutdown_called)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()

