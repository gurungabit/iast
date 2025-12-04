# ============================================================================
# DynamoDB Client - Single Table Design
# ============================================================================
"""
DynamoDB client wrapper for single table design.

Table: terminal
===============
PK                    SK                        Entity
──────────────────────────────────────────────────────────
USER#<userId>         PROFILE                   User profile
USER#<userId>         SESSION#<sessionId>       User's session
SESSION#<sessionId>   EXECUTION#<execId>        Session's AST execution
EXECUTION#<execId>    POLICY#<policyNum>        Execution's policy result

GSI1: GSI1PK (email) for user lookup by email
"""

import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
import structlog

log = structlog.get_logger()

# Configuration
DYNAMODB_ENDPOINT = os.getenv("DYNAMODB_ENDPOINT", "http://127.0.0.1:8042")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "dummy")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "dummy")
TABLE_NAME = os.getenv("DYNAMODB_TABLE", "terminal")


# Key prefixes for single table design
class KeyPrefix:
    USER = "USER#"
    SESSION = "SESSION#"
    EXECUTION = "EXECUTION#"
    POLICY = "POLICY#"
    PROFILE = "PROFILE"


class DynamoDBClient:
    """
    DynamoDB client wrapper for single table design.
    """

    def __init__(self, table_name: str = TABLE_NAME) -> None:
        self._table_name = table_name
        self._resource = boto3.resource(
            "dynamodb",
            endpoint_url=DYNAMODB_ENDPOINT,
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )
        self._client = boto3.client(
            "dynamodb",
            endpoint_url=DYNAMODB_ENDPOINT,
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )
        self._table = self._resource.Table(table_name)
        log.info(
            "DynamoDB client initialized", endpoint=DYNAMODB_ENDPOINT, table=table_name
        )

    @property
    def table(self) -> Any:
        """Get the table resource."""
        return self._table

    # -------------------------------------------------------------------------
    # Generic Operations
    # -------------------------------------------------------------------------

    def put_item(self, item: dict[str, Any]) -> None:
        """Put an item into the table."""
        self._table.put_item(Item=item)

    def get_item(self, pk: str, sk: str) -> dict[str, Any] | None:
        """Get an item by primary key (PK + SK)."""
        response = self._table.get_item(Key={"PK": pk, "SK": sk})
        return response.get("Item")

    def update_item(
        self,
        pk: str,
        sk: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an item with given attributes."""
        # Build update expression
        update_parts = []
        expression_values = {}
        expression_names = {}

        for i, (attr, value) in enumerate(updates.items()):
            placeholder = f":val{i}"
            name_placeholder = f"#attr{i}"
            update_parts.append(f"{name_placeholder} = {placeholder}")
            expression_values[placeholder] = value
            expression_names[name_placeholder] = attr

        update_expression = "SET " + ", ".join(update_parts)

        response = self._table.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ExpressionAttributeNames=expression_names,
            ReturnValues="ALL_NEW",
        )
        return response.get("Attributes", {})

    def delete_item(self, pk: str, sk: str) -> None:
        """Delete an item by primary key."""
        self._table.delete_item(Key={"PK": pk, "SK": sk})

    def query_pk(
        self,
        pk: str,
        sk_prefix: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Query items by PK, optionally filtering by SK prefix."""
        if sk_prefix:
            key_condition = Key("PK").eq(pk) & Key("SK").begins_with(sk_prefix)
        else:
            key_condition = Key("PK").eq(pk)

        kwargs: dict[str, Any] = {"KeyConditionExpression": key_condition}
        if limit:
            kwargs["Limit"] = limit

        response = self._table.query(**kwargs)
        return response.get("Items", [])

    def query_gsi1(
        self,
        gsi1pk: str,
        sk_prefix: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Query GSI1 by GSI1PK (e.g., email lookup)."""
        if sk_prefix:
            key_condition = Key("GSI1PK").eq(gsi1pk) & Key("SK").begins_with(sk_prefix)
        else:
            key_condition = Key("GSI1PK").eq(gsi1pk)

        kwargs: dict[str, Any] = {
            "IndexName": "GSI1",
            "KeyConditionExpression": key_condition,
        }
        if limit:
            kwargs["Limit"] = limit

        response = self._table.query(**kwargs)
        return response.get("Items", [])

    # -------------------------------------------------------------------------
    # User Operations
    # -------------------------------------------------------------------------

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        """Get user profile by ID."""
        return self.get_item(f"{KeyPrefix.USER}{user_id}", KeyPrefix.PROFILE)

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        """Get user profile by email (via GSI1)."""
        items = self.query_gsi1(email, sk_prefix=KeyPrefix.PROFILE, limit=1)
        return items[0] if items else None

    def put_user(self, user_id: str, email: str, data: dict[str, Any]) -> None:
        """Create or update a user."""
        item = {
            "PK": f"{KeyPrefix.USER}{user_id}",
            "SK": KeyPrefix.PROFILE,
            "GSI1PK": email,
            "user_id": user_id,
            "email": email,
            **data,
        }
        self.put_item(item)

    def get_user_sessions(self, user_id: str) -> list[dict[str, Any]]:
        """Get all sessions for a user."""
        return self.query_pk(f"{KeyPrefix.USER}{user_id}", sk_prefix=KeyPrefix.SESSION)

    # -------------------------------------------------------------------------
    # Session Operations
    # -------------------------------------------------------------------------

    def put_session(self, user_id: str, session_id: str, data: dict[str, Any]) -> None:
        """Create a session for a user."""
        item = {
            "PK": f"{KeyPrefix.USER}{user_id}",
            "SK": f"{KeyPrefix.SESSION}{session_id}",
            "user_id": user_id,
            "session_id": session_id,
            **data,
        }
        self.put_item(item)

    def get_session_executions(self, session_id: str) -> list[dict[str, Any]]:
        """Get all AST executions for a session."""
        return self.query_pk(
            f"{KeyPrefix.SESSION}{session_id}", sk_prefix=KeyPrefix.EXECUTION
        )

    # -------------------------------------------------------------------------
    # AST Execution Operations
    # -------------------------------------------------------------------------

    def put_execution(
        self, session_id: str, execution_id: str, data: dict[str, Any]
    ) -> None:
        """Create an AST execution record."""
        item = {
            "PK": f"{KeyPrefix.SESSION}{session_id}",
            "SK": f"{KeyPrefix.EXECUTION}{execution_id}",
            "session_id": session_id,
            "execution_id": execution_id,
            **data,
        }
        self.put_item(item)

    def update_execution(
        self, session_id: str, execution_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        """Update an AST execution record."""
        return self.update_item(
            f"{KeyPrefix.SESSION}{session_id}",
            f"{KeyPrefix.EXECUTION}{execution_id}",
            updates,
        )

    def get_execution_policies(self, execution_id: str) -> list[dict[str, Any]]:
        """Get all policy results for an execution."""
        return self.query_pk(
            f"{KeyPrefix.EXECUTION}{execution_id}", sk_prefix=KeyPrefix.POLICY
        )

    # -------------------------------------------------------------------------
    # Policy Result Operations
    # -------------------------------------------------------------------------

    def put_policy_result(
        self, execution_id: str, policy_number: str, data: dict[str, Any]
    ) -> None:
        """Create a policy result record."""
        item = {
            "PK": f"{KeyPrefix.EXECUTION}{execution_id}",
            "SK": f"{KeyPrefix.POLICY}{policy_number}",
            "execution_id": execution_id,
            "policy_number": policy_number,
            **data,
        }
        self.put_item(item)

    def get_policy_result(
        self, execution_id: str, policy_number: str
    ) -> dict[str, Any] | None:
        """Get a specific policy result."""
        return self.get_item(
            f"{KeyPrefix.EXECUTION}{execution_id}",
            f"{KeyPrefix.POLICY}{policy_number}",
        )


# Singleton instance
_client: DynamoDBClient | None = None


def get_dynamodb_client() -> DynamoDBClient:
    """Get the singleton DynamoDB client instance."""
    global _client
    if _client is None:
        _client = DynamoDBClient()
    return _client
