"""Tests for the AST base infrastructure."""

from __future__ import annotations

import threading
import time
import unittest
from unittest.mock import MagicMock, patch

from datetime import datetime, timedelta

from src.ast import AST, ASTResult, ASTStatus, ItemResult, run_ast


class DummyHost:
    """Minimal host stub."""

    def get_formatted_screen(self, show_row_numbers=True):
        return "dummy screen"

    def show_screen(self, title):
        return f"screenshot:{title}"


class SampleAST(AST):
    name = "sample"

    def __init__(self) -> None:
        super().__init__()
        self.should_timeout = False
        self.should_fail = False
        self.executed_with: dict | None = None

    def logoff(self, host, target_screen_keywords=None):
        return True, "", []

    def process_single_item(self, host, item, index: int, total: int):
        if self.should_timeout:
            raise TimeoutError("took too long")
        if self.should_fail:
            raise RuntimeError("boom")
        return True, "", {"processed": item}

    def authenticate(
        self,
        host,
        user,
        password,
        expected_keywords_after_login,
        application="",
        group="",
    ):
        # Skip authentication for tests
        return True, "", []


class ASTBaseTests(unittest.TestCase):
    """Cover the behavior provided by AST base class."""

    def setUp(self) -> None:
        self.ast = SampleAST()
        self.host = DummyHost()
        self.progress_calls: list = []
        self.item_calls: list = []
        self.pause_calls: list = []
        self.ast.set_callbacks(
            on_progress=lambda *args: self.progress_calls.append(args),
            on_item_result=lambda *args: self.item_calls.append(args),
            on_pause_state=lambda *args: self.pause_calls.append(args),
        )

    def test_pause_resume_and_callbacks(self) -> None:
        self.assertFalse(self.ast.is_paused)
        self.ast.pause()
        self.assertTrue(self.ast.is_paused)
        self.assertTrue(any(call[0] is True for call in self.pause_calls))

        self.ast.resume()
        self.assertFalse(self.ast.is_paused)
        self.assertTrue(any(call[0] is False for call in self.pause_calls))

    def test_cancel_and_wait_if_paused(self) -> None:
        self.ast.pause()

        resume_timer = threading.Timer(0.05, self.ast.resume)
        resume_timer.start()
        self.assertTrue(self.ast.wait_if_paused(timeout=1))

        self.ast.cancel()
        self.assertTrue(self.ast.is_cancelled)
        self.assertFalse(self.ast.wait_if_paused(timeout=0.01))

    @patch("src.core.ast.runner.get_dynamodb_client")
    def test_run_success_sets_result(self, mock_db) -> None:
        mock_db.return_value = None  # No persistence for tests
        result = run_ast(
            self.ast,
            self.host,
            execution_id="exec-1",
            username="testuser",
            password="testpass",
            items=["item1"],
        )
        self.assertTrue(result.is_success)
        self.assertEqual(self.ast.execution_id, "exec-1")
        self.assertTrue(self.progress_calls)
        self.assertTrue(self.item_calls)

    @patch("src.core.ast.runner.get_dynamodb_client")
    def test_run_handles_timeout(self, mock_db) -> None:
        mock_db.return_value = None
        self.ast.should_timeout = True
        result = run_ast(
            self.ast,
            self.host,
            username="testuser",
            password="testpass",
            items=["item1"],
        )
        self.assertEqual(
            result.status, ASTStatus.SUCCESS
        )  # Execution completes but item fails
        # The item itself failed with the timeout
        self.assertEqual(len(result.item_results), 1)
        self.assertEqual(result.item_results[0].status, "failed")
        self.assertIn("took too long", result.item_results[0].error or "")

    @patch("src.core.ast.runner.get_dynamodb_client")
    def test_run_handles_generic_error(self, mock_db) -> None:
        mock_db.return_value = None
        self.ast.should_fail = True
        result = run_ast(
            self.ast,
            self.host,
            username="testuser",
            password="testpass",
            items=["item1"],
        )
        self.assertEqual(
            result.status, ASTStatus.SUCCESS
        )  # Execution completes but item fails
        self.assertEqual(len(result.item_results), 1)
        self.assertEqual(result.item_results[0].status, "failed")
        self.assertIn("boom", result.item_results[0].error or "")

    def test_ast_result_helpers_and_item_result(self) -> None:
        start = datetime.now()
        end = start + timedelta(seconds=2)
        result = ASTResult(
            status=ASTStatus.SUCCESS,
            started_at=start,
            completed_at=end,
            item_results=[
                ItemResult(
                    item_id="1",
                    status="success",
                    started_at=start,
                    completed_at=end,
                    duration_ms=10,
                    data={"k": "v"},
                )
            ],
        )

        self.assertAlmostEqual(result.duration, 2, delta=0.1)
        self.assertTrue(result.is_success)
        self.assertEqual(result.item_results[0].data["k"], "v")


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
