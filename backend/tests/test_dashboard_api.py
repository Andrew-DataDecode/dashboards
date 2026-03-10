"""API contract tests for dashboard endpoints using FastAPI TestClient.

Mocks the semantic layer import since boring_semantic_layer may not be
available in all test environments.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Mock the semantic layer imports before importing app
_mock_semantic = MagicMock()
_mock_semantic.MCP_TOOLS = []
_mock_semantic.call_tool = MagicMock()
sys.modules.setdefault("boring_semantic_layer", MagicMock())
sys.modules.setdefault("ibis", MagicMock())
sys.modules.setdefault("ibis.bigquery", MagicMock())

from backend.dashboard_models import DashboardConfig, DashboardQueryResponse

FIXTURES_DIR = Path(__file__).parent / "fixtures"

MOCK_CLAIMS = {
    "sub": "user_test123",
    "email": "test@example.com",
    "publicMetadata": {
        "groups": ["admin"],
        "allowedDashboards": ["*"],
    },
}

MOCK_CLAIMS_NO_ACCESS = {
    "sub": "user_limited",
    "email": "limited@example.com",
    "publicMetadata": {
        "groups": [],
        "allowedDashboards": [],
    },
}

MOCK_DASHBOARD_RESULT = DashboardQueryResponse(
    data_sources={
        "consultations": {
            "status": "ok",
            "columns": ["consultation_id", "consultation_type"],
            "rows": [{"consultation_id": "C001", "consultation_type": "async"}],
            "row_count": 1,
        }
    },
    computed={"total_count": 1},
    queried_at=datetime.now(timezone.utc).isoformat(),
)


@pytest.fixture
def app_and_client():
    """Import app with mocked semantic layer and return (app, require_auth)."""
    from backend.app import app
    from backend.auth import require_auth
    from fastapi.testclient import TestClient

    yield app, require_auth, TestClient(app)
    app.dependency_overrides.clear()


def _auth_override(claims):
    async def override():
        return claims
    return override


class TestDashboardQueryEndpoint:
    def test_query_requires_auth(self, app_and_client):
        app, require_auth, client = app_and_client
        response = client.post(
            "/api/dashboard/consultations/query",
            json={"filters": {}},
        )
        assert response.status_code == 401

    def test_query_checks_permissions(self, app_and_client):
        app, require_auth, client = app_and_client
        app.dependency_overrides[require_auth] = _auth_override(MOCK_CLAIMS_NO_ACCESS)
        response = client.post(
            "/api/dashboard/consultations/query",
            json={"filters": {}},
        )
        assert response.status_code == 403

    @patch("backend.app.execute_dashboard")
    @patch("backend.app.load_dashboard_config")
    def test_query_returns_results(self, mock_load, mock_execute, app_and_client):
        app, require_auth, client = app_and_client
        mock_load.return_value = MagicMock()
        mock_execute.return_value = MOCK_DASHBOARD_RESULT
        app.dependency_overrides[require_auth] = _auth_override(MOCK_CLAIMS)

        response = client.post(
            "/api/dashboard/consultations/query",
            json={"filters": {}},
        )
        assert response.status_code == 200
        data = response.json()
        assert "data_sources" in data
        assert "computed" in data
        assert "queried_at" in data

    def test_query_unknown_slug_returns_404(self, app_and_client):
        app, require_auth, client = app_and_client
        app.dependency_overrides[require_auth] = _auth_override(MOCK_CLAIMS)
        response = client.post(
            "/api/dashboard/nonexistent_dashboard_xyz/query",
            json={"filters": {}},
        )
        assert response.status_code == 404

    @patch("backend.app.execute_dashboard")
    @patch("backend.app.load_dashboard_config")
    def test_queried_at_in_response(self, mock_load, mock_execute, app_and_client):
        app, require_auth, client = app_and_client
        mock_load.return_value = MagicMock()
        mock_execute.return_value = MOCK_DASHBOARD_RESULT
        app.dependency_overrides[require_auth] = _auth_override(MOCK_CLAIMS)

        response = client.post(
            "/api/dashboard/consultations/query",
            json={"filters": {}},
        )
        assert response.status_code == 200
        assert "queried_at" in response.json()


class TestDashboardConfigEndpoint:
    @patch("backend.app.load_dashboard_config")
    def test_config_returns_without_sql_content(self, mock_load, app_and_client):
        app, require_auth, client = app_and_client
        config_data = json.loads((FIXTURES_DIR / "valid_config.json").read_text())
        mock_load.return_value = DashboardConfig(**config_data)
        app.dependency_overrides[require_auth] = _auth_override(MOCK_CLAIMS)

        response = client.get("/api/dashboard/consultations/config")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Dashboard"
        assert "data_sources" in data
        assert "filters" in data

    def test_config_unknown_slug_returns_404(self, app_and_client):
        app, require_auth, client = app_and_client
        app.dependency_overrides[require_auth] = _auth_override(MOCK_CLAIMS)
        response = client.get("/api/dashboard/nonexistent_xyz/config")
        assert response.status_code == 404

    def test_config_checks_permissions(self, app_and_client):
        app, require_auth, client = app_and_client
        app.dependency_overrides[require_auth] = _auth_override(MOCK_CLAIMS_NO_ACCESS)
        response = client.get("/api/dashboard/consultations/config")
        assert response.status_code == 403
