# SMB Module

A comprehensive module for interacting with SMB file shares and Microsoft Access databases across State Farm offices.

## Features

- **SMB File Operations**: Download files from SMB shares with retry logic for locked files
- **Office-Based Paths**: Automatically build file paths using office codes and departments
- **Access Database Handling**: Read and export Access databases to Excel
- **Zone Management**: Map office codes to zones and file paths

## Installation

Required dependencies:

```bash
pip install smbprotocol pandas pandas-access openpyxl
```

## Quick Start

```python
from app.smb import SMBClient, AccessDBHandler, build_file_path

# Initialize client
client = SMBClient(
    server="Opr.statefarm.org",
    username="Opr\\YOUR_USERNAME",
    password="your_password"
)

# Download file using office code
client.download_by_office(
    office_code="01",      # Great Lakes zone
    department="AUTO",     # or "FIRE"
    filename="data.accdb"
)

# Work with Access database
db = AccessDBHandler("data.accdb")
tables = db.get_table_names()
db.export_to_excel("output.xlsx")
```

## Module Structure

```
app/smb/
├── __init__.py          # Module exports
├── client.py            # SMB client implementation
├── database.py          # Access database handling
├── file_paths.py        # Office/zone path mappings
├── examples.py          # Usage examples
└── README.md           # This file
```

## Usage

### 1. SMB Client

#### Basic Download

```python
from app.smb import SMBClient

client = SMBClient("Opr.statefarm.org", "Opr\\USERNAME", "password")
client.download_file(
    remote_path=r"\\Opr.statefarm.org\dfs\zone\GREAT LAKES\WORKGROUP\iAST\AUTO\file.accdb",
    local_path="file.accdb"
)
```

#### Download by Office Code (Recommended)

```python
# No need to know the full path!
client.download_by_office(
    office_code="15",      # Pacific Northwest
    department="FIRE",
    filename="claims.accdb"
)
```

#### Download Only If Not Exists

```python
was_downloaded = client.download_if_not_exists(
    remote_path=r"\\...\file.accdb",
    local_path="file.accdb"
)
```

### 2. Access Database

#### Read Tables

```python
from app.smb import AccessDBHandler

db = AccessDBHandler("database.accdb")

# Get all table names
tables = db.get_table_names()

# Read a specific table
df = db.read_table("TableName")

# Get table information
info = db.get_table_info("TableName")
```

#### Export to Excel

```python
# Export all tables
db.export_to_excel("output.xlsx")

# Export specific tables
db.export_to_excel("output.xlsx", tables=["Table1", "Table2"])
```

#### Preview Data

```python
db.preview_table("TableName", rows=10)
```

### 3. File Path Helpers

#### Build File Paths

```python
from app.smb import build_file_path

# Automatically constructs the full UNC path
path = build_file_path(
    office="01",           # Office code
    department="AUTO",     # FIRE or AUTO
    filename="data.accdb"
)
# Returns: \\Opr.statefarm.org\dfs\ZONE\GREAT LAKES\WORKGROUP\iAST\AUTO\data.accdb
```

#### Query Office Information

```python
from app.smb import get_zone_by_office, get_path_by_office

zone = get_zone_by_office("15")        # "PACIFIC NORTHWEST"
base_path = get_path_by_office("01")   # Base SMB path
```

## Office Codes

| Office | Zone                   | Office Codes in Zone |
| ------ | ---------------------- | -------------------- |
| 00     | Corporate Headquarters | 00                   |
| 01     | GREAT LAKES            | 01, 04, 18           |
| 02     | CALIFORNIA             | 02, 12, 23           |
| 05     | HEARTLAND              | 05, 06               |
| 07     | MID-ATLANTIC           | 07, 21               |
| 08     | TEXAS                  | 08, 25               |
| 09     | SOUTHERN               | 09, 27               |
| 11     | MID-AMERICA            | 11, 16               |
| 13     | NORTHEAST              | 13, 17, 28           |
| 14     | CENTRAL                | 14, 22, 26           |
| 15     | PACIFIC NORTHWEST      | 15                   |
| 19     | FLORIDA                | 19                   |
| 20     | GREAT WESTERN          | 20, 24               |

_See `file_paths.py` for complete list_

## Complete Example

```python
import os
from app.smb import SMBClient, AccessDBHandler, build_file_path

# Configuration from environment
SERVER = os.getenv("SMB_SERVER")
USERNAME = os.getenv("SMB_USERNAME")
PASSWORD = os.getenv("SMB_PASSWORD")
OFFICE = "01"
DEPT = "AUTO"
FILENAME = "RW1AA271.accdb"

# Initialize client
client = SMBClient(SERVER, USERNAME, PASSWORD)

# Download file (skip if exists)
remote_path = build_file_path(OFFICE, DEPT, FILENAME)
client.download_if_not_exists(remote_path, FILENAME)

# Process database
db = AccessDBHandler(FILENAME)
tables = db.get_table_names()
print(f"Found {len(tables)} tables")

# Export to Excel
db.export_to_excel("output.xlsx")

# Preview first table
if tables:
    db.preview_table(tables[0])
```

## Error Handling

The module includes automatic retry logic for locked files:

```python
try:
    client.download_file(
        remote_path=path,
        local_path="file.accdb",
        max_retries=5,        # Retry up to 5 times
        retry_delay=3.0       # Wait 3 seconds between retries
    )
except RuntimeError as e:
    print(f"File is locked: {e}")
except Exception as e:
    print(f"Download failed: {e}")
```

## API Reference

### SMBClient

- `__init__(server, username, password)` - Initialize client
- `download_file(remote_path, local_path, max_retries=3, retry_delay=2.0)` - Download file
- `download_by_office(office_code, department, filename, local_path=None, ...)` - Download using office code
- `download_if_not_exists(remote_path, local_path, ...)` - Download if file doesn't exist

### AccessDBHandler

- `__init__(accdb_file)` - Initialize handler
- `get_table_names()` - Get list of tables
- `read_table(table_name)` - Read table as DataFrame
- `export_to_excel(excel_file, tables=None, verbose=True)` - Export to Excel
- `preview_table(table_name, rows=5)` - Print table preview
- `get_table_info(table_name)` - Get table metadata

### File Path Functions

- `build_file_path(office, department, filename)` - Build complete UNC path
- `get_path_by_office(office)` - Get base path for office
- `get_zone_by_office(office)` - Get zone name for office
- `get_path_by_zone(zone)` - Get all paths for zone

## See Also

- `examples.py` - More usage examples
- `file_paths.py` - Complete office/zone mappings
