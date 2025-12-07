"""Tests for tn3270 renderer and host helpers."""

from __future__ import annotations

import unittest

from src.services.tn3270.host import Host
from src.services.tn3270.renderer import TN3270Renderer


class _DummyCodec:
    """Simple codec stub that decodes ASCII bytes."""

    def decode(self, data: bytes) -> tuple[str, int]:
        decoded = data.decode("ascii", errors="ignore")
        return decoded, len(decoded)


class _FakeTnz:
    """Lightweight tnz session stub for unit tests."""

    def __init__(
        self,
        rows: int = 1,
        cols: int = 8,
        text: str = " ID: USR",
        attrs: dict[int, int] | None = None,
    ) -> None:
        self.maxrow = rows
        self.maxcol = cols
        self._size = rows * cols
        padded_text = text.ljust(self._size)
        self.plane_dc = [ord(ch) for ch in padded_text[: self._size]]
        self.plane_fa = [0] * self._size
        if attrs:
            for addr, value in attrs.items():
                self.plane_fa[addr % self._size] = value
                self.plane_dc[addr % self._size] = 0
        self.plane_fg = [0] * self._size
        self.plane_bg = [0] * self._size
        self.plane_eh = [0] * self._size
        self.codec_info = {0: _DummyCodec()}
        self.curadd = 1
        self.pwait = 0
        self.updated = 1
        self.commands: list[tuple[str, str | None]] = []

    # ------------------------------------------------------------------
    # Basic tnz operations used by Host/TN3270Renderer
    # ------------------------------------------------------------------
    def scrstr(self, start: int, end: int) -> str:
        start = max(0, start)
        end = min(self._size, end)
        chars = []
        for idx in range(start, end):
            val = self.plane_dc[idx]
            chars.append(chr(val) if val else " ")
        return "".join(chars)

    def set_cursor_position(self, row: int, col: int) -> None:
        # tnz uses 1-indexed coordinates
        self.curadd = (row - 1) * self.maxcol + (col - 1)

    def key_eraseeof(self) -> None:
        self.commands.append(("eraseeof", None))

    def key_data(self, value: str) -> None:
        self.commands.append(("data", value))

    def key_eraseinput(self, value: str | None) -> None:  # pragma: no cover - helper
        self.commands.append(("eraseinput", value))


def _build_test_session() -> _FakeTnz:
    # Field attribute bytes: protected label at 0, unprotected input at 4
    attrs = {
        0: 0x28,  # Protected + intensified
        4: 0x04,  # Unprotected, intensified
    }
    session = _FakeTnz(rows=1, cols=8, text=" ID: USR", attrs=attrs)
    session.curadd = 6  # Cursor inside unprotected field
    return session


class TN3270RendererTests(unittest.TestCase):
    """Validate screen rendering helpers."""

    def test_render_screen_with_fields_builds_metadata(self) -> None:
        session = _build_test_session()
        renderer = TN3270Renderer()

        screen = renderer.render_screen_with_fields(session)

        self.assertTrue(screen.ansi.startswith("\x1b[2J\x1b[H"))
        self.assertEqual(screen.cursor_col, session.curadd % session.maxcol)
        self.assertEqual(len(screen.fields), 2)
        self.assertTrue(screen.fields[0].protected)
        self.assertFalse(screen.fields[1].protected)
        self.assertEqual(screen.fields[1].length, 3)

    def test_is_position_protected_uses_field_map(self) -> None:
        session = _build_test_session()
        renderer = TN3270Renderer()

        self.assertTrue(renderer.is_position_protected(session, 0, 1))
        self.assertFalse(renderer.is_position_protected(session, 0, 6))


class HostTests(unittest.TestCase):
    """Exercise high-level tn3270 host helpers."""

    def test_get_fields_and_find_field_by_label(self) -> None:
        session = _build_test_session()
        host = Host(session)

        fields = host.get_fields()

        self.assertEqual(len(fields), 2)
        self.assertEqual(fields[0].value, "ID:")
        self.assertEqual(fields[1].value, "USR")

        input_field = host.find_field_by_label("ID")
        self.assertIsNotNone(input_field)
        assert input_field is not None
        self.assertFalse(input_field.protected)

    def test_fill_field_by_label_moves_cursor_and_types(self) -> None:
        session = _build_test_session()
        host = Host(session)

        filled = host.fill_field_by_label("ID", "NEW")

        self.assertTrue(filled)
        # Cursor should land at start of unprotected field (address 5)
        self.assertEqual(session.curadd, host.get_fields()[1].address)
        self.assertIn(("eraseeof", None), session.commands)
        self.assertIn(("data", "NEW"), session.commands)

    def test_get_formatted_screen_includes_row_numbers(self) -> None:
        session = _build_test_session()
        host = Host(session)

        formatted = host.get_formatted_screen()

        self.assertIn("01", formatted.splitlines()[0])
        self.assertIn("ID:", formatted)

    def test_snapshot_returns_structure(self) -> None:
        session = _build_test_session()
        host = Host(session)
        session.pwait = 1

        snap = host.snapshot()

        self.assertEqual(snap["rows"], 1)
        self.assertTrue(snap["keyboard_locked"])
        self.assertEqual(len(snap["fields"]), 2)


if __name__ == "__main__":
    unittest.main()
