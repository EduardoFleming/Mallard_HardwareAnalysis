"""Ponto de entrada do Mallard (frontend novo do HardwareAnalysis)."""

import importlib.util
import platform
import subprocess
import sys


def ensure_dependencies():
    packages = {
        "pywebview": "webview",
        "psutil": "psutil",
        "google-generativeai": "google.generativeai",
        "nvidia-ml-py": "pynvml",
    }
    if platform.system() == "Windows":
        packages.update({"wmi": "wmi", "pywin32": "win32com"})
    missing = []
    for package, module in packages.items():
        try:
            installed = importlib.util.find_spec(module) is not None
        except ModuleNotFoundError:
            installed = False
        if not installed:
            missing.append(package)
    if not missing:
        return
    print("Instalando dependências necessárias: " + ", ".join(missing))
    if importlib.util.find_spec("pip") is None:
        raise SystemExit("O pip não está disponível neste Python. Instale/ative o pip e execute python app.py novamente.")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", *missing], check=True)
    except (OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(
            "Não foi possível instalar dependências automaticamente. "
            f"Execute: {sys.executable} -m pip install " + " ".join(missing)
        ) from error


if __name__ == "__main__":
    ensure_dependencies()
    from main import run_app

    raise SystemExit(run_app())
