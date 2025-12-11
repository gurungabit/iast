"""Tests for the CLI entry points."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from src import cli


class CliTests(unittest.TestCase):
    """Ensure CLI helpers orchestrate pytest execution correctly."""

    def test_run_tests_invokes_pytest(self) -> None:
        with (
            patch("src.cli.pytest.main", return_value=0) as pytest_main,
            patch("src.cli.sys.exit") as sys_exit,
        ):
            cli.run_tests()

        pytest_main.assert_called_once_with([str(cli.TESTS_DIR), "-v"])
        sys_exit.assert_called_once_with(0)

    def test_run_coverage_invokes_pytest_with_cov_options(self) -> None:
        with (
            patch("src.cli.pytest.main", return_value=0) as pytest_main,
            patch("src.cli.sys.exit") as sys_exit,
        ):
            cli.run_coverage()

        pytest_main.assert_called_once_with(
            [
                str(cli.TESTS_DIR),
                "-v",
                f"--cov={cli.SRC_DIR}",
                "--cov-report=html",
                "--cov-report=term-missing",
            ]
        )
        sys_exit.assert_called_once_with(0)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
