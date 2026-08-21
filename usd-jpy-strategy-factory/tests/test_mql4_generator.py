import pytest

from src.generators.mql4_generator import MQL4GenerationError, generate_mql4, magic_number
from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import parse_pine_file
from src.strategies.schema import EntryRule, ExitRule, IndicatorSpec, StrategySpec
from pathlib import Path

PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def _golden_spec(path: str, strategy_id: str):
    raw = parse_pine_file(str(PINE_INPUTS / path))
    danger = assess(raw)
    outcome = analyze_pine(raw, danger, strategy_id=strategy_id)
    assert outcome.spec is not None, outcome.notes
    return outcome.spec


def _assert_balanced(source: str):
    assert source.count("{") == source.count("}")
    assert source.count("(") == source.count(")")


def test_ema_cross_generates_balanced_source_with_expected_calls():
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    src = generate_mql4(spec)
    _assert_balanced(src)
    assert "#include <RiskEngine.mqh>" in src
    assert "#include <Indicators.mqh>" in src
    assert "#include <Logger.mqh>" in src
    assert "OnInit()" in src and "OnDeinit(" in src and "OnTick()" in src
    assert "RiskEngine_AllowNewOrder(RequiredSymbol, MagicNumber)" in src
    assert "Ind_EMA(Symbol(), TradingTimeframe, 20, 1)" in src
    assert "Ind_EMA(Symbol(), TradingTimeframe, 50, 1)" in src
    assert "Ind_CrossesAbove(" in src
    assert "Ind_CrossesBelow(" in src
    assert 'input string        StrategyId            = "ema_cross_001";' in src
    assert "TradingTimeframe     = PERIOD_H1;" in src


def test_rsi_mean_reversion_generates_threshold_crossings():
    spec = _golden_spec("rsi_mean_reversion.pine", "rsi_mean_reversion_001")
    src = generate_mql4(spec)
    _assert_balanced(src)
    assert "Ind_RSI(Symbol(), TradingTimeframe, 14, 1)" in src
    # threshold constants (30 / 70) appear as bare numeric literals, not indicator calls
    assert "Ind_CrossesAbove(Ind_RSI(Symbol(), TradingTimeframe, 14, 1), Ind_RSI(Symbol(), TradingTimeframe, 14, 2), 30, 30)" in src
    assert "Ind_CrossesBelow(Ind_RSI(Symbol(), TradingTimeframe, 14, 1), Ind_RSI(Symbol(), TradingTimeframe, 14, 2), 70, 70)" in src


def test_magic_number_is_deterministic_and_in_range():
    a = magic_number("ema_cross_001")
    b = magic_number("ema_cross_001")
    c = magic_number("rsi_mean_reversion_001")
    assert a == b
    assert a != c
    assert 700_000_000 <= a < 790_000_000


def test_reject_spec_refuses_generation():
    spec = StrategySpec(
        strategy_id="bad_001",
        name="Bad",
        timeframe="1h",
        long_entry=EntryRule(condition="x"),
        danger_level="REJECT",
    )
    with pytest.raises(MQL4GenerationError):
        generate_mql4(spec)


def test_needs_review_spec_refuses_generation():
    spec = StrategySpec(
        strategy_id="needs_review_001",
        name="Needs Review",
        timeframe="1h",
        long_entry=EntryRule(condition="x"),
        review_status="NEEDS_REVIEW",
    )
    with pytest.raises(MQL4GenerationError):
        generate_mql4(spec)


def test_entry_rule_without_structured_trigger_refuses_generation():
    spec = StrategySpec(
        strategy_id="unstructured_001",
        name="Unstructured",
        timeframe="1h",
        long_entry=EntryRule(condition="some hand-written text with no structured trigger"),
        exit=ExitRule(stop_loss_pips=10, take_profit_pips=20),
    )
    with pytest.raises(MQL4GenerationError, match="no structured trigger"):
        generate_mql4(spec)


def test_unsupported_indicator_type_refuses_generation():
    spec = StrategySpec(
        strategy_id="unsupported_ind_001",
        name="Unsupported Indicator",
        timeframe="1h",
        indicators=[IndicatorSpec(type="SUPERTREND", period=10)],
        long_entry=EntryRule(
            condition="SUPERTREND10 crosses above 0",
            indicator_a="SUPERTREND10",
            operator="crosses_above",
            indicator_b="0",
        ),
        exit=ExitRule(stop_loss_pips=10, take_profit_pips=20),
    )
    with pytest.raises(MQL4GenerationError, match="not yet supported"):
        generate_mql4(spec)
