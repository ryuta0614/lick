from pathlib import Path

from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import parse_pine_file

FIXTURES = Path(__file__).parent / "fixtures" / "pine"
PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def _analyze(path: str, strategy_id: str):
    raw = parse_pine_file(path)
    danger = assess(raw)
    return analyze_pine(raw, danger, strategy_id=strategy_id)


def test_ema_cross_produces_valid_spec_matching_golden_rules():
    outcome = _analyze(str(PINE_INPUTS / "ema_cross.pine"), "ema_cross_001")
    assert outcome.review_status == "OK"
    spec = outcome.spec
    assert spec is not None
    assert spec.timeframe == "1h"
    assert spec.long_entry.condition == "EMA20 crosses above EMA50"
    assert spec.short_entry.condition == "EMA20 crosses below EMA50"
    assert spec.exit.stop_loss_pips == 20
    assert spec.exit.take_profit_pips == 40
    assert [i.type for i in spec.indicators] == ["EMA", "EMA"]
    assert spec.danger_level == "SAFE"
    assert spec.anti_repaint is True


def test_rsi_mean_reversion_produces_valid_spec():
    outcome = _analyze(str(PINE_INPUTS / "rsi_mean_reversion.pine"), "rsi_mean_reversion_001")
    spec = outcome.spec
    assert spec is not None
    assert spec.timeframe == "15m"
    assert "RSI14" in spec.long_entry.condition
    assert spec.exit.stop_loss_pips == 25
    assert spec.exit.take_profit_pips == 25


def test_ambiguous_indicator_is_needs_review_with_no_invented_spec():
    outcome = _analyze(
        str(FIXTURES / "ambiguous_indicator_example.pine"), "ambiguous_indicator_001"
    )
    assert outcome.review_status == "NEEDS_REVIEW"
    assert outcome.spec is None


def test_dangerous_repaint_example_is_never_built_into_a_spec():
    outcome = _analyze(str(FIXTURES / "dangerous_repaint_example.pine"), "dangerous_001")
    assert outcome.spec is None
    assert outcome.danger_level == "REJECT"
