"""CLI helpers exposed via `uv run` entry points."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Final

import pytest

PROJECT_ROOT: Final = Path(__file__).resolve().parents[1]
TESTS_DIR: Final = PROJECT_ROOT / "tests"
SRC_DIR: Final = PROJECT_ROOT / "src"


def run_tests() -> None:
    """Execute the test suite using pytest."""
    sys.exit(pytest.main([str(TESTS_DIR), "-v"]))


def run_coverage() -> None:
    """Execute the suite while collecting coverage data."""
    sys.exit(
        pytest.main(
            [
                str(TESTS_DIR),
                "-v",
                f"--cov={SRC_DIR}",
                "--cov-report=html",
                "--cov-report=term-missing",
            ]
        )
    )


def run_format() -> None:
    """Format all Python files using ruff."""
    import subprocess

    sys.exit(subprocess.call(["ruff", "format", str(PROJECT_ROOT)]))


def run_lint() -> None:
    """Lint all Python files using ruff."""
    import subprocess

    sys.exit(subprocess.call(["ruff", "check", str(PROJECT_ROOT)]))
