@echo off
echo ==========================================
echo Preparando para subir o HardwareAnalysis...
echo ==========================================

git add .

git commit -m "Atualizacao automatica - %date% %time%"

git push -u origin main

echo.
echo Sucesso! Codigo enviado para o GitHub.
pause
