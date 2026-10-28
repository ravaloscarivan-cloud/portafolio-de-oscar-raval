@echo off
cd /d "%~dp0"
if not exist node_modules\vite (
  echo Instalando dependencias...
  call npm install
)
call npm run dev
pause
