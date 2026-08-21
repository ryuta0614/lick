"""Lightweight Pine Script (v5) extractor.

This is intentionally *not* a full Pine Script AST parser. It is a
token/regex-based extractor targeting the subset of syntax that
``src/pine/analyzer.py`` needs to build a StrategySpec: ``strategy()`` /
``indicator()`` declarations, ``input.*`` parameters, ``ta.*`` indicator
calls, crossover/crossunder conditions, and ``strategy.entry`` /
``strategy.exit`` calls.

Only Pine Script the user has placed in ``pine_inputs/`` (or passed
explicitly) is processed. This module never fetches anything from
TradingView.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

_VERSION_RE = re.compile(r"^\s*//\s*@version\s*=\s*(\d+)", re.MULTILINE)
_TIMEFRAME_HINT_RE = re.compile(r"^\s*//\s*@timeframe\s*:\s*([0-9]+[mhd])", re.MULTILINE | re.IGNORECASE)
_DECL_RE = re.compile(r"\b(strategy|indicator)\s*\((.*)\)\s*$")
_INPUT_RE = re.compile(
    r"^\s*(\w+)\s*=\s*input\.(int|float|bool|string|bool|source)\s*\(\s*([^,()]+)\s*(?:,(.*))?\)\s*$"
)
_TA_CALL_RE = re.compile(
    r"^\s*(\w+)\s*=\s*ta\.(ema|sma|wma|rsi|atr|adx|macd|bb|bbands|stoch|vwap|supertrend|"
    r"donchian|highest|lowest)\s*\(\s*(.*)\)\s*$",
    re.IGNORECASE,
)
_COND_RE = re.compile(
    r"^\s*(\w+)\s*=\s*ta\.(crossover|crossunder)\s*\(\s*([^,]+?)\s*,\s*(.+?)\s*\)\s*$",
    re.IGNORECASE,
)
_IF_RE = re.compile(r"^\s*if\s*\(?\s*(\w+)\s*\)?\s*$")
_ENTRY_RE = re.compile(
    r"strategy\.entry\s*\(\s*\"([^\"]+)\"\s*,\s*strategy\.(long|short)"
)
_EXIT_RE = re.compile(
    r"strategy\.exit\s*\(\s*\"([^\"]+)\"\s*,\s*\"([^\"]+)\"\s*,(.*)\)\s*$"
)
_STOP_ARG_RE = re.compile(r"\bstop\s*=\s*([^,]+)")
_LIMIT_ARG_RE = re.compile(r"\blimit\s*=\s*([^,]+)")


@dataclass
class PineInput:
    name: str
    kind: str  # int/float/bool/string/source
    default: str
    title: str | None = None


@dataclass
class PineIndicatorCall:
    var: str
    func: str
    raw_args: str


@dataclass
class PineConditionCall:
    var: str
    func: Literal["crossover", "crossunder"]
    lhs: str
    rhs: str


@dataclass
class PineEntry:
    id: str
    direction: Literal["long", "short"]
    condition_var: str | None


@dataclass
class PineExit:
    id: str
    from_id: str
    stop_expr: str | None
    limit_expr: str | None


@dataclass
class RawPineStrategy:
    script_kind: Literal["strategy", "indicator"]
    title: str
    pine_version: int | None
    timeframe_hint: str | None
    inputs: dict[str, PineInput] = field(default_factory=dict)
    indicator_calls: dict[str, PineIndicatorCall] = field(default_factory=dict)
    conditions: dict[str, PineConditionCall] = field(default_factory=dict)
    entries: list[PineEntry] = field(default_factory=list)
    exits: list[PineExit] = field(default_factory=list)
    raw_text: str = ""
    source_file: str | None = None


class PineParseError(ValueError):
    pass


def parse_pine_file(path: str) -> RawPineStrategy:
    text = Path(path).read_text(encoding="utf-8")
    raw = parse_pine_source(text)
    raw.source_file = str(path)
    return raw


def parse_pine_source(text: str) -> RawPineStrategy:
    version_match = _VERSION_RE.search(text)
    pine_version = int(version_match.group(1)) if version_match else None

    tf_match = _TIMEFRAME_HINT_RE.search(text)
    timeframe_hint = tf_match.group(1) if tf_match else None

    script_kind: Literal["strategy", "indicator"] | None = None
    title = "Untitled"
    for line in text.splitlines():
        decl = _DECL_RE.search(line)
        if decl:
            script_kind = decl.group(1)  # type: ignore[assignment]
            args = decl.group(2)
            title_match = re.search(r"\"([^\"]+)\"", args)
            if title_match:
                title = title_match.group(1)
            break

    if script_kind is None:
        raise PineParseError(
            "no strategy(...) or indicator(...) declaration found in Pine source"
        )

    raw = RawPineStrategy(
        script_kind=script_kind,
        title=title,
        pine_version=pine_version,
        timeframe_hint=timeframe_hint,
        raw_text=text,
    )

    pending_if_var: str | None = None
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue

        m = _INPUT_RE.match(line)
        if m:
            name, kind, default, rest = m.groups()
            title_m = re.search(r"title\s*=\s*\"([^\"]+)\"", rest or "")
            raw.inputs[name] = PineInput(
                name=name,
                kind=kind,
                default=default.strip(),
                title=title_m.group(1) if title_m else None,
            )
            continue

        m = _COND_RE.match(line)
        if m:
            var, func, lhs, rhs = m.groups()
            raw.conditions[var] = PineConditionCall(
                var=var, func=func.lower(), lhs=lhs.strip(), rhs=rhs.strip()  # type: ignore[arg-type]
            )
            continue

        m = _TA_CALL_RE.match(line)
        if m:
            var, func, args = m.groups()
            raw.indicator_calls[var] = PineIndicatorCall(var=var, func=func.lower(), raw_args=args.strip())
            continue

        m = _IF_RE.match(line)
        if m:
            pending_if_var = m.group(1)
            continue

        m = _ENTRY_RE.search(line)
        if m:
            entry_id, direction = m.groups()
            raw.entries.append(
                PineEntry(id=entry_id, direction=direction.lower(), condition_var=pending_if_var)  # type: ignore[arg-type]
            )
            pending_if_var = None
            continue

        m = _EXIT_RE.search(line)
        if m:
            exit_id, from_id, rest_args = m.groups()
            stop_m = _STOP_ARG_RE.search(rest_args)
            limit_m = _LIMIT_ARG_RE.search(rest_args)
            raw.exits.append(
                PineExit(
                    id=exit_id,
                    from_id=from_id,
                    stop_expr=stop_m.group(1).strip() if stop_m else None,
                    limit_expr=limit_m.group(1).strip() if limit_m else None,
                )
            )
            continue

    return raw
