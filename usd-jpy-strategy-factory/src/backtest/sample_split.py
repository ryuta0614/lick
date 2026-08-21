"""In-Sample / Validation / Out-of-Sample period splitting (§17).

Periods are config-driven (config/default.yaml `backtest.in_sample` /
`validation` / `out_of_sample`) rather than hardcoded, per instructions.
Out-of-sample is the most important evaluation window -- callers (e.g.
src/ranking/scorer.py) should weight it accordingly.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

DEFAULT_IN_SAMPLE = ("2017-01-01", "2022-12-31")
DEFAULT_VALIDATION = ("2023-01-01", "2024-12-31")
DEFAULT_OUT_OF_SAMPLE = ("2025-01-01", "2026-12-31")


@dataclass
class SamplePeriods:
    in_sample: tuple[str, str] = DEFAULT_IN_SAMPLE
    validation: tuple[str, str] = DEFAULT_VALIDATION
    out_of_sample: tuple[str, str] = DEFAULT_OUT_OF_SAMPLE


def _slice(df: pd.DataFrame, start: str, end: str) -> pd.DataFrame:
    mask = (df["time"] >= pd.Timestamp(start)) & (df["time"] <= pd.Timestamp(end))
    return df.loc[mask].reset_index(drop=True)


def split_periods(df: pd.DataFrame, periods: SamplePeriods | None = None) -> dict[str, pd.DataFrame]:
    periods = periods or SamplePeriods()
    return {
        "in_sample": _slice(df, *periods.in_sample),
        "validation": _slice(df, *periods.validation),
        "out_of_sample": _slice(df, *periods.out_of_sample),
    }
