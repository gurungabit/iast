import json
import os

# Load OFFICE_INFO from the JSON file
_current_dir = os.path.dirname(os.path.abspath(__file__))
_json_file = os.path.join(_current_dir, "office_info.json")

with open(_json_file, encoding="utf-8") as f:
    OFFICE_INFO = json.load(f)


def get_office_info(office_code: str) -> dict | None:
    """
    Get zone and office information for a given office code.

    Args:
        office_code: The office code (e.g., "04", "08", "13")

    Returns:
        A dictionary with 'zone', 'office', 'PrintDestinations',
        and 'AutoPrintDestinations', or None if not found
    """
    zones = OFFICE_INFO.get("ZoneList", {}).get("Zone", [])

    for zone in zones:
        offices = zone.get("Office", [])

        # Handle both single office (dict) and multiple offices (list)
        if isinstance(offices, dict):
            offices = [offices]

        for office in offices:
            if office.get("code") == office_code:
                return {
                    "zone": {
                        "id": zone.get("id"),
                        "name": zone.get("name"),
                        "ftpName": zone.get("ftpName"),
                    },
                    "office": office,
                    "PrintDestinations": zone.get("PrintDestinations", {}),
                    "AutoPrintDestinations": zone.get("AutoPrintDestinations", {}),
                }

    return None


__all__ = ["get_office_info"]

# print(json.dumps(get_office_info("04"), indent=2))  # Example usage
