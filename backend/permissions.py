"""
Config-driven dashboard permissions.

Loads permissions.json once at import time and provides helpers
for extracting user permissions from Clerk JWT claims.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from . import config as app_config

_CONFIG_PATH = app_config.permissions_path()

_config: dict = {}


def _load_config() -> dict:
    global _config
    if _config:
        return _config
    try:
        _config = json.loads(_CONFIG_PATH.read_text())
    except FileNotFoundError:
        _config = {"groups": {}, "users": {}, "dashboards": {}}
    return _config


_load_config()


@dataclass
class UserPermissions:
    groups: list[str] = field(default_factory=list)
    allowed_dashboards: list[str] = field(default_factory=list)
    allowed_routes: list[str] = field(default_factory=list)


def get_user_permissions(claims: dict) -> UserPermissions:
    """Extract permissions from JWT publicMetadata claims."""
    metadata = claims.get("publicMetadata", claims.get("public_metadata", {}))
    if not metadata:
        metadata = {}

    groups = metadata.get("groups", [])
    allowed_dashboards = metadata.get("allowedDashboards", [])
    allowed_routes = metadata.get("allowedRoutes", [])

    return UserPermissions(
        groups=groups,
        allowed_dashboards=allowed_dashboards,
        allowed_routes=allowed_routes,
    )


def can_access_dashboard(perms: UserPermissions, slug: str) -> bool:
    """Check if user can access a specific dashboard slug."""
    if "*" in perms.allowed_dashboards:
        return True
    return slug in perms.allowed_dashboards


def get_dashboard_registry() -> dict:
    """Return the dashboards section of the config."""
    return _load_config().get("dashboards", {})


def is_admin(perms: UserPermissions) -> bool:
    """Return True if user has the 'admin' group."""
    return "admin" in perms.groups


def load_permissions_config() -> dict:
    """Return the full permissions config."""
    return _load_config()
