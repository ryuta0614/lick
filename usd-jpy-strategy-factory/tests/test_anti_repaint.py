from pathlib import Path

from src.pine.anti_repaint import assess, classify_trade_count
from src.pine.parser import parse_pine_file

FIXTURES = Path(__file__).parent / "fixtures" / "pine"
PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def test_golden_ema_cross_is_safe():
    raw = parse_pine_file(str(PINE_INPUTS / "ema_cross.pine"))
    result = assess(raw)
    assert result.level == "SAFE"
    assert result.findings == []


def test_golden_rsi_mean_reversion_is_safe():
    raw = parse_pine_file(str(PINE_INPUTS / "rsi_mean_reversion.pine"))
    result = assess(raw)
    assert result.level == "SAFE"


def test_dangerous_repaint_example_is_rejected():
    raw = parse_pine_file(str(FIXTURES / "dangerous_repaint_example.pine"))
    result = assess(raw)
    assert result.level == "REJECT"
    patterns = {f.pattern for f in result.findings}
    assert any("lookahead_on" in p for p in patterns)
    assert any(r"\[\s*-\d+\s*\]" in p for p in patterns)


def test_overfitting_thresholds():
    lines = ["//@version=5", 'strategy("Overfit")']
    for i in range(13):
        lines.append(f"p{i} = input.int({i}, title=\"P{i}\")")
    lines.append('strategy.entry("Long", strategy.long)')

    from src.pine.parser import parse_pine_source

    raw = parse_pine_source("\n".join(lines))
    result = assess(raw)
    assert result.level == "DANGEROUS"


def test_classify_trade_count():
    assert classify_trade_count(150) == "SAFE"
    assert classify_trade_count(60) == "WARNING"
    assert classify_trade_count(10) == "DANGEROUS"
