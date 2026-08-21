"""Exercises the actual Streamlit script via streamlit.testing.v1.AppTest,
against an isolated temp DB. This runs the real render_* functions, not
just the pure query helpers (tests/test_dashboard_queries.py)."""

from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

from src.backtest.metrics import compute_metrics
from src.backtest.runner import run_backtest
from src.database.repository import StrategyRepository
from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import parse_pine_file

PINE_INPUTS = Path(__file__).parent.parent / "pine_inputs"
APP_PATH = str(Path(__file__).parent.parent / "src" / "dashboard" / "app.py")


def _golden_spec(filename: str, strategy_id: str):
    raw = parse_pine_file(str(PINE_INPUTS / filename))
    danger = assess(raw)
    outcome = analyze_pine(raw, danger, strategy_id=strategy_id)
    assert outcome.spec is not None
    return outcome.spec


@pytest.fixture
def dashboard_env(tmp_path, monkeypatch, synthetic_ohlcv_h1):
    db_url = f"sqlite:///{tmp_path}/dash_app.db"
    monkeypatch.setenv("STRATEGY_FACTORY_DATABASE_URL", db_url)

    repo = StrategyRepository(db_url)
    for filename, sid in [("ema_cross.pine", "ema_cross_001"), ("rsi_mean_reversion.pine", "rsi_mean_reversion_001")]:
        spec = _golden_spec(filename, sid)
        version_id = repo.save_spec(spec)
        result = run_backtest(spec, synthetic_ohlcv_h1)
        metrics = compute_metrics(result, spec.timeframe)
        repo.save_backtest(version_id, result, metrics)
        repo.save_score(version_id, 50.0 if sid == "ema_cross_001" else 70.0, "PASS", {})
    return db_url


def test_dashboard_page_renders_without_exceptions(dashboard_env):
    at = AppTest.from_file(APP_PATH)
    at.run(timeout=30)
    assert not at.exception


def test_strategy_detail_page_renders_without_exceptions(dashboard_env):
    at = AppTest.from_file(APP_PATH)
    at.run(timeout=30)
    at.sidebar.radio[0].set_value("Strategy Detail").run(timeout=30)
    assert not at.exception


def test_comparison_page_renders_without_exceptions(dashboard_env):
    at = AppTest.from_file(APP_PATH)
    at.run(timeout=30)
    at.sidebar.radio[0].set_value("Comparison").run(timeout=30)
    assert not at.exception
