"""Build a StrategySpec draft from a parsed Pine script.

Per instructions §7: if entry/exit conditions cannot be unambiguously
derived from the source, this module returns ``review_status="NEEDS_REVIEW"``
and does **not** invent trading rules. The caller (CLI ``analyze``/``convert``
commands) is responsible for combining this output with the anti-repaint
danger assessment (``src/pine/anti_repaint.py``) before persisting a
StrategySpec.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from src.pine.anti_repaint import DangerAssessment
from src.pine.parser import PineEntry, RawPineStrategy
from src.strategies.schema import (
    EntryRule,
    ExitRule,
    IndicatorSpec,
    PineSourceMeta,
    PositionManagement,
    RiskSpec,
    StrategySpec,
)

SUPPORTED_TIMEFRAMES = {"1m", "5m", "15m", "30m", "1h", "4h", "1d"}
DEFAULT_TIMEFRAME = "1h"

_CROSS_DESCRIPTION = {
    "crossover": "crosses above",
    "crossunder": "crosses below",
}

_SL_NAME_HINTS = ("sl", "stop")
_TP_NAME_HINTS = ("tp", "take", "profit", "limit")


@dataclass
class AnalysisOutcome:
    strategy_id: str
    spec: StrategySpec | None
    review_status: Literal["OK", "NEEDS_REVIEW"]
    danger_level: Literal["SAFE", "WARNING", "DANGEROUS", "REJECT"] = "SAFE"
    notes: list[str] = field(default_factory=list)


def _resolve_timeframe(raw: RawPineStrategy, notes: list[str]) -> str:
    hint = raw.timeframe_hint
    if hint and hint in SUPPORTED_TIMEFRAMES:
        return hint
    if hint:
        notes.append(
            f"timeframe hint '{hint}' is not a supported timeframe; falling back to "
            f"{DEFAULT_TIMEFRAME} (§ assumptions.md #6)"
        )
    else:
        notes.append(
            f"no @timeframe hint found in source; defaulting to {DEFAULT_TIMEFRAME} "
            "(§ assumptions.md #6)"
        )
    return DEFAULT_TIMEFRAME


def _indicator_label(func: str, period: int | None) -> str:
    return f"{func.upper()}{period}" if period is not None else func.upper()


def _resolve_numeric_arg(token: str, raw: RawPineStrategy) -> int | None:
    token = token.strip()
    if token in raw.inputs:
        try:
            return int(float(raw.inputs[token].default))
        except ValueError:
            return None
    try:
        return int(float(token))
    except ValueError:
        return None


def _build_indicators(
    raw: RawPineStrategy,
) -> tuple[list[IndicatorSpec], dict[str, str]]:
    """Returns (indicator specs, {pine_var_name: human label})."""

    indicators: list[IndicatorSpec] = []
    labels: dict[str, str] = {}
    for var, call in raw.indicator_calls.items():
        args = [a.strip() for a in call.raw_args.split(",")] if call.raw_args else []
        source = args[0] if args else "close"
        period = _resolve_numeric_arg(args[1], raw) if len(args) > 1 else None
        extra = {f"arg{i}": a for i, a in enumerate(args[2:], start=2)}
        indicators.append(
            IndicatorSpec(type=call.func.upper(), period=period, source=source, params=extra)
        )
        labels[var] = _indicator_label(call.func, period)
    return indicators, labels


def _resolve_token(token: str, raw: RawPineStrategy, labels: dict[str, str]) -> str:
    """Resolve a Pine variable name to an indicator label or a numeric literal.

    Falls back to the raw token (e.g. an unrecognized variable name) when
    neither resolution succeeds; callers should treat that case as
    unresolvable for structured (MQL4-generatable) purposes.
    """

    if token in labels:
        return labels[token]
    if token in raw.inputs:
        return raw.inputs[token].default
    return token


def _describe_condition(
    entry: PineEntry, raw: RawPineStrategy, labels: dict[str, str], notes: list[str]
) -> EntryRule | None:
    if entry.condition_var is None or entry.condition_var not in raw.conditions:
        notes.append(
            f"could not resolve a machine-checkable condition for entry '{entry.id}' "
            f"({entry.direction}); leaving unset rather than guessing (§7)"
        )
        return None

    cond = raw.conditions[entry.condition_var]
    lhs_resolved = _resolve_token(cond.lhs, raw, labels)
    rhs_resolved = _resolve_token(cond.rhs, raw, labels)
    verb = _CROSS_DESCRIPTION[cond.func]
    condition_text = f"{lhs_resolved} {verb} {rhs_resolved}"

    lhs_structured = lhs_resolved in labels.values() or _is_numeric(lhs_resolved)
    rhs_structured = rhs_resolved in labels.values() or _is_numeric(rhs_resolved)
    if not (lhs_structured and rhs_structured):
        notes.append(
            f"entry '{entry.id}' condition references an unresolved term "
            f"('{cond.lhs}' or '{cond.rhs}'); condition text was kept but structured "
            "indicator_a/operator/indicator_b were left unset"
        )
        return EntryRule(condition=condition_text, execution="next_bar_market")

    operator: Literal["crosses_above", "crosses_below"] = (
        "crosses_above" if cond.func == "crossover" else "crosses_below"
    )
    return EntryRule(
        condition=condition_text,
        execution="next_bar_market",
        indicator_a=lhs_resolved,
        operator=operator,
        indicator_b=rhs_resolved,
    )


def _is_numeric(token: str) -> bool:
    try:
        float(token)
    except ValueError:
        return False
    return True


def _resolve_pips(expr: str | None, raw: RawPineStrategy, hints: tuple[str, ...]) -> float | None:
    if not expr:
        return None
    candidates = [name for name in raw.inputs if name in expr]
    if not candidates:
        return None
    hinted = [c for c in candidates if any(h in c.lower() for h in hints)]
    chosen = hinted[0] if hinted else candidates[0]
    try:
        return float(raw.inputs[chosen].default)
    except ValueError:
        return None


def _build_exit(raw: RawPineStrategy) -> ExitRule:
    long_exit = next((e for e in raw.exits if e.from_id == "Long"), None)
    if long_exit is None and raw.exits:
        long_exit = raw.exits[0]
    if long_exit is None:
        return ExitRule()
    return ExitRule(
        stop_loss_pips=_resolve_pips(long_exit.stop_expr, raw, _SL_NAME_HINTS),
        take_profit_pips=_resolve_pips(long_exit.limit_expr, raw, _TP_NAME_HINTS),
    )


def analyze_pine(
    raw: RawPineStrategy,
    danger: DangerAssessment,
    *,
    strategy_id: str,
    name: str | None = None,
    symbol: str = "USDJPY",
) -> AnalysisOutcome:
    notes: list[str] = list(danger.notes)
    timeframe = _resolve_timeframe(raw, notes)
    indicators, labels = _build_indicators(raw)

    long_entry = None
    short_entry = None
    for entry in raw.entries:
        rule = _describe_condition(entry, raw, labels, notes)
        if entry.direction == "long" and rule is not None:
            long_entry = rule
        elif entry.direction == "short" and rule is not None:
            short_entry = rule

    review_status: Literal["OK", "NEEDS_REVIEW"] = "OK"
    if raw.script_kind == "indicator" and not raw.entries:
        notes.append(
            "indicator() script has no strategy.entry calls: entry/exit rules are not "
            "machine-derivable. Marked NEEDS_REVIEW per §7 -- AI will not invent conditions."
        )
        review_status = "NEEDS_REVIEW"
    elif long_entry is None and short_entry is None:
        notes.append("no long_entry or short_entry could be resolved unambiguously")
        review_status = "NEEDS_REVIEW"

    if review_status == "NEEDS_REVIEW" or danger.level == "REJECT":
        return AnalysisOutcome(
            strategy_id=strategy_id,
            spec=None,
            review_status=review_status,
            danger_level=danger.level,
            notes=notes,
        )

    spec = StrategySpec(
        strategy_id=strategy_id,
        name=name or raw.title,
        symbol=symbol,
        timeframe=timeframe,  # type: ignore[arg-type]
        indicators=indicators,
        long_entry=long_entry,
        short_entry=short_entry,
        exit=_build_exit(raw),
        position_management=PositionManagement(),
        risk=RiskSpec(),
        anti_repaint=danger.level in ("SAFE", "WARNING"),
        danger_level=danger.level,
        review_status="OK",
        source=PineSourceMeta(
            source_file=raw.source_file or "<memory>",
            pine_version=raw.pine_version,
            script_kind=raw.script_kind,
        ),
    )
    return AnalysisOutcome(
        strategy_id=strategy_id,
        spec=spec,
        review_status="OK",
        danger_level=danger.level,
        notes=notes,
    )
