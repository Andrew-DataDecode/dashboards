"""CLI entry point: python -m backend.validate_dashboards [--dashboard SLUG]"""

import argparse
import sys
from pathlib import Path

from .dashboard import load_dashboard_config, validate_dashboard_config, validate_all_dashboards, CONTENT_DIR


def main():
    parser = argparse.ArgumentParser(description="Validate dashboard configs")
    parser.add_argument("--dashboard", help="Validate a specific dashboard slug")
    args = parser.parse_args()

    if args.dashboard:
        slug = args.dashboard
        dashboard_dir = CONTENT_DIR / slug
        try:
            config = load_dashboard_config(slug)
            errors = validate_dashboard_config(config, dashboard_dir)
        except Exception as e:
            print(f"FAIL [{slug}]: {e}")
            sys.exit(1)

        if errors:
            print(f"FAIL [{slug}]:")
            for err in errors:
                print(f"  - {err}")
            sys.exit(1)
        else:
            print(f"OK [{slug}]")
            sys.exit(0)
    else:
        results = validate_all_dashboards()
        if not results:
            print("No dashboards found.")
            sys.exit(0)

        has_errors = False
        for slug, errors in sorted(results.items()):
            if errors:
                has_errors = True
                print(f"FAIL [{slug}]:")
                for err in errors:
                    print(f"  - {err}")
            else:
                print(f"OK [{slug}]")

        sys.exit(1 if has_errors else 0)


if __name__ == "__main__":
    main()
