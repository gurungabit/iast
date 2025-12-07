"""Unit tests for the DynamoDB client wrapper."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from src.core.config import DynamoDBConfig
from src.db import client as client_module
from src.db.client import DynamoDBClient, get_dynamodb_client


class DynamoDBClientTests(unittest.TestCase):
    """Validate how we talk to DynamoDB."""

    def setUp(self) -> None:
        self.config = DynamoDBConfig(
            endpoint="http://localhost:8042",
            region="us-east-1",
            table_name="terminal",
            access_key_id="dummy",
            secret_access_key="dummy",
        )
        self.resource_patcher = patch("src.db.client.boto3.resource")
        self.client_patcher = patch("src.db.client.boto3.client")
        self.mock_resource = self.resource_patcher.start()
        self.mock_client_ctor = self.client_patcher.start()
        self.addCleanup(self.resource_patcher.stop)
        self.addCleanup(self.client_patcher.stop)

        self.mock_table = MagicMock()
        self.mock_resource.return_value.Table.return_value = self.mock_table
        self.mock_low_level = self.mock_client_ctor.return_value
        self.mock_low_level.describe_table.return_value = {"Table": {}}

        client_module._client = None

    def tearDown(self) -> None:
        client_module._client = None

    def test_constructor_validates_connection(self) -> None:
        DynamoDBClient(self.config)

        self.mock_low_level.describe_table.assert_called_once_with(
            TableName=self.config.table_name
        )
        self.mock_resource.return_value.Table.assert_called_once_with(
            self.config.table_name
        )

    def test_constructor_raises_when_validation_fails(self) -> None:
        self.mock_low_level.describe_table.side_effect = Exception("boom")

        with self.assertRaises(RuntimeError) as ctx:
            DynamoDBClient(self.config)

        self.assertIn("Cannot connect to DynamoDB", str(ctx.exception))

        # Reset side effect for other tests
        self.mock_low_level.describe_table.side_effect = None

    def test_update_item_builds_update_expression(self) -> None:
        client = DynamoDBClient(self.config)
        self.mock_table.update_item.return_value = {"Attributes": {"status": "running"}}

        result = client.update_item(
            pk="USER#123",
            sk="SESSION#abc",
            updates={"status": "running", "progress": 50},
        )

        self.assertEqual(result, {"status": "running"})

        kwargs = self.mock_table.update_item.call_args.kwargs
        self.assertEqual(kwargs["Key"], {"PK": "USER#123", "SK": "SESSION#abc"})
        self.assertEqual(
            kwargs["UpdateExpression"], "SET #attr0 = :val0, #attr1 = :val1"
        )
        self.assertEqual(
            kwargs["ExpressionAttributeNames"],
            {"#attr0": "status", "#attr1": "progress"},
        )
        self.assertEqual(
            kwargs["ExpressionAttributeValues"],
            {":val0": "running", ":val1": 50},
        )

    def test_get_dynamodb_client_returns_singleton(self) -> None:
        first = get_dynamodb_client(self.config)
        second = get_dynamodb_client()

        self.assertIs(first, second)

    def test_put_and_get_item_roundtrip(self) -> None:
        client = DynamoDBClient(self.config)
        item = {"PK": "USER#1", "SK": "PROFILE", "email": "test@example.com"}

        client.put_item(item)
        self.mock_table.put_item.assert_called_once_with(Item=item)

        self.mock_table.get_item.return_value = {"Item": item}
        result = client.get_item("USER#1", "PROFILE")
        self.assertEqual(result, item)
        self.mock_table.get_item.assert_called_once_with(
            Key={"PK": "USER#1", "SK": "PROFILE"}
        )

    def test_query_helpers_return_items(self) -> None:
        client = DynamoDBClient(self.config)
        self.mock_table.query.return_value = {"Items": [{"PK": "USER#1"}]}

        items = client.query_pk("USER#1")
        self.assertEqual(items, [{"PK": "USER#1"}])

        items = client.query_gsi1("email@example.com")
        self.assertEqual(items, [{"PK": "USER#1"}])
        kwargs = self.mock_table.query.call_args.kwargs
        self.assertEqual(kwargs["IndexName"], "GSI1")

        self.mock_table.query.return_value = (
            {"Items": [{"PK": "USER#1"}], "LastEvaluatedKey": {"PK": "USER#1"}}
        )
        items, last_key = client.query_gsi2(
            "USER#1",
            scan_forward=True,
            limit=1,
            exclusive_start_key={"PK": "USER#0"},
        )
        self.assertEqual(len(items), 1)
        self.assertIsNotNone(last_key)

    def test_delete_item_calls_table(self) -> None:
        client = DynamoDBClient(self.config)
        client.delete_item("USER#1", "PROFILE")

        self.mock_table.delete_item.assert_called_once_with(
            Key={"PK": "USER#1", "SK": "PROFILE"}
        )

    def test_domain_helpers_build_keys(self) -> None:
        client = DynamoDBClient(self.config)
        client.get_item = MagicMock(return_value={"user_id": "user-1"})
        client.query_pk = MagicMock(return_value=[{"session": "s1"}])

        result = client.get_user("user-1")
        self.assertEqual(result, {"user_id": "user-1"})
        client.get_item.assert_called_once_with("USER#user-1", "PROFILE")

        client.get_user_sessions("user-1")
        client.query_pk.assert_called_with("USER#user-1", sk_prefix="SESSION#")

