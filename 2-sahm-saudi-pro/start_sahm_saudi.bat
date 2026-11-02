@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0python-backend"

set "PY=python"

python --version >nul 2>&1
if not errorlevel 1 (
    goto :PYTHON_FOUND
)

py -3 --version >nul 2>&1
if not errorlevel 1 (
    set "PY=py -3"
    goto :PYTHON_FOUND
)

if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    goto :PYTHON_FOUND
)
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    goto :PYTHON_FOUND
)
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
    set "PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    goto :PYTHON_FOUND
)
if exist "C:\Python312\python.exe" (
    set "PY=C:\Python312\python.exe"
    goto :PYTHON_FOUND
)
if exist "C:\Python311\python.exe" (
    set "PY=C:\Python311\python.exe"
    goto :PYTHON_FOUND
)

:PYTHON_FOUND
echo ========================================================
echo   Sahm Saudi Pro - TASI / Nomu Quantitative Backend
echo   Running on Port: 8001
echo ========================================================
echo Using Python interpreter: %PY%
echo Installing requirements...
%PY% -m pip install -r requirements.txt
echo Starting Sahm Saudi Pro Backend Server on port 8001...
%PY% -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
pause
