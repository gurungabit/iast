"""Module to parse office queue reports from SMB network storage."""

import re
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from app.networkstorage.office_info import get_office_info
from smbclient import open_file, register_session, scandir

from src.core.config import get_config


def parse_queue_report_from_content(content: str) -> pd.DataFrame:
    """
    Parse the queue report content and extract data into a DataFrame.

    Returns:
        DataFrame with columns: STATE_CODE, DIV, QUEUE, POLICY, UD, CDATE, CTIME, CASE
    """
    # Pre-compile regex for better performance
    st_div_pattern = re.compile(r"ST/DIV:\s*(\d+)")

    # Lists for columnar data (faster than list of dicts)
    state_codes = []
    divs = []
    queues = []
    policies = []
    uds = []
    cdates = []
    ctimes = []
    cases = []

    current_state = None
    current_div = None

    lines = content.split("\n")
    for line in lines:
        # Check for ST/DIV line (e.g., "ST/DIV: 131")
        if "ST/DIV:" in line:
            st_div_match = st_div_pattern.search(line)
            if st_div_match:
                div_code = st_div_match.group(1)
                current_state = div_code[:2] if len(div_code) >= 2 else div_code
                current_div = div_code[2:] if len(div_code) > 2 else ""
            continue

        # Check for data lines (starting with "4")
        if line and line[0] == "4" and current_state is not None:
            # Split the line by whitespace
            parts = line.split()

            if len(parts) >= 7:
                # Append to columnar lists
                state_codes.append(current_state)
                divs.append(current_div)
                queues.append(parts[1])
                policies.append(parts[2])
                uds.append(parts[3])
                cdates.append(parts[4])
                ctimes.append(parts[5])
                cases.append(parts[6])

    # Create DataFrame from columnar data (much faster)
    return pd.DataFrame(
        {
            "STATE_CODE": state_codes,
            "DIV": divs,
            "QUEUE": queues,
            "POLICY": policies,
            "UD": uds,
            "CDATE": cdates,
            "CTIME": ctimes,
            "CASE": cases,
        }
    )


def list_smb_files(
    server: str,
    username: str,
    password: str,
    remote_path: str,
    identifier: str,
    target_date: datetime,
) -> list[dict[str, object]]:
    """List files in SMB share matching the office identifier for a specific date."""
    register_session(server, username=username, password=password)

    matching_files = []
    # Format date as YYYYMMDD for filename matching
    date_str = target_date.strftime("%Y%m%d")
    print(f"Scanning {remote_path} for files matching '{identifier}' and date '{date_str}'...")

    try:
        for entry in scandir(remote_path, username=username, password=password):
            if (
                entry.is_file()
                and identifier in entry.name
                and "RW1AA271" in entry.name
                and date_str in entry.name
            ):
                # Get file modification time
                file_mtime = datetime.fromtimestamp(entry.stat().st_mtime)

                matching_files.append({"name": entry.name, "mtime": file_mtime})
                print(f"  Found: {entry.name} ({file_mtime.strftime('%Y-%m-%d %H:%M')})")
    except Exception as e:
        print(f"Error scanning directory: {e}")
        raise

    # Sort by modification time (newest first)
    matching_files.sort(key=lambda x: x["mtime"], reverse=True)

    return matching_files


def download_and_parse_smb_file(
    server: str, username: str, password: str, remote_path: str, filename: str
) -> pd.DataFrame:
    """Download and parse a single SMB file."""
    full_path = f"{remote_path}/{filename}"
    print(f"\nProcessing {filename}...")

    try:
        with open_file(full_path, mode="rb", username=username, password=password) as remote:
            content = remote.read().decode("latin-1")

        df = parse_queue_report_from_content(content)
        print(f"  Parsed {len(df)} records")
        return df

    except Exception as e:
        print(f"  Error processing {filename}: {e}")
        return pd.DataFrame()


def extract_date_from_filename(filename: str) -> str:
    """Extract date from filename like 'MRSH04.PREM.RW1AA271.20251125.txt' -> '2025_11_25'"""
    # Try to find 8-digit date pattern (YYYYMMDD)
    date_match = re.search(r"\.(\d{8})\.", filename)
    if date_match:
        date_str = date_match.group(1)
        return f"{date_str[:4]}_{date_str[4:6]}_{date_str[6:8]}"

    # Fallback to current date
    now = datetime.now()
    return f"{now.year}_{now.month:02d}_{now.day:02d}"


def get_office_report(office_code: str, target_date: datetime) -> pd.DataFrame:
    """
    Get queue report data for a specific office and date.

    Caches results in a pickle file. If the pickle already exists, loads and returns
    the cached data instead of fetching from network storage.

    Args:
        office_code: Office code (e.g., "04")
        target_date: Target date to fetch report for

    Returns:
        DataFrame with parsed queue report data including metadata columns
    """
    # Get office information
    office_info = get_office_info(office_code)
    if not office_info:
        print(f"Error: Office code '{office_code}' not found")
        return pd.DataFrame()

    # Extract needed information
    zone_ftp_name = office_info["zone"]["ftpName"]
    office_identifier = office_info["office"]["identifier"]
    office_name = office_info["office"]["name"]

    # Set up cache directory
    cache_dir = Path("cache") / office_code / zone_ftp_name
    cache_dir.mkdir(parents=True, exist_ok=True)

    date_str = target_date.strftime("%Y_%m_%d")
    cache_filename = f"{office_identifier}_RW1AA271_{date_str}.pkl"
    cache_path = cache_dir / cache_filename

    # Check if pickle cache exists
    if cache_path.exists():
        print(f"Loading from cache: {cache_path}")
        try:
            df = pd.read_pickle(cache_path)
            print(f"✓ Loaded {len(df)} records from cache")
            return df
        except Exception as e:
            print(f"Error loading cache: {e}")
            print("Proceeding to fetch from network storage...")

    # SMB credentials from environment config
    smb_config = get_config().smb
    server = smb_config.server
    username = smb_config.username
    cred = smb_config.password

    # Construct remote path
    base_path = smb_config.base_path
    remote_path = f"{base_path}\\{zone_ftp_name}"

    print(f"Remote path: {remote_path}")

    # List matching files for the target date
    matching_files = list_smb_files(
        server, username, cred, remote_path, office_identifier, target_date
    )

    if not matching_files:
        print(
            f"\nNo files found matching '{office_identifier}' "
            f"for date {target_date.strftime('%Y-%m-%d')}"
        )
        return pd.DataFrame()

    print(f"\nFound {len(matching_files)} file(s) to process")

    # Process all matching files and combine
    all_dfs = []

    for file_info in matching_files:
        filename = file_info["name"]
        file_info["mtime"]

        df = download_and_parse_smb_file(server, username, cred, remote_path, filename)

        if not df.empty:
            # Add metadata
            df["OFFICE_CODE"] = office_code
            df["OFFICE_NAME"] = office_name
            df["OFFICE_IDENTIFIER"] = office_identifier
            df["ZONE"] = zone_ftp_name
            # df["SOURCE_FILE"] = filename
            # df["FILE_DATE"] = file_date.strftime("%Y-%m-%d %H:%M:%S")
            all_dfs.append(df)

    # Combine all dataframes
    if all_dfs:
        combined_df = pd.concat(all_dfs, ignore_index=True)
        print(f"\nTotal records: {len(combined_df)}")

        # Save to cache
        try:
            combined_df.to_pickle(cache_path)
            print(f"✓ Cached to {cache_path}")
        except Exception as e:
            print(f"Warning: Could not save cache: {e}")

        return combined_df
    else:
        print("\nNo data was successfully parsed")
        return pd.DataFrame()


def main() -> None:
    # Configuration
    office_code = "04"
    target_date = datetime.now() - timedelta(days=1)  # Yesterday

    # Get report data
    df = get_office_report(office_code, target_date)

    if df.empty:
        print("No data retrieved")
        return

    print("First 5 records:")
    print(df.head())
    print(f"\n✓ Retrieved {len(df)} records")


if __name__ == "__main__":
    main()
