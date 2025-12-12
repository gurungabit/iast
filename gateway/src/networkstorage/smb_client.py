"""SMB Client module for file operations."""

import time
from pathlib import Path

from smbclient import open_file, register_session

from .file_paths import build_file_path


class SMBClient:
    """SMB Client for interacting with SMB shares."""

    def __init__(self, server: str, username: str, password: str) -> None:
        """
        Initialize SMB Client.

        Args:
            server: SMB server hostname
            username: Username for authentication
            password: Password for authentication
        """
        self.server = server
        self.username = username
        self.password = password
        self._session_registered = False

    def _ensure_session(self) -> None:
        """Ensure SMB session is registered."""
        if not self._session_registered:
            register_session(
                self.server, username=self.username, password=self.password
            )
            self._session_registered = True

    def download_file(
        self,
        remote_path: str,
        local_path: str,
        max_retries: int = 3,
        retry_delay: float = 2.0,
    ) -> None:
        """
        Download a file from SMB share with retry logic for locked files.

        Args:
            remote_path: Full UNC path to remote file
            local_path: Local path to save file
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds

        Raises:
            RuntimeError: If file is locked after max retries
            Exception: For other errors
        """
        self._ensure_session()

        print(f"Downloading {remote_path}...")

        for attempt in range(max_retries):
            try:
                with open_file(
                    remote_path,
                    mode="rb",
                    username=self.username,
                    password=self.password,
                ) as remote, open(local_path, "wb") as local:
                    # Copy with progress logging for large files
                    chunk_size = 1024 * 1024  # 1MB chunks
                    bytes_written = 0
                    while True:
                        chunk = remote.read(chunk_size)
                        if not chunk:
                            break
                        local.write(chunk)
                        bytes_written += len(chunk)
                        if (
                            bytes_written % (10 * 1024 * 1024) == 0
                        ):  # Log every 10MB
                            print(
                                f"  Downloaded {bytes_written / (1024*1024):.1f} MB..."
                            )

                print(
                    f"Downloaded {bytes_written / (1024*1024):.1f} MB to {local_path}"
                )
                return

            except Exception as e:
                if "being used by another process" in str(e) or "0xc0000043" in str(e):
                    if attempt < max_retries - 1:
                        print(
                            f"File is locked, retrying in {retry_delay}s... "
                            f"(attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(retry_delay)
                    else:
                        raise RuntimeError(
                            f"File is locked after {max_retries} attempts. "
                            "Please close the file on the server or try again later."
                        ) from e
                else:
                    raise

    def download_by_office(
        self,
        office_code: str,
        department: str,
        filename: str,
        local_path: str | None = None,
        max_retries: int = 3,
        retry_delay: float = 2.0,
    ) -> str:
        """
        Download a file using office code, department, and filename.

        Args:
            office_code: Office code (e.g., "01", "02")
            department: Department name ("FIRE" or "AUTO")
            filename: Name of the file to download
            local_path: Local path to save file (defaults to filename)
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds

        Returns:
            Path to downloaded local file

        Raises:
            ValueError: If office code not found or invalid department
            RuntimeError: If file is locked after max retries
        """
        # Build remote path
        remote_path = build_file_path(office_code, department, filename)

        # Use filename as local path if not specified
        if local_path is None:
            local_path = filename

        # Download the file
        self.download_file(remote_path, local_path, max_retries, retry_delay)

        return local_path

    def download_if_not_exists(
        self,
        remote_path: str,
        local_path: str,
        max_retries: int = 3,
        retry_delay: float = 2.0,
    ) -> bool:
        """
        Download file only if it doesn't exist locally.

        Args:
            remote_path: Full UNC path to remote file
            local_path: Local path to save file
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds

        Returns:
            True if file was downloaded, False if it already existed
        """
        if Path(local_path).exists():
            print(f"Using existing local file: {local_path}")
            return False

        self.download_file(remote_path, local_path, max_retries, retry_delay)
        return True


def download_if_not_exists(
    server: str,
    username: str,
    password: str,
    remote_path: str,
    local_path: str,
    max_retries: int = 3,
    retry_delay: float = 2.0,
) -> str:
    """
    Standalone function to download a file from SMB share with retry logic.
    Validates file exists after download and returns the path.

    Args:
        server: SMB server hostname
        username: Username for authentication
        password: Password for authentication
        remote_path: Full UNC path to remote file
        local_path: Local path to save file
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds

    Returns:
        Path to the downloaded file

    Raises:
        FileNotFoundError: If file doesn't exist after download
        RuntimeError: If file is locked after max retries
        Exception: For other errors
    """
    client = SMBClient(server, username, password)
    client.download_if_not_exists(remote_path, local_path, max_retries, retry_delay)

    # Validate file exists
    if not Path(local_path).exists():
        raise FileNotFoundError(f"File was not successfully downloaded: {local_path}")

    return local_path
