from pathlib import Path

from src.backtest.robustness import perturb_indicator_period, run_robustness_test
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


def test_perturb_indicator_period_updates_period_and_labels():
    spec = _golden_spec()
    variant = perturb_indicator_period(spec, indicator_index=0, delta=3)
    assert variant is not None
    assert variant.indicators[0].period == 23  # 20 + 3
    assert variant.long_entry.indicator_a == "EMA23"
    assert "EMA23" in variant.long_entry.condition
    # original untouched
    assert spec.indicators[0].period == 20
    assert spec.long_entry.indicator_a == "EMA20"


def test_perturb_indicator_period_rejects_non_positive_period():
    spec = _golden_spec()
    variant = perturb_indicator_period(spec, indicator_index=0, delta=-25)
    assert variant is None


def test_run_robustness_test_produces_points_for_each_valid_delta(synthetic_ohlcv_h1):
    spec = _golden_spec()
    report = run_robustness_test(spec, synthetic_ohlcv_h1, indicator_index=0, steps=(-2, -1, 0, 1, 2))
    assert len(report.points) == 5
    assert report.original_label == "EMA20"
    assert isinstance(report.is_plateau, bool)
