@echo off
cd /d "%~dp0python-backend"

set "PY=python"
python --version >nul 2>&1
if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    ) else if exist "C:\Python312\python.exe" (
        set "PY=C:\Python312\python.exe"
    )
)

echo Installing packages if needed...
%PY% -m pip install -r requirements.txt
echo Starting Sahm AI Server on port 8000...
%PY% -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause