"""This module handles SMB protocol interactions for file sharing and network communication."""

from .file_paths import (
    FILE_PATHS,
    build_file_path,
    get_path_by_office,
    get_path_by_zone,
    get_zone_by_office,
)
from .office_info import get_office_info
from .smb_client import SMBClient, download_if_not_exists

__all__ = [
    "SMBClient",
    "download_if_not_exists",
    "FILE_PATHS",
    "get_path_by_office",
    "get_path_by_zone",
    "get_zone_by_office",
    "build_file_path",
    "get_office_info",
]
