"""SQLite schema (§23). SQLite is the initial backend; ``repository.py``
wraps all access behind a Repository Pattern so the backend can move to
PostgreSQL later without touching callers (ARCHITECTURE.md).
"""

from __future__ import annotations

import datetime as _dt

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> _dt.datetime:
    return _dt.datetime.now(_dt.timezone.utc)


class Base(DeclarativeBase):
    pass


class Strategy(Base):
    __tablename__ = "strategies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    symbol: Mapped[str] = mapped_column(String, default="USDJPY")
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=_utcnow)

    versions: Mapped[list["StrategyVersion"]] = relationship(
        back_populates="strategy", cascade="all, delete-orphan", order_by="StrategyVersion.version"
    )


class StrategyVersion(Base):
    __tablename__ = "strategy_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_pk: Mapped[int] = mapped_column(ForeignKey("strategies.id"))
    version: Mapped[int] = mapped_column(Integer)
    danger_level: Mapped[str] = mapped_column(String)
    review_status: Mapped[str] = mapped_column(String)
    created_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=_utcnow)

    strategy: Mapped["Strategy"] = relationship(back_populates="versions")
    spec: Mapped["StrategySpecRecord"] = relationship(
        back_populates="strategy_version", uselist=False, cascade="all, delete-orphan"
    )
    backtests: Mapped[list["BacktestRecord"]] = relationship(
        back_populates="strategy_version", cascade="all, delete-orphan"
    )
    walkforward_results: Mapped[list["WalkForwardResultRecord"]] = relationship(
        back_populates="strategy_version", cascade="all, delete-orphan"
    )
    montecarlo_results: Mapped[list["MonteCarloResultRecord"]] = relationship(
        back_populates="strategy_version", cascade="all, delete-orphan"
    )
    parameters: Mapped[list["ParameterRecord"]] = relationship(
        back_populates="strategy_version", cascade="all, delete-orphan"
    )
    scores: Mapped[list["ScoreRecord"]] = relationship(
        back_populates="strategy_version", cascade="all, delete-orphan"
    )


class StrategySpecRecord(Base):
    __tablename__ = "strategy_specs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_version_pk: Mapped[int] = mapped_column(ForeignKey("strategy_versions.id"), unique=True)
    spec_json: Mapped[str] = mapped_column(Text)

    strategy_version: Mapped["StrategyVersion"] = relationship(back_populates="spec")


class BacktestRecord(Base):
    __tablename__ = "backtests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_version_pk: Mapped[int] = mapped_column(ForeignKey("strategy_versions.id"))
    run_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=_utcnow)
    label: Mapped[str] = mapped_column(String, default="full")  # e.g. "full","in_sample","out_of_sample"
    spread_multiplier: Mapped[float] = mapped_column(Float, default=1.0)

    net_profit: Mapped[float] = mapped_column(Float)
    gross_profit: Mapped[float] = mapped_column(Float)
    gross_loss: Mapped[float] = mapped_column(Float)
    profit_factor: Mapped[float] = mapped_column(Float)
    win_rate: Mapped[float] = mapped_column(Float)
    average_win: Mapped[float] = mapped_column(Float)
    average_loss: Mapped[float] = mapped_column(Float)
    risk_reward: Mapped[float] = mapped_column(Float)
    expected_payoff: Mapped[float] = mapped_column(Float)
    max_drawdown: Mapped[float] = mapped_column(Float)
    relative_drawdown_pct: Mapped[float] = mapped_column(Float)
    sharpe_ratio: Mapped[float] = mapped_column(Float)
    sortino_ratio: Mapped[float] = mapped_column(Float)
    calmar_ratio: Mapped[float] = mapped_column(Float)
    recovery_factor: Mapped[float] = mapped_column(Float)
    num_trades: Mapped[int] = mapped_column(Integer)
    long_trades: Mapped[int] = mapped_column(Integer)
    short_trades: Mapped[int] = mapped_column(Integer)
    average_holding_time_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    max_consecutive_losses: Mapped[int] = mapped_column(Integer)

    strategy_version: Mapped["StrategyVersion"] = relationship(back_populates="backtests")
    trades: Mapped[list["TradeRecord"]] = relationship(back_populates="backtest", cascade="all, delete-orphan")


class TradeRecord(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    backtest_pk: Mapped[int] = mapped_column(ForeignKey("backtests.id"))
    direction: Mapped[str] = mapped_column(String)
    entry_time: Mapped[_dt.datetime] = mapped_column(DateTime)
    entry_price: Mapped[float] = mapped_column(Float)
    exit_time: Mapped[_dt.datetime] = mapped_column(DateTime)
    exit_price: Mapped[float] = mapped_column(Float)
    exit_reason: Mapped[str] = mapped_column(String)
    lots: Mapped[float] = mapped_column(Float)
    pnl_pips: Mapped[float] = mapped_column(Float)
    pnl_account: Mapped[float] = mapped_column(Float)

    backtest: Mapped["BacktestRecord"] = relationship(back_populates="trades")


class WalkForwardResultRecord(Base):
    __tablename__ = "walkforward_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_version_pk: Mapped[int] = mapped_column(ForeignKey("strategy_versions.id"))
    run_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=_utcnow)
    walk_forward_efficiency: Mapped[float] = mapped_column(Float)
    num_windows: Mapped[int] = mapped_column(Integer)
    windows_json: Mapped[str] = mapped_column(Text)  # list of per-window {train,test,is_pf,oos_pf,...}

    strategy_version: Mapped["StrategyVersion"] = relationship(back_populates="walkforward_results")


class MonteCarloResultRecord(Base):
    __tablename__ = "montecarlo_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_version_pk: Mapped[int] = mapped_column(ForeignKey("strategy_versions.id"))
    run_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=_utcnow)
    simulations: Mapped[int] = mapped_column(Integer)
    expected_drawdown: Mapped[float] = mapped_column(Float)
    drawdown_95: Mapped[float] = mapped_column(Float)
    drawdown_99: Mapped[float] = mapped_column(Float)
    ruin_probability: Mapped[float] = mapped_column(Float)
    median_terminal_equity: Mapped[float] = mapped_column(Float)

    strategy_version: Mapped["StrategyVersion"] = relationship(back_populates="montecarlo_results")


class ParameterRecord(Base):
    __tablename__ = "parameters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_version_pk: Mapped[int] = mapped_column(ForeignKey("strategy_versions.id"))
    name: Mapped[str] = mapped_column(String)
    value: Mapped[str] = mapped_column(String)

    strategy_version: Mapped["StrategyVersion"] = relationship(back_populates="parameters")


class ScoreRecord(Base):
    __tablename__ = "scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    strategy_version_pk: Mapped[int] = mapped_column(ForeignKey("strategy_versions.id"))
    run_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=_utcnow)
    total_score: Mapped[float] = mapped_column(Float)
    verdict: Mapped[str] = mapped_column(String)  # "PASS" | "REJECT"
    breakdown_json: Mapped[str] = mapped_column(Text)

    strategy_version: Mapped["StrategyVersion"] = relationship(back_populates="scores")


class ErrorRecord(Base):
    __tablename__ = "errors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    occurred_at: Mapped[_dt.datetime] = mapped_column(DateTime, default=_utcnow)
    strategy_id: Mapped[str | None] = mapped_column(String, nullable=True)
    stage: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(Text)
