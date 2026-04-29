import json
from collections.abc import Callable
from http import HTTPStatus
from pathlib import Path

import requests

from fixtures.auth import USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD
from fixtures.types import Operation, SigNoz

_PERSES_FIXTURE = (
    Path(__file__).parents[4]
    / "pkg/types/dashboardtypes/dashboardtypesv2/testdata/perses.json"
)


def _post_dashboard(signoz: SigNoz, token: str, body: dict) -> requests.Response:
    return requests.post(
        signoz.self.host_configs["8080"].get("/api/v2/dashboards"),
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=2,
    )


def test_empty_body_rejected_for_missing_schema_version(
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = _post_dashboard(signoz, admin_token, {})

    assert response.status_code == HTTPStatus.BAD_REQUEST
    body = response.json()
    assert body["status"] == "error"
    assert body["error"]["code"] == "dashboard_invalid_input"
    assert body["error"]["message"] == 'metadata.schemaVersion must be "v6", got ""'


def test_missing_display_name_rejected(
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = _post_dashboard(signoz, admin_token, {"metadata": {"schemaVersion": "v6"}})

    assert response.status_code == HTTPStatus.BAD_REQUEST
    body = response.json()
    assert body["status"] == "error"
    assert body["error"]["code"] == "dashboard_invalid_input"
    assert body["error"]["message"] == "data.display.name is required"


def test_minimal_valid_body_creates_dashboard(
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = _post_dashboard(
        signoz,
        admin_token,
        {
            "metadata": {"schemaVersion": "v6"},
            "data": {"display": {"name": "test name"}},
        },
    )

    assert response.status_code == HTTPStatus.CREATED
    body = response.json()
    assert body["status"] == "success"
    data = body["data"]
    assert data["info"]["data"]["display"]["name"] == "test name"
    assert data["info"]["metadata"]["schemaVersion"] == "v6"


def test_unknown_root_field_rejected(
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = _post_dashboard(
        signoz,
        admin_token,
        {
            "metadata": {"schemaVersion": "v6"},
            "data": {"display": {"name": "test name"}},
            "unknownfieldattheroot": "shouldgiveanerror",
        },
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    body = response.json()
    assert body["status"] == "error"
    assert body["error"]["code"] == "dashboard_invalid_input"
    assert body["error"]["message"] == 'json: unknown field "unknownfieldattheroot"'


def test_unknown_nested_field_rejected(
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = _post_dashboard(
        signoz,
        admin_token,
        {
            "metadata": {"schemaVersion": "v6"},
            "data": {
                "display": {
                    "name": "test name",
                    "unknownfieldinside": "shouldgiveanerror",
                },
            },
        },
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    body = response.json()
    assert body["status"] == "error"
    assert body["error"]["code"] == "dashboard_invalid_input"
    assert body["error"]["message"] == 'json: unknown field "unknownfieldinside"'


def test_perses_fixture_creates_dashboard(
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    """The perses.json fixture is the kitchen-sink dashboard the schema tests
    use; round-tripping it through the create API exercises the full plugin
    surface end-to-end."""
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    data = json.loads(_PERSES_FIXTURE.read_text())
    response = _post_dashboard(
        signoz,
        admin_token,
        {"metadata": {"schemaVersion": "v6"}, "data": data},
    )

    assert response.status_code == HTTPStatus.CREATED
    body = response.json()
    assert body["status"] == "success"
    assert body["data"]["info"]["data"]["display"]["name"] == data["display"]["name"]


def test_tag_casing_is_inherited_from_existing_parent(
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    """A second dashboard tagged with a sibling under a casing-variant parent
    path should adopt the existing parent's casing while keeping the
    user-supplied casing for the new leaf segment."""
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    first = _post_dashboard(
        signoz,
        admin_token,
        {
            "metadata": {"schemaVersion": "v6"},
            "data": {"display": {"name": "dac"}},
            "tags": [{"name": "engineering/US/NYC"}],
        },
    )
    assert first.status_code == HTTPStatus.CREATED
    first_tags = first.json()["data"]["info"]["tags"]
    assert first_tags == [{"name": "engineering/US/NYC"}]

    second = _post_dashboard(
        signoz,
        admin_token,
        {
            "metadata": {"schemaVersion": "v6"},
            "data": {"display": {"name": "dac"}},
            "tags": [{"name": "engineering/us/SF"}],
        },
    )
    assert second.status_code == HTTPStatus.CREATED
    second_tags = second.json()["data"]["info"]["tags"]
    assert second_tags == [{"name": "engineering/US/SF"}]
