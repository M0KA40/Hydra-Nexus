@echo off
setlocal DisableDelayedExpansion
powershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0Wrap-BAT.ps1" %*
exit /b %errorlevel%
