from pathlib import Path

import pandas as pd
import pytest

from src.backtest.metrics import compute_metrics
from src.backtest.runner import run_backtest
from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import parse_pine_file

PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def _golden_spec(filename: str, strategy_id: str):
    raw = parse_pine_file(str(PINE_INPUTS / filename))
    danger = assess(raw)
    outcome = analyze_pine(raw, danger, strategy_id=strategy_id)
    assert outcome.spec is not None
    return outcome.spec


def test_metrics_basic_consistency(synthetic_ohlcv_h1):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    result = run_backtest(spec, synthetic_ohlcv_h1)
    m = compute_metrics(result, spec.timeframe)

    assert m.num_trades == len(result.trades)
    assert m.long_trades + m.short_trades == m.num_trades
    assert m.net_profit == pytest.approx(m.gross_profit - m.gross_loss)
    assert m.win_rate >= 0 and m.win_rate <= 100
    assert m.max_drawdown >= 0
    assert m.relative_drawdown_pct >= 0
    assert m.max_consecutive_losses >= 0


def test_metrics_empty_result_does_not_crash():
    from src.backtest.runner import BacktestResult

    empty = BacktestResult(
        strategy_id="empty",
        trades=[],
        equity_curve=pd.Series([1000.0, 1000.0], index=pd.date_range("2024-01-01", periods=2, freq="h")),
        initial_balance=1000.0,
        final_balance=1000.0,
    )
    m = compute_metrics(empty, "1h")
    assert m.num_trades == 0
    assert m.net_profit == 0
    assert m.profit_factor == 0.0



import pytest  # noqa: E402  (kept local to avoid unused-import churn at top for the single approx use)
