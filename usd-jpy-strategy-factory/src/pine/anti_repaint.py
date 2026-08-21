"""Dangerous-logic detection for Pine Script sources (§6).

Heuristic, source-level detection of repainting, lookahead bias, and
overfitting risk. This is deliberately conservative and pattern-based, not a
full data-flow analysis -- see docs/assumptions.md #5 for the documented
limitation. Strategies classified REJECT must never proceed to EA generation
(enforced again, independently, in ``src/strategies/validator.py``).

Trade-count / unrealistic-backtest checks that require actual backtest
results (rather than source text) are exposed here too (``classify_trade_count``)
so Phase 3/4 (``src/backtest``, ``src/ranking/scorer.py``) reuse the same
4-level scale.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from src.pine.parser import RawPineStrategy

DangerLevel = Literal["SAFE", "WARNING", "DANGEROUS", "REJECT"]

_LEVEL_ORDER: dict[DangerLevel, int] = {"SAFE": 0, "WARNING": 1, "DANGEROUS": 2, "REJECT": 3}

_OVERFIT_WARNING_THRESHOLD = 8
_OVERFIT_DANGEROUS_THRESHOLD = 12

MIN_TRADES_FOR_SAFE = 100  # matches the REJECT threshold in §22 (Trades < 100)


@dataclass
class Finding:
    pattern: str
    level: DangerLevel
    message: str


@dataclass
class DangerAssessment:
    level: DangerLevel
    findings: list[Finding] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _worst(levels: list[DangerLevel]) -> DangerLevel:
    if not levels:
        return "SAFE"
    return max(levels, key=lambda lv: _LEVEL_ORDER[lv])


# Each pattern is checked against the raw source text. Patterns are ordered
# by severity intent; see docs/assumptions.md #5 for caveats.
_REGEX_FINDINGS: list[tuple[re.Pattern[str], DangerLevel, str]] = [
    (
        re.compile(r"lookahead\s*=\s*barmerge\.lookahead_on"),
        "REJECT",
        "request.security(..., lookahead=barmerge.lookahead_on): explicit future-data lookahead",
    ),
    (
        re.compile(r"\w+\s*\[\s*-\d+\s*\]"),
        "REJECT",
        "negative series offset (e.g. close[-1]): references a future, unconfirmed bar",
    ),
    (
        re.compile(r"request\.security\s*\("),
        "DANGEROUS",
        "request.security() call detected: verify higher-timeframe data is not repainting "
        "(prefer lookahead=barmerge.lookahead_off and a confirmed/closed source)",
    ),
    (
        re.compile(r"ta\.pivot(high|low)\s*\("),
        "WARNING",
        "ta.pivothigh/pivotlow detected: pivot confirmation lag can cause repainting if used "
        "for the current, unconfirmed bar",
    ),
    (
        re.compile(r"barstate\.isrealtime"),
        "WARNING",
        "barstate.isrealtime referenced: verify historical and realtime bars produce identical "
        "signals (differing logic per barstate is a common repaint source)",
    ),
]


def _scan_source(raw_text: str) -> list[Finding]:
    findings: list[Finding] = []
    for pattern, level, message in _REGEX_FINDINGS:
        if pattern.search(raw_text):
            findings.append(Finding(pattern=pattern.pattern, level=level, message=message))
    return findings


def _check_overfitting(raw: RawPineStrategy) -> Finding | None:
    n_params = len(raw.inputs)
    if n_params >= _OVERFIT_DANGEROUS_THRESHOLD:
        return Finding(
            pattern="param_count",
            level="DANGEROUS",
            message=f"{n_params} input parameters declared: high overfitting risk (§6)",
        )
    if n_params >= _OVERFIT_WARNING_THRESHOLD:
        return Finding(
            pattern="param_count",
            level="WARNING",
            message=f"{n_params} input parameters declared: possible overfitting risk (§6)",
        )
    return None


def assess(raw: RawPineStrategy) -> DangerAssessment:
    """Assess a parsed Pine script for repainting / lookahead / overfitting risk."""

    findings = _scan_source(raw.raw_text)
    overfit_finding = _check_overfitting(raw)
    if overfit_finding is not None:
        findings.append(overfit_finding)

    level = _worst([f.level for f in findings])
    notes = [f"[{f.level}] {f.message}" for f in findings]
    return DangerAssessment(level=level, findings=findings, notes=notes)


def classify_trade_count(n_trades: int, min_trades: int = MIN_TRADES_FOR_SAFE) -> DangerLevel:
    """Classify statistical reliability of a backtest by trade count (§6, §22)."""

    if n_trades < min_trades // 2:
        return "DANGEROUS"
    if n_trades < min_trades:
        return "WARNING"
    return "SAFE"
