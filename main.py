"""HardwareAnalysis: interface Mallard em PyWebview com backend Python real."""

import importlib.util
import os
import platform
import subprocess
import sys
import threading
import webbrowser
from datetime import datetime
from pathlib import Path


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
            available = importlib.util.find_spec(module) is not None
        except ModuleNotFoundError:
            available = False
        if not available:
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
            "Não foi possível instalar as dependências automaticamente. "
            f"Confira a conexão com a internet e tente: {sys.executable} -m pip install " + " ".join(missing)
        ) from error


if not getattr(sys, "frozen", False):
    ensure_dependencies()

import psutil
import webview

import aiAnalysis
import analysisHistory
import hardwareGuide
import hardwareInfo
import hardwareMonitoring
import pcHealth
import reportExport
import settingsStore


APP_NAME = "Mallard"
APP_VERSION = "3.0"
_HARDWARE_CACHE_SECONDS = 30


def resource_path(*parts):
    """Localiza recursos tanto no checkout quanto em pacote PyInstaller."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, *parts)


class HardwareAnalysisApi:
    """Ponte JavaScript/Python. Métodos públicos são expostos pelo PyWebview."""

    def __init__(self):
        self._hardware_cache = None
        self._hardware_cache_time = 0.0
        self._hardware_lock = threading.Lock()
        self._settings = settingsStore.loadSettings()
        self._api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        self._window = None
        self._history_lock = threading.Lock()

    @staticmethod
    def _collect_hardware():
        return {
            "sistema": hardwareInfo.getSystemInfo(),
            "tipo_de_maquina": hardwareInfo.getDeviceType(),
            "processador": hardwareInfo.getCpuInfo(),
            "placas_de_video": hardwareInfo.getGpuInfo(),
            "placa_mae": hardwareInfo.getMotherboardInfo(),
            "memoria": hardwareInfo.getRamInfo(),
            "detalhes_modulos_ram": hardwareInfo.getRamDetails(),
            "discos": hardwareInfo.getDiskInfo(),
            "discos_detalhes": hardwareInfo.getDiskDetails(),
            "lido_em": datetime.now().strftime("%H:%M"),
        }

    def _with_manual_parts(self, hardware):
        result = dict(hardware)
        manual = self._settings.get("manual_parts", {})
        result["informado_manualmente"] = {}
        for part, field in (("gpu", "placas_de_video"), ("mb", "placa_mae")):
            if manual.get(part):
                result[field] = manual[part]
                result["informado_manualmente"][part] = True
        result["processador_parcial"] = "family" in str(result.get("processador", "")).lower()
        result["nivel"] = pcHealth.getPcLevel(result)
        result["pontos_de_atencao"] = pcHealth.getInsights(result)
        return result

    def _current_hardware(self, refresh=False):
        import time

        with self._hardware_lock:
            expired = time.monotonic() - self._hardware_cache_time >= _HARDWARE_CACHE_SECONDS
            if refresh or self._hardware_cache is None or expired:
                self._hardware_cache = self._collect_hardware()
                self._hardware_cache_time = time.monotonic()
            return self._with_manual_parts(self._hardware_cache)

    def get_hardware(self, refresh=False):
        return self._current_hardware(bool(refresh))

    def set_manual_part(self, part, model):
        if part not in {"gpu", "mb"}:
            return self._current_hardware()
        manual = dict(self._settings.get("manual_parts", {}))
        model = str(model or "").strip()[:120]
        if model:
            manual[part] = model
        else:
            manual.pop(part, None)
        self._settings = settingsStore.saveSettings({"manual_parts": manual})
        return self._current_hardware()

    def get_metrics(self):
        ram = hardwareMonitoring.getRamUsage()
        gpu = hardwareMonitoring.getGpuUsage()
        system_drive = os.environ.get("SystemDrive", "C:") + "\\" if platform.system() == "Windows" else "/"
        try:
            disk_usage = psutil.disk_usage(system_drive)
            disk = {
                "device": system_drive.rstrip("\\/") or "/",
                "percent": disk_usage.percent,
                "free_gb": round(disk_usage.free / (1024**3), 1),
                "total_gb": round(disk_usage.total / (1024**3), 1),
            }
        except OSError:
            disk = None
        if disk and disk["percent"] < 80 and not self._settings.get("achievements", {}).get("ninho"):
            achievements = dict(self._settings.get("achievements", {}))
            achievements["ninho"] = True
            self._settings = settingsStore.saveSettings({"achievements": achievements})
        return {
            "time": datetime.now().strftime("%H:%M:%S"),
            "cpu": hardwareMonitoring.getCpuUsage(),
            "ram": {
                "percent": ram["percent"],
                "used_gb": ram["used_gb"],
                "total_gb": round(psutil.virtual_memory().total / (1024**3), 1),
            },
            "gpu": gpu,
            "disk": disk,
            "note": hardwareMonitoring.getPlatformNote(),
        }

    def get_guide(self):
        hardware = self._current_hardware()
        parts = hardwareGuide.getGuideParts()
        return {
            "parts": parts,
            "glossary": hardwareGuide.getGlossary(),
            "mine": {
                part["key"]: hardwareGuide.describeForComputer(part["key"], hardware)
                for part in parts
            },
        }

    def get_ai_status(self):
        key = self._api_key
        return {
            "has_key": bool(key),
            "masked": f"…{key[-4:]}" if len(key) >= 8 else "",
            "from_env": bool(key) and key == os.environ.get("GEMINI_API_KEY", "").strip(),
            "model": aiAnalysis.GEMINI_MODEL,
        }

    def set_api_key(self, key):
        self._api_key = str(key or "").strip()
        return self.get_ai_status()

    def forget_api_key(self):
        self._api_key = ""
        return self.get_ai_status()

    def _hardware_for_ai(self):
        hardware = self._current_hardware()
        ignored = {"pontos_de_atencao", "discos", "lido_em", "nivel"}
        data = {key: value for key, value in hardware.items() if key not in ignored}
        data["nivel_estimado_por_regras"] = (hardware.get("nivel") or {}).get("name")
        return data

    def run_analysis(self, perfil, preferencias):
        with self._history_lock:
            first = not analysisHistory.loadHistory()
        try:
            result = aiAnalysis.consultar_gemini(
                self._api_key,
                self._hardware_for_ai(),
                perfil,
                preferencias or {},
            )
        except aiAnalysis.AnalysisError as error:
            if error.code == "chave_invalida":
                self._api_key = ""
            return {
                "ok": False,
                "error": error.code,
                "message": error.message,
                "retry_seconds": error.retry_seconds,
            }
        with self._history_lock:
            entry = analysisHistory.addAnalysis(perfil, preferencias or {}, self._current_hardware(), result)
        return {"ok": True, "entry": entry, "first": first}

    def get_history(self):
        with self._history_lock:
            return analysisHistory.loadHistory()

    def get_analysis(self, entry_id):
        with self._history_lock:
            return analysisHistory.getAnalysis(entry_id)

    def set_upgrade_done(self, entry_id, index, done):
        with self._history_lock:
            entry = analysisHistory.setUpgradeDone(entry_id, int(index), bool(done))
            if not entry:
                return {"entry": None, "swan": False}
            all_done = bool(entry["feitos"]) and all(entry["feitos"])
            first_swan = all_done and not self._settings.get("achievements", {}).get("cisne")
            if first_swan:
                achievements = dict(self._settings.get("achievements", {}))
                achievements["cisne"] = True
                self._settings = settingsStore.saveSettings({"achievements": achievements})
            return {"entry": entry, "swan": all_done, "first_swan": first_swan}

    def delete_analysis(self, entry_id):
        with self._history_lock:
            return analysisHistory.deleteAnalysis(entry_id)

    def export_report(self, entry_id):
        with self._history_lock:
            entry = analysisHistory.getAnalysis(entry_id)
        if not entry or not self._window:
            return {"ok": False}
        name = "hardwareanalysis-relatorio-" + entry["data"][:10] + ".html"
        selected = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=name,
            file_types=("Página HTML (*.html)",),
        )
        if not selected:
            return {"ok": False, "cancelled": True}
        path = selected if isinstance(selected, str) else selected[0]
        Path(path).write_text(reportExport.buildReportHtml(entry), encoding="utf-8")
        return {"ok": True, "path": path}

    def get_app_info(self):
        return {
            "name": APP_NAME,
            "version": APP_VERSION,
            "os": hardwareInfo.getSystemInfo()["operating_system"],
            "ai_model": aiAnalysis.GEMINI_MODEL,
        }

    def get_settings(self):
        return self._settings

    def save_settings(self, changes):
        self._settings = settingsStore.saveSettings(changes)
        return self._settings

    def open_url(self, url):
        url = str(url or "")
        if url.startswith(("https://", "http://")):
            webbrowser.open(url)
            return True
        return False


def run_app():
    api = HardwareAnalysisApi()
    api._window = webview.create_window(
        APP_NAME,
        resource_path("ui", "index.html"),
        js_api=api,
        width=1280,
        height=820,
        min_size=(1024, 680),
        background_color="#0B0F0D",
    )
    webview.start(debug=os.environ.get("HARDWARE_ANALYSIS_DEBUG") == "1", http_server=False)
    return 0


if __name__ == "__main__":
    sys.exit(run_app())
