@echo off
cd /d "%~dp0"
set "PY="
if defined MIMO_PYTHON set "PY=%MIMO_PYTHON%"
if not defined PY set "PY=python"
"%PY%" "%~dp0sync_push.py"
pause
