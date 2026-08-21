"""Streamlit dashboard (§25). Launch via `python app.py dashboard` or
`streamlit run src/dashboard/app.py`.

Not launchable/verifiable in a browser from this development container
(docs/assumptions.md #3); data-access logic lives in queries.py and is unit
tested separately (tests/test_dashboard_queries.py).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.dashboard.queries import get_equity_curve, get_strategy_detail, get_trades, list_strategies_with_scores
from src.database.repository import DEFAULT_DATABASE_URL, StrategyRepository

st.set_page_config(page_title="USDJPY Strategy Factory", layout="wide")


@st.cache_resource
def _repo() -> StrategyRepository:
    url = os.environ.get("STRATEGY_FACTORY_DATABASE_URL", DEFAULT_DATABASE_URL)
    return StrategyRepository(url)


def render_dashboard_page(repo: StrategyRepository) -> None:
    st.title("USDJPY AI Strategy Factory")
    st.caption("Backtest-only by design -- live trading is never enabled from this dashboard.")

    rows = list_strategies_with_scores(repo)
    if not rows:
        st.info("No scored strategies yet. Run `python app.py evaluate <strategy_id>` first.")
        return

    df = pd.DataFrame(rows)
    st.subheader("Best strategies")
    st.dataframe(df[["strategy_id", "name", "version", "score", "verdict"]], width="stretch")

    fig = px.bar(df.sort_values("score"), x="score", y="strategy_id", orientation="h", color="verdict")
    st.plotly_chart(fig, width="stretch")


def render_strategy_detail_page(repo: StrategyRepository) -> None:
    st.title("Strategy Detail")
    rows = list_strategies_with_scores(repo, limit=1000)
    ids = [r["strategy_id"] for r in rows]
    if not ids:
        st.info("No strategies scored yet.")
        return

    strategy_id = st.selectbox("Strategy", ids)
    detail = get_strategy_detail(repo, strategy_id)
    if detail is None:
        st.warning("No data found.")
        return

    col1, col2, col3 = st.columns(3)
    col1.metric("Danger Level", detail["danger_level"])
    col2.metric("Review Status", detail["review_status"])
    if detail["scores"]:
        col3.metric("Latest Score", f"{detail['scores'][0]['total_score']:.1f}", detail["scores"][0]["verdict"])

    st.subheader("StrategySpec")
    if detail["spec_json"]:
        st.json(json.loads(detail["spec_json"]))

    st.subheader("Backtests")
    if detail["backtests"]:
        bt_df = pd.DataFrame(detail["backtests"])
        st.dataframe(bt_df, width="stretch")

        selected_bt_id = st.selectbox("Equity curve for backtest #", bt_df["id"].tolist())
        equity = get_equity_curve(repo, selected_bt_id)
        if not equity.empty:
            eq_df = equity.reset_index()
            eq_df.columns = ["time", "cumulative_pnl"]
            st.plotly_chart(px.line(eq_df, x="time", y="cumulative_pnl", title="Equity Curve (cumulative P&L)"), width="stretch")
            running_max = equity.cummax()
            drawdown = equity - running_max
            dd_df = drawdown.reset_index()
            dd_df.columns = ["time", "drawdown"]
            st.plotly_chart(px.area(dd_df, x="time", y="drawdown", title="Drawdown"), width="stretch")

        trades_df = get_trades(repo, selected_bt_id)
        if not trades_df.empty:
            st.subheader("Trades")
            st.dataframe(trades_df, width="stretch")
    else:
        st.info("No backtests recorded for this strategy yet.")


def render_comparison_page(repo: StrategyRepository) -> None:
    st.title("Comparison")
    rows = list_strategies_with_scores(repo, limit=1000)
    ids = [r["strategy_id"] for r in rows]
    if len(ids) < 2:
        st.info("Need at least two scored strategies to compare.")
        return

    selected = st.multiselect("Strategies", ids, default=ids[: min(3, len(ids))])
    if not selected:
        return

    records = []
    for sid in selected:
        detail = get_strategy_detail(repo, sid)
        if detail is None or not detail["backtests"]:
            continue
        latest_bt = detail["backtests"][0]
        latest_score = detail["scores"][0]["total_score"] if detail["scores"] else None
        records.append({"strategy_id": sid, "score": latest_score, **latest_bt})

    if records:
        st.dataframe(pd.DataFrame(records), width="stretch")


def main() -> None:
    repo = _repo()
    page = st.sidebar.radio("Page", ["Dashboard", "Strategy Detail", "Comparison"])
    if page == "Dashboard":
        render_dashboard_page(repo)
    elif page == "Strategy Detail":
        render_strategy_detail_page(repo)
    else:
        render_comparison_page(repo)


if __name__ == "__main__":
    main()
