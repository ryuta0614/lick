from pathlib import Path

from src.backtest.montecarlo import run_monte_carlo
from src.backtest.runner import BacktestResult, Trade, run_backtest
from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import parse_pine_file
import pandas as pd


PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def _golden_spec():
    raw = parse_pine_file(str(PINE_INPUTS / "ema_cross.pine"))
    danger = assess(raw)
    outcome = analyze_pine(raw, danger, strategy_id="ema_cross_001")
    assert outcome.spec is not None
    return outcome.spec


def test_monte_carlo_basic_properties(synthetic_ohlcv_h1):
    spec = _golden_spec()
    result = run_backtest(spec, synthetic_ohlcv_h1)
    report = run_monte_carlo(result, simulations=1000, seed=42)

    assert report.simulations == 1000
    assert report.expected_drawdown >= 0
    assert report.drawdown_99 >= report.drawdown_95 >= 0
    assert 0.0 <= report.ruin_probability <= 1.0


def test_monte_carlo_no_trades_is_degenerate_but_safe():
    empty = BacktestResult(
        strategy_id="empty",
        trades=[],
        equity_curve=pd.Series([1000.0], index=pd.date_range("2024-01-01", periods=1, freq="h")),
        initial_balance=1000.0,
        final_balance=1000.0,
    )
    report = run_monte_carlo(empty, simulations=100, seed=1)
    assert report.expected_drawdown == 0.0
    assert report.ruin_probability == 0.0
    assert report.median_terminal_equity == 1000.0


def test_monte_carlo_deterministic_with_fixed_seed(synthetic_ohlcv_h1):
    spec = _golden_spec()
    result = run_backtest(spec, synthetic_ohlcv_h1)
    r1 = run_monte_carlo(result, simulations=500, seed=7)
    r2 = run_monte_carlo(result, simulations=500, seed=7)
    assert r1 == r2


def test_monte_carlo_high_ruin_probability_for_losing_strategy():
    # A synthetic set of trades that always loses heavily -> near-certain ruin.
    trades = [
        Trade(
            direction="long",
            entry_time=pd.Timestamp("2024-01-01") + pd.Timedelta(days=i),
            entry_price=100.0,
            exit_time=pd.Timestamp("2024-01-01") + pd.Timedelta(days=i, hours=1),
            exit_price=99.0,
            exit_reason="stop_loss",
            lots=0.01,
            pnl_pips=-20.0,
            pnl_account=-9000.0,
        )
        for i in range(20)
    ]
    result = BacktestResult(
        strategy_id="losing",
        trades=trades,
        equity_curve=pd.Series([10000.0] * 20),
        initial_balance=10000.0,
        final_balance=10000.0 - 20 * 9000.0,
    )
    report = run_monte_carlo(result, simulations=500, seed=1)
    assert report.ruin_probability > 0.9
