import datetime
import os
from typing import Any

import isodate
import requests

from fixtures import types


# parses the given timestamp string from ISO format to datetime.datetime
def parse_timestamp(ts_str: str) -> datetime.datetime:
    """
    Parse a timestamp string from ISO format.
    """
    if ts_str.endswith("Z"):
        ts_str = ts_str[:-1] + "+00:00"
    return datetime.datetime.fromisoformat(ts_str)


# parses the given duration to datetime.timedelta
def parse_duration(duration: Any) -> datetime.timedelta:
    """
    Parse a duration string from ISO format.
    """
    # if it's string then parse it as iso format
    if isinstance(duration, str):
        return isodate.parse_duration(duration)
    if isinstance(duration, datetime.timedelta):
        return duration
    return datetime.timedelta(seconds=duration)


def get_testdata_file_path(file: str) -> str:
    testdata_dir = os.path.join(os.path.dirname(__file__), "..", "testdata")
    return os.path.join(testdata_dir, file)


def get_user_by_email(signoz: types.SigNoz, admin_token: str, email: str) -> dict:
    """Helper to get a user by email."""
    headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
    response = requests.get(
        signoz.self.host_configs["8080"].get("/api/v2/users"),
        timeout=2,
        headers=headers,
    )
    return next(
        (user for user in response.json()["data"] if user["email"] == email),
        None,
    )


def get_user_role_names(signoz: types.SigNoz, admin_token: str, user_id: str) -> list:
    """Helper to get the user roles by user ID"""
    headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
    response = requests.get(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{user_id}/roles"),
        timeout=2,
        headers=headers,
    )

    roles = response.json()["data"]
    if not roles:
        return []

    return [role["name"] for role in roles]


def get_user_roles(signoz: types.SigNoz, admin_token: str, user_id: str) -> list:
    """Helper to get the user roles (full objects) by user ID"""
    headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
    response = requests.get(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{user_id}/roles"),
        timeout=2,
        headers=headers,
    )
    return response.json()["data"] or []


def add_user_role(signoz: types.SigNoz, admin_token: str, user_id: str, role_name: str) -> None:
    """Helper to add a role to a user via POST /api/v2/users/{id}/roles"""
    response = requests.post(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{user_id}/roles"),
        json={"name": role_name},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == 200, f"failed to add role {role_name}: {response.text}"


def remove_user_role_by_name(
    signoz: types.SigNoz, admin_token: str, user_id: str, role_name: str
) -> None:
    """Helper to remove a role from a user by role name"""
    roles = get_user_roles(signoz, admin_token, user_id)
    role_id = next((r["id"] for r in roles if r["name"] == role_name), None)
    assert role_id is not None, f"role {role_name} not found for user {user_id}"
    response = requests.delete(
        signoz.self.host_configs["8080"].get(f"/api/v2/users/{user_id}/roles/{role_id}"),
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=2,
    )
    assert response.status_code == 204, f"failed to remove role {role_name}: {response.text}"


def set_user_roles(
    signoz: types.SigNoz, admin_token: str, user_id: str, desired_role_names: list
) -> None:
    """Helper to set exact roles for a user using POST/DELETE endpoints"""
    current_roles = get_user_roles(signoz, admin_token, user_id)
    current_names = {r["name"] for r in current_roles}
    desired_names = set(desired_role_names)

    # Remove roles not in desired set
    for role in current_roles:
        if role["name"] not in desired_names:
            response = requests.delete(
                signoz.self.host_configs["8080"].get(
                    f"/api/v2/users/{user_id}/roles/{role['id']}"
                ),
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=2,
            )
            assert response.status_code == 204

    # Add roles not in current set
    for name in desired_names:
        if name not in current_names:
            add_user_role(signoz, admin_token, user_id, name)
