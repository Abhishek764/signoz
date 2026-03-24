from http import HTTPStatus
from typing import Callable, Tuple

import requests

from fixtures import types
from fixtures.utils import get_user_role_names


def test_change_role(
    signoz: types.SigNoz,
    get_token: Callable[[str, str], str],
    get_tokens: Callable[[str, str], Tuple[str, str]],
):
    admin_token = get_token("admin@integration.test", "password123Z$")

    # Create a new user as VIEWER
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/invite"),
        json={"email": "admin+rolechange@integration.test", "role": "VIEWER"},
        timeout=2,
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == HTTPStatus.CREATED

    invited_user = response.json()["data"]
    reset_token = invited_user["token"]

    # Activate user via reset password
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/resetPassword"),
        json={"password": "password123Z$", "token": reset_token},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Make some API calls as new user
    new_user_token, new_user_refresh_token = get_tokens(
        "admin+rolechange@integration.test", "password123Z$"
    )

    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )

    assert response.status_code == HTTPStatus.OK

    new_user_id = response.json()["data"]["id"]

    # Make some API call which is protected
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/org/preferences"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )

    assert response.status_code == HTTPStatus.FORBIDDEN

    # Change the new user's role - move to ADMIN
    response = requests.put(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{new_user_id}"),
        json={
            "displayName": "role change user",
            "roleNames": ["signoz-admin"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )

    assert response.status_code == HTTPStatus.NO_CONTENT

    # Make some API calls again
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED

    # Rotate token for new user
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v2/sessions/rotate"),
        json={
            "refreshToken": new_user_refresh_token,
        },
        headers={"Authorization": f"Bearer {new_user_token}"},
        timeout=2,
    )

    assert response.status_code == HTTPStatus.OK

    # Make some API call again which is protected
    rotate_response = response.json()["data"]
    new_user_token, new_user_refresh_token = (
        rotate_response["accessToken"],
        rotate_response["refreshToken"],
    )

    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/org/preferences"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )

    assert response.status_code == HTTPStatus.OK


def test_remove_all_roles(
    signoz: types.SigNoz,
    get_token: Callable[[str, str], str],
    get_tokens: Callable[[str, str], Tuple[str, str]],
):
    admin_token = get_token("admin@integration.test", "password123Z$")

    # Create a new user as EDITOR
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/invite"),
        json={"email": "admin+noroles@integration.test", "role": "EDITOR"},
        timeout=2,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == HTTPStatus.CREATED

    invited_user = response.json()["data"]
    reset_token = invited_user["token"]

    # Activate user via reset password
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/resetPassword"),
        json={"password": "password123Z$", "token": reset_token},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Login and get user id
    new_user_token, new_user_refresh_token = get_tokens(
        "admin+noroles@integration.test", "password123Z$"
    )

    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.OK
    new_user_id = response.json()["data"]["id"]

    # Validate the user has the editor role
    role_names = get_user_role_names(signoz, admin_token, new_user_id)
    assert role_names is not None
    assert "signoz-editor" in role_names

    # Remove all roles
    response = requests.put(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{new_user_id}"),
        json={
            "displayName": "no roles user",
            "roleNames": [],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Validate the user has no roles
    role_names = get_user_role_names(signoz, admin_token, new_user_id)
    assert role_names is None or len(role_names) == 0

    # Old token should be invalidated after role change
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.UNAUTHORIZED

    # Rotate token — new token should also fail API calls
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v2/sessions/rotate"),
        json={
            "refreshToken": new_user_refresh_token,
        },
        headers={"Authorization": f"Bearer {new_user_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.OK

    rotate_response = response.json()["data"]
    new_user_token = rotate_response["accessToken"]

    # API calls with new token should be forbidden (no roles)
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.FORBIDDEN


def test_multiple_roles(
    signoz: types.SigNoz,
    get_token: Callable[[str, str], str],
    get_tokens: Callable[[str, str], Tuple[str, str]],
):
    admin_token = get_token("admin@integration.test", "password123Z$")

    # Create a new user as VIEWER
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/invite"),
        json={"email": "admin+multirole@integration.test", "role": "VIEWER"},
        timeout=2,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == HTTPStatus.CREATED

    invited_user = response.json()["data"]
    reset_token = invited_user["token"]

    # Activate user via reset password
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v1/resetPassword"),
        json={"password": "password123Z$", "token": reset_token},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Login and get user id
    new_user_token, new_user_refresh_token = get_tokens(
        "admin+multirole@integration.test", "password123Z$"
    )

    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.OK
    new_user_id = response.json()["data"]["id"]

    # Validate user starts with viewer role
    role_names = get_user_role_names(signoz, admin_token, new_user_id)
    assert role_names is not None
    assert role_names == ["signoz-viewer"], f"expected ['signoz-viewer'], got {role_names}"

    # As viewer, admin-only APIs should be forbidden
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/org/preferences"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.FORBIDDEN

    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.FORBIDDEN

    # Assign multiple roles: editor + viewer
    response = requests.put(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{new_user_id}"),
        json={
            "displayName": "multi role user",
            "roleNames": ["signoz-editor", "signoz-viewer"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Validate user has both roles
    role_names = get_user_role_names(signoz, admin_token, new_user_id)
    assert role_names is not None
    assert sorted(role_names) == ["signoz-editor", "signoz-viewer"], (
        f"expected ['signoz-editor', 'signoz-viewer'], got {sorted(role_names)}"
    )

    # Rotate token to pick up new roles
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v2/sessions/rotate"),
        json={"refreshToken": new_user_refresh_token},
        headers={"Authorization": f"Bearer {new_user_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.OK

    rotate_response = response.json()["data"]
    new_user_token = rotate_response["accessToken"]
    new_user_refresh_token = rotate_response["refreshToken"]

    # Verify /me includes both roles
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users/me"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.OK
    me_role_names = sorted(r["name"] for r in response.json()["data"]["roles"])
    assert me_role_names == ["signoz-editor", "signoz-viewer"], (
        f"expected ['signoz-editor', 'signoz-viewer'] in /me, got {me_role_names}"
    )

    # Editor+viewer still cannot access admin-only APIs
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/org/preferences"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.FORBIDDEN

    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.FORBIDDEN

    # Assign all three roles including admin
    response = requests.put(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{new_user_id}"),
        json={
            "displayName": "multi role user",
            "roleNames": ["signoz-admin", "signoz-editor", "signoz-viewer"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    role_names = get_user_role_names(signoz, admin_token, new_user_id)
    assert sorted(role_names) == [
        "signoz-admin",
        "signoz-editor",
        "signoz-viewer",
    ], f"expected all three roles, got {sorted(role_names)}"

    # Rotate token to pick up admin role
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v2/sessions/rotate"),
        json={"refreshToken": new_user_refresh_token},
        headers={"Authorization": f"Bearer {new_user_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.OK

    rotate_response = response.json()["data"]
    new_user_token = rotate_response["accessToken"]
    new_user_refresh_token = rotate_response["refreshToken"]

    # Now with admin role, admin-only APIs should succeed
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/org/preferences"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.OK

    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.OK

    # Reduce back to single viewer role
    response = requests.put(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{new_user_id}"),
        json={
            "displayName": "multi role user",
            "roleNames": ["signoz-viewer"],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.NO_CONTENT

    role_names = get_user_role_names(signoz, admin_token, new_user_id)
    assert role_names == ["signoz-viewer"], (
        f"expected ['signoz-viewer'] after reduction, got {role_names}"
    )

    # Rotate token to pick up reduced roles
    response = requests.post(
        signoz.self.host_configs["8080"].get("/api/v2/sessions/rotate"),
        json={"refreshToken": new_user_refresh_token},
        headers={"Authorization": f"Bearer {new_user_token}"},
        timeout=2,
    )
    assert response.status_code == HTTPStatus.OK

    rotate_response = response.json()["data"]
    new_user_token = rotate_response["accessToken"]

    # After reducing to viewer, admin-only APIs should be forbidden again
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v1/org/preferences"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.FORBIDDEN

    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users"),
        timeout=2,
        headers={"Authorization": f"Bearer {new_user_token}"},
    )
    assert response.status_code == HTTPStatus.FORBIDDEN
