@echo off
chcp 65001 > nul
setlocal

REM ============================================================
REM  EC Consulting OS — 当月進捗MTGデッキ 自動生成
REM  使い方: run_mtg.bat <shop_name> <YYYYMM>
REM  例:     run_mtg.bat mkn24 202608
REM ============================================================

if "%1"=="" (
    echo 使い方: run_mtg.bat ^<shop_name^> ^<YYYYMM^>
    echo 例:     run_mtg.bat mkn24 202608
    pause
    exit /b 1
)
if "%2"=="" (
    echo ❌ 対象月 YYYYMM を指定してください
    echo 例:     run_mtg.bat mkn24 202608
    pause
    exit /b 1
)

set SHOP=%1
set YYYYMM=%2
set OUT_DIR=C:\Users\ryuta\Downloads\ec_consulting_reports\%SHOP%_%YYYYMM%
set JSON_FILE=%OUT_DIR%\mtg_data.json
set SCRIPT_DIR=%~dp0

REM .env から ANTHROPIC_API_KEY を読み込む
if exist "%SCRIPT_DIR%.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%SCRIPT_DIR%.env") do (
        if "%%A"=="ANTHROPIC_API_KEY" set ANTHROPIC_API_KEY=%%B
    )
)

echo.
echo ============================================================
echo  STEP 1/2: Google Drive から広告データを取得中...
echo ============================================================
python "%SCRIPT_DIR%fetch_ad_from_drive.py" %SHOP% %YYYYMM%
if errorlevel 1 (
    echo [ERROR] 広告データ取得に失敗しました。
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  STEP 2/2: PowerPoint MTGデッキを生成中...
echo ============================================================
node "%SCRIPT_DIR%generate_mtg_pptx.js" "%JSON_FILE%"
if errorlevel 1 (
    echo [ERROR] PPTX生成に失敗しました。
    pause
    exit /b 1
)

REM PPTX を自動で開く
set PPTX_FILE=%OUT_DIR%\mtg_report_%YYYYMM%.pptx
if exist "%PPTX_FILE%" (
    echo.
    echo ✅ 完了！ファイルを開きます: %PPTX_FILE%
    start "" "%PPTX_FILE%"
) else (
    echo ⚠️  PPTXファイルが見つかりません: %PPTX_FILE%
)

pause
