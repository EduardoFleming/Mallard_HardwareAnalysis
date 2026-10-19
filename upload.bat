@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

git rev-parse --show-toplevel >nul 2>&1
if errorlevel 1 (
    echo Erro: execute este script dentro de um repositorio Git.
    pause
    exit /b 1
)

rem Recusa publicar caso um save local ja esteja rastreado pelo Git, inclusive em subpastas.
for /f "delims=" %%F in ('git ls-files') do (
    for %%S in (config.json historico.json) do (
        if /I "%%~nxF"=="%%S" (
            set "SAVE_FILE=%%F"
            goto :save_tracked
        )
    )
)

echo Este script vai preparar todas as alteracoes locais, criar um commit e publicar o branch atual.
echo Saves ignorados: config.json, historico.json e nomes listados no .gitignore.
echo Commit/push ficam bloqueados se um save conhecido estiver rastreado ou staged.
choice /C SN /N /M "Voce testou o app e autoriza commit e push agora? [S/N] "
if errorlevel 2 (
    echo Cancelado. Nenhum arquivo foi adicionado ou enviado.
    exit /b 0
)

git add -A
if errorlevel 1 (
    echo Erro ao preparar os arquivos.
    exit /b 1
)

rem Segunda barreira: verifica os nomes staged, inclusive saves em subpastas.
for /f "usebackq delims=" %%F in (`git diff --cached --name-only`) do (
    for %%S in (config.json historico.json) do (
        if /I "%%~nxF"=="%%S" (
            set "SAVE_FILE=%%F"
            goto :save_staged
        )
    )
)

git diff --cached --quiet
if not errorlevel 1 (
    echo Nao ha alteracoes preparadas para commit.
    exit /b 0
)

git status --short
choice /C SN /N /M "Confirma o commit e o envio ao GitHub? [S/N] "
if errorlevel 2 (
    echo Cancelado. Os arquivos preparados continuam no staging local; nada foi enviado.
    exit /b 0
)

git commit -m "Atualizacao automatica - %date% %time%"
if errorlevel 1 (
    echo Falha ao criar o commit. Nada foi enviado.
    exit /b 1
)

git push -u origin HEAD
if errorlevel 1 (
    echo O commit foi criado localmente, mas o push falhou.
    pause
    exit /b 1
)

echo.
echo Sucesso! Codigo enviado para o GitHub.
pause
exit /b 0

:save_tracked
echo BLOQUEADO: um arquivo de save local ja esta rastreado pelo Git: !SAVE_FILE!
echo Remova-o do indice com git rm --cached e o caminho acima; revise o historico antes de publicar.
pause
exit /b 1

:save_staged
echo BLOQUEADO: um arquivo de save esta preparado para publicacao: !SAVE_FILE!
git reset -q -- "!SAVE_FILE!"
echo Remova-o do staging e revise o .gitignore antes de publicar.
pause
exit /b 1
