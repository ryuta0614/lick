"""MetaEditor CLI wrapper.

This development container has no Windows/Wine/Rakuten MT4/MetaEditor
installation (docs/assumptions.md #1), so ``compile_ea()`` returns
``CompileResult(status="NOT_AVAILABLE", ...)`` here every time -- this is
the tested path (tests/test_mt4_compiler.py). On a Windows host with
MetaEditor installed, set ``METAEDITOR_PATH`` (or have ``metaeditor64.exe``
/ ``metaeditor.exe`` on PATH) and this same function will actually compile.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

CompileStatus = Literal["SUCCESS", "FAILED", "NOT_AVAILABLE"]


@dataclass
class CompileResult:
    status: CompileStatus
    detail: str
    log_path: str | None = None


def find_metaeditor() -> str | None:
    env_path = os.environ.get("METAEDITOR_PATH")
    if env_path and Path(env_path).exists():
        return env_path
    return shutil.which("metaeditor64.exe") or shutil.which("metaeditor.exe")


def compile_ea(mq4_path: str, timeout: int = 60) -> CompileResult:
    mq4 = Path(mq4_path)
    if not mq4.exists():
        return CompileResult(status="FAILED", detail=f"file not found: {mq4_path}")

    exe = find_metaeditor()
    if exe is None:
        return CompileResult(
            status="NOT_AVAILABLE",
            detail=(
                "MetaEditor was not found (no METAEDITOR_PATH env var and no "
                "metaeditor(64).exe on PATH). Expected in this development container "
                "(docs/assumptions.md #1) -- compile on a Windows host with Rakuten MT4 / "
                "MetaEditor installed, or set METAEDITOR_PATH there. See docs/rakuten_mt4.md "
                "for the full deployment procedure."
            ),
        )

    log_path = mq4.with_suffix(".log")
    try:
        subprocess.run([exe, f"/compile:{mq4}", f"/log:{log_path}"], timeout=timeout, check=False)
    except OSError as exc:
        return CompileResult(status="NOT_AVAILABLE", detail=f"failed to launch MetaEditor: {exc}")

    if not log_path.exists():
        return CompileResult(status="FAILED", detail="MetaEditor did not produce a log file")

    log_text = log_path.read_text(encoding="utf-16", errors="ignore")
    if "error" in log_text.lower():
        return CompileResult(status="FAILED", detail=log_text, log_path=str(log_path))
    return CompileResult(status="SUCCESS", detail=log_text, log_path=str(log_path))
