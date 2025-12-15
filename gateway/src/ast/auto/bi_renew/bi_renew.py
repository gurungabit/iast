# ============================================================================
# BI Renew AST - Automated Billing Invoice Renewal Processing
# ============================================================================
"""
Automated Billing Invoice (BI) Renewal processing script.

This AST processes BI_RENEW pending records by:
1. Fetching pending BI_RENEW records from DB2 (NZ490 table)
2. Retrieving and filtering RW1AA271 office reports from network storage
3. Enriching records with Access database data (PND queues, exclusions)
4. Processing eligible policies through the mainframe

Data Flow:
1. Query DB2 for BI_RENEW pending records (PEND_CODE='21', PEND_INFO='BI_RENEW')
2. Fetch RW1AA271 report from network storage for the specified office/date
3. Filter for PND queue records, identify excluded queues (EC, EN, EP, SUP, DPI)
4. Cross-reference policies: skip those with multiple PND records or exclusions
5. Process remaining eligible policies through mainframe automation

Required parameters:
    - username: Mainframe username
    - password: Mainframe password
    - date: Processing date (MM/DD/YYYY format, defaults to previous business day)

Optional parameters:
    - testMode: If true, run in test mode without making changes
"""

from datetime import datetime
from email import policy
from typing import TYPE_CHECKING, Any, Literal

import pandas as pd
import structlog

from .db_queries import get_bi_renew_pending_records
from ....core.ast.base import AST
from ....networkstorage.parse_office_reports import get_office_report
from ....utils.date_utils import get_previous_business_date

if TYPE_CHECKING:
    from ....services.tn3270.host import Host

log = structlog.get_logger()

PolicyStatus = Literal["success", "failed", "skipped"]


def validate_policy_number(policy_number: str) -> bool:
    """Validate a policy number format (9 char alphanumeric)."""
    log.debug("Validating policy number", policy_number=policy_number)
    res = bool(policy_number and len(policy_number) == 7 and policy_number.isalnum())
    log.debug("Policy number validation result", policy_number=policy_number, is_valid=res)
    return res


class BiRenew(AST):
    """
    Automated Billing Invoice (BI) Renewal processor.

    Fetches pending BI_RENEW records from DB2, cross-references with
    RW1AA271 office reports, and processes eligible policies through
    mainframe automation.

    Authentication flow:
    - Sequential: Login once → Process all policies → Logoff once
    - Parallel: Each session logs in → Processes batch → Logs off

    Data sources:
    - DB2 NZ490 table: BI_RENEW pending records
    - Network storage: RW1AA271 office reports
    - Access database: PND queue records, exclusion lists

    Required parameters:
        - username: Mainframe username
        - password: Mainframe password

    Optional parameters:
        - date: Missed run date (MM/DD/YYYY), defaults to previous business day
        - testMode: Run in test mode without making changes
    """

    name = "bi_renew"
    description = "Process BI renewal pending records from DB2 with office report validation"
    supports_parallel = True  # This AST supports parallel execution

    # Authentication configuration for Fire system
    auth_expected_keywords = [
        "Personal Queue Status",
        "End Of Transaction",
    ]
    auth_application = "AUTO04"
    auth_group = "@OOAUTO"

    def logoff(
        self, host: "Host", target_screen_keywords: list[str] | None = None
    ) -> tuple[bool, str]:
        """Sign off from TSO system."""
        log.info("🔒 Signing off from terminal session...")
        # TODO: for now.. This will need to changed..
        host.pa(3)
        max_backoff_count = 20
        while not host.wait_for_text("Exit Menu", timeout=0.8) and max_backoff_count > 0:
            host.pf(15)
            max_backoff_count -= 1

        host.fill_field_at_position(36, 5, "1")
        host.enter()

        # Check for target screen or default SIGNON
        target_keywords = target_screen_keywords or ["**** SIGNON ****", "SIGNON"]
        for keyword in target_keywords:
            if host.wait_for_text(keyword, timeout=10):
                log.info("✅ Signed off successfully.", keyword=keyword)
                return True, ""

        return False, "Failed to sign off"

    def validate_item(self, item: Any) -> bool:
        policy_number = item.get("policy") if isinstance(item, dict) else None
        if not policy_number:
            log.warning("⚠️ Missing policy number in item", item=item)
            self.report_status("⚠️ Missing policy number in item")
            return False
        return validate_policy_number(str(policy_number))

    def _get_and_filter_db_records(
        self, office_code: str, date_obj: datetime
    ) -> tuple[pd.DataFrame | None, pd.DataFrame | None]:
        """Filter Access database records into PND and excluded queues.

        Args:
            df: DataFrame containing all Access database records

        Returns:
            Tuple of (pnd_df, excluded_df) DataFrames
        """
        self.report_status("Fetching RW1AA271 report from network storage...")
        df = get_office_report(office_code, date_obj)
        if df is None or df.empty:
            self.report_status("No records found in RW1AA271 report.")
            message = (
                f"❌ No RW1AA271 records found for office {office_code} "
                f"on date {date_obj.strftime('%Y-%m-%d')}"
            )
            log.error("%s", message)
            return None, None

        self.report_status(f"Fetched {len(df)} records from RW1AA271 report")
        original_count = len(df)
        pnd_df = df[df["QUEUE"].str.startswith("PND", na=False)]
        log.info("Filtered PND records", count=len(pnd_df))
        if len(pnd_df) == 0:
            self.report_status("No PND records found after filtering.")
            message = (
                f"❌ No PND records found in RW1AA271 report for office {office_code} "
                f"on date {date_obj.strftime('%Y-%m-%d')}"
            )
            log.error("%s", message)
            return None, None

        excluded_prefixes = ["EC", "EN", "EP", "SUP", "DPI"]
        excluded_df = df[df["QUEUE"].str.startswith(tuple(excluded_prefixes), na=False)]
        log.info("Filtered excluded records", count=len(excluded_df))

        self.report_status(
            f"Filtered {len(pnd_df)} PND records and {len(excluded_df)} excluded "
            f"records from {original_count} total"
        )
        return pnd_df, excluded_df

    def _transform_bi_renew_records(self, db_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Transform BI renewal pending records into a policy-keyed dictionary.

        Args:
            db_records: List of dictionaries containing PEND_KEY, PEND_INFO, and PEND_DATE

        Returns:
            List of dictionaries with policy and transformed record data
        """
        result = []

        for record in db_records:
            pend_key = record.get("PEND_KEY", "").strip()
            pend_info = record.get("PEND_INFO", "").strip()
            pend_date = record.get("PEND_DATE", "").strip()

            # Extract policy number (starting at index 3, length 7)
            if len(pend_key.strip()) >= 10:  # Ensure PEND_KEY has enough characters
                policy = pend_key[3:10]

                # Extract StateCode (starting at index 0, length 2)
                state_code = pend_key[0:2]

                # Extract UniqueDigit (starting at index 2, length 1)
                unique_digit = pend_key[2:3]

                # Format PEND_DATE from "20251115" to "MM/DD/YYYY"
                formatted_date = ""
                if pend_date and len(pend_date) == 8:
                    try:
                        date_obj = datetime.strptime(pend_date, "%Y%m%d")
                        formatted_date = date_obj.strftime("%m/%d/%Y")
                    except ValueError:
                        formatted_date = pend_date  # Keep original if parsing fails
                else:
                    formatted_date = pend_date

                # Create the item dictionary with policy included
                result.append(
                    {
                        "policy": policy,
                        "StateCode": state_code,
                        "UniqueDigit": unique_digit,
                        "Eligible": False,
                        "EmailCoordinator": False,
                        "PEND_DATE": formatted_date,
                        "PEND_KEY": pend_key,
                        "PEND_INFO": pend_info,
                    }
                )

        return result

    def _enrich_items_with_access_data(
        self,
        items: list[dict[str, Any]],
        pnd_df: pd.DataFrame,
        excluded_df: pd.DataFrame | None = None,
    ) -> None:
        """Enrich items with Access database data and mark problematic policies for non-processing.

        Args:
            items: List of item dictionaries from DB2
            pnd_df: DataFrame with PND queue records
            excluded_df: DataFrame with excluded queue records

        Returns:
            None (modifies items in place)
        """

        # Build policy count dictionaries for O(1) lookups
        pnd_policy_counts = pnd_df["POLICY"].astype(str).value_counts().to_dict()
        excluded_policy_counts = (
            excluded_df["POLICY"].astype(str).value_counts().to_dict()
            if excluded_df is not None and not excluded_df.empty
            else {}
        )

        for item in items:
            policy = item.get("policy")
            if not policy:
                continue

            policy_count = pnd_policy_counts.get(str(policy), 0)
            excluded_count = excluded_policy_counts.get(str(policy), 0)

            # Add Division if exactly one PND record exists
            if policy_count == 1:
                matching_row = pnd_df[pnd_df["POLICY"].astype(str) == str(policy)]
                if not matching_row.empty:
                    item["Division"] = str(matching_row.iloc[0]["DIV"])
                else:
                    item["Division"] = ""
                    item["PolicyStatus"] = (
                        "No matching PND record found in RW1AA271 - POLICY NOT PROCESSED!"
                    )
            # Mark policies with multiple PND records
            if policy_count > 1:
                item["PolicyStatus"] = (
                    "Multiple PNDs found in the RW1AA271 on this policy - POLICY NOT PROCESSED!"
                )
                log.warning(
                    "⚠️ Policy %s has %d PND records in Access database - marked for non-processing",
                    policy,
                    policy_count,
                )

            # Mark policies with excluded queue records
            if excluded_count > 0:
                item["PolicyStatus"] = (
                    "Multiple cases found in excluded queues in the RW1AA271 "
                    "on this policy - POLICY NOT PROCESSED!"
                )
                log.warning(
                    "⚠️ Policy %s has %d excluded QUEUE records in Access database "
                    "- marked for non-processing",
                    policy,
                    excluded_count,
                )

    def _filter_processable_items(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Filter items to only those that can be processed.

        Args:
            items: List of all items (including those with PolicyStatus)

        Returns:
            List of items without PolicyStatus (processable items)
        """
        original_count = len(items)
        filtered_items = [item for item in items if "PolicyStatus" not in item]

        if original_count != len(filtered_items):
            log.info(
                "🔍 Filtered out %d policies with issues, %d policies remaining for processing",
                original_count - len(filtered_items),
                len(filtered_items),
            )

        return filtered_items

    def prepare_items(self, **kwargs: Any) -> list[dict[str, Any]]:
        """
        Prepare items for processing.

        :param self: Description
        :param kwargs: Description
        """
        office_code = "04"  # Michigan

        self.report_status("Preparing items from database...")

        run_date = kwargs.get("date") or datetime.now().strftime("%m/%d/%Y")
        prev_business_date = get_previous_business_date(run_date)
        date = datetime.strptime(prev_business_date, "%m/%d/%Y")
        pnd_df, excluded_df = self._get_and_filter_db_records(office_code, date)

        if pnd_df is None:
            return []

        self.report_status("Fetching BI_RENEW records from DB2...")
        db_records = get_bi_renew_pending_records(prev_business_date)

        if db_records is None:
            self.report_status("Failed to fetch DB2 records.")
            log.error("❌ Failed to fetch DB2 records")
            return []

        items = self._transform_bi_renew_records(db_records)

        self._enrich_items_with_access_data(items, pnd_df, excluded_df)

        filtered_items = self._filter_processable_items(items)

        self.report_status(f"Prepared {len(filtered_items)} items for processing.")

        return filtered_items

    def process_single_item(
        self, host: "Host", item: Any, index: int, total: int
    ) -> tuple[bool, str, dict[str, Any]]:
        log.info("Starting policy processing", policy_number=item)
        # item must be dict
        if not isinstance(item, dict):
            return False, f"Item is not a dictionary {item}", {}

        policy_number = item.get("policy", "")
        self.capture_screenshot(host, f"{policy_number}_start")
        policy_data = {
            "policyNumber": policy_number,
            "status": "active",
        }

        return True, "", policy_data
