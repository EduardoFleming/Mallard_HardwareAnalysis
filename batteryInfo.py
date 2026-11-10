"""Saúde da bateria do notebook (aba Bateria).

Carga atual e energia vêm do psutil. A capacidade de fábrica, a capacidade de hoje e
os ciclos vêm do relatório de bateria do Windows (powercfg), que não pede administrador.
Em desktop não existe bateria, então a aba só aparece em notebooks.
"""

import os
import platform
import re
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from datetime import datetime

import psutil

_CACHE = {"at": 0, "data": None}
_CACHE_SECONDS = 600  # o relatório demora alguns segundos: guarda por 10 minutos


def hasBattery():
    try:
        return psutil.sensors_battery() is not None
    except (AttributeError, NotImplementedError, OSError):
        return False


def _mwh(text):
    match = re.search(r"\d+", str(text or ""))
    return int(match.group(0)) if match else None


def _strip_ns(root):
    for element in root.iter():
        if "}" in element.tag:
            element.tag = element.tag.split("}", 1)[1]
    return root


def _read_report():
    """Roda `powercfg /batteryreport` e devolve capacidades, ciclos e histórico mensal."""
    if platform.system() != "Windows":
        return None
    path = os.path.join(tempfile.gettempdir(), "mallard-battery.xml")
    try:
        subprocess.run(
            ["powercfg", "/batteryreport", "/xml", "/output", path],
            capture_output=True, timeout=25, check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        root = _strip_ns(ET.parse(path).getroot())
    except (OSError, subprocess.SubprocessError, ET.ParseError):
        return None
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    battery = root.find(".//Batteries/Battery")
    if battery is None:
        return None
    design = _mwh(battery.findtext("DesignCapacity"))
    full = _mwh(battery.findtext("FullChargeCapacity"))
    cycles = _mwh(battery.findtext("CycleCount"))
    history = []
    # O relatório traz o histórico de capacidade em elementos com o atributo FullChargeCapacity;
    # procurar por esse atributo funciona nas versões do Windows que mudam o nome da tag.
    for entry in root.iter():
        value = _mwh(entry.get("FullChargeCapacity"))
        start = entry.get("StartDate") or entry.get("Start") or entry.get("StartTime") or ""
        if start and value:
            history.append({"date": start[:10], "wh": round(value / 1000, 1)})
    return {"design_wh": round(design / 1000, 1) if design else None, "full_wh": round(full / 1000, 1) if full else None,
            "cycles": cycles, "history": history}


def _history_labels(history, now_wh):
    """Reduz o histórico a até 12 pontos mensais com rótulos curtos (ex.: "out/2025")."""
    months = ("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")
    by_month = {}
    for point in history:
        try:
            date = datetime.strptime(point["date"], "%Y-%m-%d")
        except ValueError:
            continue
        by_month[(date.year, date.month)] = point["wh"]
    series = [{"label": f"{months[m - 1]}/{y}", "wh": wh} for (y, m), wh in sorted(by_month.items())][-12:]
    if series and now_wh:
        series[-1] = {"label": "hoje", "wh": now_wh}
    return series


def _top_drainers():
    """Quem mais usa o processador agora, como pista de quem gasta bateria (é uma estimativa)."""
    totals = {}
    for proc in psutil.process_iter(["name", "cpu_percent"]):
        try:
            name = (proc.info["name"] or "").rsplit(".", 1)[0]
            cpu = proc.info["cpu_percent"] or 0
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        if name and name.lower() not in ("system idle process", "idle", "system"):
            totals[name] = totals.get(name, 0) + cpu
    total = sum(totals.values()) or 1
    ranked = sorted(totals.items(), key=lambda item: -item[1])[:3]
    return [{"name": name, "percent": round(100 * value / total)} for name, value in ranked if value > 0]


def getBattery(refresh=False):
    """{"supported": False} em desktop; em notebook, os números para a tela."""
    if not hasBattery():
        return {"supported": False}
    status = psutil.sensors_battery()
    now = time.time()
    if refresh or not _CACHE["data"] or now - _CACHE["at"] > _CACHE_SECONDS:
        _CACHE["data"] = _read_report() or {}
        _CACHE["at"] = now
    report = _CACHE["data"]
    design, full = report.get("design_wh"), report.get("full_wh")
    health = round(100 * full / design) if design and full else None
    return {
        "supported": True,
        "percent": round(status.percent),
        "plugged": bool(status.power_plugged),
        "design_wh": design,
        "full_wh": full,
        "cycles": report.get("cycles"),
        "health_percent": health,
        "history": _history_labels(report.get("history") or [], full),
        "drain": _top_drainers(),
        "has_report": bool(report),
    }
