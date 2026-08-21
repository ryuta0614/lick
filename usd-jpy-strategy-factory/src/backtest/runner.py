"""Reference Python backtester: replays a StrategySpec against OHLCV data.

This is the "Reference Python Backtester" described in ARCHITECTURE.md. It
consumes only a validated StrategySpec (specifically the structured
``EntryRule.indicator_a/operator/indicator_b`` fields, exactly like
``src/generators/mql4_generator.py``) plus an OHLCV DataFrame -- never Pine
source directly.

Execution model (must match the generated MQL4 EA, see docs/testing.md
§Pine <-> MQL4 Validation):

- A crossover/crossunder is confirmed using two *closed* bars (t-1 vs t-2).
- Any resulting order is filled at the *next* bar's open ("next_bar_market"),
  matching both Pine's realistic broker emulation and the MQL4 EA's
  new-bar-triggered OnTick() logic (shift=1/2 evaluated once per new bar).
- Stop loss / take profit are checked against the same bar's high/low once a
  position is open; if both would be hit within one bar, stop loss is
  assumed to trigger first (conservative bias, documented in
  docs/assumptions.md).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import pandas as pd

from src.backtest.costs import CostConfig
from src.backtest.indicators import compute_indicator
from src.strategies.labels import find_indicator_by_label, is_numeric_literal
from src.strategies.schema import EntryRule, StrategySpec

REQUIRED_COLUMNS = ("time", "open", "high", "low", "close")


class BacktestError(ValueError):
    pass


@dataclass
class Trade:
    direction: Literal["long", "short"]
    entry_time: pd.Timestamp
    entry_price: float
    exit_time: pd.Timestamp
    exit_price: float
    exit_reason: Literal["stop_loss", "take_profit", "reverse", "end_of_data"]
    lots: float
    pnl_pips: float
    pnl_account: float


@dataclass
class BacktestResult:
    strategy_id: str
    trades: list[Trade] = field(default_factory=list)
    equity_curve: pd.Series = field(default_factory=lambda: pd.Series(dtype=float))
    initial_balance: float = 0.0
    final_balance: float = 0.0
    cost_config: CostConfig | None = None


def _validate_df(df: pd.DataFrame) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise BacktestError(f"OHLCV DataFrame is missing required columns: {missing}")
    if len(df) < 3:
        raise BacktestError("OHLCV DataFrame must have at least 3 rows")


def _resolve_term_series(
    df: pd.DataFrame, spec: StrategySpec, token: str, cache: dict[str, pd.Series]
) -> pd.Series:
    if token in cache:
        return cache[token]
    if is_numeric_literal(token):
        series = pd.Series(float(token), index=df.index)
    else:
        indicator = find_indicator_by_label(spec.indicators, token)
        if indicator is None:
            raise BacktestError(
                f"cannot resolve term '{token}': not numeric and no matching indicator in "
                f"StrategySpec.indicators"
            )
        series = compute_indicator(df, indicator)
    cache[token] = series
    return series


def _crosses_above(a: pd.Series, b: pd.Series) -> pd.Series:
    return (a > b) & (a.shift(1) <= b.shift(1))


def _crosses_below(a: pd.Series, b: pd.Series) -> pd.Series:
    return (a < b) & (a.shift(1) >= b.shift(1))


def _entry_signal_series(
    df: pd.DataFrame, spec: StrategySpec, rule: EntryRule | None, cache: dict[str, pd.Series]
) -> pd.Series:
    if rule is None:
        return pd.Series(False, index=df.index)
    if rule.indicator_a is None or rule.operator is None or rule.indicator_b is None:
        raise BacktestError(
            f"entry condition '{rule.condition}' has no structured trigger "
            "(indicator_a/operator/indicator_b); cannot backtest deterministically"
        )
    a = _resolve_term_series(df, spec, rule.indicator_a, cache)
    b = _resolve_term_series(df, spec, rule.indicator_b, cache)
    cross = _crosses_above(a, b) if rule.operator == "crosses_above" else _crosses_below(a, b)
    # Confirmed using bar t vs t-1; the resulting order fills at bar t+1's
    # open, so shift the boolean flag forward by one bar (see module docstring).
    return cross.shift(1).fillna(False)


def apply_entry_costs(direction: Literal["long", "short"], open_price: float, costs: CostConfig) -> float:
    slip = costs.slippage_pips * costs.pip_size
    return open_price + slip if direction == "long" else open_price - slip


def _apply_exit_costs(direction: Literal["long", "short"], raw_price: float, costs: CostConfig) -> float:
    slip = costs.slippage_pips * costs.pip_size
    # Exiting a long = selling (worse fill is lower); exiting a short = buying (worse fill is higher).
    return raw_price - slip if direction == "long" else raw_price + slip


def close_trade(
    direction: Literal["long", "short"],
    entry_time: pd.Timestamp,
    entry_price: float,
    exit_time: pd.Timestamp,
    exit_raw_price: float,
    exit_reason: str,
    lots: float,
    costs: CostConfig,
) -> Trade:
    exit_price = _apply_exit_costs(direction, exit_raw_price, costs)
    raw_pnl_price = (exit_price - entry_price) if direction == "long" else (entry_price - exit_price)
    pnl_pips = raw_pnl_price / costs.pip_size - costs.spread_pips

    if costs.swap_enabled and costs.swap_pips_per_day:
        nights = max((pd.Timestamp(exit_time).normalize() - pd.Timestamp(entry_time).normalize()).days, 0)
        pnl_pips -= nights * costs.swap_pips_per_day

    pnl_account = pnl_pips * costs.pip_value_per_lot() * lots
    pnl_account -= costs.commission_per_lot * lots

    return Trade(
        direction=direction,
        entry_time=entry_time,
        entry_price=entry_price,
        exit_time=exit_time,
        exit_price=exit_price,
        exit_reason=exit_reason,  # type: ignore[arg-type]
        lots=lots,
        pnl_pips=pnl_pips,
        pnl_account=pnl_account,
    )


def check_stop_take(
    direction: Literal["long", "short"], entry_price: float, bar_high: float, bar_low: float, spec: StrategySpec, pip_size: float
) -> tuple[float, str] | None:
    sl_pips = spec.exit.stop_loss_pips
    tp_pips = spec.exit.take_profit_pips

    if direction == "long":
        sl_price = entry_price - sl_pips * pip_size if sl_pips else None
        tp_price = entry_price + tp_pips * pip_size if tp_pips else None
        if sl_price is not None and bar_low <= sl_price:
            return sl_price, "stop_loss"
        if tp_price is not None and bar_high >= tp_price:
            return tp_price, "take_profit"
    else:
        sl_price = entry_price + sl_pips * pip_size if sl_pips else None
        tp_price = entry_price - tp_pips * pip_size if tp_pips else None
        if sl_price is not None and bar_high >= sl_price:
            return sl_price, "stop_loss"
        if tp_price is not None and bar_low <= tp_price:
            return tp_price, "take_profit"
    return None


def run_backtest(spec: StrategySpec, df: pd.DataFrame, costs: CostConfig | None = None) -> BacktestResult:
    _validate_df(df)
    costs = costs or CostConfig.for_symbol(spec.symbol)
    df = df.reset_index(drop=True)

    cache: dict[str, pd.Series] = {}
    long_signal = _entry_signal_series(df, spec, spec.long_entry, cache)
    short_signal = _entry_signal_series(df, spec, spec.short_entry, cache)

    lots = spec.risk.fixed_lot
    reverse = spec.position_management.reverse_on_opposite_signal

    trades: list[Trade] = []
    balance = costs.initial_balance
    equity_values: list[float] = []

    position_dir: Literal["long", "short"] | None = None
    position_entry_price = 0.0
    position_entry_time = None

    times = df["time"]
    opens, highs, lows, closes = df["open"], df["high"], df["low"], df["close"]

    for i in range(len(df)):
        t, o, h, l, c = times.iloc[i], opens.iloc[i], highs.iloc[i], lows.iloc[i], closes.iloc[i]

        if position_dir is not None:
            hit = check_stop_take(position_dir, position_entry_price, h, l, spec, costs.pip_size)
            if hit is not None:
                exit_price, reason = hit
                trades.append(
                    close_trade(
                        position_dir, position_entry_time, position_entry_price, t, exit_price, reason, lots, costs
                    )
                )
                balance += trades[-1].pnl_account
                position_dir = None

        want_long = bool(long_signal.iloc[i])
        want_short = bool(short_signal.iloc[i])

        if want_long and not want_short:
            if position_dir == "short" and reverse:
                trades.append(
                    close_trade(position_dir, position_entry_time, position_entry_price, t, o, "reverse", lots, costs)
                )
                balance += trades[-1].pnl_account
                position_dir = None
            if position_dir is None:
                position_dir, position_entry_time = "long", t
                position_entry_price = apply_entry_costs("long", o, costs)
        elif want_short and not want_long:
            if position_dir == "long" and reverse:
                trades.append(
                    close_trade(position_dir, position_entry_time, position_entry_price, t, o, "reverse", lots, costs)
                )
                balance += trades[-1].pnl_account
                position_dir = None
            if position_dir is None:
                position_dir, position_entry_time = "short", t
                position_entry_price = apply_entry_costs("short", o, costs)

        if position_dir == "long":
            unrealized = (c - position_entry_price) / costs.pip_size * costs.pip_value_per_lot() * lots
        elif position_dir == "short":
            unrealized = (position_entry_price - c) / costs.pip_size * costs.pip_value_per_lot() * lots
        else:
            unrealized = 0.0
        equity_values.append(balance + unrealized)

    if position_dir is not None:
        t, c = times.iloc[-1], closes.iloc[-1]
        trades.append(close_trade(position_dir, position_entry_time, position_entry_price, t, c, "end_of_data", lots, costs))
        balance += trades[-1].pnl_account
        if equity_values:
            equity_values[-1] = balance

    equity_curve = pd.Series(equity_values, index=pd.to_datetime(times))
    return BacktestResult(
        strategy_id=spec.strategy_id,
        trades=trades,
        equity_curve=equity_curve,
        initial_balance=costs.initial_balance,
        final_balance=balance,
        cost_config=costs,
    )


def run_spread_stress_test(
    spec: StrategySpec,
    df: pd.DataFrame,
    base_costs: CostConfig | None = None,
    multipliers: tuple[float, ...] = (1.0, 1.5, 2.0),
) -> dict[float, BacktestResult]:
    """§14: run the same backtest at normal / 1.5x / 2x spread."""

    base_costs = base_costs or CostConfig.for_symbol(spec.symbol)
    return {m: run_backtest(spec, df, base_costs.scaled(m)) for m in multipliers}
