from pathlib import Path

import pytest

from src.backtest.metrics import compute_metrics
from src.backtest.runner import run_backtest
from src.database.repository import StrategyRepository
from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import parse_pine_file

PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"


def _golden_spec(filename: str, strategy_id: str):
    raw = parse_pine_file(str(PINE_INPUTS / filename))
    danger = assess(raw)
    outcome = analyze_pine(raw, danger, strategy_id=strategy_id)
    assert outcome.spec is not None
    return outcome.spec


@pytest.fixture
def repo(tmp_path):
    return StrategyRepository(f"sqlite:///{tmp_path}/test.db")


def test_save_and_load_spec_roundtrip(repo):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    version_id = repo.save_spec(spec)
    loaded = repo.get_spec(version_id)
    assert loaded.strategy_id == spec.strategy_id
    assert loaded.long_entry.condition == spec.long_entry.condition


def test_save_backtest_persists_trades(repo, synthetic_ohlcv_h1):
    spec = _golden_spec("ema_cross.pine", "ema_cross_001")
    version_id = repo.save_spec(spec)
    result = run_backtest(spec, synthetic_ohlcv_h1)
    metrics = compute_metrics(result, spec.timeframe)

    backtest_id = repo.save_backtest(version_id, result, metrics)
    assert backtest_id > 0

    with repo.session() as session:
        from src.database.models import BacktestRecord, TradeRecord

        record = session.get(BacktestRecord, backtest_id)
        assert record.num_trades == len(result.trades)
        trades = session.query(TradeRecord).filter_by(backtest_pk=backtest_id).all()
        assert len(trades) == len(result.trades)


def test_ranking_orders_by_score_descending(repo):
    spec_a = _golden_spec("ema_cross.pine", "ema_cross_001")
    spec_b = _golden_spec("rsi_mean_reversion.pine", "rsi_mean_reversion_001")
    vid_a = repo.save_spec(spec_a)
    vid_b = repo.save_spec(spec_b)

    repo.save_score(vid_a, 55.0, "PASS", {})
    repo.save_score(vid_b, 82.0, "PASS", {})

    ranking = repo.ranking()
    assert [r["strategy_id"] for r in ranking] == ["rsi_mean_reversion_001", "ema_cross_001"]


def test_log_error_does_not_raise(repo):
    repo.log_error(stage="parse", message="something went wrong", strategy_id="ema_cross_001")
