@echo off
cd /d "%~dp0\.."
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo Cloudflared is not installed on this computer.
  echo Install it from the official Cloudflare downloads, then run this file again.
  pause
  exit /b 1
)
echo Starting a temporary HTTPS link for phone installation.
echo Use the https://...trycloudflare.com URL shown below on the phone.
echo Keep this window open. Ctrl+C stops the phone link.
cloudflared tunnel --url http://127.0.0.1:3000
pause
