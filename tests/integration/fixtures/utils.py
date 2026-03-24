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
