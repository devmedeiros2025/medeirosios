@echo off
setlocal
title MEDEIROS SYSTEM - Painel local

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado no PATH. Instale o Node 22 ou superior.
  exit /b 1
)

set "RAIZ=%~dp0.."
for %%I in ("%RAIZ%") do set "RAIZ=%%~fI"
set "PORTA=8765"

echo.
echo  MEDEIROS SYSTEM
echo  Painel local: http://127.0.0.1:%PORTA%
echo  MausBot:      openmausbot serve --port 8799 --no-pair
echo  Encerrar:     CTRL+C
echo.

start "" "http://127.0.0.1:%PORTA%"
node "%RAIZ%\scripts\ui\server.mjs"
endlocal
