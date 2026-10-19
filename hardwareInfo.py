import json
import platform
import shlex
import subprocess
from pathlib import Path

import psutil


def _windows_wmi():
    if platform.system() != "Windows":
        return None, None
    try:
        import pythoncom
        import wmi

        pythoncom.CoInitialize()
        return wmi.WMI(), pythoncom
    except Exception:
        return None, None


def _linux_cpu_name():
    cpuinfo = Path("/proc/cpuinfo")
    try:
        for line in cpuinfo.read_text(errors="ignore").splitlines():
            if line.lower().startswith(("model name", "hardware")):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return ""


def getCpuInfo():
    if platform.system() == "Windows":
        client, _ = _windows_wmi()
        try:
            if client:
                processors = client.Win32_Processor()
                if processors:
                    return processors[0].Name.strip()
        except Exception:
            pass
    return platform.processor() or _linux_cpu_name() or "Não identificado pelo sistema"


def getGpuInfo():
    system = platform.system()
    if system == "Windows":
        client, _ = _windows_wmi()
        try:
            if client:
                devices = client.Win32_VideoController()
                names = [device.Name.strip() for device in devices if device.Name]
                if names:
                    return ", ".join(names)
        except Exception:
            pass
    elif system == "Darwin":
        try:
            result = subprocess.run(
                ["system_profiler", "SPDisplaysDataType", "-json"],
                capture_output=True,
                text=True,
                timeout=8,
                check=True,
            )
            displays = json.loads(result.stdout).get("SPDisplaysDataType", [])
            names = [item.get("sppci_model") for item in displays if item.get("sppci_model")]
            if names:
                return ", ".join(names)
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
            pass
    elif system == "Linux":
        try:
            result = subprocess.run(
                ["lspci", "-mm"], capture_output=True, text=True, timeout=5, check=True
            )
            names = []
            for line in result.stdout.splitlines():
                parts = shlex.split(line)
                if len(parts) >= 3 and parts[1] in {
                    "VGA compatible controller",
                    "3D controller",
                    "Display controller",
                }:
                    names.append(" ".join(parts[2:]))
            if names:
                return ", ".join(names)
        except (OSError, subprocess.SubprocessError, IndexError):
            pass
    return "Não identificado (pode ser informado manualmente)"


def getMotherboardInfo():
    system = platform.system()
    if system == "Windows":
        client, _ = _windows_wmi()
        try:
            if client:
                boards = client.Win32_BaseBoard()
                if boards:
                    manufacturer = (boards[0].Manufacturer or "").strip()
                    product = (boards[0].Product or "").strip()
                    return f"{manufacturer} {product}".strip() or "Não identificado"
        except Exception:
            pass
    elif system == "Linux":
        fields = ("board_vendor", "board_name")
        values = []
        for field in fields:
            try:
                values.append(Path(f"/sys/devices/virtual/dmi/id/{field}").read_text().strip())
            except OSError:
                values.append("")
        if any(values):
            return " ".join(value for value in values if value)
    return "Não identificado automaticamente; confirme o modelo antes de comprar peças"


def getRamInfo():
    memory = psutil.virtual_memory()
    return {
        "total_gb": round(memory.total / (1024**3), 2),
        "available_gb": round(memory.available / (1024**3), 2),
        "usage_percent": memory.percent,
    }


def getRamDetails():
    """Retorna detalhes físicos quando WMI está disponível; não inventa dados ausentes."""
    client, _ = _windows_wmi()
    if not client:
        return "Quantidade detectada pelo sistema; tipo, frequência e módulos não disponíveis"
    try:
        modules = client.Win32_PhysicalMemory()
        details = []
        for module in modules:
            capacity = round(int(module.Capacity) / (1024**3), 2)
            speed = getattr(module, "ConfiguredClockSpeed", None) or getattr(module, "Speed", None)
            details.append(f"{capacity} GB" + (f" a {speed} MHz" if speed else ""))
        return ", ".join(details) if details else "Módulos não identificados"
    except Exception:
        return "Detalhes dos módulos não identificados"


def getDiskInfo():
    disks = []
    for partition in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(partition.mountpoint)
        except (PermissionError, OSError):
            continue
        disks.append(
            f"{partition.device or partition.mountpoint}: "
            f"{usage.total / (1024**3):.1f} GB total, "
            f"{usage.percent}% usado"
        )
    return disks


def getSystemInfo():
    return {
        "operating_system": f"{platform.system()} {platform.release()}",
        "architecture": platform.machine(),
        "logical_cpu_cores": psutil.cpu_count(logical=True),
        "physical_cpu_cores": psutil.cpu_count(logical=False),
    }


_NOTEBOOK_CHASSIS = {8, 9, 10, 14, 30, 31, 32}
_DESKTOP_CHASSIS = {3, 4, 5, 6, 7, 13, 15, 16, 24, 35, 36}


def getDeviceType():
    """Heurística simples de notebook/desktop baseada em WMI ou bateria."""
    if platform.system() == "Windows":
        client, _ = _windows_wmi()
        try:
            if client:
                for enclosure in client.Win32_SystemEnclosure():
                    chassis_types = set(enclosure.ChassisTypes or [])
                    if chassis_types & _NOTEBOOK_CHASSIS:
                        return "notebook"
                    if chassis_types & _DESKTOP_CHASSIS:
                        return "desktop"
        except Exception:
            pass
    try:
        battery = psutil.sensors_battery()
    except Exception:
        battery = None
    return "notebook" if battery is not None else "desktop"


def getDiskDetails():
    disks = []
    for partition in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(partition.mountpoint)
        except (PermissionError, OSError):
            continue
        disks.append({
            "device": (partition.device or partition.mountpoint).rstrip("\\/"),
            "total_gb": round(usage.total / (1024**3), 1),
            "used_gb": round(usage.used / (1024**3), 1),
            "free_gb": round(usage.free / (1024**3), 1),
            "percent": usage.percent,
        })
    return disks
