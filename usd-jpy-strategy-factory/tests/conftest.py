from __future__ import annotations

import numpy as np
import pandas as pd
import pytest


def make_synthetic_ohlcv(n_bars: int = 2000, freq: str = "1h", seed: int = 42) -> pd.DataFrame:
    """Deterministic synthetic USDJPY-like OHLCV series for tests.

    Combines a slow sine-wave "trend" with small random noise so that both
    EMA crossovers and RSI overbought/oversold crossings occur repeatedly --
    this container has no access to real USDJPY history (docs/assumptions.md
    #2), so unit/integration tests exercise the engine against this fixture
    instead.
    """

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


@pytest.fixture
def synthetic_ohlcv_h1() -> pd.DataFrame:
    return make_synthetic_ohlcv(n_bars=2000, freq="1h", seed=42)


@pytest.fixture
def synthetic_ohlcv_15m() -> pd.DataFrame:
    return make_synthetic_ohlcv(n_bars=3000, freq="15min", seed=7)
