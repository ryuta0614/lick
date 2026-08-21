"""Strategy Score (§21) and Reject conditions (§22).

Deliberately does *not* score raw profit amount -- weights are entirely
about quality (consistency, drawdown, out-of-sample survival, robustness),
per instructions §21/§42 ("利益率だけを最大化しない"). Thresholds/weights
default to the values in config/default.yaml but are overridable so callers
(the CLI, tests) can load the real config file without duplicating numbers.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

from src.backtest.metrics import Metrics
from src.backtest.montecarlo import MonteCarloReport
from src.backtest.robustness import RobustnessReport
from src.backtest.walkforward import WalkForwardReport
from src.pine.anti_repaint import classify_trade_count
from src.strategies.schema import StrategySpec

DEFAULT_WEIGHTS: dict[str, float] = {
    "profit_factor": 15,
    "max_drawdown": 20,
    "sharpe": 10,
    "out_of_sample": 20,
    "walk_forward": 15,
    "parameter_robustness": 10,
    "trade_count": 5,
    "monte_carlo": 5,
}

DEFAULT_REJECT_THRESHOLDS: dict[str, float] = {
    "min_profit_factor": 1.2,
    "max_drawdown_pct": 30.0,
    "min_trades": 100,
    "min_oos_profit": 0.0,
}


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _scale(value: float, low: float, high: float) -> float:
    """Maps value in [low, high] to [0, 1] (increasing); clipped outside."""

    if high == low:
        return 1.0 if value >= high else 0.0
    return _clip01((value - low) / (high - low))


def score_profit_factor(pf: float, weight: float, floor: float = 1.0, cap: float = 2.0) -> float:
    pf = cap if pf == math.inf else pf
    return weight * _scale(pf, floor, cap)


def score_max_drawdown(dd_pct: float, weight: float, reject_dd_pct: float) -> float:
    return weight * (1 - _scale(dd_pct, 0.0, reject_dd_pct))


def score_sharpe(sharpe: float, weight: float, floor: float = 0.0, cap: float = 2.0) -> float:
    return weight * _scale(sharpe, floor, cap)


def score_out_of_sample(
    oos_metrics: Metrics | None, weight: float, min_oos_profit: float, floor_pf: float = 1.0, cap_pf: float = 2.0
) -> float:
    if oos_metrics is None or oos_metrics.num_trades == 0:
        return 0.0
    if oos_metrics.net_profit <= min_oos_profit:
        return 0.0
    pf = cap_pf if oos_metrics.profit_factor == math.inf else oos_metrics.profit_factor
    return weight * _scale(pf, floor_pf, cap_pf)


def score_walk_forward(wf_report: WalkForwardReport | None, weight: float, floor: float = 0.0, cap: float = 1.0) -> float:
    if wf_report is None or not wf_report.windows:
        return 0.0
    return weight * _scale(wf_report.walk_forward_efficiency, floor, cap)


def score_parameter_robustness(rob_report: RobustnessReport | None, weight: float) -> float:
    if rob_report is None or not rob_report.points:
        return 0.0
    mid = rob_report.points[len(rob_report.points) // 2]
    center = next((p for p in rob_report.points if p.delta == 0), mid)
    center_sign = center.metrics.net_profit > 0
    fraction = sum(1 for p in rob_report.points if (p.metrics.net_profit > 0) == center_sign) / len(rob_report.points)
    return weight * fraction


def score_trade_count(num_trades: int, weight: float, min_trades: int) -> float:
    level = classify_trade_count(num_trades, min_trades)
    return {"SAFE": weight, "WARNING": weight * 0.5, "DANGEROUS": 0.0}[level]


def score_monte_carlo(mc_report: MonteCarloReport | None, weight: float, ruin_cap_pct: float = 20.0) -> float:
    if mc_report is None:
        return 0.0
    ruin_pct = mc_report.ruin_probability * 100.0
    return weight * (1 - _scale(ruin_pct, 0.0, ruin_cap_pct))


def evaluate_reject_conditions(
    spec: StrategySpec,
    full_metrics: Metrics,
    oos_metrics: Metrics | None,
    thresholds: dict[str, float] = DEFAULT_REJECT_THRESHOLDS,
) -> list[str]:
    """§22: any of these being true means REJECT regardless of score."""

    reasons: list[str] = []
    pf = full_metrics.profit_factor
    pf_display = pf if pf != math.inf else float("inf")
    if pf_display < thresholds["min_profit_factor"]:
        reasons.append(f"Profit Factor {pf_display:.2f} < {thresholds['min_profit_factor']}")
    if full_metrics.relative_drawdown_pct > thresholds["max_drawdown_pct"]:
        reasons.append(
            f"Max Drawdown {full_metrics.relative_drawdown_pct:.1f}% > {thresholds['max_drawdown_pct']}%"
        )
    if full_metrics.num_trades < thresholds["min_trades"]:
        reasons.append(f"Trades {full_metrics.num_trades} < {int(thresholds['min_trades'])}")
    if oos_metrics is not None and oos_metrics.net_profit <= thresholds["min_oos_profit"]:
        reasons.append(f"OOS Profit {oos_metrics.net_profit:.0f} <= {thresholds['min_oos_profit']}")
    if spec.danger_level in ("DANGEROUS", "REJECT") or not spec.anti_repaint:
        reasons.append(f"Repainting/lookahead risk detected (danger_level={spec.danger_level})")
    return reasons


@dataclass
class ScoreBreakdown:
    profit_factor: float
    max_drawdown: float
    sharpe: float
    out_of_sample: float
    walk_forward: float
    parameter_robustness: float
    trade_count: float
    monte_carlo: float

    @property
    def total(self) -> float:
        return (
            self.profit_factor
            + self.max_drawdown
            + self.sharpe
            + self.out_of_sample
            + self.walk_forward
            + self.parameter_robustness
            + self.trade_count
            + self.monte_carlo
        )

    def as_dict(self) -> dict:
        return {**self.__dict__, "total": self.total}


@dataclass
class ScoreResult:
    breakdown: ScoreBreakdown
    total_score: float
    verdict: Literal["PASS", "REJECT"]
    reject_reasons: list[str] = field(default_factory=list)


def compute_strategy_score(
    spec: StrategySpec,
    full_metrics: Metrics,
    oos_metrics: Metrics | None = None,
    walk_forward: WalkForwardReport | None = None,
    monte_carlo: MonteCarloReport | None = None,
    robustness: RobustnessReport | None = None,
    weights: dict[str, float] = DEFAULT_WEIGHTS,
    thresholds: dict[str, float] = DEFAULT_REJECT_THRESHOLDS,
) -> ScoreResult:
    breakdown = ScoreBreakdown(
        profit_factor=score_profit_factor(full_metrics.profit_factor, weights["profit_factor"]),
        max_drawdown=score_max_drawdown(
            full_metrics.relative_drawdown_pct, weights["max_drawdown"], thresholds["max_drawdown_pct"]
        ),
        sharpe=score_sharpe(full_metrics.sharpe_ratio, weights["sharpe"]),
        out_of_sample=score_out_of_sample(
            oos_metrics, weights["out_of_sample"], min_oos_profit=thresholds["min_oos_profit"]
        ),
        walk_forward=score_walk_forward(walk_forward, weights["walk_forward"]),
        parameter_robustness=score_parameter_robustness(robustness, weights["parameter_robustness"]),
        trade_count=score_trade_count(full_metrics.num_trades, weights["trade_count"], int(thresholds["min_trades"])),
        monte_carlo=score_monte_carlo(monte_carlo, weights["monte_carlo"]),
    )

    reject_reasons = evaluate_reject_conditions(spec, full_metrics, oos_metrics, thresholds)
    verdict: Literal["PASS", "REJECT"] = "REJECT" if reject_reasons else "PASS"
    total_score = 0.0 if verdict == "REJECT" else breakdown.total

    return ScoreResult(breakdown=breakdown, total_score=total_score, verdict=verdict, reject_reasons=reject_reasons)
