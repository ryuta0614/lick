from pathlib import Path

from src.backtest import benchmarks as bm
from src.backtest.costs import CostConfig
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


def test_buy_and_hold_has_exactly_one_trade(synthetic_ohlcv_h1):
    result = bm.buy_and_hold(synthetic_ohlcv_h1)
    assert len(result.trades) == 1
    assert result.trades[0].direction == "long"


def test_always_long_never_shorts(synthetic_ohlcv_h1):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    costs = CostConfig.for_symbol("USDJPY")
    result = bm.always_long(synthetic_ohlcv_h1, costs, spec.exit, spec.risk.fixed_lot)
    assert len(result.trades) > 0
    assert all(t.direction == "long" for t in result.trades)


def test_always_short_never_longs(synthetic_ohlcv_h1):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    costs = CostConfig.for_symbol("USDJPY")
    result = bm.always_short(synthetic_ohlcv_h1, costs, spec.exit, spec.risk.fixed_lot)
    assert len(result.trades) > 0
    assert all(t.direction == "short" for t in result.trades)


def test_random_entry_trade_count_near_target(synthetic_ohlcv_h1):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    costs = CostConfig.for_symbol("USDJPY")
    result = bm.random_entry(synthetic_ohlcv_h1, costs, spec.exit, spec.risk.fixed_lot, target_trades=20, seed=3)
    # stochastic, but should be in the right order of magnitude
    assert 0 < len(result.trades) < 100


def test_simple_ema_cross_runs(synthetic_ohlcv_h1):
    result = bm.simple_ema_cross(synthetic_ohlcv_h1, timeframe="1h")
    assert len(result.equity_curve) == len(synthetic_ohlcv_h1)
