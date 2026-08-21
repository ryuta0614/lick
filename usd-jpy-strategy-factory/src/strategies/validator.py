"""Structural validation for StrategySpec.

This is *not* the performance-based reject logic of scoring (Profit Factor,
Max DD, trade count, etc. -- see ``src/ranking/scorer.py`` for that, per
instructions §22). This module only checks internal consistency of the spec
itself and enforces the Phase 1 scope guard (USDJPY only) and the
anti-repaint / review gates that block EA generation.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from src.strategies.schema import StrategySpec

SUPPORTED_SYMBOLS = {"USDJPY"}


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not self.errors

    @property
    def blocks_ea_generation(self) -> bool:
        """True if this spec must not proceed to MQL4 generation / live paths."""
        return not self.is_valid


def validate_spec(spec: StrategySpec) -> ValidationResult:
    result = ValidationResult()

    if spec.symbol not in SUPPORTED_SYMBOLS:
        result.errors.append(
            f"symbol '{spec.symbol}' is out of scope for Phase 1 "
            f"(supported: {sorted(SUPPORTED_SYMBOLS)})"
        )

    if spec.danger_level == "REJECT":
        result.errors.append("danger_level is REJECT: excluded from EA generation (§6)")
    elif spec.danger_level == "DANGEROUS":
        result.warnings.append("danger_level is DANGEROUS: review before proceeding")
    elif spec.danger_level == "WARNING":
        result.warnings.append("danger_level is WARNING: review recommended")

    if spec.review_status == "NEEDS_REVIEW":
        result.errors.append(
            "review_status is NEEDS_REVIEW: entry/exit conditions were ambiguous in the "
            "source and were not auto-completed (§7). Human review required before EA "
            "generation."
        )

    if not spec.anti_repaint:
        result.errors.append("anti_repaint is False: repainting/lookahead risk detected (§6)")

    if spec.long_entry is None and spec.short_entry is None:
        # Also enforced by the pydantic model validator; kept here defensively
        # so ValidationResult stays the single source of truth for callers.
        result.errors.append("at least one of long_entry/short_entry must be defined")

    if spec.exit.stop_loss_pips is None and spec.exit.take_profit_pips is None:
        result.warnings.append(
            "no stop_loss_pips or take_profit_pips defined: unbounded risk per trade"
        )

    if spec.position_management.pyramiding and spec.position_management.max_positions <= 1:
        result.errors.append(
            "position_management.pyramiding=True is inconsistent with max_positions<=1"
        )

    if spec.risk.position_sizing == "fixed_lot" and spec.risk.fixed_lot <= 0:
        result.errors.append("risk.fixed_lot must be > 0 for fixed_lot sizing")

    if len(spec.indicators) > 6:
        result.warnings.append(
            f"{len(spec.indicators)} indicators declared: possible overfitting risk (§6)"
        )

    return result
