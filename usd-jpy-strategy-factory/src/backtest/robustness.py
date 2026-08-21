"""Parameter Robustness Test (§20): does performance collapse if a single
optimized parameter is nudged to a neighboring value? A strategy that only
works at one exact parameter value is a strong overfitting signal ("no
plateau"); a strategy whose neighbors perform similarly is more trustworthy.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.backtest.costs import CostConfig
from src.backtest.metrics import Metrics, compute_metrics
from src.backtest.runner import run_backtest
from src.strategies.labels import indicator_label
from src.strategies.schema import StrategySpec

DEFAULT_NEIGHBORHOOD_STEPS: tuple[int, ...] = (-2, -1, 0, 1, 2)


@dataclass
class RobustnessPoint:
    delta: int
    period: int
    metrics: Metrics


@dataclass
class RobustnessReport:
    indicator_index: int
    original_label: str
    points: list[RobustnessPoint]
    is_plateau: bool


def perturb_indicator_period(spec: StrategySpec, indicator_index: int, delta: int) -> StrategySpec | None:
    """Returns a copy of ``spec`` with one indicator's period shifted by
    ``delta``, and every EntryRule reference to its old label updated to the
    new one. Returns None if the resulting period would be < 1."""

    original = spec.indicators[indicator_index]
    if original.period is None:
        return None
    new_period = original.period + delta
    if new_period < 1:
        return None

    old_label = indicator_label(original)
    new = spec.model_copy(deep=True)
    new.indicators[indicator_index].period = new_period
    new_label = indicator_label(new.indicators[indicator_index])

    for rule in (new.long_entry, new.short_entry):
        if rule is None:
            continue
        if rule.indicator_a == old_label:
            rule.indicator_a = new_label
        if rule.indicator_b == old_label:
            rule.indicator_b = new_label
        rule.condition = rule.condition.replace(old_label, new_label)

    return new


def run_robustness_test(
    spec: StrategySpec,
    df: pd.DataFrame,
    costs: CostConfig | None = None,
    indicator_index: int = 0,
    steps: tuple[int, ...] = DEFAULT_NEIGHBORHOOD_STEPS,
) -> RobustnessReport:
    costs = costs or CostConfig.for_symbol(spec.symbol)
    original_label = indicator_label(spec.indicators[indicator_index])

    points: list[RobustnessPoint] = []
    for delta in steps:
        variant = spec if delta == 0 else perturb_indicator_period(spec, indicator_index, delta)
        if variant is None:
            continue
        metrics = compute_metrics(run_backtest(variant, df, costs), spec.timeframe)
        points.append(
            RobustnessPoint(delta=delta, period=variant.indicators[indicator_index].period, metrics=metrics)
        )

    center = next((p for p in points if p.delta == 0), None)
    if center is None or not points:
        is_plateau = False
    else:
        center_sign = center.metrics.net_profit > 0
        is_plateau = all((p.metrics.net_profit > 0) == center_sign for p in points)

    return RobustnessReport(
        indicator_index=indicator_index, original_label=original_label, points=points, is_plateau=is_plateau
    )
