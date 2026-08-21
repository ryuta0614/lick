"""Walk Forward Analysis (§18).

Scope note (docs/assumptions.md): this Phase 4 implementation does not
re-optimize StrategySpec parameters per window -- there is no parameter
optimizer in this codebase yet. Each window instead re-runs the *same*
fixed-parameter StrategySpec on its training and test slices and measures
how consistent (or how much it degrades) performance is between them. This
is a simplified, optimizer-free approximation of classical WFA, sufficient
to catch a strategy that only "works" on a specific historical slice.
Walk Forward Efficiency (WFE) is computed as
``sum(out-of-sample net profit) / sum(in-sample net profit)``.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src.backtest.costs import CostConfig
from src.backtest.metrics import Metrics, compute_metrics
from src.backtest.runner import run_backtest
from src.strategies.schema import StrategySpec


@dataclass
class WalkForwardWindow:
    train_start: pd.Timestamp
    train_end: pd.Timestamp
    test_start: pd.Timestamp
    test_end: pd.Timestamp
    train_metrics: Metrics
    test_metrics: Metrics


@dataclass
class WalkForwardReport:
    windows: list[WalkForwardWindow]
    walk_forward_efficiency: float

    def as_dict_list(self) -> list[dict]:
        return [
            {
                "train_start": str(w.train_start),
                "train_end": str(w.train_end),
                "test_start": str(w.test_start),
                "test_end": str(w.test_end),
                "train_net_profit": w.train_metrics.net_profit,
                "test_net_profit": w.test_metrics.net_profit,
                "train_profit_factor": w.train_metrics.profit_factor,
                "test_profit_factor": w.test_metrics.profit_factor,
            }
            for w in self.windows
        ]


def run_walk_forward(
    spec: StrategySpec,
    df: pd.DataFrame,
    costs: CostConfig | None = None,
    training_months: int = 24,
    test_months: int = 6,
    step_months: int = 6,
) -> WalkForwardReport:
    costs = costs or CostConfig.for_symbol(spec.symbol)
    df = df.sort_values("time").reset_index(drop=True)

    start = pd.Timestamp(df["time"].iloc[0])
    data_end = pd.Timestamp(df["time"].iloc[-1])

    windows: list[WalkForwardWindow] = []
    train_start = start

    while True:
        train_end = train_start + pd.DateOffset(months=training_months)
        test_end = train_end + pd.DateOffset(months=test_months)
        if test_end > data_end:
            break

        train_df = df[(df["time"] >= train_start) & (df["time"] < train_end)].reset_index(drop=True)
        test_df = df[(df["time"] >= train_end) & (df["time"] < test_end)].reset_index(drop=True)

        if len(train_df) >= 3 and len(test_df) >= 3:
            train_metrics = compute_metrics(run_backtest(spec, train_df, costs), spec.timeframe)
            test_metrics = compute_metrics(run_backtest(spec, test_df, costs), spec.timeframe)
            windows.append(
                WalkForwardWindow(
                    train_start=train_start,
                    train_end=train_end,
                    test_start=train_end,
                    test_end=test_end,
                    train_metrics=train_metrics,
                    test_metrics=test_metrics,
                )
            )

        train_start = train_start + pd.DateOffset(months=step_months)

    total_train_profit = sum(w.train_metrics.net_profit for w in windows)
    total_test_profit = sum(w.test_metrics.net_profit for w in windows)
    if total_train_profit > 0:
        wfe = total_test_profit / total_train_profit
    else:
        wfe = 0.0

    return WalkForwardReport(windows=windows, walk_forward_efficiency=wfe)
