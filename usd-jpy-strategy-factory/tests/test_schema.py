import pytest
from pydantic import ValidationError

from src.strategies.schema import EntryRule, StrategySpec


def _minimal_kwargs(**overrides):
    kwargs = dict(
        strategy_id="ema_cross_001",
        name="EMA Cross",
        symbol="USDJPY",
        timeframe="1h",
        long_entry=EntryRule(condition="EMA20 crosses above EMA50"),
    )
    kwargs.update(overrides)
    return kwargs


def test_minimal_spec_builds_with_defaults():
    spec = StrategySpec(**_minimal_kwargs())
    assert spec.exit.stop_loss_pips is None
    assert spec.position_management.max_positions == 1
    assert spec.risk.position_sizing == "fixed_lot"
    assert spec.danger_level == "SAFE"
    assert spec.review_status == "OK"


def test_requires_at_least_one_entry():
    with pytest.raises(ValidationError):
        StrategySpec(
            strategy_id="no_entry",
            name="No Entry",
            timeframe="1h",
        )


def test_strategy_id_must_be_snake_case():
    with pytest.raises(ValidationError):
        StrategySpec(**_minimal_kwargs(strategy_id="EMA Cross 001"))


def test_invalid_timeframe_rejected():
    with pytest.raises(ValidationError):
        StrategySpec(**_minimal_kwargs(timeframe="2h"))


def test_roundtrip_json_file(tmp_path):
    spec = StrategySpec(**_minimal_kwargs())
    path = tmp_path / "ema_cross_001.json"
    spec.to_json_file(str(path))

    loaded = StrategySpec.from_json_file(str(path))
    assert loaded == spec
