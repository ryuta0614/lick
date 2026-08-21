"""StrategySpec: the single normative representation of a trading strategy.

Pine Script and MQL4 are never translated directly into one another. Both the
Python reference backtester (``src/backtest``) and the MQL4 generator
(``src/generators/mql4_generator.py``) consume *only* this schema. See
``ARCHITECTURE.md`` for the rationale.
"""

from __future__ import annotations

import datetime as _dt
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

# Supported timeframes. Pine's ``timeframe.period`` strings are normalized to
# this set by src/pine/analyzer.py.
Timeframe = Literal["1m", "5m", "15m", "30m", "1h", "4h", "1d"]

DangerLevel = Literal["SAFE", "WARNING", "DANGEROUS", "REJECT"]
ReviewStatus = Literal["OK", "NEEDS_REVIEW"]
ExecutionModel = Literal["next_bar_market", "same_bar_close", "stop", "limit"]
PositionSizing = Literal["fixed_lot"]


class IndicatorSpec(BaseModel):
    """A single technical indicator used by the strategy."""

    type: str = Field(..., description="Indicator kind, e.g. EMA, RSI, MACD, ATR, BB")
    period: int | None = Field(default=None, ge=1)
    source: str = Field(default="close", description="close/open/high/low/hl2/hlc3/ohlc4")
    params: dict[str, Any] = Field(
        default_factory=dict,
        description="Extra indicator-specific parameters (e.g. MACD fast/slow/signal, BB stddev)",
    )


class EntryRule(BaseModel):
    """Long or short entry condition.

    ``condition`` is a short human-readable description (e.g. "EMA20 crosses
    above EMA50"), always present. When the source condition is a simple
    crossover/crossunder between two resolvable terms, ``indicator_a`` /
    ``operator`` / ``indicator_b`` are also populated with a structured,
    machine-checkable form of the same condition: each of ``indicator_a`` /
    ``indicator_b`` is either an indicator label matching an entry in
    ``StrategySpec.indicators`` (e.g. "EMA20") or a numeric literal string
    (e.g. "30"). Both ``src/backtest/runner.py`` and
    ``src/generators/mql4_generator.py`` consume the structured fields when
    present so that the Python reference implementation and the generated
    MQL4 EA implement the *identical* trigger, rather than each re-parsing
    ``condition`` independently. When the structured fields are absent
    (hand-authored spec, or a condition too complex to structure), callers
    fall back to treating the strategy as NEEDS_REVIEW for EA generation.
    """

    condition: str
    execution: ExecutionModel = "next_bar_market"
    indicator_a: str | None = None
    operator: Literal["crosses_above", "crosses_below"] | None = None
    indicator_b: str | None = None


class ExitRule(BaseModel):
    stop_loss_pips: float | None = Field(default=None, ge=0)
    take_profit_pips: float | None = Field(default=None, ge=0)
    trailing_stop_pips: float | None = Field(default=None, ge=0)


class PositionManagement(BaseModel):
    max_positions: int = Field(default=1, ge=1)
    pyramiding: bool = False
    reverse_on_opposite_signal: bool = Field(
        default=True,
        description="Close current position and open the opposite one on an opposite signal.",
    )


class RiskSpec(BaseModel):
    position_sizing: PositionSizing = "fixed_lot"
    fixed_lot: float = Field(default=0.01, gt=0)


class PineSourceMeta(BaseModel):
    """Provenance metadata linking a StrategySpec back to its Pine source."""

    source_file: str
    pine_version: int | None = None
    script_kind: Literal["strategy", "indicator"] = "strategy"
    imported_at: _dt.datetime = Field(default_factory=lambda: _dt.datetime.now(_dt.timezone.utc))


class StrategySpec(BaseModel):
    """The single normative specification for a trading strategy."""

    strategy_id: str = Field(..., pattern=r"^[a-z0-9_]+$")
    name: str
    symbol: str = "USDJPY"
    timeframe: Timeframe

    indicators: list[IndicatorSpec] = Field(default_factory=list)

    long_entry: EntryRule | None = None
    short_entry: EntryRule | None = None

    exit: ExitRule = Field(default_factory=ExitRule)
    position_management: PositionManagement = Field(default_factory=PositionManagement)
    risk: RiskSpec = Field(default_factory=RiskSpec)

    anti_repaint: bool = Field(
        default=True, description="True if the strategy passed anti-repaint checks (see below)."
    )
    danger_level: DangerLevel = "SAFE"
    review_status: ReviewStatus = "OK"

    source: PineSourceMeta | None = None
    version: int = 1

    @model_validator(mode="after")
    def _require_at_least_one_entry(self) -> "StrategySpec":
        if self.long_entry is None and self.short_entry is None:
            raise ValueError("StrategySpec must define at least one of long_entry/short_entry")
        return self

    def to_json_file(self, path: str) -> None:
        import json
        from pathlib import Path

        Path(path).write_text(
            json.dumps(self.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    @classmethod
    def from_json_file(cls, path: str) -> "StrategySpec":
        import json
        from pathlib import Path

        return cls.model_validate(json.loads(Path(path).read_text(encoding="utf-8")))
