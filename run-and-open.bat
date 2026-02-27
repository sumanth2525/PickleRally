@echo off
cd /d "%~dp0"
echo Starting server on http://localhost:3456 (and on your LAN for mobile)
echo Keep this window open. Close it to stop the server.
echo.
start "" cmd /k "python -m http.server 3456 --bind 0.0.0.0"
ping -n 3 127.0.0.1 >nul
start "" "http://localhost:3456"
start "" "http://localhost:3456/qr.html"
echo.
echo QR page opened. Scan the QR code with your phone (same WiFi).
