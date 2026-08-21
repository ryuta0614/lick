from pathlib import Path

from src.pine.parser import PineParseError, parse_pine_file, parse_pine_source

FIXTURES = Path(__file__).parent / "fixtures" / "pine"
PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def test_parses_ema_cross_golden_strategy():
    raw = parse_pine_file(str(PINE_INPUTS / "ema_cross.pine"))
    assert raw.script_kind == "strategy"
    assert raw.title == "EMA20/50 Crossover"
    assert raw.pine_version == 5
    assert raw.timeframe_hint == "1h"

    assert set(raw.inputs) == {"emaFastLen", "emaSlowLen", "slPips", "tpPips"}
    assert raw.inputs["emaFastLen"].default == "20"

    assert set(raw.indicator_calls) == {"emaFast", "emaSlow"}
    assert raw.indicator_calls["emaFast"].func == "ema"

    assert raw.conditions["longCondition"].func == "crossover"
    assert raw.conditions["longCondition"].lhs == "emaFast"
    assert raw.conditions["longCondition"].rhs == "emaSlow"

    directions = {e.id: e.direction for e in raw.entries}
    assert directions == {"Long": "long", "Short": "short"}
    long_entry = next(e for e in raw.entries if e.id == "Long")
    assert long_entry.condition_var == "longCondition"

    assert len(raw.exits) == 2
    assert "slPips" in raw.exits[0].stop_expr
    assert "tpPips" in raw.exits[0].limit_expr


def test_parses_rsi_mean_reversion_golden_strategy():
    raw = parse_pine_file(str(PINE_INPUTS / "rsi_mean_reversion.pine"))
    assert raw.timeframe_hint == "15m"
    assert raw.indicator_calls["rsiValue"].func == "rsi"
    assert raw.conditions["shortCondition"].func == "crossunder"


def test_indicator_script_is_parsed_without_entries():
    raw = parse_pine_file(str(FIXTURES / "ambiguous_indicator_example.pine"))
    assert raw.script_kind == "indicator"
    assert raw.entries == []


def test_missing_declaration_raises():
    import pytest

    with pytest.raises(PineParseError):
        parse_pine_source("//@version=5\nplot(close)\n")
