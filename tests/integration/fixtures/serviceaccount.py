"""Fixtures and helpers for service account tests."""

from http import HTTPStatus

import requests

from fixtures import types
from fixtures.logger import setup_logger

logger = setup_logger(__name__)

SA_BASE = "/api/v1/service_accounts"


def create_sa(
    signoz: types.SigNoz, token: str, name: str, role: str = "signoz-viewer"
) -> str:
    """Create a service account and return its ID."""
    resp = requests.post(
        signoz.self.host_configs["8080"].get(SA_BASE),
        json={"name": name, "roles": [{"name": role}]},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    assert resp.status_code == HTTPStatus.CREATED, resp.text
    return resp.json()["data"]["id"]


def create_sa_with_key(
    signoz: types.SigNoz, token: str, name: str, role: str = "signoz-admin"
) -> tuple:
    """Create a service account with an API key and return (sa_id, api_key)."""
    sa_id = create_sa(signoz, token, name, role)

    key_resp = requests.post(
        signoz.self.host_configs["8080"].get(f"{SA_BASE}/{sa_id}/keys"),
        json={"name": "auth-key", "expiresAt": 0},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    assert key_resp.status_code == HTTPStatus.CREATED, key_resp.text
    api_key = key_resp.json()["data"]["key"]

    return sa_id, api_key


def find_sa_by_name(signoz: types.SigNoz, token: str, name: str) -> dict:
    """Find a service account by name from the list endpoint."""
    list_resp = requests.get(
        signoz.self.host_configs["8080"].get(SA_BASE),
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    assert list_resp.status_code == HTTPStatus.OK, list_resp.text
    return next(sa for sa in list_resp.json()["data"] if sa["name"] == name)
