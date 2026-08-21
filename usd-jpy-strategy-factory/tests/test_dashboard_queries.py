from pathlib import Path

import pytest

from src.backtest.metrics import compute_metrics
from src.backtest.runner import run_backtest
from src.dashboard.queries import get_equity_curve, get_strategy_detail, get_trades, list_strategies_with_scores
from src.database.repository import StrategyRepository
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


@pytest.fixture
def seeded_repo(tmp_path, synthetic_ohlcv_h1):
    repo = StrategyRepository(f"sqlite:///{tmp_path}/dash.db")
    spec = _golden_spec()
    version_id = repo.save_spec(spec)
    result = run_backtest(spec, synthetic_ohlcv_h1)
    metrics = compute_metrics(result, spec.timeframe)
    backtest_id = repo.save_backtest(version_id, result, metrics)
    repo.save_score(version_id, 42.0, "PASS", {"profit_factor": 15})
    return repo, backtest_id


def test_list_strategies_with_scores(seeded_repo):
    repo, _ = seeded_repo
    rows = list_strategies_with_scores(repo)
    assert rows[0]["strategy_id"] == "ema_cross_001"
    assert rows[0]["score"] == 42.0


def test_get_strategy_detail_includes_backtests_and_scores(seeded_repo):
    repo, _ = seeded_repo
    detail = get_strategy_detail(repo, "ema_cross_001")
    assert detail is not None
    assert detail["danger_level"] == "SAFE"
    assert len(detail["backtests"]) == 1
    assert len(detail["scores"]) == 1
    assert detail["spec_json"] is not None


def test_get_strategy_detail_unknown_returns_none(seeded_repo):
    repo, _ = seeded_repo
    assert get_strategy_detail(repo, "does_not_exist") is None


def test_get_equity_curve_is_cumulative(seeded_repo):
    repo, backtest_id = seeded_repo
    equity = get_equity_curve(repo, backtest_id)
    assert len(equity) > 0
    trades_df = get_trades(repo, backtest_id)
    assert equity.iloc[-1] == pytest.approx(trades_df["pnl_account"].sum())


def test_get_trades_dataframe_has_expected_columns(seeded_repo):
    repo, backtest_id = seeded_repo
    trades_df = get_trades(repo, backtest_id)
    assert not trades_df.empty
    assert {"direction", "entry_time", "exit_time", "pnl_account"}.issubset(trades_df.columns)
