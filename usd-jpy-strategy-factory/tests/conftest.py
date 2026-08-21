from __future__ import annotations

import pandas as pd
import pytest

from src.backtest.synthetic import make_synthetic_ohlcv

__all__ = ["make_synthetic_ohlcv", "synthetic_ohlcv_h1", "synthetic_ohlcv_15m"]


@pytest.fixture
def synthetic_ohlcv_h1() -> pd.DataFrame:
    return make_synthetic_ohlcv(n_bars=2000, freq="1h", seed=42)


@pytest.fixture
def synthetic_ohlcv_15m() -> pd.DataFrame:
    return make_synthetic_ohlcv(n_bars=3000, freq="15min", seed=7)
