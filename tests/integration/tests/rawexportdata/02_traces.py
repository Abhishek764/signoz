import csv
import io
import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from http import HTTPStatus

import requests

from fixtures import types
from fixtures.auth import USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD
from fixtures.querier import (
    BuilderQuery,
    OrderBy,
    QueryRangeRequest,
    TelemetryFieldKey,
    TraceOperatorQuery,
)
from fixtures.traces import TraceIdGenerator, Traces, TracesKind, TracesStatusCode


def test_export_raw_data_get_not_allowed(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
) -> None:
    """
    Tests:
    1. GET request to export_raw_data is rejected with 405 Method Not Allowed
    """
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/export_raw_data"),
        timeout=10,
        headers={
            "authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == HTTPStatus.METHOD_NOT_ALLOWED


def test_export_traces_csv(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
    insert_traces: Callable[[list[Traces]], None],
) -> None:
    """
    Setup:
    Insert 3 traces with different attributes.

    Tests:
    1. Export traces as CSV format
    2. Verify CSV structure and content
    3. Validate headers are present
    4. Check trace data is correctly formatted
    """
    http_service_trace_id = TraceIdGenerator.trace_id()
    http_service_span_id = TraceIdGenerator.span_id()
    http_service_db_span_id = TraceIdGenerator.span_id()
    topic_service_trace_id = TraceIdGenerator.trace_id()
    topic_service_span_id = TraceIdGenerator.span_id()

    now = datetime.now(tz=UTC).replace(second=0, microsecond=0)

    insert_traces(
        [
            Traces(
                timestamp=now - timedelta(seconds=4),
                duration=timedelta(seconds=3),
                trace_id=http_service_trace_id,
                span_id=http_service_span_id,
                parent_span_id="",
                name="POST /integration",
                kind=TracesKind.SPAN_KIND_SERVER,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={
                    "deployment.environment": "production",
                    "service.name": "http-service",
                    "os.type": "linux",
                    "host.name": "linux-000",
                },
                attributes={
                    "net.transport": "IP.TCP",
                    "http.scheme": "http",
                    "http.user_agent": "Integration Test",
                    "http.request.method": "POST",
                    "http.response.status_code": "200",
                },
            ),
            Traces(
                timestamp=now - timedelta(seconds=3.5),
                duration=timedelta(seconds=0.5),
                trace_id=http_service_trace_id,
                span_id=http_service_db_span_id,
                parent_span_id=http_service_span_id,
                name="SELECT",
                kind=TracesKind.SPAN_KIND_CLIENT,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={
                    "deployment.environment": "production",
                    "service.name": "http-service",
                    "os.type": "linux",
                    "host.name": "linux-000",
                },
                attributes={
                    "db.name": "integration",
                    "db.operation": "SELECT",
                    "db.statement": "SELECT * FROM integration",
                },
            ),
            Traces(
                timestamp=now - timedelta(seconds=1),
                duration=timedelta(seconds=2),
                trace_id=topic_service_trace_id,
                span_id=topic_service_span_id,
                parent_span_id="",
                name="topic publish",
                kind=TracesKind.SPAN_KIND_PRODUCER,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={
                    "deployment.environment": "production",
                    "service.name": "topic-service",
                    "os.type": "linux",
                    "host.name": "linux-001",
                },
                attributes={
                    "message.type": "SENT",
                    "messaging.operation": "publish",
                    "messaging.message.id": "001",
                },
            ),
        ]
    )

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    # Calculate timestamps in nanoseconds
    start_ns = int((now - timedelta(minutes=5)).timestamp() * 1e9)
    end_ns = int(now.timestamp() * 1e9)

    body = QueryRangeRequest(
        start=start_ns,
        end=end_ns,
        queries=[BuilderQuery(signal="traces", name="A", limit=1000)],
    ).to_dict()

    # Export traces as CSV
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/export_raw_data"),
        json=body,
        timeout=30,
        headers={
            "authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == HTTPStatus.OK
    assert response.headers["Content-Type"] == "text/csv"
    assert "attachment" in response.headers.get("Content-Disposition", "")

    # Parse CSV content
    csv_content = response.text
    csv_reader = csv.DictReader(io.StringIO(csv_content))

    rows = list(csv_reader)
    assert len(rows) == 3, f"Expected 3 rows, got {len(rows)}"

    # Verify trace IDs are present in the exported data
    trace_ids = [row.get("trace_id") for row in rows]
    assert http_service_trace_id in trace_ids
    assert topic_service_trace_id in trace_ids

    # Verify span names are present
    span_names = [row.get("name") for row in rows]
    assert "POST /integration" in span_names
    assert "SELECT" in span_names
    assert "topic publish" in span_names


def test_export_traces_jsonl(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
    insert_traces: Callable[[list[Traces]], None],
) -> None:
    """
    Setup:
    Insert 2 traces with different attributes.

    Tests:
    1. Export traces as JSONL format
    2. Verify JSONL structure and content
    3. Check each line is valid JSON
    4. Validate trace data is correctly formatted
    """
    http_service_trace_id = TraceIdGenerator.trace_id()
    http_service_span_id = TraceIdGenerator.span_id()
    topic_service_trace_id = TraceIdGenerator.trace_id()
    topic_service_span_id = TraceIdGenerator.span_id()

    now = datetime.now(tz=UTC).replace(second=0, microsecond=0)

    insert_traces(
        [
            Traces(
                timestamp=now - timedelta(seconds=4),
                duration=timedelta(seconds=3),
                trace_id=http_service_trace_id,
                span_id=http_service_span_id,
                parent_span_id="",
                name="POST /api/test",
                kind=TracesKind.SPAN_KIND_SERVER,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={
                    "service.name": "api-service",
                    "deployment.environment": "staging",
                },
                attributes={
                    "http.request.method": "POST",
                    "http.response.status_code": "201",
                },
            ),
            Traces(
                timestamp=now - timedelta(seconds=2),
                duration=timedelta(seconds=1),
                trace_id=topic_service_trace_id,
                span_id=topic_service_span_id,
                parent_span_id="",
                name="queue.process",
                kind=TracesKind.SPAN_KIND_CONSUMER,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={
                    "service.name": "queue-service",
                    "deployment.environment": "staging",
                },
                attributes={
                    "messaging.operation": "process",
                    "messaging.system": "rabbitmq",
                },
            ),
        ]
    )

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    # Calculate timestamps in nanoseconds
    start_ns = int((now - timedelta(minutes=5)).timestamp() * 1e9)
    end_ns = int(now.timestamp() * 1e9)

    body = QueryRangeRequest(
        start=start_ns,
        end=end_ns,
        queries=[BuilderQuery(signal="traces", name="A", limit=1000)],
    ).to_dict()

    # Export traces as JSONL
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/export_raw_data?format=jsonl"),
        json=body,
        timeout=10,
        headers={
            "authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == HTTPStatus.OK
    assert response.headers["Content-Type"] == "application/x-ndjson"
    assert "attachment" in response.headers.get("Content-Disposition", "")

    # Parse JSONL content
    jsonl_lines = response.text.strip().split("\n")
    assert len(jsonl_lines) == 2, f"Expected 2 lines, got {len(jsonl_lines)}"

    # Verify each line is valid JSON
    json_objects = []
    for line in jsonl_lines:
        obj = json.loads(line)
        json_objects.append(obj)
        assert "trace_id" in obj
        assert "span_id" in obj
        assert "name" in obj

    # Verify trace IDs are present
    trace_ids = [obj.get("trace_id") for obj in json_objects]
    assert http_service_trace_id in trace_ids
    assert topic_service_trace_id in trace_ids

    # Verify span names are present
    span_names = [obj.get("name") for obj in json_objects]
    assert "POST /api/test" in span_names
    assert "queue.process" in span_names


def test_export_traces_with_filter(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
    insert_traces: Callable[[list[Traces]], None],
) -> None:
    """
    Setup:
    Insert traces with different service names.

    Tests:
    1. Export traces with filter applied
    2. Verify only filtered traces are returned
    """
    service_a_trace_id = TraceIdGenerator.trace_id()
    service_a_span_id = TraceIdGenerator.span_id()
    service_b_trace_id = TraceIdGenerator.trace_id()
    service_b_span_id = TraceIdGenerator.span_id()

    now = datetime.now(tz=UTC).replace(second=0, microsecond=0)

    insert_traces(
        [
            Traces(
                timestamp=now - timedelta(seconds=4),
                duration=timedelta(seconds=1),
                trace_id=service_a_trace_id,
                span_id=service_a_span_id,
                parent_span_id="",
                name="operation-a",
                kind=TracesKind.SPAN_KIND_SERVER,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={
                    "service.name": "service-a",
                },
                attributes={},
            ),
            Traces(
                timestamp=now - timedelta(seconds=2),
                duration=timedelta(seconds=1),
                trace_id=service_b_trace_id,
                span_id=service_b_span_id,
                parent_span_id="",
                name="operation-b",
                kind=TracesKind.SPAN_KIND_SERVER,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={
                    "service.name": "service-b",
                },
                attributes={},
            ),
        ]
    )

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    # Calculate timestamps in nanoseconds
    start_ns = int((now - timedelta(minutes=5)).timestamp() * 1e9)
    end_ns = int(now.timestamp() * 1e9)

    body = QueryRangeRequest(
        start=start_ns,
        end=end_ns,
        queries=[
            BuilderQuery(
                signal="traces",
                name="A",
                limit=1000,
                filter_expression="service.name = 'service-a'",
            )
        ],
    ).to_dict()

    # Export traces with filter
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/export_raw_data?format=jsonl"),
        json=body,
        timeout=10,
        headers={
            "authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == HTTPStatus.OK
    assert response.headers["Content-Type"] == "application/x-ndjson"

    # Parse JSONL content
    jsonl_lines = response.text.strip().split("\n")
    assert len(jsonl_lines) == 1, f"Expected 1 line (filtered), got {len(jsonl_lines)}"

    # Verify the filtered trace
    filtered_obj = json.loads(jsonl_lines[0])
    assert filtered_obj["trace_id"] == service_a_trace_id
    assert filtered_obj["name"] == "operation-a"


def test_export_traces_with_limit(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
    insert_traces: Callable[[list[Traces]], None],
) -> None:
    """
    Setup:
    Insert 5 traces.

    Tests:
    1. Export traces with limit applied
    2. Verify only limited number of traces are returned
    """
    now = datetime.now(tz=UTC).replace(second=0, microsecond=0)

    traces = []
    for i in range(5):
        traces.append(
            Traces(
                timestamp=now - timedelta(seconds=i),
                duration=timedelta(seconds=1),
                trace_id=TraceIdGenerator.trace_id(),
                span_id=TraceIdGenerator.span_id(),
                parent_span_id="",
                name=f"operation-{i}",
                kind=TracesKind.SPAN_KIND_SERVER,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={
                    "service.name": "test-service",
                },
                attributes={},
            )
        )

    insert_traces(traces)

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    # Calculate timestamps in nanoseconds
    start_ns = int((now - timedelta(minutes=5)).timestamp() * 1e9)
    end_ns = int(now.timestamp() * 1e9)

    body = QueryRangeRequest(
        start=start_ns,
        end=end_ns,
        queries=[BuilderQuery(signal="traces", name="A", limit=3)],
    ).to_dict()

    # Export traces with limit
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/export_raw_data?format=csv"),
        json=body,
        timeout=10,
        headers={
            "authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == HTTPStatus.OK
    assert response.headers["Content-Type"] == "text/csv"

    # Parse CSV content
    csv_content = response.text
    csv_reader = csv.DictReader(io.StringIO(csv_content))

    rows = list(csv_reader)
    assert len(rows) == 3, f"Expected 3 rows (limited), got {len(rows)}"


def test_export_traces_multiple_queries_rejected(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
) -> None:
    """
    Tests:
    1. POST with multiple builder queries but no trace operator is rejected
    2. Verify 400 error is returned
    """
    now = datetime.now(tz=UTC).replace(second=0, microsecond=0)
    start_ns = int((now - timedelta(minutes=5)).timestamp() * 1e9)
    end_ns = int(now.timestamp() * 1e9)

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    body = QueryRangeRequest(
        start=start_ns,
        end=end_ns,
        request_type=None,
        queries=[
            BuilderQuery(
                signal="traces",
                name="A",
                limit=1000,
                filter_expression="service.name = 'service-a'",
            ),
            BuilderQuery(
                signal="traces",
                name="B",
                limit=1000,
                filter_expression="service.name = 'service-b'",
            ),
        ],
    ).to_dict()

    url = signoz.self.host_configs["8080"].get("/api/v1/export_raw_data?format=jsonl")
    response = requests.post(
        url,
        json=body,
        timeout=10,
        headers={
            "authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_export_traces_with_composite_query_trace_operator(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
    insert_traces: Callable[[list[Traces]], None],
) -> None:
    """
    Setup:
    Insert a parent span and two child spans, all with an http.method attribute.

    Tests:
    1. Basic trace operator (A => B) returning parent spans, ordered by timestamp.
    2. Same operator with selectFields=[service.name] and order by http.method, which is
       NOT in selectFields — verifies the inner/outer subquery fix for the CH 25.12.5
       NOT_FOUND_COLUMN_IN_BLOCK regression (ORDER BY col AS `col` in a CTE shape).
    """
    parent_trace_id = TraceIdGenerator.trace_id()
    parent_span_id = TraceIdGenerator.span_id()
    child_span_id_1 = TraceIdGenerator.span_id()
    child_span_id_2 = TraceIdGenerator.span_id()

    now = datetime.now(tz=UTC).replace(second=0, microsecond=0)

    insert_traces(
        [
            Traces(
                timestamp=now - timedelta(seconds=10),
                duration=timedelta(seconds=5),
                trace_id=parent_trace_id,
                span_id=parent_span_id,
                parent_span_id="",
                name="parent-operation",
                kind=TracesKind.SPAN_KIND_SERVER,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={"service.name": "parent-service"},
                attributes={"operation.type": "parent", "http.method": "GET"},
            ),
            Traces(
                timestamp=now - timedelta(seconds=9),
                duration=timedelta(seconds=2),
                trace_id=parent_trace_id,
                span_id=child_span_id_1,
                parent_span_id=parent_span_id,
                name="child-operation-1",
                kind=TracesKind.SPAN_KIND_INTERNAL,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={"service.name": "parent-service"},
                attributes={"operation.type": "child", "http.method": "POST"},
            ),
            Traces(
                timestamp=now - timedelta(seconds=7),
                duration=timedelta(seconds=1),
                trace_id=parent_trace_id,
                span_id=child_span_id_2,
                parent_span_id=parent_span_id,
                name="child-operation-2",
                kind=TracesKind.SPAN_KIND_INTERNAL,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={"service.name": "parent-service"},
                attributes={"operation.type": "child", "http.method": "POST"},
            ),
        ]
    )

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    start_ns = int((now - timedelta(minutes=5)).timestamp() * 1e9)
    end_ns = int(now.timestamp() * 1e9)

    url = signoz.self.host_configs["8080"].get("/api/v1/export_raw_data?format=jsonl")
    query_a = BuilderQuery(
        signal="traces",
        name="A",
        limit=1000,
        filter_expression="operation.type = 'parent'",
    )
    query_b = BuilderQuery(
        signal="traces",
        name="B",
        limit=1000,
        filter_expression="operation.type = 'child'",
    )

    def export(operator: TraceOperatorQuery) -> list[dict]:
        body = QueryRangeRequest(
            start=start_ns,
            end=end_ns,
            queries=[query_a, query_b, operator],
        ).to_dict()
        resp = requests.post(
            url,
            json=body,
            timeout=10,
            headers={"authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        assert resp.status_code == HTTPStatus.OK, resp.text
        assert resp.headers["Content-Type"] == "application/x-ndjson"
        return [json.loads(line) for line in resp.text.strip().split("\n") if line]

    # Test 1: basic trace operator ordered by timestamp
    spans = export(
        TraceOperatorQuery(
            name="C",
            expression="A => B",
            return_spans_from="A",
            limit=1000,
            order=[OrderBy(TelemetryFieldKey("timestamp", "string", "span"), "desc")],
        )
    )
    assert len(spans) == 1
    assert all(s.get("trace_id") == parent_trace_id for s in spans)
    assert any(s.get("name") == "parent-operation" for s in spans)

    # Test 2: order-by field (http.method) absent from selectFields
    spans = export(
        TraceOperatorQuery(
            name="C",
            expression="A => B",
            return_spans_from="A",
            limit=1000,
            select_fields=[TelemetryFieldKey("service.name", "string", "resource")],
            order=[OrderBy(TelemetryFieldKey("http.method", "string", "tag"), "desc")],
        )
    )
    assert len(spans) >= 1
    assert all(s.get("trace_id") == parent_trace_id for s in spans)
    assert any(s.get("name") == "parent-operation" for s in spans)


def test_export_traces_with_select_fields(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
    insert_traces: Callable[[list[Traces]], None],
) -> None:
    """
    Setup:
    Insert traces with various attributes.

    Tests:
    1. Export traces with specific select fields via POST
    2. Verify only specified fields are returned in the output
    """
    trace_id = TraceIdGenerator.trace_id()
    span_id = TraceIdGenerator.span_id()

    now = datetime.now(tz=UTC).replace(second=0, microsecond=0)

    insert_traces(
        [
            Traces(
                timestamp=now - timedelta(seconds=10),
                duration=timedelta(seconds=2),
                trace_id=trace_id,
                span_id=span_id,
                parent_span_id="",
                name="test-operation",
                kind=TracesKind.SPAN_KIND_SERVER,
                status_code=TracesStatusCode.STATUS_CODE_OK,
                status_message="",
                resources={
                    "service.name": "test-service",
                    "deployment.environment": "production",
                    "host.name": "server-01",
                },
                attributes={
                    "http.method": "POST",
                    "http.status_code": "201",
                    "user.id": "user123",
                },
            ),
        ]
    )

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    # Calculate timestamps in nanoseconds
    start_ns = int((now - timedelta(minutes=5)).timestamp() * 1e9)
    end_ns = int(now.timestamp() * 1e9)

    body = QueryRangeRequest(
        start=start_ns,
        end=end_ns,
        queries=[
            BuilderQuery(
                signal="traces",
                name="A",
                limit=1000,
                select_fields=[
                    TelemetryFieldKey("trace_id", "string", "span"),
                    TelemetryFieldKey("span_id", "string", "span"),
                    TelemetryFieldKey("name", "string", "span"),
                    TelemetryFieldKey("service.name", "string", "resource"),
                ],
            )
        ],
    ).to_dict()

    url = signoz.self.host_configs["8080"].get("/api/v1/export_raw_data?format=jsonl")
    response = requests.post(
        url,
        json=body,
        timeout=10,
        headers={
            "authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == HTTPStatus.OK
    assert response.headers["Content-Type"] == "application/x-ndjson"

    # Parse JSONL content
    jsonl_lines = response.text.strip().split("\n")
    assert len(jsonl_lines) == 1

    # Verify the selected fields are present
    result = json.loads(jsonl_lines[0])
    assert "trace_id" in result
    assert "span_id" in result
    assert "name" in result

    # Verify values
    assert result["trace_id"] == trace_id
    assert result["span_id"] == span_id
    assert result["name"] == "test-operation"
