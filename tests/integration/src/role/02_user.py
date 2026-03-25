from http import HTTPStatus
from typing import Callable

import pytest
import requests
from sqlalchemy import sql

from fixtures.auth import (
    USER_ADMIN_EMAIL,
    USER_ADMIN_NAME,
    USER_ADMIN_PASSWORD,
    USER_EDITOR_EMAIL,
    USER_EDITOR_PASSWORD,
)
from fixtures.types import Operation, SigNoz


def test_user_invite_accept_role_grant(
    request: pytest.FixtureRequest,
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    # invite a user as editor
    invite_payload = {
        "email": USER_EDITOR_EMAIL,
        "role": "EDITOR",
    }
    invite_response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/invite"),
        json=invite_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert invite_response.status_code == HTTPStatus.CREATED
    invited_user = invite_response.json()["data"]
    reset_token = invited_user["token"]

    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/resetPassword"),
        json={"password": USER_EDITOR_PASSWORD, "token": reset_token},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Login with editor email and password
    editor_token = get_token(USER_EDITOR_EMAIL, USER_EDITOR_PASSWORD)
    user_me_response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        headers={"Authorization": f"Bearer {editor_token}"},
        timeout=2,
    )
    assert user_me_response.status_code == HTTPStatus.OK
    editor_id = user_me_response.json()["data"]["id"]

    # check the forbidden response for admin api for editor user
    admin_roles_response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/roles"),
        headers={"Authorization": f"Bearer {editor_token}"},
        timeout=2,
    )
    assert admin_roles_response.status_code == HTTPStatus.FORBIDDEN

    roles_response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/roles"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert roles_response.status_code == HTTPStatus.OK
    org_id = roles_response.json()["data"][0]["orgId"]

    # check role assignment tuples in DB
    with signoz.sqlstore.conn.connect() as conn:
        tuple_object_id = f"organization/{org_id}/role/signoz-editor"
        tuple_result = conn.execute(
            sql.text("SELECT * FROM tuple WHERE object_id = :object_id"),
            {"object_id": tuple_object_id},
        )
        tuple_row = tuple_result.mappings().fetchone()
        assert tuple_row is not None
        assert tuple_row["object_type"] == "role"
        assert tuple_row["relation"] == "assignee"

        # verify the user tuple details depending on db provider
        if request.config.getoption("--sqlstore-provider") == "sqlite":
            user_object_id = f"organization/{org_id}/user/{editor_id}"
            assert tuple_row["user_object_type"] == "user"
            assert tuple_row["user_object_id"] == user_object_id
        else:
            _user = f"user:organization/{org_id}/user/{editor_id}"
            assert tuple_row["user_type"] == "user"
            assert tuple_row["_user"] == _user


def test_user_update_role_grant(
    request: pytest.FixtureRequest,
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    # Get the editor user's id
    editor_token = get_token(USER_EDITOR_EMAIL, USER_EDITOR_PASSWORD)
    user_me_response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        headers={"Authorization": f"Bearer {editor_token}"},
        timeout=2,
    )
    assert user_me_response.status_code == HTTPStatus.OK
    editor_id = user_me_response.json()["data"]["id"]

    # Get the role id for viewer
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    roles_response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/roles"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert roles_response.status_code == HTTPStatus.OK
    roles_data = roles_response.json()["data"]
    org_id = roles_data[0]["orgId"]

    # Add the viewer role to the user
    add_response = requests.post(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{editor_id}/roles"),
        json={"name": "signoz-viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert add_response.status_code == HTTPStatus.OK

    # Get the editor role id so we can remove it
    roles_list_response = requests.get(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{editor_id}/roles"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert roles_list_response.status_code == HTTPStatus.OK
    editor_role_id = next(
        r["id"] for r in roles_list_response.json()["data"] if r["name"] == "signoz-editor"
    )

    # Remove the editor role
    remove_response = requests.delete(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{editor_id}/roles/{editor_role_id}"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert remove_response.status_code == HTTPStatus.NO_CONTENT

    # Check that user no longer has the editor role in the db
    with signoz.sqlstore.conn.connect() as conn:
        editor_tuple_object_id = f"organization/{org_id}/role/signoz-editor"
        viewer_tuple_object_id = f"organization/{org_id}/role/signoz-viewer"
        # Check there is no tuple for signoz-editor assignment
        editor_tuple_result = conn.execute(
            sql.text(
                "SELECT * FROM tuple WHERE object_id = :object_id AND relation = 'assignee'"
            ),
            {"object_id": editor_tuple_object_id},
        )
        for row in editor_tuple_result.mappings().fetchall():
            if request.config.getoption("--sqlstore-provider") == "sqlite":
                user_object_id = f"organization/{org_id}/user/{editor_id}"
                assert row["user_object_id"] != user_object_id
            else:
                _user = f"user:organization/{org_id}/user/{editor_id}"
                assert row["_user"] != _user

        # Check that a tuple exists for signoz-viewer assignment
        viewer_tuple_result = conn.execute(
            sql.text(
                "SELECT * FROM tuple WHERE object_id = :object_id AND relation = 'assignee'"
            ),
            {"object_id": viewer_tuple_object_id},
        )
        row = viewer_tuple_result.mappings().fetchone()
        assert row is not None
        assert row["object_type"] == "role"
        assert row["relation"] == "assignee"
        if request.config.getoption("--sqlstore-provider") == "sqlite":
            user_object_id = f"organization/{org_id}/user/{editor_id}"
            assert row["user_object_type"] == "user"
            assert row["user_object_id"] == user_object_id
        else:
            _user = f"user:organization/{org_id}/user/{editor_id}"
            assert row["user_type"] == "user"
            assert row["_user"] == _user


def test_user_delete_role_revoke(
    request: pytest.FixtureRequest,
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    # login with editor to get the user_id and check if user exists
    editor_token = get_token(USER_EDITOR_EMAIL, USER_EDITOR_PASSWORD)
    user_me_response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        headers={"Authorization": f"Bearer {editor_token}"},
        timeout=2,
    )
    assert user_me_response.status_code == HTTPStatus.OK
    editor_id = user_me_response.json()["data"]["id"]

    # delete the editor user
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)
    delete_response = requests.delete(
        signoz.self.host_configs["8080"].get(f"/api/v1/user/{editor_id}"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert delete_response.status_code == HTTPStatus.NO_CONTENT

    # get the role id from roles list
    roles_response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/roles"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert roles_response.status_code == HTTPStatus.OK
    org_id = roles_response.json()["data"][0]["orgId"]
    tuple_object_id = f"organization/{org_id}/role/signoz-editor"

    with signoz.sqlstore.conn.connect() as conn:
        tuple_result = conn.execute(
            sql.text(
                "SELECT * FROM tuple WHERE object_id = :object_id AND relation = 'assignee'"
            ),
            {"object_id": tuple_object_id},
        )

        # there should NOT be any tuple for the current user assignment
        tuple_rows = tuple_result.mappings().fetchall()
        for row in tuple_rows:
            if request.config.getoption("--sqlstore-provider") == "sqlite":
                user_object_id = f"organization/{org_id}/user/{editor_id}"
                assert row["user_object_id"] != user_object_id
            else:
                _user = f"user:organization/{org_id}/user/{editor_id}"
                assert row["_user"] != _user


def test_update_my_user(
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    # Update own display name via PUT /api/v2/users/me
    response = requests.put(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        json={"displayName": "updated admin name"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Verify the update via GET /api/v2/users/me
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.OK
    assert response.json()["data"]["displayName"] == "updated admin name"

    # Restore original name
    response = requests.put(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        json={"displayName": USER_ADMIN_NAME},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT


def test_update_user_by_id(
    signoz: SigNoz,
    create_user_admin: Operation,  # pylint: disable=unused-argument
    get_token: Callable[[str, str], str],
):
    admin_token = get_token(USER_ADMIN_EMAIL, USER_ADMIN_PASSWORD)

    # Invite a user to update
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/invite"),
        json={"email": "admin+updatetest@integration.test", "role": "VIEWER"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.CREATED
    reset_token = response.json()["data"]["token"]

    # Activate user
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/resetPassword"),
        json={"password": "password123Z$", "token": reset_token},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Get user id
    user_token = get_token("admin+updatetest@integration.test", "password123Z$")
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        headers={"Authorization": f"Bearer {user_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.OK
    user_id = response.json()["data"]["id"]

    # Admin updates user's display name via PUT /api/v2/users/{id}
    response = requests.put(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{user_id}"),
        json={"displayName": "renamed user"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Verify via GET /api/v2/users/{id}
    response = requests.get(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{user_id}"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.OK
    assert response.json()["data"]["displayName"] == "renamed user"

    # Self-update should be rejected
    me_response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    admin_id = me_response.json()["data"]["id"]

    response = requests.put(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{admin_id}"),
        json={"displayName": "self update"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST
