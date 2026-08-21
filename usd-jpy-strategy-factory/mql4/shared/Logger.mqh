//+------------------------------------------------------------------+
//| Logger.mqh -- shared structured logging for generated EAs        |
//| Part of the USDJPY AI Strategy Factory (mql4/shared).            |
//| Do NOT edit generated EAs directly; regenerate from StrategySpec.|
//+------------------------------------------------------------------+
#property strict

#ifndef __USDJPY_SF_LOGGER_MQH__
#define __USDJPY_SF_LOGGER_MQH__

int __Logger_FileHandle = INVALID_HANDLE;
string __Logger_FileName = "";

// Call once from OnInit(). fileName is typically "<strategy_id>.log".
void Logger_Init(string fileName)
{
   __Logger_FileName = fileName;
   __Logger_FileHandle = FileOpen(fileName, FILE_WRITE | FILE_READ | FILE_TXT | FILE_SHARE_READ);
   if (__Logger_FileHandle != INVALID_HANDLE)
      FileSeek(__Logger_FileHandle, 0, SEEK_END);
}

void Logger_Deinit()
{
   if (__Logger_FileHandle != INVALID_HANDLE)
   {
      FileClose(__Logger_FileHandle);
      __Logger_FileHandle = INVALID_HANDLE;
   }
}

void __Logger_Write(string level, string message)
{
   string line = TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS) + " [" + level + "] " + message;
   Print(line);
   if (__Logger_FileHandle != INVALID_HANDLE)
   {
      FileWrite(__Logger_FileHandle, line);
      FileFlush(__Logger_FileHandle);
   }
}

void LogInfo(string message)  { __Logger_Write("INFO", message); }
void LogWarn(string message)  { __Logger_Write("WARN", message); }
void LogError(string message) { __Logger_Write("ERROR", message); }

// Logs the last MQL4 error code/description alongside a context message.
void LogLastError(string context)
{
   int code = GetLastError();
   __Logger_Write("ERROR", context + " (error " + IntegerToString(code) + ": " + ErrorDescription(code) + ")");
}

// Minimal error-code-to-text map for the codes generated EAs are most
// likely to hit (trade context busy, invalid price/stops, off quotes,
// not enough money, market closed). Falls back to the numeric code.
string ErrorDescription(int code)
{
   switch (code)
   {
      case 1:   return "No error, trade conditions not changed";
      case 2:   return "Common error";
      case 3:   return "Invalid trade parameters";
      case 4:   return "Trade server is busy";
      case 6:   return "No connection with trade server";
      case 129: return "Invalid price";
      case 130: return "Invalid stops";
      case 131: return "Invalid trade volume";
      case 132: return "Market is closed";
      case 133: return "Trade is disabled";
      case 134: return "Not enough money";
      case 135: return "Price changed";
      case 136: return "Off quotes";
      case 137: return "Broker is busy";
      case 138: return "Requote";
      case 146: return "Trade context is busy";
      default:  return "Error code " + IntegerToString(code);
   }
}

#endif // __USDJPY_SF_LOGGER_MQH__
