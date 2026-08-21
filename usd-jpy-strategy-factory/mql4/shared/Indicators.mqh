//+------------------------------------------------------------------+
//| Indicators.mqh -- thin wrappers over MT4 built-in indicators     |
//| Part of the USDJPY AI Strategy Factory (mql4/shared).            |
//|                                                                    |
//| Only the indicator types used by generated EAs so far (EMA, SMA, |
//| WMA, RSI) are wired to real MT4 functions. Others used by         |
//| src/generators/mql4_generator.py's StrategySpec.indicators list  |
//| that are not yet implemented here (SuperTrend, Donchian, VWAP)   |
//| must not be silently approximated -- the generator refuses to    |
//| emit code for indicator types this file does not support         |
//| (see mql4_generator.py SUPPORTED_INDICATOR_TYPES).                |
//+------------------------------------------------------------------+
#property strict

#ifndef __USDJPY_SF_INDICATORS_MQH__
#define __USDJPY_SF_INDICATORS_MQH__

double Ind_MA(string symbol, int tf, int period, int maMethod, int shift)
{
   return iMA(symbol, tf, period, 0, maMethod, PRICE_CLOSE, shift);
}

double Ind_EMA(string symbol, int tf, int period, int shift)
{
   return Ind_MA(symbol, tf, period, MODE_EMA, shift);
}

double Ind_SMA(string symbol, int tf, int period, int shift)
{
   return Ind_MA(symbol, tf, period, MODE_SMA, shift);
}

double Ind_WMA(string symbol, int tf, int period, int shift)
{
   return Ind_MA(symbol, tf, period, MODE_LWMA, shift);
}

double Ind_RSI(string symbol, int tf, int period, int shift)
{
   return iRSI(symbol, tf, period, PRICE_CLOSE, shift);
}

double Ind_ATR(string symbol, int tf, int period, int shift)
{
   return iATR(symbol, tf, period, shift);
}

// direction: MODE_MAIN, MODE_PLUSDI, MODE_MINUSDI
double Ind_ADX(string symbol, int tf, int period, int direction, int shift)
{
   return iADX(symbol, tf, period, PRICE_CLOSE, direction, shift);
}

// mode: MODE_MAIN or MODE_SIGNAL
double Ind_MACD(string symbol, int tf, int fastPeriod, int slowPeriod, int signalPeriod, int mode, int shift)
{
   return iMACD(symbol, tf, fastPeriod, slowPeriod, signalPeriod, PRICE_CLOSE, mode, shift);
}

// mode: MODE_UPPER, MODE_LOWER, MODE_MAIN (middle band)
double Ind_Bands(string symbol, int tf, int period, double deviation, int mode, int shift)
{
   return iBands(symbol, tf, period, deviation, 0, PRICE_CLOSE, mode, shift);
}

double Ind_Stochastic(string symbol, int tf, int kPeriod, int dPeriod, int slowing, int mode, int shift)
{
   return iStochastic(symbol, tf, kPeriod, dPeriod, slowing, MODE_SMA, 0, mode, shift);
}

// Generic crossover helper shared by every generated EA's signal logic.
// Works for indicator-vs-indicator and indicator-vs-constant-threshold
// crossings alike (pass the same constant for cur/prev when comparing
// against a fixed threshold level).
bool Ind_CrossesAbove(double curA, double prevA, double curB, double prevB)
{
   return (prevA <= prevB && curA > curB);
}

bool Ind_CrossesBelow(double curA, double prevA, double curB, double prevB)
{
   return (prevA >= prevB && curA < curB);
}

#endif // __USDJPY_SF_INDICATORS_MQH__
