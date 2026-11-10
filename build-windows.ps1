$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$venv = Join-Path $PSScriptRoot ".venv-build"
$python = Join-Path $venv "Scripts\python.exe"
$dist = Join-Path $PSScriptRoot "dist"
$assets = Join-Path $PSScriptRoot "build-assets"
$work = Join-Path $PSScriptRoot "build\pyinstaller"
$spec = Join-Path $PSScriptRoot "Mallard.spec"

if (-not (Test-Path $python)) {
    Write-Host "Criando ambiente de build isolado..."
    python -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw "Python não conseguiu criar o ambiente de build." }
}

Write-Host "Instalando/atualizando dependências no ambiente isolado..."
& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar pip." }
& $python -m pip install -r (Join-Path $PSScriptRoot "requirements-build.txt")
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar dependências do build." }

if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }

$icon = Join-Path $assets "Mallard.ico"
if (-not (Test-Path $assets)) { New-Item -ItemType Directory -Path $assets | Out-Null }
& $python (Join-Path $PSScriptRoot "generateIcon.py") $icon
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $icon)) { throw "Não foi possível gerar o ícone do Mallard." }

Write-Host "Empacotando Mallard com PyInstaller..."
& $python -c "import webview" 2>$null
if ($LASTEXITCODE -ne 0) { throw "PyWebview não foi instalado corretamente." }
& $python -c "from google import genai; from google.genai import types; print('Google GenAI imports OK')" 2>$null
if ($LASTEXITCODE -ne 0) { throw "Google GenAI não foi instalado corretamente." }
& $python -m PyInstaller --noconfirm --clean --distpath $dist --workpath $work $spec
if ($LASTEXITCODE -ne 0) { throw "PyInstaller falhou." }

$exe = Join-Path $dist "Mallard.exe"
if (-not (Test-Path $exe)) { throw "Executável não foi gerado: $exe" }
Write-Host "Aplicativo empacotado em: $exe"

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
    $possible = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe")
    )
    $isccPath = $possible | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $isccPath) {
        Write-Host "Inno Setup não está instalado. Instalando com winget..."
        winget install --id JRSoftware.InnoSetup --exact --silent --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) { throw "Não foi possível instalar o Inno Setup com winget." }
        $isccPath = $possible | Where-Object { Test-Path $_ } | Select-Object -First 1
        if (-not $isccPath) { throw "Inno Setup foi instalado, mas ISCC.exe não foi encontrado." }
    }
} else {
    $isccPath = $iscc.Source
}

Write-Host "Criando instalador Setup.exe..."
& $isccPath (Join-Path $PSScriptRoot "installer\Mallard.iss")
if ($LASTEXITCODE -ne 0) { throw "Inno Setup falhou." }

$setup = Join-Path $PSScriptRoot "release\Mallard-Setup-4.1.1.exe"
if (-not (Test-Path $setup)) { throw "Instalador não foi encontrado: $setup" }
Write-Host "Instalador pronto: $setup"
