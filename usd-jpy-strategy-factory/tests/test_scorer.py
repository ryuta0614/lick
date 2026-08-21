from pathlib import Path

from src.backtest.metrics import compute_metrics
from src.backtest.montecarlo import run_monte_carlo
from src.backtest.robustness import run_robustness_test
from src.backtest.runner import run_backtest
from src.backtest.walkforward import run_walk_forward
from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import parse_pine_file
from src.ranking.scorer import (
    DEFAULT_REJECT_THRESHOLDS,
    compute_strategy_score,
    evaluate_reject_conditions,
)

PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def _golden_spec():
    raw = parse_pine_file(str(PINE_INPUTS / "ema_cross.pine"))
    danger = assess(raw)
    outcome = analyze_pine(raw, danger, strategy_id="ema_cross_001")
    assert outcome.spec is not None
    return outcome.spec


def test_score_breakdown_is_between_0_and_100(synthetic_ohlcv_h1):
    spec = _golden_spec()
    result = run_backtest(spec, synthetic_ohlcv_h1)
    metrics = compute_metrics(result, spec.timeframe)
    mc = run_monte_carlo(result, simulations=500, seed=1)
    wf = run_walk_forward(spec, synthetic_ohlcv_h1, training_months=1, test_months=1, step_months=1)
    rob = run_robustness_test(spec, synthetic_ohlcv_h1, indicator_index=0)

    score = compute_strategy_score(
        spec, metrics, oos_metrics=metrics, walk_forward=wf, monte_carlo=mc, robustness=rob
    )
    assert 0.0 <= score.total_score <= 100.0
    assert score.breakdown.total == sum(
        [
            score.breakdown.profit_factor,
            score.breakdown.max_drawdown,
            score.breakdown.sharpe,
            score.breakdown.out_of_sample,
            score.breakdown.walk_forward,
            score.breakdown.parameter_robustness,
            score.breakdown.trade_count,
            score.breakdown.monte_carlo,
        ]
    )


def test_reject_on_low_profit_factor():
    from src.backtest.metrics import Metrics
    import pandas as pd

    bad_metrics = Metrics(
        net_profit=-100,
        gross_profit=100,
        gross_loss=200,
        profit_factor=0.5,
        win_rate=30,
        average_win=10,
        average_loss=-20,
        risk_reward=0.5,
        expected_payoff=-1,
        max_drawdown=500,
        relative_drawdown_pct=10,
        sharpe_ratio=-0.5,
        sortino_ratio=-0.5,
        calmar_ratio=0,
        recovery_factor=0,
        num_trades=150,
        long_trades=80,
        short_trades=70,
        average_holding_time=pd.Timedelta(hours=2),
        max_consecutive_losses=5,
    )
    spec = _golden_spec()
    reasons = evaluate_reject_conditions(spec, bad_metrics, bad_metrics)
    assert any("Profit Factor" in r for r in reasons)

    score = compute_strategy_score(spec, bad_metrics, oos_metrics=bad_metrics)
    assert score.verdict == "REJECT"
    assert score.total_score == 0.0


def test_reject_on_insufficient_trades():
    from src.backtest.metrics import Metrics
    import pandas as pd

    metrics = Metrics(
        net_profit=1000,
        gross_profit=1500,
        gross_loss=500,
        profit_factor=3.0,
        win_rate=60,
        average_win=50,
        average_loss=-25,
        risk_reward=2.0,
        expected_payoff=20,
        max_drawdown=100,
        relative_drawdown_pct=2,
        sharpe_ratio=1.5,
        sortino_ratio=1.5,
        calmar_ratio=1.0,
        recovery_factor=10,
        num_trades=5,
        long_trades=3,
        short_trades=2,
        average_holding_time=pd.Timedelta(hours=2),
        max_consecutive_losses=1,
    )
    spec = _golden_spec()
    reasons = evaluate_reject_conditions(spec, metrics, metrics, DEFAULT_REJECT_THRESHOLDS)
    assert any("Trades" in r for r in reasons)


def test_reject_on_danger_level():
    from src.backtest.metrics import Metrics
    import pandas as pd

    good_metrics = Metrics(
        net_profit=1000,
        gross_profit=1500,
        gross_loss=500,
        profit_factor=3.0,
        win_rate=60,
        average_win=50,
        average_loss=-25,
        risk_reward=2.0,
        expected_payoff=20,
        max_drawdown=100,
        relative_drawdown_pct=2,
        sharpe_ratio=1.5,
        sortino_ratio=1.5,
        calmar_ratio=1.0,
        recovery_factor=10,
        num_trades=150,
        long_trades=80,
        short_trades=70,
        average_holding_time=pd.Timedelta(hours=2),
        max_consecutive_losses=1,
    )
    spec = _golden_spec()
    dangerous_spec = spec.model_copy(update={"danger_level": "DANGEROUS"})
    reasons = evaluate_reject_conditions(dangerous_spec, good_metrics, good_metrics)
    assert any("Repainting" in r for r in reasons)
