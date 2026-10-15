@echo off
cd /d "%~dp0"
start "استفادة المؤسسة من البيانات" /MIN cmd /c "timeout /t 1 /nobreak >nul & start http://127.0.0.1:8761/"
python server.py
