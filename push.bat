@echo off
cd /d "%~dp0"
if "%~1"=="" (
  echo Usage: push.bat https://github.com/???/balance-ledger.git
  pause
  exit /b 1
)
git remote remove origin 2>nul
git remote add origin %1
git branch -M main
git push -u origin main
echo Push done. Then enable GitHub Pages in repo Settings.
pause
