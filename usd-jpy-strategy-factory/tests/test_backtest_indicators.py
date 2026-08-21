import numpy as np
import pandas as pd

from src.backtest.indicators import ema, rsi, sma, wma


def test_sma_matches_pandas_rolling_mean():
    s = pd.Series(np.arange(1, 21, dtype=float))
    result = sma(s, 5)
    assert np.isnan(result.iloc[3])
    assert result.iloc[4] == s.iloc[0:5].mean()


def test_ema_converges_towards_constant_input():
    s = pd.Series([100.0] * 50)
    result = ema(s, 10)
    assert abs(result.iloc[-1] - 100.0) < 1e-6


def test_wma_weights_recent_values_more():
    s = pd.Series([1.0, 1.0, 1.0, 1.0, 100.0])
    result = wma(s, 5)
    # heavily weighted toward the most recent (large) value
    assert result.iloc[-1] > s[:-1].mean()


def test_rsi_is_bounded_0_100():
    rng = np.random.default_rng(0)
    s = pd.Series(100 + rng.normal(0, 1, 200).cumsum())
    result = rsi(s, 14).dropna()
    assert (result >= 0).all() and (result <= 100).all()


def test_rsi_pure_uptrend_is_high():
    s = pd.Series(np.arange(1, 50, dtype=float))
    result = rsi(s, 14)
    assert result.iloc[-1] > 90
