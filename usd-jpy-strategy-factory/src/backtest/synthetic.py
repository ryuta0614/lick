"""Synthetic OHLCV generator.

This container cannot reach real USDJPY historical data
(docs/assumptions.md #2). This generator provides a deterministic
placeholder series so the full pipeline (`app.py pipeline --synthetic`) can
be exercised end-to-end without real data -- results produced against it
must never be treated as a real backtest. Point any CLI command at a real
CSV via ``--data`` once you have one.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def make_synthetic_ohlcv(n_bars: int = 2000, freq: str = "1h", seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    t = np.arange(n_bars)
    trend = 5.0 * np.sin(t / 60.0) + 0.01 * t
    noise = rng.normal(0, 0.15, size=n_bars).cumsum() * 0.05
    close = 110.0 + trend + noise

    open_ = np.empty(n_bars)
    open_[0] = close[0]
    open_[1:] = close[:-1]

    intrabar_range = np.abs(rng.normal(0.05, 0.02, size=n_bars)) + 0.01
    high = np.maximum(open_, close) + intrabar_range
    low = np.minimum(open_, close) - intrabar_range

    times = pd.date_range("2020-01-06", periods=n_bars, freq=freq)  # a Monday
    return pd.DataFrame(
        {
            "time": times,
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": rng.integers(50, 500, size=n_bars),
        }
    )
