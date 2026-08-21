#!/usr/bin/env python3
"""USDJPY AI Strategy Factory CLI (§31).

    python app.py import pine_inputs/ema_cross.pine --strategy-id ema_cross_001
    python app.py analyze ema_cross_001
    python app.py convert ema_cross_001
    python app.py compile ema_cross_001
    python app.py backtest ema_cross_001 [--data data/USDJPY_1h.csv | --synthetic]
    python app.py walkforward ema_cross_001 [--data ... | --synthetic]
    python app.py montecarlo ema_cross_001 [--data ... | --synthetic]
    python app.py evaluate ema_cross_001 [--data ... | --synthetic]
    python app.py rank
    python app.py dashboard
    python app.py pipeline pine_inputs/ema_cross.pine --strategy-id ema_cross_001 [--synthetic]

This CLI never places a live order (there is no order-placing code path
here at all -- see ARCHITECTURE.md "Live Safety"). `evaluate`/`pipeline`
print the current RUN_MODE/ENABLE_LIVE_TRADING gate state for visibility
only.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import click
import pandas as pd
from dotenv import load_dotenv

from src.backtest.costs import CostConfig
from src.backtest.metrics import Metrics, compute_metrics
from src.backtest.montecarlo import run_monte_carlo
from src.backtest.robustness import run_robustness_test
from src.backtest.runner import run_backtest, run_spread_stress_test
from src.backtest.sample_split import SamplePeriods, split_periods
from src.backtest.synthetic import make_synthetic_ohlcv
from src.backtest.walkforward import run_walk_forward
from src.database.repository import DEFAULT_DATABASE_URL, StrategyRepository
from src.generators.mql4_generator import MQL4GenerationError, generate_mql4
from src.logging_setup import setup_logging
from src.mt4.compiler import compile_ea
from src.pine.analyzer import analyze_pine
from src.pine.anti_repaint import assess
from src.pine.parser import PineParseError, parse_pine_file
from src.ranking.scorer import compute_strategy_score
from src.strategies.schema import StrategySpec
from src.strategies.validator import validate_spec

load_dotenv()
logger = setup_logging()

PINE_REGISTRY_PATH = Path("data/pine_registry.json")
STRATEGY_SPECS_DIR = Path("strategy_specs")
MQL4_GENERATED_DIR = Path("mql4/generated")

_TIMEFRAME_TO_PANDAS_FREQ = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
}


def _load_registry() -> dict:
    if PINE_REGISTRY_PATH.exists():
        return json.loads(PINE_REGISTRY_PATH.read_text(encoding="utf-8"))
    return {}


def _save_registry(registry: dict) -> None:
    PINE_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    PINE_REGISTRY_PATH.write_text(json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8")


def _load_data(data_path: str | None, synthetic: bool, timeframe: str) -> pd.DataFrame:
    if synthetic:
        click.echo("NOTE: using SYNTHETIC demo data -- not a real backtest (docs/assumptions.md #2)")
        freq = _TIMEFRAME_TO_PANDAS_FREQ.get(timeframe, "1h")
        return make_synthetic_ohlcv(n_bars=2000, freq=freq)
    if data_path is None:
        raise click.ClickException(
            "no --data CSV given and --synthetic not set. This container cannot reach real "
            "USDJPY history (docs/assumptions.md #2). Supply a CSV with columns "
            "time,open,high,low,close[,volume] via --data, or pass --synthetic for a demo run."
        )
    return pd.read_csv(data_path, parse_dates=["time"])


def _dynamic_periods(df: pd.DataFrame) -> SamplePeriods:
    """60/20/20 split over the data's actual date range -- used only for
    --synthetic demo runs, where the fixed config/default.yaml calendar
    periods (2017-2026) would not overlap a short synthetic series."""

    start, end = df["time"].min(), df["time"].max()
    span = end - start
    is_end = start + span * 0.6
    val_end = start + span * 0.8
    fmt = "%Y-%m-%d"
    return SamplePeriods(
        in_sample=(start.strftime(fmt), is_end.strftime(fmt)),
        validation=(is_end.strftime(fmt), val_end.strftime(fmt)),
        out_of_sample=(val_end.strftime(fmt), end.strftime(fmt)),
    )


def _get_repository() -> StrategyRepository:
    try:
        from src.config import load_config

        url = load_config().get("database", {}).get("url", DEFAULT_DATABASE_URL)
    except Exception:
        url = DEFAULT_DATABASE_URL
    return StrategyRepository(url)


def _load_spec(strategy_id: str) -> StrategySpec:
    path = STRATEGY_SPECS_DIR / f"{strategy_id}.json"
    if not path.exists():
        raise click.ClickException(f"no StrategySpec for '{strategy_id}'; run `app.py analyze {strategy_id}` first")
    return StrategySpec.from_json_file(str(path))


def _print_metrics(label: str, m: Metrics) -> None:
    pf = "inf" if m.profit_factor == float("inf") else f"{m.profit_factor:.2f}"
    click.echo(
        f"[{label}] trades={m.num_trades} PF={pf} WinRate={m.win_rate:.1f}% "
        f"NetProfit={m.net_profit:.0f} DD={m.relative_drawdown_pct:.1f}% Sharpe={m.sharpe_ratio:.2f}"
    )


def _print_live_safety_status() -> None:
    run_mode = os.environ.get("RUN_MODE", "BACKTEST")
    enable_live = os.environ.get("ENABLE_LIVE_TRADING", "false").lower() == "true"
    gate_open = run_mode == "LIVE" and enable_live
    click.echo(
        f"Live Safety gate: RUN_MODE={run_mode} ENABLE_LIVE_TRADING={enable_live} "
        f"-> live order placement {'ENABLED' if gate_open else 'blocked'} "
        "(this CLI never places orders itself; see ARCHITECTURE.md)"
    )


@click.group()
def cli() -> None:
    """USDJPY AI Strategy Factory."""


@cli.command("import")
@click.argument("pine_file", type=click.Path(exists=True))
@click.option("--strategy-id", default=None, help="Override the derived strategy_id (default: filename stem)")
def import_cmd(pine_file: str, strategy_id: str | None) -> None:
    """Register a Pine Script (from pine_inputs/) for later analysis."""

    strategy_id = strategy_id or Path(pine_file).stem
    try:
        parse_pine_file(pine_file)
    except PineParseError as exc:
        raise click.ClickException(f"failed to parse Pine source: {exc}") from exc

    registry = _load_registry()
    registry[strategy_id] = {"pine_path": str(pine_file)}
    _save_registry(registry)
    logger.info(f"{strategy_id} imported from {pine_file}")
    click.echo(f"Registered strategy_id='{strategy_id}' -> {pine_file}")


@cli.command()
@click.argument("strategy_id")
def analyze(strategy_id: str) -> None:
    """Parse + danger-check + build a StrategySpec for STRATEGY_ID."""

    registry = _load_registry()
    if strategy_id not in registry:
        raise click.ClickException(f"unknown strategy_id '{strategy_id}'; run `app.py import <file>` first")
    pine_path = registry[strategy_id]["pine_path"]

    raw = parse_pine_file(pine_path)
    danger = assess(raw)
    outcome = analyze_pine(raw, danger, strategy_id=strategy_id)

    click.echo(f"danger_level={outcome.danger_level} review_status={outcome.review_status}")
    for note in outcome.notes:
        click.echo(f"  - {note}")

    if outcome.spec is None:
        logger.warning(
            f"{strategy_id} analyze: NO SPEC (danger={outcome.danger_level} review={outcome.review_status})"
        )
        raise click.ClickException("StrategySpec could not be built -- see notes above")

    STRATEGY_SPECS_DIR.mkdir(parents=True, exist_ok=True)
    spec_path = STRATEGY_SPECS_DIR / f"{strategy_id}.json"
    outcome.spec.to_json_file(str(spec_path))
    logger.info(f"{strategy_id} analyzed: danger={outcome.danger_level} -> {spec_path}")
    click.echo(f"StrategySpec written to {spec_path}")


@cli.command()
@click.argument("strategy_id")
def convert(strategy_id: str) -> None:
    """StrategySpec -> MQL4 EA."""

    spec = _load_spec(strategy_id)
    validation = validate_spec(spec)
    for w in validation.warnings:
        click.echo(f"WARNING: {w}")
    if not validation.is_valid:
        for e in validation.errors:
            click.echo(f"ERROR: {e}")
        raise click.ClickException("StrategySpec failed validation; EA not generated")

    try:
        source = generate_mql4(spec)
    except MQL4GenerationError as exc:
        logger.error(f"{strategy_id} MQL4 generation: FAILED ({exc})")
        raise click.ClickException(str(exc)) from exc

    MQL4_GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MQL4_GENERATED_DIR / f"{strategy_id}.mq4"
    out_path.write_text(source, encoding="utf-8")
    logger.info(f"{strategy_id} MQL4 generation: SUCCESS -> {out_path}")
    click.echo(f"MQL4 EA written to {out_path}")


@cli.command("compile")
@click.argument("strategy_id")
def compile_cmd(strategy_id: str) -> None:
    """Compile the generated EA with MetaEditor (NOT_AVAILABLE in this dev container)."""

    mq4_path = MQL4_GENERATED_DIR / f"{strategy_id}.mq4"
    if not mq4_path.exists():
        raise click.ClickException(f"no generated EA for '{strategy_id}'; run `app.py convert {strategy_id}` first")
    result = compile_ea(str(mq4_path))
    logger.info(f"{strategy_id} compile: {result.status}")
    click.echo(f"compile status: {result.status}")
    click.echo(result.detail)


@cli.command()
@click.argument("strategy_id")
@click.option("--data", "data_path", default=None, type=click.Path(exists=True))
@click.option("--synthetic", is_flag=True, help="Use synthetic demo data (docs/assumptions.md #2)")
@click.option("--stress-test/--no-stress-test", default=True, help="Also run the 1x/1.5x/2x spread stress test")
def backtest(strategy_id: str, data_path: str | None, synthetic: bool, stress_test: bool) -> None:
    """Run the Python reference backtester and store results in the DB."""

    spec = _load_spec(strategy_id)
    df = _load_data(data_path, synthetic, spec.timeframe)
    costs = CostConfig.for_symbol(spec.symbol)

    result = run_backtest(spec, df, costs)
    metrics = compute_metrics(result, spec.timeframe)
    _print_metrics("full", metrics)

    repo = _get_repository()
    version_id = repo.save_spec(spec)
    repo.save_backtest(version_id, result, metrics, label="full")

    if stress_test:
        for mult, stress_result in run_spread_stress_test(spec, df, costs).items():
            stress_metrics = compute_metrics(stress_result, spec.timeframe)
            repo.save_backtest(version_id, stress_result, stress_metrics, label="spread_stress", spread_multiplier=mult)
            click.echo(f"  spread x{mult}: {stress_metrics.net_profit:.0f} net profit, PF={stress_metrics.profit_factor:.2f}")

    logger.info(
        f"{strategy_id} backtest completed: PF={metrics.profit_factor:.2f} "
        f"DD={metrics.relative_drawdown_pct:.1f}% trades={metrics.num_trades}"
    )


@cli.command()
@click.argument("strategy_id")
@click.option("--data", "data_path", default=None, type=click.Path(exists=True))
@click.option("--synthetic", is_flag=True)
@click.option("--training-months", default=24, show_default=True)
@click.option("--test-months", default=6, show_default=True)
@click.option("--step-months", default=6, show_default=True)
def walkforward(
    strategy_id: str, data_path: str | None, synthetic: bool, training_months: int, test_months: int, step_months: int
) -> None:
    """Walk Forward Analysis (§18)."""

    spec = _load_spec(strategy_id)
    df = _load_data(data_path, synthetic, spec.timeframe)
    costs = CostConfig.for_symbol(spec.symbol)

    report = run_walk_forward(spec, df, costs, training_months, test_months, step_months)
    click.echo(f"windows={len(report.windows)} WFE={report.walk_forward_efficiency:.2f}")
    for w in report.windows:
        click.echo(
            f"  train[{w.train_start.date()}..{w.train_end.date()}) net={w.train_metrics.net_profit:.0f}  "
            f"test[{w.test_start.date()}..{w.test_end.date()}) net={w.test_metrics.net_profit:.0f}"
        )

    repo = _get_repository()
    version_id = repo.save_spec(spec)
    repo.save_walkforward(version_id, report.walk_forward_efficiency, report.as_dict_list())
    logger.info(f"{strategy_id} walk forward: WFE={report.walk_forward_efficiency:.2f} windows={len(report.windows)}")


@cli.command()
@click.argument("strategy_id")
@click.option("--data", "data_path", default=None, type=click.Path(exists=True))
@click.option("--synthetic", is_flag=True)
@click.option("--simulations", default=10_000, show_default=True)
def montecarlo(strategy_id: str, data_path: str | None, synthetic: bool, simulations: int) -> None:
    """Monte Carlo simulation of the trade sequence (§19)."""

    spec = _load_spec(strategy_id)
    df = _load_data(data_path, synthetic, spec.timeframe)
    costs = CostConfig.for_symbol(spec.symbol)

    result = run_backtest(spec, df, costs)
    report = run_monte_carlo(result, simulations=simulations)
    click.echo(
        f"simulations={report.simulations} expected_dd={report.expected_drawdown:.0f} "
        f"dd95={report.drawdown_95:.0f} dd99={report.drawdown_99:.0f} "
        f"ruin_probability={report.ruin_probability * 100:.2f}% "
        f"median_terminal_equity={report.median_terminal_equity:.0f}"
    )

    repo = _get_repository()
    version_id = repo.save_spec(spec)
    repo.save_montecarlo(
        version_id,
        report.simulations,
        report.expected_drawdown,
        report.drawdown_95,
        report.drawdown_99,
        report.ruin_probability,
        report.median_terminal_equity,
    )
    logger.info(f"{strategy_id} monte carlo: ruin_probability={report.ruin_probability * 100:.2f}%")


@cli.command()
@click.argument("strategy_id")
@click.option("--data", "data_path", default=None, type=click.Path(exists=True))
@click.option("--synthetic", is_flag=True)
def evaluate(strategy_id: str, data_path: str | None, synthetic: bool) -> None:
    """Run the full Quant Validation suite and compute the Strategy Score (§21/§22)."""

    spec = _load_spec(strategy_id)
    df = _load_data(data_path, synthetic, spec.timeframe)
    costs = CostConfig.for_symbol(spec.symbol)

    periods = _dynamic_periods(df) if synthetic else SamplePeriods()
    split = split_periods(df, periods)

    full_result = run_backtest(spec, df, costs)
    full_metrics = compute_metrics(full_result, spec.timeframe)
    _print_metrics("full", full_metrics)

    oos_df = split["out_of_sample"]
    oos_metrics = None
    if len(oos_df) >= 3:
        oos_metrics = compute_metrics(run_backtest(spec, oos_df, costs), spec.timeframe)
        _print_metrics("out_of_sample", oos_metrics)
    else:
        click.echo("out_of_sample: insufficient data in this window, skipped")

    wf_report = run_walk_forward(spec, df, costs, training_months=1 if synthetic else 24, test_months=1 if synthetic else 6, step_months=1 if synthetic else 6)
    click.echo(f"walk_forward: windows={len(wf_report.windows)} WFE={wf_report.walk_forward_efficiency:.2f}")

    mc_report = run_monte_carlo(full_result, simulations=10_000)
    click.echo(f"monte_carlo: ruin_probability={mc_report.ruin_probability * 100:.2f}%")

    rob_report = None
    if spec.indicators:
        rob_report = run_robustness_test(spec, df, costs, indicator_index=0)
        click.echo(f"robustness: indicator={rob_report.original_label} plateau={rob_report.is_plateau}")

    score = compute_strategy_score(
        spec, full_metrics, oos_metrics=oos_metrics, walk_forward=wf_report, monte_carlo=mc_report, robustness=rob_report
    )
    click.echo(f"Score: {score.total_score:.1f}  Verdict: {score.verdict}")
    if score.reject_reasons:
        for reason in score.reject_reasons:
            click.echo(f"  REJECT reason: {reason}")

    repo = _get_repository()
    version_id = repo.save_spec(spec)
    repo.save_score(version_id, score.total_score, score.verdict, score.breakdown.as_dict())
    logger.info(f"{strategy_id} evaluate: Score={score.total_score:.1f} Verdict={score.verdict}")

    _print_live_safety_status()


@cli.command()
@click.option("--limit", default=20, show_default=True)
def rank(limit: int) -> None:
    """List strategies ranked by their latest Strategy Score."""

    repo = _get_repository()
    rows = repo.ranking(limit=limit)
    if not rows:
        click.echo("No scored strategies yet -- run `app.py evaluate <strategy_id>` first.")
        return
    for i, row in enumerate(rows, start=1):
        click.echo(f"{i}. {row['strategy_id']:<30} {row['score']:6.1f}  [{row['verdict']}]")


@cli.command()
def dashboard() -> None:
    """Launch the Streamlit dashboard."""

    import subprocess
    import sys

    subprocess.run([sys.executable, "-m", "streamlit", "run", "src/dashboard/app.py"], check=False)


@cli.command()
@click.argument("pine_file", type=click.Path(exists=True))
@click.option("--strategy-id", default=None)
@click.option("--data", "data_path", default=None, type=click.Path(exists=True))
@click.option("--synthetic", is_flag=True)
@click.pass_context
def pipeline(ctx: click.Context, pine_file: str, strategy_id: str | None, data_path: str | None, synthetic: bool) -> None:
    """Import -> Analyze -> Convert -> Compile -> Backtest -> Walk Forward ->
    Monte Carlo -> Score -> Report, in one shot."""

    strategy_id = strategy_id or Path(pine_file).stem
    click.echo(f"=== pipeline: {strategy_id} ===")

    ctx.invoke(import_cmd, pine_file=pine_file, strategy_id=strategy_id)
    ctx.invoke(analyze, strategy_id=strategy_id)
    ctx.invoke(convert, strategy_id=strategy_id)
    ctx.invoke(compile_cmd, strategy_id=strategy_id)
    ctx.invoke(backtest, strategy_id=strategy_id, data_path=data_path, synthetic=synthetic)
    ctx.invoke(walkforward, strategy_id=strategy_id, data_path=data_path, synthetic=synthetic)
    ctx.invoke(montecarlo, strategy_id=strategy_id, data_path=data_path, synthetic=synthetic)
    ctx.invoke(evaluate, strategy_id=strategy_id, data_path=data_path, synthetic=synthetic)

    click.echo(f"=== pipeline complete: {strategy_id} ===")


if __name__ == "__main__":
    cli()
