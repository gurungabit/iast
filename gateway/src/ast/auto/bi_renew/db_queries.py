"""DB2 queries specific to BI Renew automation."""

import logging
from typing import Any

from gateway.src.db.db2.db import connect, disconnect, execute_query

logger = logging.getLogger(__name__)


def get_bi_renew_pending_records(
    date_processed: str,
) -> list[dict[str, Any]] | None:
    """Fetch BI_RENEW pending records from DB2.

    Args:
        date_processed: Date to filter records (format: MM/DD/YYYY)

    Returns:
        List of dictionaries with PEND_KEY, PEND_INFO, PEND_DATE or None on error
    """
    connection = connect()
    if not connection:
        return None

    conn, dbi_conn = connection

    try:
        query = """
            SELECT PEND_KEY, PEND_INFO, PEND_DATE
            FROM RU99.NZ490
            WHERE PART_KEY = '0'
              AND DATE_PROCESSED = ?
              AND PEND_CODE = '21'
              AND PEND_INFO = 'BI_RENEW'
              AND DATE_DELETED IS NULL
            WITH UR
        """
        results = execute_query(dbi_conn, query, (date_processed,))
        if results is not None:
            logger.info("Retrieved %d BI_RENEW records", len(results))
        return results
    finally:
        disconnect(conn, dbi_conn)
