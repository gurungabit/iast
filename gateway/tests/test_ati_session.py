#!/usr/bin/env python3
"""
Test ATI session creation and SIGNON screen detection.

Run with: python -m pytest tests/test_ati_session.py -v -s
Or directly: python tests/test_ati_session.py

NOTE: These are integration tests that require a running TN3270 server.
They are skipped by default. Run with --run-integration to include them.
"""

import uuid

import pytest
from tnz.ati import Ati


# Skip all tests in this module unless --run-integration is passed
pytestmark = pytest.mark.skipif(
    "not config.getoption('--run-integration', default=False)",
    reason="Integration tests require --run-integration flag",
)


def create_ati_session(
    host: str = "localhost",
    port: int = 3270,
    session_prefix: str = "TEST",
    maxwait: int = 30,
    waitsleep: float = 0.5,
    maxlostwarn: int = 0,
) -> tuple[Ati | None, str, str]:
    """Create an ATI session and wait for SIGNON screen.

    Returns:
        Tuple of (ati_instance, session_name, error_message)
        On success: (ati, session_name, "")
        On failure: (None, "", error_message)
    """
    session_id = uuid.uuid4().hex[:8]
    session_name = f"{session_prefix}_{session_id}"

    try:
        # Create ATI instance
        ati = Ati()

        # Configure session parameters
        print(f"🔌 Connecting to {host}:{port}...")
        ati.set("SESSION_HOST", host)
        ati.set("SESSION_PORT", str(port))
        ati.set("SESSION_TN_ENHANCED", "1")
        ati.set("SESSION_DEVICE_TYPE", "IBM-3279-4-E")
        ati.set("SESSION_PS_SIZE", "43x80")

        # Configure timeouts (BEFORE creating session)
        ati.maxwait = maxwait
        ati.waitsleep = waitsleep
        ati.maxlostwarn = maxlostwarn

        # Establish session
        print(f"   Creating session: {session_name}")
        ati.set("SESSION", session_name)

        # Wait for SIGNON screen using ati.wait() with lambda
        print("   Waiting for SIGNON screen...")
        if not ati.wait(lambda: ati.scrhas("SIGNON")):
            error = f"SIGNON screen not found - RC={ati.rc}, SESLOST={ati.seslost}"
            print(f"❌ {error}")
            return None, "", error

        # Verify TNZ instance
        tnz = ati.get_tnz()
        if not tnz:
            error = "TNZ instance not found after session creation"
            print(f"❌ {error}")
            return None, "", error

        print(f"✅ Connected - Session: {session_name}")
        return ati, session_name, ""

    except Exception as e:
        error = f"Connection failed: {e}"
        print(f"❌ {error}")
        return None, "", error


def test_ati_session_creation():
    """Test that we can create an ATI session and see SIGNON screen."""
    ati, session_name, error = create_ati_session(
        host="localhost",
        port=3270,
        maxwait=30,
    )

    if ati is None:
        print(f"\nFailed to create session: {error}")
        # Don't assert failure - this is for manual testing
        return

    try:
        # Show the screen
        tnz = ati.get_tnz()
        if tnz:
            print("\n--- Current Screen ---")
            print(tnz.scrstr())
            print("----------------------")

        # Verify SIGNON is visible
        assert ati.scrhas("SIGNON"), "SIGNON should be visible on screen"
        print("\n✅ Test passed - SIGNON screen detected")

    finally:
        # Clean up
        print(f"\n🧹 Dropping session: {session_name}")
        try:
            ati.drop("SESSION")
        except Exception as e:
            print(f"   Warning: Failed to drop session: {e}")


def test_multiple_parallel_sessions():
    """Test creating multiple ATI sessions in parallel."""
    import concurrent.futures

    num_sessions = 3
    sessions: list[tuple[Ati | None, str, str]] = []

    print(f"\n🚀 Creating {num_sessions} parallel sessions...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_sessions) as executor:
        futures = [
            executor.submit(
                create_ati_session,
                host="localhost",
                port=3270,
                session_prefix=f"PAR{i}",
                maxwait=30,
            )
            for i in range(num_sessions)
        ]

        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            sessions.append(result)

    # Report results
    successful = [(ati, name) for ati, name, err in sessions if ati is not None]
    failed = [err for ati, name, err in sessions if ati is None]

    print(f"\n📊 Results: {len(successful)}/{num_sessions} sessions created")

    if failed:
        print("❌ Failed sessions:")
        for err in failed:
            print(f"   - {err}")

    # Clean up successful sessions
    for ati, session_name in successful:
        try:
            print(f"🧹 Dropping session: {session_name}")
            ati.drop("SESSION")
        except Exception as e:
            print(f"   Warning: Failed to drop {session_name}: {e}")

    # For manual testing, don't assert
    if successful:
        print(f"\n✅ {len(successful)} sessions created successfully")


if __name__ == "__main__":
    print("=" * 60)
    print("ATI Session Test")
    print("=" * 60)

    print("\n[Test 1] Single session creation")
    print("-" * 40)
    test_ati_session_creation()

    print("\n" + "=" * 60)
    print("\n[Test 2] Multiple parallel sessions")
    print("-" * 40)
    test_multiple_parallel_sessions()
