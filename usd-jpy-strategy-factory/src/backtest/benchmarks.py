"""Benchmark strategies (§16): is a "sophisticated" strategy actually better
than trivial baselines? Each function returns a BacktestResult comparable
via ``src/backtest/metrics.py::compute_metrics`` against the strategy under
test.

- ``buy_and_hold``: a single long position held for the entire dataset.
- ``always_long`` / ``always_short``: re-enter in a fixed direction using the
  *same* stop-loss/take-profit/lot size as the strategy under test, so the
  comparison isolates "does the entry timing add value?" from risk sizing.
- ``random_entry``: enters in a random direction with roughly the same trade
  frequency as the strategy under test (same SL/TP/lot), to see whether the
  strategy beats chance.
- ``simple_ema_cross``: a fixed-parameter EMA(20)/EMA(50) crossover, the
  simplest common trend-following baseline.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.backtest.costs import CostConfig
from src.backtest.runner import BacktestResult, Trade, apply_entry_costs, check_stop_take, close_trade
from src.strategies.schema import EntryRule, ExitRule, IndicatorSpec, PositionManagement, RiskSpec, StrategySpec


def _run_directional_baseline(
    df: pd.DataFrame,
    costs: CostConfig,
    exit_rule: ExitRule,
    lots: float,
    direction_at_bar,
) -> BacktestResult:
    """Shared loop for buy_and_hold / always_long / always_short / random_entry.

    ``direction_at_bar(i)`` returns "long", "short", or None (stay flat / no
    new entry at bar i when currently flat).
    """

    trades: list[Trade] = []
    balance = costs.initial_balance
    equity_values: list[float] = []

    position_dir = None
    entry_price = 0.0
    entry_time = None

    times, opens, highs, lows, closes = df["time"], df["open"], df["high"], df["low"], df["close"]

    for i in range(len(df)):
        t, o, h, l, c = times.iloc[i], opens.iloc[i], highs.iloc[i], lows.iloc[i], closes.iloc[i]

        if position_dir is not None:
            hit = check_stop_take(position_dir, entry_price, h, l, _ExitOnlySpec(exit_rule), costs.pip_size)
            if hit is not None:
                exit_price, reason = hit
                trades.append(close_trade(position_dir, entry_time, entry_price, t, exit_price, reason, lots, costs))
                balance += trades[-1].pnl_account
                position_dir = None

        if position_dir is None:
            direction = direction_at_bar(i)
            if direction is not None:
                position_dir, entry_time = direction, t
                entry_price = apply_entry_costs(direction, o, costs)

        if position_dir == "long":
            unrealized = (c - entry_price) / costs.pip_size * costs.pip_value_per_lot() * lots
        elif position_dir == "short":
            unrealized = (entry_price - c) / costs.pip_size * costs.pip_value_per_lot() * lots
        else:
            unrealized = 0.0
        equity_values.append(balance + unrealized)

    if position_dir is not None:
        t, c = times.iloc[-1], closes.iloc[-1]
        trades.append(close_trade(position_dir, entry_time, entry_price, t, c, "end_of_data", lots, costs))
        balance += trades[-1].pnl_account
        if equity_values:
            equity_values[-1] = balance

    return BacktestResult(
        strategy_id="benchmark",
        trades=trades,
        equity_curve=pd.Series(equity_values, index=pd.to_datetime(times)),
        initial_balance=costs.initial_balance,
        final_balance=balance,
        cost_config=costs,
    )


class _ExitOnlySpec:
    """Adapter so check_stop_take (which expects StrategySpec.exit) works
    without needing a full StrategySpec for benchmark loops."""

    def __init__(self, exit_rule: ExitRule):
        self.exit = exit_rule


def buy_and_hold(df: pd.DataFrame, costs: CostConfig | None = None, lots: float = 0.01) -> BacktestResult:
    costs = costs or CostConfig.for_symbol("USDJPY")
    entered = {"done": False}

    def direction_at_bar(i: int):
        if i == 0 and not entered["done"]:
            entered["done"] = True
            return "long"
        return None

    return _run_directional_baseline(df, costs, ExitRule(), lots, direction_at_bar)


def always_long(df: pd.DataFrame, costs: CostConfig, exit_rule: ExitRule, lots: float) -> BacktestResult:
    return _run_directional_baseline(df, costs, exit_rule, lots, lambda i: "long")


def always_short(df: pd.DataFrame, costs: CostConfig, exit_rule: ExitRule, lots: float) -> BacktestResult:
    return _run_directional_baseline(df, costs, exit_rule, lots, lambda i: "short")


def random_entry(
    df: pd.DataFrame,
    costs: CostConfig,
    exit_rule: ExitRule,
    lots: float,
    target_trades: int,
    seed: int = 0,
) -> BacktestResult:
    rng = np.random.default_rng(seed)
    n = len(df)
    entry_prob = min(target_trades / n, 1.0) if n and target_trades > 0 else 0.0

    def direction_at_bar(i: int):
        if rng.random() < entry_prob:
            return "long" if rng.random() < 0.5 else "short"
        return None

    return _run_directional_baseline(df, costs, exit_rule, lots, direction_at_bar)


def simple_ema_cross_spec(symbol: str = "USDJPY", timeframe: str = "1h", fast: int = 20, slow: int = 50) -> StrategySpec:
    """A fixed-parameter EMA crossover: the simplest common trend baseline."""

    return StrategySpec(
        strategy_id="benchmark_simple_ema_cross",
        name="Benchmark: Simple EMA Cross",
        symbol=symbol,
        timeframe=timeframe,  # type: ignore[arg-type]
        indicators=[
            IndicatorSpec(type="EMA", period=fast),
            IndicatorSpec(type="EMA", period=slow),
        ],
        long_entry=EntryRule(
            condition=f"EMA{fast} crosses above EMA{slow}",
            indicator_a=f"EMA{fast}",
            operator="crosses_above",
            indicator_b=f"EMA{slow}",
        ),
        short_entry=EntryRule(
            condition=f"EMA{fast} crosses below EMA{slow}",
            indicator_a=f"EMA{fast}",
            operator="crosses_below",
            indicator_b=f"EMA{slow}",
        ),
        exit=ExitRule(),
        position_management=PositionManagement(),
        risk=RiskSpec(),
    )


def simple_ema_cross(df: pd.DataFrame, costs: CostConfig | None = None, **kwargs) -> BacktestResult:
    from src.backtest.runner import run_backtest

    spec = simple_ema_cross_spec(**kwargs)
    return run_backtest(spec, df, costs)
