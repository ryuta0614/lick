"""Monte Carlo simulation (§19): bootstrap-resample the trade P&L sequence
to estimate the distribution of drawdowns and terminal equity a strategy
could plausibly have produced by chance ordering of the same trades.

Default 10,000 simulations, vectorized with numpy for speed.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from src.backtest.runner import BacktestResult

DEFAULT_SIMULATIONS = 10_000
DEFAULT_RUIN_THRESHOLD_PCT = 50.0  # equity falling below this % of initial balance counts as "ruin"


@dataclass
class MonteCarloReport:
    simulations: int
    expected_drawdown: float
    drawdown_95: float
    drawdown_99: float
    ruin_probability: float
    median_terminal_equity: float


def run_monte_carlo(
    result: BacktestResult,
    simulations: int = DEFAULT_SIMULATIONS,
    ruin_threshold_pct: float = DEFAULT_RUIN_THRESHOLD_PCT,
    seed: int | None = None,
) -> MonteCarloReport:
    pnls = np.array([t.pnl_account for t in result.trades], dtype=float)

    if len(pnls) == 0:
        return MonteCarloReport(
            simulations=simulations,
            expected_drawdown=0.0,
            drawdown_95=0.0,
            drawdown_99=0.0,
            ruin_probability=0.0,
            median_terminal_equity=result.initial_balance,
        )

    rng = np.random.default_rng(seed)
    sampled = rng.choice(pnls, size=(simulations, len(pnls)), replace=True)
    equity = result.initial_balance + np.cumsum(sampled, axis=1)

    running_max = np.maximum.accumulate(equity, axis=1)
    drawdowns = running_max - equity
    max_dd_per_sim = drawdowns.max(axis=1)

    ruin_level = result.initial_balance * ruin_threshold_pct / 100.0
    ruin_mask = (equity <= ruin_level).any(axis=1)

    terminal_equity = equity[:, -1]

    return MonteCarloReport(
        simulations=simulations,
        expected_drawdown=float(max_dd_per_sim.mean()),
        drawdown_95=float(np.percentile(max_dd_per_sim, 95)),
        drawdown_99=float(np.percentile(max_dd_per_sim, 99)),
        ruin_probability=float(ruin_mask.mean()),
        median_terminal_equity=float(np.median(terminal_equity)),
    )
