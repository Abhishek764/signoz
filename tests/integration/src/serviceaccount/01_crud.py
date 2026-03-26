from http import HTTPStatus
from typing import Callable

import requests

from fixtures import types
from fixtures.auth import USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD
from fixtures.logger import setup_logger
from fixtures.serviceaccount import SA_BASE, create_sa, find_sa_by_name

logger = setup_logger(__name__)


def test_create_service_account(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = requests.post(
        signoz.self.host_configs["8080"].get(SA_BASE),
        json={"name": "test-sa", "roles": [{"name": "signoz-admin"}]},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )

    assert response.status_code == HTTPStatus.CREATED, response.text
    data = response.json()["data"]
    assert "id" in data
    assert len(data["id"]) > 0


def test_create_service_account_invalid_name(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    # name with spaces should be rejected
    response = requests.post(
        signoz.self.host_configs["8080"].get(SA_BASE),
        json={"name": "invalid name", "roles": [{"name": "signoz-admin"}]},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST, response.text


def test_create_service_account_empty_roles(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = requests.post(
        signoz.self.host_configs["8080"].get(SA_BASE),
        json={"name": "no-roles-sa", "roles": []},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST, response.text


def test_list_service_accounts(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = requests.get(
        signoz.self.host_configs["8080"].get(SA_BASE),
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )

    assert response.status_code == HTTPStatus.OK, response.text
    data = response.json()["data"]
    assert isinstance(data, list)

    # should contain the SA we created in the earlier test
    names = [sa["name"] for sa in data]
    assert "test-sa" in names


def test_get_service_account(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    sa = find_sa_by_name(signoz, token, "test-sa")

    response = requests.get(
        signoz.self.host_configs["8080"].get(f"{SA_BASE}/{sa['id']}"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )

    assert response.status_code == HTTPStatus.OK, response.text
    data = response.json()["data"]
    assert data["id"] == sa["id"]
    assert data["name"] == "test-sa"
    assert data["status"] == "active"
    assert "email" in data
    assert "roles" in data


def test_get_service_account_not_found(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    response = requests.get(
        signoz.self.host_configs["8080"].get(
            f"{SA_BASE}/00000000-0000-0000-0000-000000000000"
        ),
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )

    assert response.status_code == HTTPStatus.NOT_FOUND, response.text


def test_update_service_account(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    sa = find_sa_by_name(signoz, token, "test-sa")

    response = requests.put(
        signoz.self.host_configs["8080"].get(f"{SA_BASE}/{sa['id']}"),
        json={"name": "test-sa-updated", "roles": [{"name": "signoz-viewer"}]},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )

    assert response.status_code == HTTPStatus.NO_CONTENT, response.text

    # verify the update
    get_resp = requests.get(
        signoz.self.host_configs["8080"].get(f"{SA_BASE}/{sa['id']}"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    assert get_resp.json()["data"]["name"] == "test-sa-updated"


def test_delete_service_account(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    sa_id = create_sa(signoz, token, "sa-to-disable")

    response = requests.put(
        signoz.self.host_configs["8080"].get(f"{SA_BASE}/{sa_id}/status"),
        json={"status": "deleted"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )

    assert response.status_code == HTTPStatus.NO_CONTENT, response.text

    # verify status changed
    get_resp = requests.get(
        signoz.self.host_configs["8080"].get(f"{SA_BASE}/{sa_id}"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    assert get_resp.json()["data"]["status"] == "deleted"


def test_create_after_delete_reuses_name(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    """The partial unique index on (name, org_id) excludes deleted rows,
    so create → delete → create with the same name must succeed."""
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    sa_name = "sa-reuse-name"

    # 1. create
    first_id = create_sa(signoz, token, sa_name)

    # 2. creating again with the same name should fail (conflict)
    dup_resp = requests.post(
        signoz.self.host_configs["8080"].get(SA_BASE),
        json={"name": sa_name, "roles": [{"name": "signoz-viewer"}]},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    assert dup_resp.status_code == HTTPStatus.CONFLICT, dup_resp.text

    # 3. disable the first one
    disable_resp = requests.put(
        signoz.self.host_configs["8080"].get(f"{SA_BASE}/{first_id}/status"),
        json={"status": "deleted"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    assert disable_resp.status_code == HTTPStatus.NO_CONTENT

    # 4. now creating with the same name should succeed
    second_id = create_sa(signoz, token, sa_name)
    assert second_id != first_id, "New SA should have a different ID"


def test_force_delete_service_account(
    signoz: types.SigNoz,
    create_user_admin: types.Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    sa_id = create_sa(signoz, token, "sa-to-delete")

    response = requests.delete(
        signoz.self.host_configs["8080"].get(f"{SA_BASE}/{sa_id}"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )

    assert response.status_code == HTTPStatus.NO_CONTENT, response.text

    # verify it's gone
    get_resp = requests.get(
        signoz.self.host_configs["8080"].get(f"{SA_BASE}/{sa_id}"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    assert get_resp.status_code == HTTPStatus.NOT_FOUND
