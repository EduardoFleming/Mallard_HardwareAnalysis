"""Preferências do Mallard salvas em disco.

A chave do Gemini NUNCA é gravada aqui: ela fica só na memória enquanto o app
está aberto. Este arquivo guarda apenas escolhas de interface e peças que o
usuário informou à mão.
"""

import json
import os
import shutil
from pathlib import Path

DEFAULTS = {
    "theme": "mallard",
    "reduce_motion": False,
    "unlocked_1972": False,
    "tried_themes": [],
    "manual_parts": {},
    "achievements": {},
}

THEMES = ("mallard", "pekin", "femea", "cinzento", "cayuga", "patinho")
MANUAL_PARTS = ("gpu", "mb")
ACHIEVEMENTS = ("cisne", "ninho")


def _config_path():
    base = os.environ.get("APPDATA") or str(Path.home() / ".config")
    folder = Path(base) / "Mallard"
    folder.mkdir(parents=True, exist_ok=True)
    _migrate_store_python_saves(folder)
    return folder / "config.json"


def _migrate_store_python_saves(destination):
    """Copy saves out of the Microsoft Store Python sandbox when installing the app.

    Store Python redirects %APPDATA% into LocalCache/Roaming. A bundled desktop
    executable is not sandboxed, so it sees the ordinary roaming path instead.
    Copy missing files only and leave the original saves in place as a backup.
    """
    local_app_data = os.environ.get("LOCALAPPDATA")
    if os.name != "nt" or not local_app_data:
        return

    roots = Path(local_app_data) / "Packages"
    if not roots.is_dir():
        return

    legacy_folders = sorted(
        roots.glob("PythonSoftwareFoundation.Python.*/LocalCache/Roaming/Mallard"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for name in ("config.json", "historico.json"):
        target = destination / name
        if target.exists():
            continue
        for legacy_folder in legacy_folders:
            source = legacy_folder / name
            if source.is_file():
                try:
                    shutil.copy2(source, target)
                except OSError:
                    # Do not prevent app startup if a sandbox file is inaccessible.
                    pass
                break


def _clean(data):
    """Mantém só campos conhecidos e com o tipo certo."""
    settings = json.loads(json.dumps(DEFAULTS))
    if not isinstance(data, dict):
        return settings
    if data.get("theme") in THEMES:
        settings["theme"] = data["theme"]
    for field in ("reduce_motion", "unlocked_1972"):
        if isinstance(data.get(field), bool):
            settings[field] = data[field]
    if isinstance(data.get("tried_themes"), list):
        settings["tried_themes"] = [item for item in data["tried_themes"] if item in THEMES]
    if isinstance(data.get("manual_parts"), dict):
        settings["manual_parts"] = {
            key: str(value).strip()[:120]
            for key, value in data["manual_parts"].items()
            if key in MANUAL_PARTS and str(value).strip()
        }
    if isinstance(data.get("achievements"), dict):
        settings["achievements"] = {
            key: True for key, value in data["achievements"].items() if key in ACHIEVEMENTS and value is True
        }
    if settings["theme"] == "patinho" and not settings["unlocked_1972"]:
        settings["theme"] = "mallard"
    return settings


def loadSettings():
    path = _config_path()
    if not path.exists():
        return _clean({})
    try:
        return _clean(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError):
        return _clean({})


def saveSettings(changes):
    """Aplica as mudanças sobre o que já está salvo e devolve o resultado."""
    current = loadSettings()
    if isinstance(changes, dict):
        current.update(changes)
    cleaned = _clean(current)
    _config_path().write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    return cleaned
