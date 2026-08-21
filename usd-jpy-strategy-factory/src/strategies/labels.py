"""Shared indicator-label formatting.

Used by both src/pine/analyzer.py (when building EntryRule.indicator_a/b
from Pine variable names) and src/generators/mql4_generator.py /
src/backtest/runner.py (when resolving those labels back to a concrete
IndicatorSpec). Keeping the format in one place guarantees the label
produced at analysis time is always resolvable downstream.
"""

from __future__ import annotations

from src.strategies.schema import IndicatorSpec


def indicator_label(spec: IndicatorSpec) -> str:
    return f"{spec.type}{spec.period}" if spec.period is not None else spec.type


def find_indicator_by_label(indicators: list[IndicatorSpec], label: str) -> IndicatorSpec | None:
    for spec in indicators:
        if indicator_label(spec) == label:
            return spec
    return None


def is_numeric_literal(token: str) -> bool:
    try:
        float(token)
    except ValueError:
        return False
    return True
