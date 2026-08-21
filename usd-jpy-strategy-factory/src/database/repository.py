"""Repository Pattern wrapping the SQLite database (§23).

All callers (CLI commands, dashboard, scorer) go through
``StrategyRepository`` rather than importing SQLAlchemy models directly, so
the backend can move to PostgreSQL later by changing only this file's
engine construction (ARCHITECTURE.md).
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from src.backtest.metrics import Metrics
from src.backtest.runner import BacktestResult
from src.database.models import (
    Base,
    BacktestRecord,
    ErrorRecord,
    MonteCarloResultRecord,
    ParameterRecord,
    ScoreRecord,
    Strategy,
    StrategySpecRecord,
    StrategyVersion,
    TradeRecord,
    WalkForwardResultRecord,
)
from src.strategies.schema import StrategySpec

DEFAULT_DATABASE_URL = "sqlite:///data/strategy_factory.db"


class StrategyRepository:
    def __init__(self, database_url: str = DEFAULT_DATABASE_URL):
        if database_url.startswith("sqlite:///") and database_url not in ("sqlite:///:memory:",):
            db_path = database_url.removeprefix("sqlite:///")
            if db_path and db_path != ":memory:":
                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._engine = create_engine(database_url)
        Base.metadata.create_all(self._engine)
        self._Session = sessionmaker(bind=self._engine)

    @contextmanager
    def session(self):
        session = self._Session()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def save_spec(self, spec: StrategySpec) -> int:
        """Upserts the Strategy row and appends a new StrategyVersion + spec
        JSON snapshot. Returns the new StrategyVersion primary key."""

        with self.session() as session:
            strategy = session.scalar(
                select(Strategy).where(Strategy.strategy_id == spec.strategy_id)
            )
            if strategy is None:
                strategy = Strategy(strategy_id=spec.strategy_id, name=spec.name, symbol=spec.symbol)
                session.add(strategy)
                session.flush()

            version = StrategyVersion(
                strategy_pk=strategy.id,
                version=spec.version,
                danger_level=spec.danger_level,
                review_status=spec.review_status,
            )
            session.add(version)
            session.flush()

            session.add(
                StrategySpecRecord(
                    strategy_version_pk=version.id,
                    spec_json=json.dumps(spec.model_dump(mode="json"), ensure_ascii=False),
                )
            )
            session.flush()
            return version.id

    def latest_version_id(self, strategy_id: str) -> int | None:
        with self.session() as session:
            strategy = session.scalar(select(Strategy).where(Strategy.strategy_id == strategy_id))
            if strategy is None or not strategy.versions:
                return None
            return strategy.versions[-1].id

    def get_spec(self, strategy_version_pk: int) -> StrategySpec:
        with self.session() as session:
            record = session.scalar(
                select(StrategySpecRecord).where(StrategySpecRecord.strategy_version_pk == strategy_version_pk)
            )
            if record is None:
                raise LookupError(f"no StrategySpec stored for strategy_version_pk={strategy_version_pk}")
            return StrategySpec.model_validate(json.loads(record.spec_json))

    def save_backtest(
        self,
        strategy_version_pk: int,
        result: BacktestResult,
        metrics: Metrics,
        label: str = "full",
        spread_multiplier: float = 1.0,
    ) -> int:
        with self.session() as session:
            record = BacktestRecord(
                strategy_version_pk=strategy_version_pk,
                label=label,
                spread_multiplier=spread_multiplier,
                net_profit=metrics.net_profit,
                gross_profit=metrics.gross_profit,
                gross_loss=metrics.gross_loss,
                profit_factor=0.0 if metrics.profit_factor == float("inf") else metrics.profit_factor,
                win_rate=metrics.win_rate,
                average_win=metrics.average_win,
                average_loss=metrics.average_loss,
                risk_reward=0.0 if metrics.risk_reward == float("inf") else metrics.risk_reward,
                expected_payoff=metrics.expected_payoff,
                max_drawdown=metrics.max_drawdown,
                relative_drawdown_pct=metrics.relative_drawdown_pct,
                sharpe_ratio=metrics.sharpe_ratio,
                sortino_ratio=metrics.sortino_ratio,
                calmar_ratio=metrics.calmar_ratio,
                recovery_factor=metrics.recovery_factor,
                num_trades=metrics.num_trades,
                long_trades=metrics.long_trades,
                short_trades=metrics.short_trades,
                average_holding_time_seconds=metrics.average_holding_time.total_seconds(),
                max_consecutive_losses=metrics.max_consecutive_losses,
            )
            session.add(record)
            session.flush()

            for trade in result.trades:
                session.add(
                    TradeRecord(
                        backtest_pk=record.id,
                        direction=trade.direction,
                        entry_time=trade.entry_time,
                        entry_price=trade.entry_price,
                        exit_time=trade.exit_time,
                        exit_price=trade.exit_price,
                        exit_reason=trade.exit_reason,
                        lots=trade.lots,
                        pnl_pips=trade.pnl_pips,
                        pnl_account=trade.pnl_account,
                    )
                )
            session.flush()
            return record.id

    def save_walkforward(
        self, strategy_version_pk: int, walk_forward_efficiency: float, windows: list[dict]
    ) -> int:
        with self.session() as session:
            record = WalkForwardResultRecord(
                strategy_version_pk=strategy_version_pk,
                walk_forward_efficiency=walk_forward_efficiency,
                num_windows=len(windows),
                windows_json=json.dumps(windows, ensure_ascii=False, default=str),
            )
            session.add(record)
            session.flush()
            return record.id

    def save_montecarlo(
        self,
        strategy_version_pk: int,
        simulations: int,
        expected_drawdown: float,
        drawdown_95: float,
        drawdown_99: float,
        ruin_probability: float,
        median_terminal_equity: float,
    ) -> int:
        with self.session() as session:
            record = MonteCarloResultRecord(
                strategy_version_pk=strategy_version_pk,
                simulations=simulations,
                expected_drawdown=expected_drawdown,
                drawdown_95=drawdown_95,
                drawdown_99=drawdown_99,
                ruin_probability=ruin_probability,
                median_terminal_equity=median_terminal_equity,
            )
            session.add(record)
            session.flush()
            return record.id

    def save_score(self, strategy_version_pk: int, total_score: float, verdict: str, breakdown: dict) -> int:
        with self.session() as session:
            record = ScoreRecord(
                strategy_version_pk=strategy_version_pk,
                total_score=total_score,
                verdict=verdict,
                breakdown_json=json.dumps(breakdown, ensure_ascii=False),
            )
            session.add(record)
            session.flush()
            return record.id

    def log_error(self, stage: str, message: str, strategy_id: str | None = None) -> None:
        with self.session() as session:
            session.add(ErrorRecord(stage=stage, message=message, strategy_id=strategy_id))

    def ranking(self, limit: int = 20) -> list[dict]:
        """Latest score per strategy, ordered best-first, for `app.py rank`."""

        with self.session() as session:
            strategies = session.scalars(select(Strategy)).all()
            rows: list[dict] = []
            for strategy in strategies:
                if not strategy.versions:
                    continue
                latest_version = strategy.versions[-1]
                if not latest_version.scores:
                    continue
                latest_score = max(latest_version.scores, key=lambda s: s.run_at)
                rows.append(
                    {
                        "strategy_id": strategy.strategy_id,
                        "name": strategy.name,
                        "version": latest_version.version,
                        "score": latest_score.total_score,
                        "verdict": latest_score.verdict,
                    }
                )
            rows.sort(key=lambda r: r["score"], reverse=True)
            return rows[:limit]
