#!/usr/bin/env python3
"""
Sync dashboard permissions from config to Clerk publicMetadata.

Reads dashboard-permissions.json, resolves each user's full dashboard list
(expanding groups and wildcards), then pushes to Clerk Backend API.

Usage:
    python sync-permissions.py --dry-run
    python sync-permissions.py
"""

import argparse
import json
import os
import sys
from pathlib import Path

import requests

CLERK_API_BASE = "https://api.clerk.com/v1"


def load_config(config_path: str) -> dict:
    path = Path(config_path)
    if not path.exists():
        print(f"Error: config file not found: {path}", file=sys.stderr)
        sys.exit(1)
    return json.loads(path.read_text())


def resolve_user_dashboards(config: dict, user_email: str) -> tuple[list[str], list[str], list[str]]:
    """Resolve a user's full dashboard list from groups + extra_dashboards.

    Returns (groups, allowed_dashboards, allowed_routes).
    """
    user_info = config["users"][user_email]
    user_groups = user_info["groups"]
    extra = user_info.get("extra_dashboards", [])
    group_defs = config["groups"]
    dashboards_registry = config["dashboards"]

    slugs = set()
    has_wildcard = False

    for group in user_groups:
        group_slugs = group_defs.get(group, [])
        if "*" in group_slugs:
            has_wildcard = True
        else:
            slugs.update(group_slugs)

    slugs.update(extra)

    if has_wildcard:
        allowed_dashboards = ["*"]
        allowed_routes = [f"/dashboards/{slug}" for slug in dashboards_registry]
    else:
        allowed_dashboards = sorted(slugs)
        allowed_routes = [f"/dashboards/{slug}" for slug in sorted(slugs)]

    return user_groups, allowed_dashboards, allowed_routes


def find_clerk_user(email: str, headers: dict) -> dict | None:
    """Find a Clerk user by email address."""
    resp = requests.get(
        f"{CLERK_API_BASE}/users",
        params={"email_address": email},
        headers=headers,
    )
    resp.raise_for_status()
    users = resp.json()
    for u in users:
        emails = [ea["email_address"] for ea in u.get("email_addresses", [])]
        if email in emails:
            return u
    return None


def update_clerk_metadata(user_id: str, metadata: dict, headers: dict) -> None:
    """Patch a Clerk user's publicMetadata."""
    resp = requests.patch(
        f"{CLERK_API_BASE}/users/{user_id}",
        json={"public_metadata": metadata},
        headers=headers,
    )
    resp.raise_for_status()


def main():
    parser = argparse.ArgumentParser(description="Sync dashboard permissions to Clerk")
    parser.add_argument(
        "config",
        nargs="?",
        default=str(Path(__file__).resolve().parent.parent / "content" / "permissions.json"),
        help="Path to dashboard-permissions.json",
    )
    parser.add_argument("--dry-run", action="store_true", help="Parse and print without calling Clerk API")
    args = parser.parse_args()

    config = load_config(args.config)

    print(f"Loaded config: {len(config['groups'])} groups, {len(config['users'])} users, {len(config['dashboards'])} dashboards")

    resolved = {}
    for email in config["users"]:
        groups, dashboards, routes = resolve_user_dashboards(config, email)
        resolved[email] = {
            "groups": groups,
            "allowedDashboards": dashboards,
            "allowedRoutes": routes,
        }
        print(f"\n  {email}:")
        print(f"    groups: {groups}")
        print(f"    dashboards: {dashboards}")
        print(f"    routes: {routes}")

    if args.dry_run:
        print("\n[dry-run] No Clerk API calls made.")
        return

    secret_key = os.environ.get("CLERK_SECRET_KEY")
    if not secret_key:
        print("Error: CLERK_SECRET_KEY environment variable is required", file=sys.stderr)
        sys.exit(1)

    headers = {"Authorization": f"Bearer {secret_key}", "Content-Type": "application/json"}

    updated = 0
    not_found = []

    for email, metadata in resolved.items():
        clerk_user = find_clerk_user(email, headers)
        if not clerk_user:
            not_found.append(email)
            print(f"\n  WARNING: {email} not found in Clerk")
            continue

        existing = clerk_user.get("public_metadata", {})
        new_metadata = {**existing, **metadata}

        if new_metadata == existing:
            print(f"\n  {email}: already up to date")
            continue

        update_clerk_metadata(clerk_user["id"], new_metadata, headers)
        updated += 1
        print(f"\n  {email}: updated")

    print(f"\nDone: {updated} updated, {len(not_found)} not found in Clerk")
    if not_found:
        print(f"  Not found: {', '.join(not_found)}")


if __name__ == "__main__":
    main()
