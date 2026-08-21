"""Rakuten MT4 terminal process interface.

This container cannot launch or observe a real MT4 terminal
(docs/assumptions.md #1). This module defines the interface a Windows-side
bridge should implement/extend; here it always reports ``NOT_AVAILABLE``
rather than guessing at process state.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

TerminalStatus = Literal["RUNNING", "NOT_RUNNING", "NOT_AVAILABLE"]


@dataclass
class TerminalState:
    status: TerminalStatus
    detail: str


def get_terminal_status(terminal_exe_path: str | None = None) -> TerminalState:
    if terminal_exe_path is None:
        terminal_exe_path = os.environ.get("RAKUTEN_MT4_TERMINAL_PATH")

    if not terminal_exe_path:
        return TerminalState(
            status="NOT_AVAILABLE",
            detail=(
                "No MT4 terminal path configured (RAKUTEN_MT4_TERMINAL_PATH), and this "
                "container has no MT4 installation (docs/assumptions.md #1)."
            ),
        )
    if not os.path.exists(terminal_exe_path):
        return TerminalState(status="NOT_AVAILABLE", detail=f"terminal executable not found: {terminal_exe_path}")

    # Process-liveness / window-handle inspection is inherently
    # platform-specific (Windows) and this container is never the actual
    # deployment target, so it is intentionally left unimplemented here
    # rather than faked.
    return TerminalState(
        status="NOT_AVAILABLE",
        detail="terminal executable found, but process-liveness checking is not implemented "
        "in this environment; implement on the Windows host running MT4",
    )
