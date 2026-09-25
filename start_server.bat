@echo off
title Road Buffer Tool
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python nahi mila — python.org se install karo aur dobara try karo.
  pause
  exit /b 1
)

echo Road Buffer Tool start ho raha hai...
echo Band karne ke liye ye window close kar do.
echo.

:loop
python app.py
echo.
echo ------------------------------------------------------------
echo Server band ho gaya tha — 3 second me apne aap restart hoga...
echo ------------------------------------------------------------
timeout /t 3 /nobreak >nul
goto loop
