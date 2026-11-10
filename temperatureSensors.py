"""Temperaturas e ventoinhas (tela Temperatura e aviso de calor na bandeja).

O que dá para ler depende do computador:
- Placa de vídeo NVIDIA: pelo NVML (o mesmo do Monitor).
- Linux: Psutil lê processador, disco NVMe e ventoinhas.
- Windows: o Psutil não traz sensores, então tentamos a zona térmica do ACPI e o contador de
  confiabilidade do disco pelo PowerShell. Muitos notebooks e placas-mãe não expõem esses dados:
  nesse caso o item aparece como "Sem sensor", nunca com um número inventado.
"""

import json
import platform
import subprocess
import threading
import time

import psutil

import hardwareMonitoring

# (alto, crítico) em °C. "Alto" ainda é seguro, mas merece atenção.
LIMITS = {"cpu": (70, 85), "ssd": (55, 70), "gpu": (80, 90)}
FAN_LIMITS = (2000, 3000)  # rpm: rápida, no máximo
CACHE_SECONDS = 6
POWERSHELL_TIMEOUT = 8

_cache = {"at": 0.0, "value": None}
_lock = threading.Lock()

_POWERSHELL = r"""
$r = @{}
try { $t = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1
      if ($t) { $r.cpu = [math]::Round($t.CurrentTemperature / 10 - 273.15, 1) } } catch {}
try { $d = Get-PhysicalDisk -ErrorAction Stop | Get-StorageReliabilityCounter -ErrorAction Stop | Select-Object -First 1
      if ($d -and $d.Temperature) { $r.ssd = [double]$d.Temperature } } catch {}
$r | ConvertTo-Json -Compress
"""


def classify(kind, temp):
    """'ok', 'warn' (alto), 'crit' ou 'off' (sem leitura)."""
    if temp is None:
        return "off"
    warn, crit = LIMITS.get(kind, LIMITS["cpu"])
    if temp >= crit:
        return "crit"
    if temp >= warn:
        return "warn"
    return "ok"


def classifyFan(rpm):
    if rpm is None:
        return "off"
    if rpm >= FAN_LIMITS[1]:
        return "crit"
    if rpm >= FAN_LIMITS[0]:
        return "warn"
    return "ok"


def _plausible(value):
    return isinstance(value, (int, float)) and 5 <= value <= 120


def _psutil_temperatures():
    """Processador e disco pelo Psutil (Linux). Devolve (cpu, ssd, ventoinhas)."""
    cpu = ssd = None
    fans = []
    sensors = getattr(psutil, "sensors_temperatures", None)
    if sensors:
        try:
            data = sensors() or {}
        except (OSError, RuntimeError):
            data = {}
        for name in ("coretemp", "k10temp", "zenpower", "cpu_thermal", "cpu-thermal", "acpitz"):
            readings = [r.current for r in data.get(name, []) if _plausible(r.current)]
            if readings:
                cpu = max(readings)
                break
        nvme = [r.current for r in data.get("nvme", []) if _plausible(r.current)]
        if nvme:
            ssd = max(nvme)
    fan_reader = getattr(psutil, "sensors_fans", None)
    if fan_reader:
        try:
            for name, readings in (fan_reader() or {}).items():
                for index, reading in enumerate(readings):
                    if reading.current and reading.current > 0:
                        label = reading.label or (name if index == 0 else f"{name} {index + 1}")
                        fans.append({"name": label, "rpm": int(reading.current)})
        except (OSError, RuntimeError):
            pass
    return cpu, ssd, fans


def _windows_temperatures():
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", _POWERSHELL],
            capture_output=True,
            text=True,
            timeout=POWERSHELL_TIMEOUT,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        data = json.loads(result.stdout.strip() or "{}")
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        return None, None
    cpu = data.get("cpu") if _plausible(data.get("cpu")) else None
    ssd = data.get("ssd") if _plausible(data.get("ssd")) else None
    return cpu, ssd


def _read():
    gpu = hardwareMonitoring.getGpuUsage()
    fans = []
    if platform.system() == "Windows":
        cpu, ssd = _windows_temperatures()
        source = "Zona térmica do Windows (ACPI)" if cpu is not None else None
    else:
        cpu, ssd, fans = _psutil_temperatures()
        source = "Sensores do sistema" if cpu is not None else None
    gpu_temp = gpu.get("temp") if _plausible(gpu.get("temp")) else None
    rpm = max((fan["rpm"] for fan in fans), default=None)
    entries = {
        "cpu": {"temp": cpu, "state": classify("cpu", cpu), "source": source},
        "ssd": {"temp": ssd, "state": classify("ssd", ssd)},
        "gpu": {"temp": gpu_temp, "state": classify("gpu", gpu_temp), "name": gpu.get("name"), "usage": gpu.get("usage")},
        "fan": {"rpm": rpm, "state": classifyFan(rpm), "fans": fans},
    }
    states = [entry["state"] for entry in entries.values()]
    worst = "crit" if "crit" in states else "warn" if "warn" in states else "ok" if "ok" in states else "off"
    return {
        "supported": worst != "off",
        "worst": worst,
        "limits": {"cpu": LIMITS["cpu"], "ssd": LIMITS["ssd"], "gpu": LIMITS["gpu"], "fan": FAN_LIMITS},
        **entries,
        "note": None if worst != "off" else "Este computador não mostra a temperatura ao Mallard.",
    }


def readTemperatures(force=False):
    """Leitura com cache curto: a tela e a bandeja podem perguntar à vontade sem pesar."""
    with _lock:
        now = time.monotonic()
        if not force and _cache["value"] is not None and now - _cache["at"] < CACHE_SECONDS:
            return _cache["value"]
        try:
            value = _read()
        except Exception as error:  # noqa: BLE001 - sensor nunca pode derrubar o app
            value = {"supported": False, "worst": "off", "note": f"Não foi possível ler os sensores: {error}",
                     "limits": {"cpu": LIMITS["cpu"], "ssd": LIMITS["ssd"], "gpu": LIMITS["gpu"], "fan": FAN_LIMITS},
                     "cpu": {"temp": None, "state": "off", "source": None}, "ssd": {"temp": None, "state": "off"},
                     "gpu": {"temp": None, "state": "off", "name": None, "usage": None}, "fan": {"rpm": None, "state": "off", "fans": []}}
        _cache["at"], _cache["value"] = now, value
        return value
