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
        "google-genai": "google.genai",
        "nvidia-ml-py": "pynvml",
    }
    if platform.system() == "Windows":
        packages.update({"wmi": "wmi", "pywin32": "win32com", "pystray": "pystray", "Pillow": "PIL"})

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
import batteryInfo
import diskCleanup
import gameCheck
import analysisHistory
import hardwareGuide
import hardwareInfo
import hardwareMonitoring
import pcHealth
import reportExport
import runningPrograms
import secureKeyStore
import settingsStore
import startupItems
import temperatureSensors
import trayAlerts
import upgradeCompare
import upgradeSimulator
import usageJournal


APP_NAME = "Mallard"
APP_VERSION = "4.1.1"
_HARDWARE_CACHE_SECONDS = 30
_MINI_SIZE = {"full": (340, 428), "compact": (340, 104)}


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
        env_key = os.environ.get("GEMINI_API_KEY", "").strip()
        self._api_key = env_key or secureKeyStore.load_key()
        self._api_key_saved = bool(self._api_key and not env_key)
        self._window = None
        self._history_lock = threading.Lock()
        self._mini = None
        self._tray = None
        self._closing = False

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

    def get_battery(self, refresh=False):
        return batteryInfo.getBattery(bool(refresh))

    def get_metrics(self):
        ram = hardwareMonitoring.getRamUsage()
        gpu = hardwareMonitoring.getGpuUsage()
        drive = os.environ.get("SystemDrive", "C:") + "\\" if platform.system() == "Windows" else "/"
        try:
            usage = psutil.disk_usage(drive)
            disk = {
                "device": drive.rstrip("\\/") or "/",
                "percent": usage.percent,
                "free_gb": round(usage.free / (1024**3), 1),
                "total_gb": round(usage.total / (1024**3), 1),
                "total_bytes": usage.total,
                "used_bytes": usage.used,
                "free_bytes": usage.free,
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

    def get_simulation_options(self):
        return upgradeSimulator.getOptions(self._current_hardware())

    def simulate_upgrade(self, choice):
        choice = choice or {}
        return upgradeSimulator.simulate(
            self._current_hardware(),
            ram_gb=choice.get("ram_gb"),
            ssd_gb=int(choice.get("ssd_gb") or 0),
            nvme=bool(choice.get("nvme")),
            gpu_tier=choice.get("gpu_tier"),
        )

    def get_top_programs(self):
        return runningPrograms.topPrograms()

    def close_program(self, key):
        return runningPrograms.closeProgram(key)

    def get_game_examples(self):
        return gameCheck.exampleEntries()

    def check_game(self, query):
        return gameCheck.check(query, self._current_hardware())

    def ask_game(self, query):
        try:
            data = aiAnalysis.consultar_requisitos(self._api_key, query)
        except aiAnalysis.AnalysisError as error:
            if error.code == "chave_invalida":
                self._discard_invalid_api_key()
            return {
                "ok": False,
                "error": error.code,
                "message": error.message,
                "retry_seconds": error.retry_seconds,
            }
        except Exception as error:
            return {"ok": False, "error": "desconhecido", "message": str(error)}
        if not data:
            return {"ok": True, "found": False, "query": str(query or "").strip()}
        return {"ok": True, **gameCheck.fromRemote(data, self._current_hardware())}

    def get_journal(self, week_offset=0):
        try:
            usageJournal.recordSample()
        except Exception:
            pass
        return usageJournal.getJournal(week_offset)

    def get_startup(self):
        return startupItems.listItems()

    def set_startup_enabled(self, item_id, enabled):
        return startupItems.setEnabled(item_id, bool(enabled))

    def open_power_settings(self):
        if platform.system() == "Windows":
            os.startfile("ms-settings:batterysaver")
            return True
        return False

    def scan_cleanup(self):
        return diskCleanup.scan()

    def start_cleanup(self, keys):
        return diskCleanup.startCleanup(keys)

    def get_cleanup_status(self):
        status = diskCleanup.status()
        if status["phase"] == "done" and not status.get("achievement_checked"):
            disk = diskCleanup._disk()
            if disk and disk["percent"] < 80 and status["freed"] > 0:
                achievements = dict(self._settings.get("achievements", {}))
                if not achievements.get("ninho"):
                    achievements["ninho"] = True
                    self._settings = settingsStore.saveSettings({"achievements": achievements})
                    status["first_ninho"] = True
            status["disk"] = disk
        return status

    def reset_cleanup(self):
        diskCleanup.resetJob()
        return diskCleanup.status()

    def get_temperatures(self, refresh=False):
        return temperatureSensors.readTemperatures(bool(refresh))

    def get_before_after(self):
        return upgradeCompare.getBeforeAfter()

    def get_tray_info(self):
        info = self._tray.info() if self._tray else {
            "available": False, "snoozed": False, "status": "ok", "text": ""
        }
        info["enabled"] = bool(self._settings.get("tray_alerts", True))
        return info

    def set_tray_snooze(self, on):
        if self._tray:
            self._tray.setSnooze(bool(on))
        return self.get_tray_info()

    def send_test_alert(self, kind="mem"):
        return bool(self._tray and self._tray.sendTest(str(kind)))

    def _alert_sample(self):
        metrics = self.get_metrics()
        return {"ram": metrics["ram"], "disk": metrics["disk"]}

    @staticmethod
    def _alert_top():
        programs = runningPrograms.topPrograms(1)
        return programs[0] if programs else None

    def _alert_prefs(self):
        return self._settings

    def _start_tray(self):
        self._tray = trayAlerts.TrayService(
            self._alert_sample,
            self._alert_prefs,
            top_fn=self._alert_top,
            on_open=self.show_main,
            on_mini=self.open_mini,
            on_quit=self._quit,
        )
        if self._tray.start():
            self._tray.setVisible(bool(self._settings.get("tray_alerts", True)))

    def open_mini(self):
        if self._mini is not None:
            try:
                self._mini.show()
                return True
            except Exception:
                self._mini = None
        compact = bool(self._settings.get("mini_compact"))
        width, height = _MINI_SIZE["compact" if compact else "full"]
        position = {}
        try:
            screen = webview.screens[0]
            position = {"x": max(0, screen.width - width - 24), "y": max(0, screen.height - height - 96)}
        except Exception:
            pass
        self._mini = webview.create_window(
            "Mallard · mini",
            resource_path("ui", "mini.html"),
            js_api=self,
            width=width,
            height=height,
            frameless=True,
            easy_drag=False,
            resizable=False,
            on_top=bool(self._settings.get("mini_pinned", True)),
            background_color="#0B0F0D",
            **position,
        )
        self._mini.events.closed += self._on_mini_closed
        try:
            if self._window:
                self._window.minimize()
        except Exception:
            pass
        return True

    def _on_mini_closed(self):
        self._mini = None

    def close_mini(self):
        mini, self._mini = self._mini, None
        if mini is not None:
            try:
                mini.destroy()
            except Exception:
                pass
        return True

    def set_mini_option(self, key, value):
        field = {"pinned": "mini_pinned", "compact": "mini_compact"}.get(key)
        if field:
            self._settings = settingsStore.saveSettings({field: bool(value)})
            self._apply_mini()
        return {"pinned": self._settings["mini_pinned"], "compact": self._settings["mini_compact"]}

    def _apply_mini(self):
        if self._mini is None:
            return
        try:
            self._mini.on_top = bool(self._settings.get("mini_pinned", True))
            self._mini.resize(*_MINI_SIZE["compact" if self._settings.get("mini_compact") else "full"])
        except Exception:
            pass

    def show_main(self, page=None):
        if self._window is None:
            return False
        try:
            self._window.restore()
            self._window.show()
            if page:
                self._window.evaluate_js(f"App.go({json.dumps(str(page))})")
        except Exception:
            return False
        return True

    def expand_from_mini(self):
        self.close_mini()
        return self.show_main()

    def _quit(self):
        self._closing = True
        if self._tray:
            self._tray.stop()
        for window in list(webview.windows):
            try:
                window.destroy()
            except Exception:
                pass

    def _on_main_closed(self):
        self._closing = True
        self.close_mini()
        if self._tray:
            self._tray.stop()

    def get_ai_status(self):
        key = self._api_key
        return {
            "has_key": bool(key),
            "masked": f"…{key[-4:]}" if len(key) >= 8 else "",
            "from_env": bool(key) and key == os.environ.get("GEMINI_API_KEY", "").strip(),
            "saved": self._api_key_saved,
            "model": aiAnalysis.GEMINI_MODEL,
        }

    def set_api_key(self, key):
        key = str(key or "").strip()
        if not key:
            return self.get_ai_status()
        try:
            secureKeyStore.save_key(key)
            self._api_key_saved = True
            save_error = False
        except OSError:
            # A chave continua só nesta sessão; nunca gravar em texto puro.
            self._api_key_saved = False
            save_error = True
        self._api_key = key
        status = self.get_ai_status()
        status["save_error"] = save_error
        return status

    def forget_api_key(self):
        self._api_key = ""
        self._api_key_saved = False
        secureKeyStore.delete_key()
        return self.get_ai_status()

    def _discard_invalid_api_key(self):
        was_saved = self._api_key_saved
        self._api_key = ""
        self._api_key_saved = False
        if was_saved:
            secureKeyStore.delete_key()

    def _hardware_for_ai(self):
        hardware = self._current_hardware()
        ignored = {"pontos_de_atencao", "discos", "lido_em", "nivel"}
        data = {key: value for key, value in hardware.items() if key not in ignored}
        data["nivel_estimado_por_regras"] = (hardware.get("nivel") or {}).get("name")
        return data

    def run_analysis(self, perfil, preferencias):
        with self._history_lock:
            first = not analysisHistory.loadHistory()
        request_preferences = dict(preferencias or {})
        request_preferences.pop("resumo", None)
        try:
            result = aiAnalysis.consultar_gemini(
                self._api_key,
                self._hardware_for_ai(),
                perfil,
                request_preferences,
            )
        except aiAnalysis.AnalysisError as error:
            if error.code == "chave_invalida":
                self._discard_invalid_api_key()
            return {
                "ok": False,
                "error": error.code,
                "message": error.message,
                "retry_seconds": error.retry_seconds,
            }
        with self._history_lock:
            entry = analysisHistory.addAnalysis(perfil, request_preferences, self._current_hardware(), result)
        return {"ok": True, "entry": entry, "first": first}

    def set_shopping(self, entry_id, index, include, price=None):
        with self._history_lock:
            return analysisHistory.setShopping(entry_id, int(index), bool(include), price)

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
        if self._tray:
            self._tray.setVisible(bool(self._settings.get("tray_alerts", True)))
        self._apply_mini()
        return self._settings

    def open_url(self, url):
        url = str(url or "")
        if url.startswith(("https://", "http://")):
            webbrowser.open(url)
            return True
        return False


def run_app():
    api = HardwareAnalysisApi()
    usageJournal.startSampler()
    api._window = webview.create_window(
        APP_NAME,
        resource_path("ui", "index.html"),
        js_api=api,
        width=1440,
        height=900,
        min_size=(1040, 680),
        background_color="#0B0F0D",
    )
    api._window.events.closed += api._on_main_closed
    api._start_tray()
    webview.start(
        debug=os.environ.get("HARDWARE_ANALYSIS_DEBUG") == "1",
        http_server=False,
        icon=resource_path("build-assets", "Mallard.ico"),
    )
    return 0


if __name__ == "__main__":
    sys.exit(run_app())
