from pathlib import Path

import pytest

from src.backtest.costs import CostConfig
from src.backtest.runner import BacktestError, run_backtest, run_spread_stress_test
from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import parse_pine_file
from src.strategies.schema import EntryRule, ExitRule, StrategySpec

PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def _golden_spec(filename: str, strategy_id: str) -> StrategySpec:
    raw = parse_pine_file(str(PINE_INPUTS / filename))
    danger = assess(raw)
    outcome = analyze_pine(raw, danger, strategy_id=strategy_id)
    assert outcome.spec is not None, outcome.notes
    return outcome.spec


def test_run_backtest_produces_equity_curve_matching_bar_count(synthetic_ohlcv_h1):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    result = run_backtest(spec, synthetic_ohlcv_h1)
    assert len(result.equity_curve) == len(synthetic_ohlcv_h1)
    assert result.initial_balance == pytest.approx(CostConfig.for_symbol("USDJPY").initial_balance)


def test_run_backtest_produces_trades_with_valid_directions(synthetic_ohlcv_h1):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    result = run_backtest(spec, synthetic_ohlcv_h1)
    assert len(result.trades) > 0
    for trade in result.trades:
        assert trade.direction in ("long", "short")
        assert trade.exit_time >= trade.entry_time
        assert trade.lots == spec.risk.fixed_lot


def test_rsi_mean_reversion_runs_on_synthetic_data(synthetic_ohlcv_15m):
    spec = _golden_spec("rsi_mean_reversion.pine", "rsi_mean_reversion_001")
    result = run_backtest(spec, synthetic_ohlcv_15m)
    assert len(result.trades) > 0


def test_entry_without_structured_trigger_raises(synthetic_ohlcv_h1):
    spec = StrategySpec(
        strategy_id="bad_trigger",
        name="Bad",
        timeframe="1h",
        long_entry=EntryRule(condition="unstructured"),
        exit=ExitRule(stop_loss_pips=10, take_profit_pips=20),
    )
    with pytest.raises(BacktestError):
        run_backtest(spec, synthetic_ohlcv_h1)


def test_missing_columns_raises(synthetic_ohlcv_h1):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    bad_df = synthetic_ohlcv_h1.drop(columns=["high"])
    with pytest.raises(BacktestError):
        run_backtest(spec, bad_df)


def test_spread_stress_test_is_monotonically_non_increasing(synthetic_ohlcv_h1):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    results = run_spread_stress_test(spec, synthetic_ohlcv_h1, multipliers=(1.0, 1.5, 2.0))
    balances = [results[m].final_balance for m in (1.0, 1.5, 2.0)]
    assert balances[0] >= balances[1] >= balances[2]
    trade_counts = {len(results[m].trades) for m in (1.0, 1.5, 2.0)}
    assert len(trade_counts) == 1  # same entries/exits, only realized cost differs
