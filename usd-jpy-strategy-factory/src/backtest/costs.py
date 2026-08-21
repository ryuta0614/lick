"""Trading cost model for the reference backtester (§14).

Models spread, slippage, swap, and commission. Values are placeholders
(docs/assumptions.md #12) -- real Rakuten MT4 USDJPY spread/swap figures
should replace these before any conclusions are drawn from backtest output.
"""

from __future__ import annotations

from dataclasses import dataclass


def default_pip_size(symbol: str) -> float:
    """1 pip = 0.01 for JPY-quoted pairs, 0.0001 otherwise."""

    return 0.01 if symbol.upper().endswith("JPY") else 0.0001


@dataclass
class CostConfig:
    symbol: str = "USDJPY"
    pip_size: float = 0.01
    spread_pips: float = 1.5
    slippage_pips: float = 0.3
    commission_per_lot: float = 0.0
    swap_enabled: bool = True
    swap_pips_per_day: float = 0.0
    lot_units: float = 100_000.0
    initial_balance: float = 1_000_000.0  # JPY, matching a Rakuten MT4 account currency

    @classmethod
    def for_symbol(cls, symbol: str, **overrides) -> "CostConfig":
        return cls(symbol=symbol, pip_size=default_pip_size(symbol), **overrides)

    def pip_value_per_lot(self) -> float:
        """Account-currency value of a 1-pip move for a 1.0 lot position."""

        return self.pip_size * self.lot_units

    def scaled(self, spread_multiplier: float) -> "CostConfig":
        """Returns a copy with spread_pips scaled -- for §14 stress testing."""

        return CostConfig(
            symbol=self.symbol,
            pip_size=self.pip_size,
            spread_pips=self.spread_pips * spread_multiplier,
            slippage_pips=self.slippage_pips,
            commission_per_lot=self.commission_per_lot,
            swap_enabled=self.swap_enabled,
            swap_pips_per_day=self.swap_pips_per_day,
            lot_units=self.lot_units,
            initial_balance=self.initial_balance,
        )


DEFAULT_STRESS_MULTIPLIERS: tuple[float, ...] = (1.0, 1.5, 2.0)
