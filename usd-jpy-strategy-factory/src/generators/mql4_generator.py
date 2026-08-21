"""StrategySpec -> MQL4 EA source generator.

Pine Script is never translated directly into MQL4 (see ARCHITECTURE.md).
This module consumes *only* a validated StrategySpec, and specifically the
structured ``EntryRule.indicator_a`` / ``operator`` / ``indicator_b`` fields
(populated by ``src/pine/analyzer.py`` for crossover/crossunder conditions)
so that entry logic is generated deterministically rather than parsed from
free-text.

Generated EAs `#include <RiskEngine.mqh>`, `<Indicators.mqh>`, `<Logger.mqh>`
from ``mql4/shared/`` -- these must be copied into the MT4 terminal's
``MQL4/Include/`` folder (see docs/rakuten_mt4.md) before compilation.
"""

from __future__ import annotations

import datetime as _dt
import zlib

from src.strategies.labels import find_indicator_by_label, is_numeric_literal
from src.strategies.schema import EntryRule, StrategySpec
from src.strategies.validator import validate_spec

# Only indicator types with a real wrapper in mql4/shared/Indicators.mqh are
# supported for entry-condition generation. Extend both files together.
_INDICATOR_FUNC = {
    "EMA": "Ind_EMA",
    "SMA": "Ind_SMA",
    "WMA": "Ind_WMA",
    "RSI": "Ind_RSI",
}

_TIMEFRAME_TO_PERIOD = {
    "1m": "PERIOD_M1",
    "5m": "PERIOD_M5",
    "15m": "PERIOD_M15",
    "30m": "PERIOD_M30",
    "1h": "PERIOD_H1",
    "4h": "PERIOD_H4",
    "1d": "PERIOD_D1",
}

# Base offset keeps generated magic numbers out of the range a user is
# likely to have picked by hand for an unrelated EA.
_MAGIC_NUMBER_BASE = 700_000_000
_MAGIC_NUMBER_MODULO = 90_000_000


class MQL4GenerationError(ValueError):
    pass


def magic_number(strategy_id: str) -> int:
    return _MAGIC_NUMBER_BASE + (zlib.crc32(strategy_id.encode("utf-8")) % _MAGIC_NUMBER_MODULO)


def _resolve_term(spec: StrategySpec, token: str) -> tuple[str, str]:
    """Returns (current-closed-bar expr, previous-closed-bar expr) for a term."""

    if is_numeric_literal(token):
        return token, token

    indicator = find_indicator_by_label(spec.indicators, token)
    if indicator is None:
        raise MQL4GenerationError(
            f"cannot resolve term '{token}': not a numeric literal and no indicator in "
            f"StrategySpec.indicators matches that label"
        )
    if indicator.type not in _INDICATOR_FUNC:
        raise MQL4GenerationError(
            f"indicator type '{indicator.type}' is not yet supported by the MQL4 generator "
            f"(supported: {sorted(_INDICATOR_FUNC)}); extend mql4/shared/Indicators.mqh and "
            f"src/generators/mql4_generator.py together before using it in an entry condition"
        )
    func = _INDICATOR_FUNC[indicator.type]
    # shift=1/2: last two *closed* bars, evaluated once per new bar (see
    # IsNewBar() in the generated EA) -- this is the MQL4-side equivalent of
    # EntryRule.execution == "next_bar_market": the signal is confirmed on a
    # closed bar and any resulting order is sent on the following tick.
    cur = f"{func}(Symbol(), TradingTimeframe, {indicator.period}, 1)"
    prev = f"{func}(Symbol(), TradingTimeframe, {indicator.period}, 2)"
    return cur, prev


def _build_trigger_expr(spec: StrategySpec, rule: EntryRule | None) -> str | None:
    if rule is None:
        return None
    if rule.indicator_a is None or rule.operator is None or rule.indicator_b is None:
        raise MQL4GenerationError(
            f"entry condition '{rule.condition}' has no structured trigger "
            "(indicator_a/operator/indicator_b); regenerate the StrategySpec from a Pine "
            "source with a resolvable crossover/crossunder, or author these fields by hand"
        )
    cur_a, prev_a = _resolve_term(spec, rule.indicator_a)
    cur_b, prev_b = _resolve_term(spec, rule.indicator_b)
    func = "Ind_CrossesAbove" if rule.operator == "crosses_above" else "Ind_CrossesBelow"
    return f"{func}({cur_a}, {prev_a}, {cur_b}, {prev_b})"


def generate_mql4(spec: StrategySpec) -> str:
    """Generate MQL4 EA source for a StrategySpec. Raises MQL4GenerationError on failure."""

    validation = validate_spec(spec)
    if validation.blocks_ea_generation:
        raise MQL4GenerationError(
            f"StrategySpec '{spec.strategy_id}' fails validation, refusing to generate an EA: "
            f"{validation.errors}"
        )

    long_expr = _build_trigger_expr(spec, spec.long_entry)
    short_expr = _build_trigger_expr(spec, spec.short_entry)
    magic = magic_number(spec.strategy_id)
    tf_const = _TIMEFRAME_TO_PERIOD[spec.timeframe]
    generated_at = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")

    lines: list[str] = []
    lines += _header(spec, generated_at)
    lines += _inputs(spec, magic, tf_const)
    lines += _lifecycle_and_helpers()
    lines += _signal_handling(spec, long_expr, short_expr)
    return "\n".join(lines) + "\n"


def _header(spec: StrategySpec, generated_at: str) -> list[str]:
    return [
        "//+------------------------------------------------------------------+",
        f"//| {spec.strategy_id}.mq4 -- GENERATED by src/generators/mql4_generator.py |",
        "//| DO NOT EDIT BY HAND. Edit strategy_specs/"
        f"{spec.strategy_id}.json and regenerate. |",
        f"//| StrategySpec: {spec.name} (version {spec.version}) |",
        f"//| Generated at: {generated_at} |",
        "//| See ARCHITECTURE.md 'Live Safety' before deploying this EA.       |",
        "//+------------------------------------------------------------------+",
        "#property copyright \"USDJPY AI Strategy Factory\"",
        "#property strict",
        "",
        "#include <RiskEngine.mqh>",
        "#include <Indicators.mqh>",
        "#include <Logger.mqh>",
        "",
    ]


def _inputs(spec: StrategySpec, magic: int, tf_const: str) -> list[str]:
    sl = spec.exit.stop_loss_pips if spec.exit.stop_loss_pips is not None else 0
    tp = spec.exit.take_profit_pips if spec.exit.take_profit_pips is not None else 0
    return [
        f'input string        StrategyId            = "{spec.strategy_id}";',
        f'input string         RequiredSymbol        = "{spec.symbol}";',
        f"input ENUM_TIMEFRAMES TradingTimeframe     = {tf_const};",
        f"input int            MagicNumber           = {magic};",
        f"input double         FixedLot              = {spec.risk.fixed_lot};",
        f"input double         StopLossPips          = {sl};",
        f"input double         TakeProfitPips        = {tp};",
        f"input bool           ReverseOnOppositeSignal = {'true' if spec.position_management.reverse_on_opposite_signal else 'false'};",
        "input int            SlippagePoints        = 3;",
        f'input string         EAComment             = "{spec.strategy_id} (USDJPY Strategy Factory)";',
        "",
        "datetime __lastBarTime = 0;",
        "",
    ]


def _lifecycle_and_helpers() -> list[str]:
    return [
        "int OnInit()",
        "{",
        '   Logger_Init(StrategyId + ".log");',
        '   LogInfo("EA initialized: " + StrategyId + " magic=" + IntegerToString(MagicNumber));',
        "   if (Symbol() != RequiredSymbol)",
        "   {",
        '      LogError("This EA is restricted to " + RequiredSymbol + "; refusing to run on " + Symbol());',
        "      return INIT_FAILED;",
        "   }",
        "   __lastBarTime = 0;",
        "   return INIT_SUCCEEDED;",
        "}",
        "",
        "void OnDeinit(const int reason)",
        "{",
        '   LogInfo("EA deinitialized, reason=" + IntegerToString(reason));',
        "   Logger_Deinit();",
        "}",
        "",
        "bool IsNewBar()",
        "{",
        "   datetime t = iTime(Symbol(), TradingTimeframe, 0);",
        "   if (t != __lastBarTime)",
        "   {",
        "      __lastBarTime = t;",
        "      return true;",
        "   }",
        "   return false;",
        "}",
        "",
        "double ComputeStopLoss(int orderType, double price)",
        "{",
        "   if (StopLossPips <= 0) return 0;",
        "   double dist = StopLossPips * RiskEngine_PipSize();",
        "   return (orderType == OP_BUY) ? price - dist : price + dist;",
        "}",
        "",
        "double ComputeTakeProfit(int orderType, double price)",
        "{",
        "   if (TakeProfitPips <= 0) return 0;",
        "   double dist = TakeProfitPips * RiskEngine_PipSize();",
        "   return (orderType == OP_BUY) ? price + dist : price - dist;",
        "}",
        "",
    ]


def _signal_handling(spec: StrategySpec, long_expr: str | None, short_expr: str | None) -> list[str]:
    lines = [
        "void HandleSignal(int orderType, double lot)",
        "{",
        "   int opposite = (orderType == OP_BUY) ? OP_SELL : OP_BUY;",
        "",
        "   if (ReverseOnOppositeSignal)",
        "   {",
        "      for (int i = OrdersTotal() - 1; i >= 0; i--)",
        "      {",
        "         if (OrderSelect(i, SELECT_BY_POS, MODE_TRADES) && OrderMagicNumber() == MagicNumber",
        "             && OrderSymbol() == Symbol() && OrderType() == opposite)",
        "         {",
        "            double closePrice = (opposite == OP_BUY) ? Bid : Ask;",
        "            if (!OrderClose(OrderTicket(), OrderLots(), closePrice, SlippagePoints))",
        '               LogLastError("OrderClose failed while reversing position");',
        "            else",
        '               LogInfo("Closed opposite position on reverse signal, ticket=" + IntegerToString(OrderTicket()));',
        "         }",
        "      }",
        "   }",
        "",
        "   if (!RiskEngine_AllowNewOrder(RequiredSymbol, MagicNumber)) return;",
        "",
        "   double price = (orderType == OP_BUY) ? Ask : Bid;",
        "   double sl = ComputeStopLoss(orderType, price);",
        "   double tp = ComputeTakeProfit(orderType, price);",
        "   color arrowColor = (orderType == OP_BUY) ? clrBlue : clrRed;",
        "",
        "   int ticket = OrderSend(Symbol(), orderType, lot, price, SlippagePoints, sl, tp, EAComment, MagicNumber, 0, arrowColor);",
        "   if (ticket < 0)",
        '      LogLastError("OrderSend failed");',
        "   else",
        '      LogInfo("Order opened: ticket=" + IntegerToString(ticket) + " type=" + IntegerToString(orderType) + " lot=" + DoubleToString(lot, 2));',
        "}",
        "",
        "void OnTick()",
        "{",
        "   if (!IsNewBar()) return;",
        "",
        "   double lot = RiskEngine_NormalizeLot(FixedLot);",
        "",
    ]

    if long_expr is not None:
        lines += [
            f"   bool longSignal = {long_expr};",
            "   if (longSignal) HandleSignal(OP_BUY, lot);",
            "",
        ]
    if short_expr is not None:
        lines += [
            f"   bool shortSignal = {short_expr};",
            "   if (shortSignal) HandleSignal(OP_SELL, lot);",
            "",
        ]

    lines.append("}")
    return lines
