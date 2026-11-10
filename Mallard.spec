# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import collect_all

ROOT = Path(SPECPATH)
datas = [(str(ROOT / "ui"), "ui")]
binaries = []
hiddenimports = []

for package in ("webview", "google.genai", "pynvml", "psutil", "win32com", "pythoncom", "pywintypes", "pystray", "PIL"):
    try:
        package_datas, package_binaries, package_hiddenimports = collect_all(package)
        datas += package_datas
        binaries += package_binaries
        hiddenimports += package_hiddenimports
    except Exception:
        # Pacotes de plataforma podem não existir em versões específicas.
        pass

# Só o caminho Google GenAI usado pelo cliente é necessário; coleta
# todos os namespaces acrescenta dezenas de módulos experimentais e testes.
hiddenimports += [
    "google.genai._api_client",
    "google.api_core",
    "google.auth",
    "google.protobuf",
    "pystray",
    "PIL.Image",
    "PIL.ImageDraw",
]

for entry in list(datas):
    source = entry[0].replace("\\", "/").lower()
    if "googleapiclient/discovery_cache/documents" in source:
        datas.remove(entry)

runtime_hooks = []
try:
    from webview.platforms.winforms import fix_pyinstaller_hook

    runtime_hooks.append(str(Path(fix_pyinstaller_hook.__file__)))
except Exception:
    pass

a = Analysis(
    [str(ROOT / "app.py")],
    pathex=[str(ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=runtime_hooks,
    excludes=["PySide6", "PyQt5", "PyQt6", "tkinter", "pytest"],
    noarchive=False,
    optimize=1,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="Mallard",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    icon=str(ROOT / "build-assets" / "Mallard.ico"),
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
