"""Pure data-access helpers for the Streamlit dashboard.

Kept separate from ``app.py`` (the actual Streamlit UI) so they can be unit
tested without a Streamlit runtime -- everything here returns plain
dicts/lists/pandas objects assembled *inside* the DB session, since
SQLAlchemy ORM objects become unusable once their session closes.
"""

from __future__ import annotations

import json

import pandas as pd
from sqlalchemy import select

from src.database.models import Strategy, TradeRecord
from src.database.repository import StrategyRepository


def list_strategies_with_scores(repo: StrategyRepository, limit: int = 100) -> list[dict]:
    return repo.ranking(limit=limit)


def get_strategy_detail(repo: StrategyRepository, strategy_id: str) -> dict | None:
    with repo.session() as session:
        strategy = session.scalar(select(Strategy).where(Strategy.strategy_id == strategy_id))
        if strategy is None or not strategy.versions:
            return None
        version = strategy.versions[-1]

        backtests = [
            {
                "id": b.id,
                "label": b.label,
                "spread_multiplier": b.spread_multiplier,
                "run_at": b.run_at,
                "net_profit": b.net_profit,
                "profit_factor": b.profit_factor,
                "win_rate": b.win_rate,
                "relative_drawdown_pct": b.relative_drawdown_pct,
                "sharpe_ratio": b.sharpe_ratio,
                "num_trades": b.num_trades,
            }
            for b in sorted(version.backtests, key=lambda b: b.run_at, reverse=True)
        ]

        scores = [
            {"id": s.id, "run_at": s.run_at, "total_score": s.total_score, "verdict": s.verdict, "breakdown": json.loads(s.breakdown_json)}
            for s in sorted(version.scores, key=lambda s: s.run_at, reverse=True)
        ]

        return {
            "strategy_id": strategy.strategy_id,
            "name": strategy.name,
            "symbol": strategy.symbol,
            "version": version.version,
            "danger_level": version.danger_level,
            "review_status": version.review_status,
            "spec_json": version.spec.spec_json if version.spec else None,
            "backtests": backtests,
            "scores": scores,
        }


def get_equity_curve(repo: StrategyRepository, backtest_id: int) -> pd.Series:
    """Reconstructs a cumulative-P&L equity curve from stored trades.

    This is relative equity (starting at 0), not the absolute account
    balance -- BacktestRecord does not persist ``initial_balance`` -- which
    is sufficient for visualizing growth/drawdown shape.
    """

    with repo.session() as session:
        trades = (
            session.query(TradeRecord)
            .filter_by(backtest_pk=backtest_id)
            .order_by(TradeRecord.exit_time)
            .all()
        )
        cum = 0.0
        index = []
        values = []
        for t in trades:
            cum += t.pnl_account
            index.append(t.exit_time)
            values.append(cum)
    if not index:
        return pd.Series(dtype=float)
    return pd.Series(values, index=pd.to_datetime(index))


def get_trades(repo: StrategyRepository, backtest_id: int) -> pd.DataFrame:
    with repo.session() as session:
        trades = (
            session.query(TradeRecord)
            .filter_by(backtest_pk=backtest_id)
            .order_by(TradeRecord.entry_time)
            .all()
        )
        rows = [
            {
                "direction": t.direction,
                "entry_time": t.entry_time,
                "entry_price": t.entry_price,
                "exit_time": t.exit_time,
                "exit_price": t.exit_price,
                "exit_reason": t.exit_reason,
                "lots": t.lots,
                "pnl_pips": t.pnl_pips,
                "pnl_account": t.pnl_account,
            }
            for t in trades
        ]
    return pd.DataFrame(rows)
