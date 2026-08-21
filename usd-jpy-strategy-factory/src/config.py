"""Loads config/default.yaml (overridable via STRATEGY_FACTORY_CONFIG)."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml

DEFAULT_CONFIG_PATH = "config/default.yaml"


@lru_cache(maxsize=1)
def load_config(path: str | None = None) -> dict:
    path = path or os.environ.get("STRATEGY_FACTORY_CONFIG", DEFAULT_CONFIG_PATH)
    text = Path(path).read_text(encoding="utf-8")
    return yaml.safe_load(text)
