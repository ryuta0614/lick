from src.strategies.schema import EntryRule, ExitRule, PositionManagement, StrategySpec
from src.strategies.validator import validate_spec


def _spec(**overrides):
    kwargs = dict(
        strategy_id="ema_cross_001",
        name="EMA Cross",
        symbol="USDJPY",
        timeframe="1h",
        long_entry=EntryRule(condition="EMA20 crosses above EMA50"),
        exit=ExitRule(stop_loss_pips=20, take_profit_pips=40),
    )
    kwargs.update(overrides)
    return StrategySpec(**kwargs)


def test_valid_spec_passes():
    result = validate_spec(_spec())
    assert result.is_valid
    assert not result.blocks_ea_generation


def test_out_of_scope_symbol_is_rejected():
    result = validate_spec(_spec(symbol="EURUSD"))
    assert not result.is_valid
    assert any("out of scope" in e for e in result.errors)


def test_reject_danger_level_blocks_ea_generation():
    result = validate_spec(_spec(danger_level="REJECT"))
    assert not result.is_valid
    assert result.blocks_ea_generation


def test_needs_review_blocks_ea_generation():
    result = validate_spec(_spec(review_status="NEEDS_REVIEW"))
    assert not result.is_valid


def test_repaint_flag_false_is_rejected():
    result = validate_spec(_spec(anti_repaint=False))
    assert not result.is_valid


def test_no_stop_or_take_profit_is_a_warning_not_error():
    result = validate_spec(_spec(exit=ExitRule()))
    assert result.is_valid
    assert any("unbounded risk" in w for w in result.warnings)


def test_pyramiding_without_multiple_positions_is_rejected():
    result = validate_spec(
        _spec(position_management=PositionManagement(pyramiding=True, max_positions=1))
    )
    assert not result.is_valid
