@echo off
chcp 65001 > nul
setlocal

REM ============================================================
REM  EC Consulting OS — 楽天レポート自動生成ランチャー
REM  使い方: run_report.bat <shop_name> <YYYYMM>
REM  例:     run_report.bat mkn24 202607
REM ============================================================

set SCRIPT_DIR=%~dp0

REM .env から ANTHROPIC_API_KEY を読み込む
if exist "%SCRIPT_DIR%.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%SCRIPT_DIR%.env") do (
        if "%%A"=="ANTHROPIC_API_KEY" set ANTHROPIC_API_KEY=%%B
    )
)

if "%ANTHROPIC_API_KEY%"=="" (
    echo [ERROR] ANTHROPIC_API_KEY が設定されていません。
    echo         scripts\.env ファイルに以下を記載してください:
    echo         ANTHROPIC_API_KEY=sk-ant-...
    pause
    exit /b 1
)

REM 引数チェック
if "%~1"=="" (
    set /p SHOP_NAME="ショップ名を入力 (例: mkn24): "
) else (
    set SHOP_NAME=%~1
)

if "%~2"=="" (
    set /p YEAR_MONTH="対象月を入力 YYYYMM (例: 202607): "
) else (
    set YEAR_MONTH=%~2
)

set JSON_PATH=C:\Users\ryuta\Downloads\ec_consulting_reports\%SHOP_NAME%_%YEAR_MONTH%\report_data.json

echo.
echo ============================================================
echo  STEP 1/3: Google Drive からデータを取得中...
echo ============================================================
python "%SCRIPT_DIR%fetch_from_drive.py" %SHOP_NAME% %YEAR_MONTH%
if errorlevel 1 (
    echo [ERROR] データ取得に失敗しました。
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  STEP 2/3: Claude AI で分析を強化中...
echo ============================================================
python "%SCRIPT_DIR%enrich_analysis.py" "%JSON_PATH%"
if errorlevel 1 (
    echo [ERROR] AI分析に失敗しました。
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  STEP 3/3: PowerPoint レポートを生成中...
echo ============================================================
node "%SCRIPT_DIR%generate_report_pptx.js" "%JSON_PATH%"
if errorlevel 1 (
    echo [ERROR] PPTX生成に失敗しました。
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  完了！レポートを開いています...
echo ============================================================

REM PPTX を自動で開く
for %%f in (C:\Users\ryuta\Downloads\ec_consulting_reports\%SHOP_NAME%_%YEAR_MONTH%\*.pptx) do (
    start "" "%%f"
)

endlocal
