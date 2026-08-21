import pandas as pd

from src.backtest.sample_split import SamplePeriods, split_periods


def test_split_periods_partitions_by_date(synthetic_ohlcv_h1):
    periods = SamplePeriods(
        in_sample=("2020-01-01", "2020-01-31"),
        validation=("2020-02-01", "2020-02-15"),
        out_of_sample=("2020-02-16", "2020-03-31"),
    )
    result = split_periods(synthetic_ohlcv_h1, periods)
    assert set(result) == {"in_sample", "validation", "out_of_sample"}
    for name, df in result.items():
        assert (df["time"] >= pd.Timestamp(getattr(periods, name)[0])).all()
        assert (df["time"] <= pd.Timestamp(getattr(periods, name)[1])).all()
    assert len(result["in_sample"]) > 0
    assert len(result["out_of_sample"]) > 0


def test_split_periods_empty_when_out_of_range(synthetic_ohlcv_h1):
    periods = SamplePeriods(
        in_sample=("1990-01-01", "1990-12-31"),
        validation=("2020-01-01", "2020-01-05"),
        out_of_sample=("2020-01-06", "2020-01-10"),
    )
    result = split_periods(synthetic_ohlcv_h1, periods)
    assert len(result["in_sample"]) == 0
