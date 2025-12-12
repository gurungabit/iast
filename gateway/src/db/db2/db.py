"""Generic DB2 Database Connection utilities.

Provides reusable connection and query execution functions
that can be used by any AST module needing DB2 access.
"""

import contextlib
import logging
import os
from typing import Any

import ibm_db
import ibm_db_dbi

from src.core.config import get_config

logger = logging.getLogger(__name__)

# Get absolute path to certificate file relative to this module
_CERT_PATH = os.path.join(os.path.dirname(__file__), "cacerts.crt")


def get_connection_string() -> str:
    """Build DB2 connection string from environment config."""
    config = get_config().db2
    return (
        f"DRIVER=DB2;"
        f"DATABASE={config.database};"
        f"HOSTNAME={config.hostname};"
        f"UID={config.uid};"
        f"PWD={config.pwd};"
        f"PORT={config.port};"
        f"PROTOCOL={config.protocol};"
        f"CurrentSchema={config.schema};"
        "SECURITY=SSL;"
        f"SSLServerCertificate={_CERT_PATH}"
    )


def connect() -> tuple[Any, Any] | None:
    """Establish DB2 connection.

    Returns:
        Tuple of (ibm_db connection, dbi connection) or None on failure
    """
    try:
        connection_string = get_connection_string()
        conn = ibm_db.connect(connection_string, "", "")
        if not conn:
            logger.error("Failed to connect to DB2")
            return None
        dbi_conn = ibm_db_dbi.Connection(conn)
        return conn, dbi_conn
    except Exception as e:
        logger.error(f"DB2 connection error: {e}")
        return None


def disconnect(conn: Any, dbi_conn: Any) -> None:
    """Close DB2 connections.

    Args:
        conn: ibm_db connection
        dbi_conn: dbi connection
    """
    if dbi_conn:
        with contextlib.suppress(Exception):
            dbi_conn.close()
    if conn:
        with contextlib.suppress(Exception):
            ibm_db.close(conn)


def execute_query(
    dbi_conn: Any, query: str, params: tuple | None = None
) -> list[dict[str, Any]] | None:
    """Execute query and return results as list of dicts.

    Args:
        dbi_conn: Active dbi connection
        query: SQL query string
        params: Optional query parameters

    Returns:
        List of dictionaries or None on error
    """
    try:
        cursor = dbi_conn.cursor()
        cursor.execute(query, params) if params else cursor.execute(query)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        cursor.close()
        return [dict(zip(columns, row, strict=False)) for row in rows]
    except Exception as e:
        logger.error(f"Query execution error: {e}")
        return None
