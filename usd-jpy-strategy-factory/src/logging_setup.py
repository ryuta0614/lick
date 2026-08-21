"""Structured logging for CLI commands (§32). Writes to logs/factory.log
(gitignored) and the console."""

from __future__ import annotations

import logging
from pathlib import Path


def setup_logging(log_dir: str = "logs") -> logging.Logger:
    Path(log_dir).mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("strategy_factory")
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)

    file_handler = logging.FileHandler(Path(log_dir) / "factory.log", encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", datefmt="%Y-%m-%d %H:%M"))
    logger.addHandler(file_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(console_handler)

    return logger
