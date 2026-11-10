"""Programas que abrem sozinhos junto com o Windows (aba Inicialização).

O Mallard só LÊ a lista e liga/desliga cada item do mesmo jeito que o Gerenciador
de Tarefas faz (chave StartupApproved do usuário). Nada é desinstalado nem apagado,
e só o que pertence ao usuário atual pode ser alterado: itens da máquina inteira
(HKLM) aparecem como "Do sistema".
"""

import os
import platform
import struct
import time
from pathlib import Path

import psutil

RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
APPROVED_RUN = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
APPROVED_FOLDER = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder"

# Tempo que o Windows leva sozinho até começar a abrir os programas do usuário (estimativa).
BASE_SECONDS = 30

# Programas conhecidos: nome amigável, dica em linguagem simples, impacto, segundos e memória estimados.
# "suggest" marca os que costumam poder esperar sem prejuízo.
KNOWN = {
    "teams": ("Microsoft Teams", "Pode abrir só quando tiver reunião", "Alto", 9, 450, True),
    "steam": ("Steam", "Abre sozinho quando você for jogar", "Alto", 8, 300, True),
    "discord": ("Discord", "Mantenha se você conversa o dia todo", "Médio", 5, 350, False),
    "onedrive": ("OneDrive", "Sincroniza seus arquivos na nuvem", "Médio", 5, 120, False),
    "spotify": ("Spotify", "Pode desligar sem perder nada", "Médio", 4, 180, True),
    "adobe": ("Adobe Updater", "Procura atualizações; dá para fazer depois", "Baixo", 2, 60, True),
    "acrobat": ("Adobe Updater", "Procura atualizações; dá para fazer depois", "Baixo", 2, 60, True),
    "epicgames": ("Epic Games", "Abre sozinho quando você for jogar", "Alto", 7, 250, True),
    "skype": ("Skype", "Pode abrir só quando você chamar alguém", "Médio", 5, 200, True),
    "zoom": ("Zoom", "Pode abrir só quando tiver reunião", "Médio", 4, 150, True),
    "whatsapp": ("WhatsApp", "Mantenha se você usa o dia todo", "Médio", 4, 200, False),
    "googledrive": ("Google Drive", "Sincroniza seus arquivos na nuvem", "Médio", 4, 150, False),
    "dropbox": ("Dropbox", "Sincroniza seus arquivos na nuvem", "Médio", 4, 150, False),
    "realtek": ("Áudio Realtek", "Melhor manter: controla o som", "Baixo", 1, 20, False),
    "securityhealth": ("Segurança do Windows", "Proteção do sistema, sempre liga", "Baixo", 1, 200, False),
    "windowsdefender": ("Segurança do Windows", "Proteção do sistema, sempre liga", "Baixo", 1, 200, False),
}

# O que nunca deve ser desligado por aqui.
PROTECTED = ("securityhealth", "windowsdefender", "defender")

_ENABLED = struct.pack("<I", 2) + b"\x00" * 8
_FIX = {"Alto": 0, "Médio": 1, "Baixo": 2}


def isSupported():
    return platform.system() == "Windows"


def _clean_name(raw):
    return "".join(ch for ch in str(raw).lower() if ch.isalnum())


def _lookup(name, command):
    key_text = _clean_name(name) + " " + _clean_name(command)
    for key, value in KNOWN.items():
        if key in key_text:
            return key, value
    return None, None


def _exe_path(command):
    """Extrai o caminho do programa de uma linha de comando do registro."""
    text = str(command or "").strip()
    if text.startswith('"'):
        end = text.find('"', 1)
        return text[1:end] if end > 0 else text.strip('"')
    lower = text.lower()
    cut = lower.find(".exe")
    return text[: cut + 4] if cut >= 0 else text.split(" ")[0]


def _estimate_from_file(path):
    """Sem informação sobre o programa: usa o tamanho do arquivo como pista (só uma estimativa)."""
    try:
        size_mb = os.path.getsize(path) / (1024 * 1024)
    except OSError:
        return "Baixo", 2, None
    if size_mb >= 150:
        return "Alto", 8, None
    if size_mb >= 40:
        return "Médio", 4, None
    return "Baixo", 2, None


def _running_memory_mb(exe):
    """Memória que o programa está usando agora, se ele estiver aberto."""
    name = Path(exe).name.lower()
    if not name:
        return None
    total = 0
    found = False
    for proc in psutil.process_iter(["name", "memory_info"]):
        try:
            if (proc.info["name"] or "").lower() == name and proc.info["memory_info"]:
                total += proc.info["memory_info"].rss
                found = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return round(total / (1024 * 1024)) if found else None


def _read_run_entries():
    """Lê as chaves Run do usuário (alteráveis) e da máquina (só leitura)."""
    import winreg

    entries = []
    for hive, label, locked in ((winreg.HKEY_CURRENT_USER, "user", False), (winreg.HKEY_LOCAL_MACHINE, "machine", True)):
        try:
            with winreg.OpenKey(hive, RUN_KEY) as key:
                index = 0
                while True:
                    try:
                        name, command, _ = winreg.EnumValue(key, index)
                    except OSError:
                        break
                    index += 1
                    entries.append({"source": label, "name": name, "command": str(command), "locked": locked})
        except OSError:
            continue
    return entries


def _read_folder_entries():
    folder = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
    entries = []
    try:
        for item in folder.iterdir():
            if item.is_file() and item.suffix.lower() in (".lnk", ".url", ".exe", ".bat", ".cmd") and item.name.lower() != "desktop.ini":
                entries.append({"source": "folder", "name": item.stem, "command": str(item), "locked": False})
    except OSError:
        pass
    return entries


def _approved_path(source):
    return APPROVED_FOLDER if source == "folder" else APPROVED_RUN


def _is_enabled(entry):
    """O Windows guarda o estado em StartupApproved: o primeiro byte par (2, 6) é ligado, ímpar (3) é desligado."""
    import winreg

    value_name = entry["name"] + (".lnk" if entry["source"] == "folder" and not entry["name"].lower().endswith(".lnk") else "")
    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        try:
            with winreg.OpenKey(hive, _approved_path(entry["source"])) as key:
                data, _ = winreg.QueryValueEx(key, value_name)
                if data:
                    return data[0] % 2 == 0
        except OSError:
            continue
    return True


def _value_name(entry):
    if entry["source"] == "folder":
        for ext in (".lnk", ".url", ".exe", ".bat", ".cmd"):
            if Path(entry["command"]).suffix.lower() == ext:
                return Path(entry["command"]).name
    return entry["name"]


def _item_id(entry):
    return f'{entry["source"]}:{entry["name"]}'


def listItems():
    """Devolve {"supported", "base_seconds", "items"}; cada item já traz impacto e estado."""
    if not isSupported():
        return {"supported": False, "base_seconds": BASE_SECONDS, "items": []}
    items = []
    for entry in _read_run_entries() + _read_folder_entries():
        key, known = _lookup(entry["name"], entry["command"])
        exe = _exe_path(entry["command"])
        if known:
            friendly, hint, impact, seconds, memory, suggest = known
            memory_now = _running_memory_mb(exe)
            memory = memory_now if memory_now is not None else memory
        else:
            friendly, hint = entry["name"], "Programa instalado por você ou por outro programa"
            impact, seconds, memory = _estimate_from_file(exe)
            memory = _running_memory_mb(exe)
            suggest = False
        protected = key in PROTECTED or any(word in _clean_name(entry["name"]) for word in PROTECTED)
        items.append({
            "id": _item_id(entry),
            "name": friendly,
            "hint": hint,
            "impact": impact,
            "seconds": seconds,
            "memory_mb": memory,
            "enabled": _is_enabled(entry),
            "locked": bool(entry["locked"] or protected),
            "suggest": bool(suggest) and not (entry["locked"] or protected),
            "source": entry["source"],
        })
    items.sort(key=lambda item: (_FIX.get(item["impact"], 3), -item["seconds"], item["name"].lower()))
    return {"supported": True, "base_seconds": BASE_SECONDS, "items": items}


def setEnabled(item_id, enabled):
    """Liga ou desliga um item do usuário. Devolve a lista atualizada."""
    if not isSupported():
        return listItems()
    import winreg

    source, _, name = str(item_id).partition(":")
    if source not in ("user", "folder"):
        return listItems()
    entries = [e for e in _read_run_entries() + _read_folder_entries() if e["source"] == source and e["name"] == name]
    if not entries:
        return listItems()
    entry = entries[0]
    if any(word in _clean_name(entry["name"]) for word in PROTECTED):
        return listItems()
    if enabled:
        data = _ENABLED
    else:
        # Desligado: 3 + a hora atual no formato FILETIME (é o que o Windows grava).
        filetime = int((time.time() + 11644473600) * 10_000_000)
        data = struct.pack("<I", 3) + struct.pack("<Q", filetime)
    path = _approved_path(source)
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, path) as key:
        winreg.SetValueEx(key, _value_name(entry), 0, winreg.REG_BINARY, data)
    return listItems()
