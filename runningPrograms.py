"""Quem está usando a memória agora (cartão "Quem está enchendo a lagoa" do Monitor).

Agrupa os processos pelo nome do programa (o Chrome tem dezenas de processos) e devolve os
maiores. Fechar um programa pede para ele encerrar (terminate), nunca força o fim, e programas
do sistema ou do próprio Mallard ficam protegidos.
"""

import os
import sys

import psutil

# Programas que não devem ser fechados pelo usuário nesta tela.
PROTECTED = {
    "system", "system idle process", "registry", "memory compression", "smss", "csrss", "wininit", "winlogon", "services",
    "lsass", "svchost", "dwm", "fontdrvhost", "explorer", "searchhost", "startmenuexperiencehost", "shellexperiencehost",
    "msmpeng", "securityhealthservice", "securityhealthsystray", "nissrv", "sihost", "taskhostw", "ctfmon", "audiodg",
    "wudfhost", "spoolsv", "runtimebroker", "conhost", "dllhost", "systemd", "init", "kthreadd", "launchd", "windowserver",
    "python", "pythonw", "mallard", "webview2", "msedgewebview2",
}
FRIENDLY = {
    "chrome": "Google Chrome", "msedge": "Microsoft Edge", "firefox": "Firefox", "brave": "Brave", "discord": "Discord",
    "spotify": "Spotify", "steam": "Steam", "steamwebhelper": "Steam", "code": "Visual Studio Code", "teams": "Microsoft Teams",
    "ms-teams": "Microsoft Teams", "slack": "Slack", "whatsapp": "WhatsApp", "onedrive": "OneDrive", "outlook": "Outlook",
    "excel": "Excel", "winword": "Word", "powerpnt": "PowerPoint", "msmpeng": "Windows Defender",
}


def _key(name):
    return (name or "").rsplit(".", 1)[0].strip().lower()


def _is_mine(proc):
    """Só processos do próprio usuário podem ser fechados."""
    try:
        return proc.username().split("\\")[-1].lower() == (os.environ.get("USERNAME") or os.environ.get("USER") or "").lower()
    except (psutil.Error, OSError):
        return False


def _protected(key):
    return key in PROTECTED or key == _key(os.path.basename(sys.executable))


def topPrograms(limit=5):
    """[{name, key, memory_mb, share, closable, protected}] com os programas que mais usam memória."""
    groups = {}
    for proc in psutil.process_iter(["name", "memory_info"]):
        try:
            key = _key(proc.info["name"])
            mem = proc.info["memory_info"].rss if proc.info["memory_info"] else 0
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        if not key or key in ("system idle process", "memory compression", "registry"):
            continue
        entry = groups.setdefault(key, {"bytes": 0, "mine": True, "raw": proc.info["name"] or key})
        entry["bytes"] += mem
    ranked = sorted(groups.items(), key=lambda item: -item[1]["bytes"])[:limit]
    top = ranked[0][1]["bytes"] if ranked else 1
    out = []
    for key, data in ranked:
        protected = _protected(key)
        out.append({
            "key": key,
            "name": FRIENDLY.get(key) or (data["raw"].rsplit(".", 1)[0] or key).capitalize(),
            "memory_mb": round(data["bytes"] / 1024 ** 2),
            "share": round(100 * data["bytes"] / max(1, top)),
            "protected": protected,
            "closable": not protected,
        })
    return out


def closeProgram(key):
    """Pede para o programa encerrar. Devolve {closed, skipped} (quantos processos aceitaram o pedido)."""
    key = _key(key)
    if not key or _protected(key):
        return {"closed": 0, "skipped": 0, "refused": True}
    closed = skipped = 0
    for proc in psutil.process_iter(["name"]):
        try:
            if _key(proc.info["name"]) != key:
                continue
            if not _is_mine(proc):
                skipped += 1
                continue
            proc.terminate()
            closed += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            skipped += 1
    return {"closed": closed, "skipped": skipped, "refused": False}
