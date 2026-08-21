//+------------------------------------------------------------------+
//| RiskEngine.mqh -- common safety layer for every generated EA     |
//| Part of the USDJPY AI Strategy Factory (mql4/shared).            |
//|                                                                    |
//| This file is the MQL4-side half of the Live Safety gate described |
//| in ARCHITECTURE.md. No generated EA may call OrderSend() without  |
//| first passing RiskEngine_AllowNewOrder(). LIVE order placement    |
//| requires BOTH RunMode == RUN_MODE_LIVE AND EnableLiveTrading==true|
//| -- changing only one of the two never enables live trading.       |
//+------------------------------------------------------------------+
#property strict

#ifndef __USDJPY_SF_RISKENGINE_MQH__
#define __USDJPY_SF_RISKENGINE_MQH__

#include "Logger.mqh"

enum ENUM_RUN_MODE
{
   RUN_MODE_BACKTEST = 0, // Strategy Tester only
   RUN_MODE_DEMO     = 1, // Demo account forward test
   RUN_MODE_LIVE     = 2  // Real money -- also requires EnableLiveTrading=true
};

input ENUM_RUN_MODE RunMode          = RUN_MODE_BACKTEST; // RunMode (see docs/rakuten_mt4.md)
input bool          EnableLiveTrading = false;             // Must be true AND RunMode=LIVE for live orders
input bool          StopTrading       = false;             // Kill switch: true = block all new orders
input bool          EmergencyStop     = false;              // Secondary kill switch (manual, config-driven)

input double MaxSpreadPips    = 3.0;  // RiskEngine: max allowed spread in pips
input int    MaxPositions     = 1;    // RiskEngine: max concurrent positions for this EA/magic
input double MaxLots          = 0.10; // RiskEngine: hard cap on a single order's lot size
input double MaxDailyLossPct  = 2.0;  // RiskEngine: block new orders once today's realized loss exceeds this % of balance
input double MaxDrawdownPct   = 10.0; // RiskEngine: block new orders once (Balance-Equity)/Balance exceeds this %
input int    MaxTradesPerDay  = 10;   // RiskEngine: max new trades per calendar day for this EA/magic
input int    TradingStartHour = 0;    // RiskEngine: trading window start (broker server time, 0-23)
input int    TradingEndHour   = 23;   // RiskEngine: trading window end (broker server time, 0-23)
input bool   FridayClose      = true; // RiskEngine: stop opening new positions late on Friday
input int    FridayCloseHour  = 22;   // RiskEngine: hour (server time) after which new Friday entries are blocked

double RiskEngine_PipSize()
{
   return (Digits == 3 || Digits == 5) ? Point * 10.0 : Point;
}

// The single Live Safety gate. See ARCHITECTURE.md "Live Safety".
bool RiskEngine_CanPlaceOrder()
{
   if (EmergencyStop)
   {
      LogWarn("RiskEngine: EmergencyStop is active, new orders blocked");
      return false;
   }
   if (StopTrading)
   {
      LogWarn("RiskEngine: kill switch STOP_TRADING is active, new orders blocked");
      return false;
   }

   if (RunMode == RUN_MODE_BACKTEST)
   {
      if (!IsTesting())
      {
         LogWarn("RiskEngine: RunMode=BACKTEST outside of Strategy Tester, new orders blocked");
         return false;
      }
      return true;
   }

   if (RunMode == RUN_MODE_DEMO)
   {
      if (IsTesting())
         return true;
      if (!IsDemo())
      {
         LogError("RiskEngine: RunMode=DEMO but the connected account is not a demo account, new orders blocked");
         return false;
      }
      return true;
   }

   if (RunMode == RUN_MODE_LIVE)
   {
      if (!EnableLiveTrading)
      {
         LogWarn("RiskEngine: RunMode=LIVE but EnableLiveTrading=false, new orders blocked (both must be set)");
         return false;
      }
      if (IsDemo())
      {
         LogError("RiskEngine: RunMode=LIVE but the connected account is a demo account, refusing to trade (config mismatch)");
         return false;
      }
      return true;
   }

   LogError("RiskEngine: unrecognized RunMode, new orders blocked");
   return false;
}

bool RiskEngine_CheckSymbol(string requiredSymbol)
{
   if (Symbol() != requiredSymbol)
   {
      LogError("RiskEngine: symbol mismatch, EA is restricted to " + requiredSymbol + " but chart is " + Symbol());
      return false;
   }
   return true;
}

bool RiskEngine_CheckSpread()
{
   double spreadPips = MarketInfo(Symbol(), MODE_SPREAD) * Point / RiskEngine_PipSize();
   if (spreadPips > MaxSpreadPips)
   {
      LogWarn("RiskEngine: spread " + DoubleToString(spreadPips, 1) + " pips exceeds MaxSpreadPips " + DoubleToString(MaxSpreadPips, 1));
      return false;
   }
   return true;
}

int RiskEngine_CountOpenPositions(int magicNumber)
{
   int count = 0;
   for (int i = 0; i < OrdersTotal(); i++)
   {
      if (OrderSelect(i, SELECT_BY_POS, MODE_TRADES) && OrderMagicNumber() == magicNumber && OrderSymbol() == Symbol())
         count++;
   }
   return count;
}

bool RiskEngine_CheckMaxPositions(int magicNumber)
{
   int count = RiskEngine_CountOpenPositions(magicNumber);
   if (count >= MaxPositions)
   {
      LogInfo("RiskEngine: MaxPositions reached (" + IntegerToString(count) + "/" + IntegerToString(MaxPositions) + ")");
      return false;
   }
   return true;
}

bool RiskEngine_CheckMaxTradesPerDay(int magicNumber)
{
   datetime dayStart = iTime(Symbol(), PERIOD_D1, 0);
   int count = 0;
   for (int i = 0; i < OrdersHistoryTotal(); i++)
   {
      if (OrderSelect(i, SELECT_BY_POS, MODE_HISTORY) && OrderMagicNumber() == magicNumber
          && OrderSymbol() == Symbol() && OrderOpenTime() >= dayStart)
         count++;
   }
   count += RiskEngine_CountOpenPositions(magicNumber);
   if (count >= MaxTradesPerDay)
   {
      LogInfo("RiskEngine: MaxTradesPerDay reached (" + IntegerToString(count) + "/" + IntegerToString(MaxTradesPerDay) + ")");
      return false;
   }
   return true;
}

bool RiskEngine_CheckMaxDailyLoss()
{
   datetime dayStart = iTime(Symbol(), PERIOD_D1, 0);
   double dayProfit = 0.0;
   for (int i = 0; i < OrdersHistoryTotal(); i++)
   {
      if (OrderSelect(i, SELECT_BY_POS, MODE_HISTORY) && OrderCloseTime() >= dayStart)
         dayProfit += OrderProfit() + OrderSwap() + OrderCommission();
   }
   if (dayProfit >= 0 || AccountBalance() <= 0)
      return true;
   double lossPct = -dayProfit / AccountBalance() * 100.0;
   if (lossPct >= MaxDailyLossPct)
   {
      LogWarn("RiskEngine: MaxDailyLossPct breached (" + DoubleToString(lossPct, 2) + "% >= " + DoubleToString(MaxDailyLossPct, 2) + "%)");
      return false;
   }
   return true;
}

bool RiskEngine_CheckMaxDrawdown()
{
   if (AccountBalance() <= 0)
      return true;
   double ddPct = (AccountBalance() - AccountEquity()) / AccountBalance() * 100.0;
   if (ddPct >= MaxDrawdownPct)
   {
      LogError("RiskEngine: MaxDrawdownPct breached (" + DoubleToString(ddPct, 2) + "% >= " + DoubleToString(MaxDrawdownPct, 2) + "%)");
      return false;
   }
   return true;
}

bool RiskEngine_CheckTradingHours()
{
   int h = Hour();
   if (TradingStartHour <= TradingEndHour)
      return (h >= TradingStartHour && h <= TradingEndHour);
   return (h >= TradingStartHour || h <= TradingEndHour); // window wraps past midnight
}

bool RiskEngine_CheckFridayClose()
{
   if (DayOfWeek() == 6 || DayOfWeek() == 0)
      return false; // market closed (Saturday/Sunday, broker server time)
   if (!FridayClose)
      return true;
   if (DayOfWeek() == 5 && Hour() >= FridayCloseHour)
      return false;
   return true;
}

// Aggregated pre-trade gate. Call this immediately before every OrderSend().
bool RiskEngine_AllowNewOrder(string requiredSymbol, int magicNumber)
{
   if (!RiskEngine_CanPlaceOrder())        return false;
   if (!RiskEngine_CheckSymbol(requiredSymbol)) return false;
   if (!RiskEngine_CheckSpread())          return false;
   if (!RiskEngine_CheckMaxPositions(magicNumber)) return false;
   if (!RiskEngine_CheckMaxTradesPerDay(magicNumber)) return false;
   if (!RiskEngine_CheckMaxDailyLoss())    return false;
   if (!RiskEngine_CheckMaxDrawdown())     return false;
   if (!RiskEngine_CheckTradingHours())    return false;
   if (!RiskEngine_CheckFridayClose())     return false;
   return true;
}

double RiskEngine_NormalizeLot(double requestedLot)
{
   double lot = MathMin(requestedLot, MaxLots);
   double minLot = MarketInfo(Symbol(), MODE_MINLOT);
   double maxLot = MarketInfo(Symbol(), MODE_MAXLOT);
   double lotStep = MarketInfo(Symbol(), MODE_LOTSTEP);
   if (lotStep <= 0) lotStep = 0.01;
   lot = MathRound(lot / lotStep) * lotStep;
   lot = MathMax(lot, minLot);
   lot = MathMin(lot, maxLot);
   return lot;
}

#endif // __USDJPY_SF_RISKENGINE_MQH__
