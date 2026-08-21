"""Performance metrics (§15) computed from a BacktestResult."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from src.backtest.runner import BacktestResult, Trade

# Approximate bars/year for a 24/5 FX market (~260 trading days/year).
# Used to annualize Sharpe/Sortino/Calmar; timeframe granularity is coarse
# enough that this is a reasonable approximation, not an exact count.
_BARS_PER_YEAR = {
    "1m": 260 * 24 * 60,
    "5m": 260 * 24 * 12,
    "15m": 260 * 24 * 4,
    "30m": 260 * 24 * 2,
    "1h": 260 * 24,
    "4h": 260 * 6,
    "1d": 260,
}


def periods_per_year(timeframe: str) -> float:
    return float(_BARS_PER_YEAR.get(timeframe, 260))


@dataclass
class Metrics:
    net_profit: float
    gross_profit: float
    gross_loss: float
    profit_factor: float
    win_rate: float
    average_win: float
    average_loss: float
    risk_reward: float
    expected_payoff: float
    max_drawdown: float
    relative_drawdown_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    recovery_factor: float
    num_trades: int
    long_trades: int
    short_trades: int
    average_holding_time: pd.Timedelta
    max_consecutive_losses: int

    def as_dict(self) -> dict:
        d = self.__dict__.copy()
        d["average_holding_time"] = str(d["average_holding_time"])
        return d


def _max_drawdown(equity: pd.Series) -> tuple[float, float]:
    """Returns (absolute max drawdown, relative max drawdown %)."""

    if equity.empty:
        return 0.0, 0.0
    running_max = equity.cummax()
    drawdown = equity - running_max
    abs_dd = max(float(-drawdown.min()), 0.0) if len(drawdown) else 0.0
    rel_dd = drawdown / running_max.replace(0, np.nan) * 100.0
    rel_dd_pct = max(float(-rel_dd.min()), 0.0) if rel_dd.notna().any() else 0.0
    return abs_dd, rel_dd_pct


def _max_consecutive_losses(trades: list[Trade]) -> int:
    streak = 0
    worst = 0
    for trade in trades:
        if trade.pnl_account < 0:
            streak += 1
            worst = max(worst, streak)
        else:
            streak = 0
    return worst


def compute_metrics(result: BacktestResult, timeframe: str = "1h") -> Metrics:
    trades = result.trades
    num_trades = len(trades)

    wins = [t.pnl_account for t in trades if t.pnl_account > 0]
    losses = [t.pnl_account for t in trades if t.pnl_account <= 0]

    gross_profit = float(sum(wins))
    gross_loss = float(-sum(losses))
    net_profit = gross_profit - gross_loss

    profit_factor = gross_profit / gross_loss if gross_loss > 0 else math.inf if gross_profit > 0 else 0.0
    win_rate = (len(wins) / num_trades * 100.0) if num_trades else 0.0
    average_win = gross_profit / len(wins) if wins else 0.0
    average_loss = -gross_loss / len(losses) if losses else 0.0
    risk_reward = (average_win / abs(average_loss)) if average_loss != 0 else math.inf if average_win > 0 else 0.0
    expected_payoff = net_profit / num_trades if num_trades else 0.0

    max_dd, rel_dd_pct = _max_drawdown(result.equity_curve)

    returns = result.equity_curve.pct_change().dropna()
    ppy = periods_per_year(timeframe)
    if len(returns) > 1 and returns.std(ddof=0) > 0:
        sharpe = float(returns.mean() / returns.std(ddof=0) * math.sqrt(ppy))
    else:
        sharpe = 0.0

    downside = returns[returns < 0]
    if len(downside) > 1 and downside.std(ddof=0) > 0:
        sortino = float(returns.mean() / downside.std(ddof=0) * math.sqrt(ppy))
    else:
        sortino = 0.0

    n_years = len(result.equity_curve) / ppy if ppy else 0.0
    if n_years > 0 and result.initial_balance > 0:
        annualized_return_pct = ((result.final_balance / result.initial_balance) ** (1 / n_years) - 1) * 100.0
    else:
        annualized_return_pct = 0.0
    calmar = annualized_return_pct / rel_dd_pct if rel_dd_pct > 0 else 0.0

    recovery_factor = net_profit / max_dd if max_dd > 0 else 0.0

    long_trades = sum(1 for t in trades if t.direction == "long")
    short_trades = sum(1 for t in trades if t.direction == "short")

    if trades:
        holding_times = [pd.Timestamp(t.exit_time) - pd.Timestamp(t.entry_time) for t in trades]
        avg_holding = sum(holding_times, pd.Timedelta(0)) / len(holding_times)
    else:
        avg_holding = pd.Timedelta(0)

    return Metrics(
        net_profit=net_profit,
        gross_profit=gross_profit,
        gross_loss=gross_loss,
        profit_factor=profit_factor,
        win_rate=win_rate,
        average_win=average_win,
        average_loss=average_loss,
        risk_reward=risk_reward,
        expected_payoff=expected_payoff,
        max_drawdown=max_dd,
        relative_drawdown_pct=rel_dd_pct,
        sharpe_ratio=sharpe,
        sortino_ratio=sortino,
        calmar_ratio=calmar,
        recovery_factor=recovery_factor,
        num_trades=num_trades,
        long_trades=long_trades,
        short_trades=short_trades,
        average_holding_time=avg_holding,
        max_consecutive_losses=_max_consecutive_losses(trades),
    )
