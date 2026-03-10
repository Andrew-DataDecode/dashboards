"""Auto-discovery registry for computed source functions.

Scans project/dashboard-content/computed_sources/ for Python files.
Each file must export a top-level function matching the filename.
"""

import importlib.util
import logging
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

_registry: dict[str, Callable] = {}
_initialized = False


def _discover_functions(sources_dir: Path) -> dict[str, Callable]:
    functions = {}
    if not sources_dir.is_dir():
        return functions

    for py_file in sorted(sources_dir.glob("*.py")):
        if py_file.name.startswith("_"):
            continue
        func_name = py_file.stem
        spec = importlib.util.spec_from_file_location(f"computed_sources.{func_name}", py_file)
        if not spec or not spec.loader:
            continue
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        fn = getattr(module, func_name, None)
        if callable(fn):
            functions[func_name] = fn
            logger.info(f"Registered computed function: {func_name}")
        else:
            logger.warning(f"No callable '{func_name}' found in {py_file}")

    return functions


def init_registry(sources_dir: Path | None = None) -> None:
    global _registry, _initialized
    if sources_dir is None:
        sources_dir = Path(__file__).resolve().parent.parent.parent / "dashboard-content" / "computed_sources"
    _registry = _discover_functions(sources_dir)
    _initialized = True


def get_function(name: str) -> Callable:
    if not _initialized:
        init_registry()
    fn = _registry.get(name)
    if fn is None:
        raise KeyError(f"Computed function '{name}' not found. Available: {list(_registry.keys())}")
    return fn


def list_functions() -> list[str]:
    if not _initialized:
        init_registry()
    return list(_registry.keys())
