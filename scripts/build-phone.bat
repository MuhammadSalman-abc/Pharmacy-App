@echo off
cd /d "%~dp0\.."
echo Building the installable MediStock phone app...
call npm run build:web
if errorlevel 1 (
  echo Build failed. Read the error above.
  pause
  exit /b 1
)
echo.
echo Phone app built successfully in apps\web\out
echo Next step: host this folder on HTTPS, then open the link on Android and choose Install app.
pause
