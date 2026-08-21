"""Python-side indicator computation for the reference backtester.

Formulas are chosen to match Pine's ``ta.*`` and MT4's ``i*`` built-ins as
closely as pandas allows, so that the Python reference backtester and the
generated MQL4 EA are computing the *same* signal from the *same*
StrategySpec (§34 Pine <-> MQL4 validation intent). In particular RSI uses
Wilder's smoothing (equivalent to an EWM with alpha=1/period), matching both
``ta.rsi`` and ``iRSI``.

Only the indicator types the MQL4 generator also supports
(``src/generators/mql4_generator.py`` / ``mql4/shared/Indicators.mqh``) are
implemented here: EMA, SMA, WMA, RSI.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.strategies.schema import IndicatorSpec


class UnsupportedIndicatorError(ValueError):
    pass


def sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def wma(series: pd.Series, period: int) -> pd.Series:
    weights = np.arange(1, period + 1, dtype=float)
    return series.rolling(window=period).apply(
        lambda x: float(np.dot(x, weights) / weights.sum()), raw=True
    )


def rsi(series: pd.Series, period: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1.0 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    result = 100 - (100 / (1 + rs))
    return result.fillna(100.0).where(avg_loss != 0, 100.0)


_INDICATOR_FUNCS = {"EMA": ema, "SMA": sma, "WMA": wma, "RSI": rsi}

SUPPORTED_INDICATOR_TYPES = frozenset(_INDICATOR_FUNCS)


def compute_indicator(df: pd.DataFrame, spec: IndicatorSpec) -> pd.Series:
    if spec.type not in _INDICATOR_FUNCS:
        raise UnsupportedIndicatorError(
            f"indicator type '{spec.type}' is not supported by the Python reference "
            f"backtester (supported: {sorted(SUPPORTED_INDICATOR_TYPES)})"
        )
    if spec.period is None:
        raise UnsupportedIndicatorError(f"indicator '{spec.type}' requires a period")
    source = df[spec.source] if spec.source in df.columns else df["close"]
    return _INDICATOR_FUNCS[spec.type](source, spec.period)
