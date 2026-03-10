"""Tests for dashboard API endpoints including list endpoint."""

from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from .app import app

client = TestClient(app)

MOCK_CLAIMS_ADMIN = {
    "sub": "user_admin",
    "email": "admin@test.com",
    "publicMetadata": {
        "groups": ["executive"],
        "allowedDashboards": ["*"],
        "allowedRoutes": ["/dashboards"],
    },
}

MOCK_CLAIMS_LIMITED = {
    "sub": "user_limited",
    "email": "limited@test.com",
    "publicMetadata": {
        "groups": ["ops"],
        "allowedDashboards": ["operations"],
        "allowedRoutes": ["/dashboards"],
    },
}

MOCK_CLAIMS_NONE = {
    "sub": "user_none",
    "email": "none@test.com",
    "publicMetadata": {
        "groups": [],
        "allowedDashboards": [],
        "allowedRoutes": [],
    },
}

MOCK_REGISTRY = {
    "operations": {"title": "Operations Dashboard", "description": "Daily ops metrics", "path": "/dashboards/operations"},
    "revenue": {"title": "Revenue Dashboard", "description": "Revenue tracking", "path": "/dashboards/revenue"},
}


def _override_auth(claims):
    """Create auth override dependency."""
    async def _auth():
        return claims
    return _auth


@patch("backend.permissions._config", {"groups": {}, "users": {}, "dashboards": MOCK_REGISTRY})
class TestListDashboards:
    def test_admin_sees_all_dashboards(self):
        from .auth import require_auth
        app.dependency_overrides[require_auth] = _override_auth(MOCK_CLAIMS_ADMIN)
        try:
            resp = client.get("/api/dashboards")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["dashboards"]) == 2
            slugs = {d["slug"] for d in data["dashboards"]}
            assert "operations" in slugs
            assert "revenue" in slugs
        finally:
            app.dependency_overrides.clear()

    def test_limited_user_sees_permitted_only(self):
        from .auth import require_auth
        app.dependency_overrides[require_auth] = _override_auth(MOCK_CLAIMS_LIMITED)
        try:
            resp = client.get("/api/dashboards")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["dashboards"]) == 1
            assert data["dashboards"][0]["slug"] == "operations"
        finally:
            app.dependency_overrides.clear()

    def test_no_access_returns_empty_list(self):
        from .auth import require_auth
        app.dependency_overrides[require_auth] = _override_auth(MOCK_CLAIMS_NONE)
        try:
            resp = client.get("/api/dashboards")
            assert resp.status_code == 200
            data = resp.json()
            assert data["dashboards"] == []
        finally:
            app.dependency_overrides.clear()

    def test_response_shape(self):
        from .auth import require_auth
        app.dependency_overrides[require_auth] = _override_auth(MOCK_CLAIMS_ADMIN)
        try:
            resp = client.get("/api/dashboards")
            data = resp.json()
            for d in data["dashboards"]:
                assert "slug" in d
                assert "title" in d
                assert "description" in d
        finally:
            app.dependency_overrides.clear()

    def test_requires_authentication(self):
        # No auth override = real auth required
        app.dependency_overrides.clear()
        resp = client.get("/api/dashboards")
        assert resp.status_code in (401, 403)
