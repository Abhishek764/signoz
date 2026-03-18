from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from typing import Callable, List, Optional, Union

import pytest

from fixtures import types
from fixtures.auth import USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD
from fixtures.metrics import Metrics
from fixtures.querier import (
    build_builder_query,
    build_order_by,
    get_all_series,
    get_series_values,
    make_query_request,
)
from fixtures.utils import get_testdata_file_path

FILE = get_testdata_file_path("gauge_data_1h.jsonl")


@pytest.mark.parametrize(
    "time_agg, space_agg, service, num_elements, start_val, first_val, twentieth_min_val, after_twentieth_min_val",
    [
        ("avg", "avg", "api", 60, 400, 800, 800, 400),
        ("avg", "avg", "web", 50, 800, 800, 800, 600),
        ("avg", "avg", "lab", 60, 500, 700, 700, 500),
        ("sum", "sum", "api", 60, 400, 800, 800, 400),
        ("sum", "sum", "web", 50, 800, 800, 800, 600),
        ("sum", "sum", "lab", 60, 1000, 1400, 1400, 1000),
        ("max", "max", "api", 60, 400, 800, 800, 400),
        ("max", "max", "web", 50, 800, 800, 800, 600),
        ("max", "max", "lab", 60, 600, 800, 800, 600),
        ("avg", "sum", "api", 60, 400, 800, 800, 400),
        ("avg", "sum", "web", 50, 800, 800, 800, 600),
        ("avg", "sum", "lab", 60, 500, 700, 700, 500),
        ("max", "sum", "api", 60, 400, 800, 800, 400),
        ("max", "sum", "web", 50, 800, 800, 800, 600),
        ("max", "sum", "lab", 60, 600, 800, 800, 600),
    ],
)
def test_for_one_service(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
    insert_metrics: Callable[[List[Metrics]], None],
    time_agg: str,
    space_agg: str,
    service: str,
    num_elements: float,
    start_val: float,
    first_val: float,
    twentieth_min_val: float,
    after_twentieth_min_val: float,  ## web service has a gap of 10 mins after the 20th minute
) -> None:
    now = datetime.now(tz=timezone.utc).replace(second=0, microsecond=0)
    start_ms = int((now - timedelta(minutes=65)).timestamp() * 1000)
    end_ms = int(now.timestamp() * 1000)
    metric_name = f"test_memory_{time_agg}_{space_agg}_{service}_usage"

    metrics = Metrics.load_from_file(
        FILE,
        base_time=now - timedelta(minutes=60),
        metric_name_override=metric_name,
    )
    insert_metrics(metrics)

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    query = build_builder_query(
        "A",
        metric_name,
        time_agg,
        space_agg,
        filter_expression=f'service = "{service}"',
    )

    response = make_query_request(signoz, token, start_ms, end_ms, [query])
    assert response.status_code == HTTPStatus.OK

    data = response.json()
    result_values = sorted(get_series_values(data, "A"), key=lambda x: x["timestamp"])
    assert len(result_values) == num_elements
    assert result_values[0]["value"] == start_val
    assert result_values[1]["value"] == first_val
    assert result_values[19]["value"] == twentieth_min_val
    assert result_values[20]["value"] == after_twentieth_min_val


@pytest.mark.parametrize(
    "time_agg, space_agg, start_val, first_val, twentieth_min_val, twenty_first_min_val, thirty_first_min_val",
    [
        ("avg", "avg", 566.667, 766.667, 766.667, 450, 500),
        ("avg", "sum", 1700, 2300, 2300, 900, 1500),
        ("avg", "max", 800, 800, 800, 500, 600),
        ("max", "avg", 600, 800, 800, 500, 533.333),
        ("max", "sum", 1800, 2400, 2400, 1000, 1600),
        ("max", "max", 800, 800, 800, 600, 600),
    ],
)
def test_for_multiple_aggregations(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
    insert_metrics: Callable[[List[Metrics]], None],
    time_agg: str,
    space_agg: str,
    start_val: float,
    first_val: float,
    twentieth_min_val: float,
    twenty_first_min_val: float,  ## web service has a gap of 10 mins after the 20th minute
    thirty_first_min_val: float,
) -> None:
    now = datetime.now(tz=timezone.utc).replace(second=0, microsecond=0)
    start_ms = int((now - timedelta(minutes=65)).timestamp() * 1000)
    end_ms = int(now.timestamp() * 1000)
    metric_name = f"test_memory_{time_agg}_{space_agg}_usage"

    metrics = Metrics.load_from_file(
        FILE,
        base_time=now - timedelta(minutes=60),
        metric_name_override=metric_name,
    )
    insert_metrics(metrics)

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    query = build_builder_query(
        "A",
        metric_name,
        time_agg,
        space_agg,
    )

    response = make_query_request(signoz, token, start_ms, end_ms, [query])
    assert response.status_code == HTTPStatus.OK

    data = response.json()
    result_values = sorted(get_series_values(data, "A"), key=lambda x: x["timestamp"])
    assert len(result_values) == 60
    assert result_values[0]["value"] == start_val
    assert result_values[1]["value"] == first_val
    assert result_values[19]["value"] == twentieth_min_val
    assert result_values[20]["value"] == twenty_first_min_val
    assert result_values[30]["value"] == thirty_first_min_val


@pytest.mark.parametrize(
    "metric_suffix,order_by,limit,expected_count,expected_services",
    [
        (
            "no_order",
            None,  # default ordering: desc by avg of all metric values for a group
            None,
            3,
            ["lab", "web", "api"],  # sum of all values: lab=42000, api=36000, web=34000. avg of all sums: lab=700, api=600, web=680
        ),
        (
            "only_limit",
            None,
            2,
            2,
            ["lab", "web"],  # top 2 by default desc: lab=42000, api=36000
        ),
        (
            "asc",
            [build_order_by("service", "asc")],
            None,
            3,
            ["api", "lab", "web"],
        ),
        (
            "asc_lim2",
            [build_order_by("service", "asc")],
            2,
            2,
            ["api", "lab"],
        ),
        (
            "desc",
            [build_order_by("service", "desc")],
            None,
            3,
            ["web", "lab", "api"],
        ),
        (
            "desc_lim2",
            [build_order_by("service", "desc")],
            2,
            2,
            ["web", "lab"],
        ),
        (
            "asc_metric_name",
            [build_order_by("sum(test_gauge_groupby_asc_metric_name)", "asc")],
            None,
            3,
            ["api", "web", "lab"],
        ),
        (
            "asc_metric_name_lim2",
            [build_order_by("sum(test_gauge_groupby_asc_metric_name_lim2)", "asc")],
            2,
            2,
            ["api", "web"],
        ),
        (
            "desc_metric_name",
            [build_order_by("sum(test_gauge_groupby_desc_metric_name)", "desc")],
            None,
            3,
            ["lab", "web", "api"], 
        ),
        (
            "desc_metric_name_lim2",
            [build_order_by("sum(test_gauge_groupby_desc_metric_name_lim2)", "desc")],
            2,
            2,
            ["lab", "web"],
        ),
    ],
)
def test_gauge_group_by_service(
    signoz: types.SigNoz,
    create_user_admin: None,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
    insert_metrics: Callable[[List[Metrics]], None],
    metric_suffix: str,
    order_by: Optional[List],
    limit: Optional[int],
    expected_count: int,
    expected_services: Union[set, List[str]],
) -> None:
    now = datetime.now(tz=timezone.utc).replace(second=0, microsecond=0)
    start_ms = int((now - timedelta(minutes=65)).timestamp() * 1000)
    end_ms = int(now.timestamp() * 1000)
    metric_name = f"test_gauge_groupby_{metric_suffix}"

    metrics = Metrics.load_from_file(
        FILE,
        base_time=now - timedelta(minutes=60),
        metric_name_override=metric_name,
    )
    insert_metrics(metrics)

    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    query = build_builder_query(
        "A",
        metric_name,
        "max",
        "sum",
        group_by=["service"],
        order_by=order_by,
        limit=limit,
    )

    response = make_query_request(signoz, token, start_ms, end_ms, [query])
    assert response.status_code == HTTPStatus.OK

    data = response.json()
    all_series = get_all_series(data, "A")

    assert (
        len(all_series) == expected_count
    ), f"Expected {expected_count} series, got {len(all_series)}"

    service_labels = [
        series.get("labels", [{}])[0].get("value", "unknown")
        for series in all_series
    ]

    if isinstance(expected_services, set):
        assert (
            set(service_labels) == expected_services
        ), f"Expected services {expected_services}, got {set(service_labels)}"
    else:
        assert service_labels == expected_services, (
            f"Expected services {expected_services}, got {service_labels}"
        )
