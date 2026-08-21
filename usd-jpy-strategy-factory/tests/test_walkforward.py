from pathlib import Path

from src.backtest.walkforward import run_walk_forward
from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import parse_pine_file

PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def _golden_spec():
    raw = parse_pine_file(str(PINE_INPUTS / "ema_cross.pine"))
    danger = assess(raw)
    outcome = analyze_pine(raw, danger, strategy_id="ema_cross_001")
    assert outcome.spec is not None
    return outcome.spec


def test_walk_forward_produces_windows_and_wfe(synthetic_ohlcv_h1):
    spec = _golden_spec()
    report = run_walk_forward(spec, synthetic_ohlcv_h1, training_months=1, test_months=1, step_months=1)
    assert len(report.windows) > 0
    for w in report.windows:
        assert w.train_start < w.train_end == w.test_start < w.test_end
    assert isinstance(report.walk_forward_efficiency, float)


def test_walk_forward_empty_when_insufficient_data(synthetic_ohlcv_h1):
    spec = _golden_spec()
    short_df = synthetic_ohlcv_h1.iloc[:10]
    report = run_walk_forward(spec, short_df, training_months=24, test_months=6, step_months=6)
    assert report.windows == []
    assert report.walk_forward_efficiency == 0.0
