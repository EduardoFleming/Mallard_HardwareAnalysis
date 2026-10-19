"""Histórico das análises do Consultor (as "pegadas" do Mallard).

Cada análise fica salva com o pedido, a resposta da IA e um retrato das peças
daquele momento, para dar para comparar antes e depois. A chave do Gemini nunca
entra aqui.
"""

import json
import uuid
from datetime import datetime

from settingsStore import _config_path

MAX_ENTRIES = 50


def _history_path():
    return _config_path().with_name("historico.json")


def _snapshot(hardware):
    memory = hardware.get("memoria") or {}
    return {
        "tipo_de_maquina": hardware.get("tipo_de_maquina"),
        "processador": hardware.get("processador"),
        "placas_de_video": hardware.get("placas_de_video"),
        "placa_mae": hardware.get("placa_mae"),
        "memoria_total_gb": memory.get("total_gb"),
        "memoria_uso_percent": memory.get("usage_percent"),
        "discos": hardware.get("discos_detalhes") or [],
        "nivel_regras": (hardware.get("nivel") or {}).get("index"),
    }


def loadHistory():
    path = _history_path()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def _save(entries):
    _history_path().write_text(json.dumps(entries[:MAX_ENTRIES], ensure_ascii=False, indent=2), encoding="utf-8")


def addAnalysis(perfil, preferencias, hardware, result):
    entry = {
        "id": uuid.uuid4().hex[:12],
        "data": datetime.now().isoformat(timespec="minutes"),
        "perfil": perfil,
        "preferencias": preferencias,
        "pecas": _snapshot(hardware),
        "resultado": result,
        "feitos": [False] * len(result.get("recommendations", [])),
    }
    entries = loadHistory()
    entries.insert(0, entry)
    _save(entries)
    return entry


def getAnalysis(entry_id):
    for entry in loadHistory():
        if entry.get("id") == entry_id:
            return entry
    return None


def setUpgradeDone(entry_id, index, done):
    if index < 0 or index >= 3:
        return None
    entries = loadHistory()
    for entry in entries:
        if entry.get("id") == entry_id:
            feitos = entry.setdefault("feitos", [])
            while len(feitos) <= index:
                feitos.append(False)
            feitos[index] = bool(done)
            _save(entries)
            return entry
    return None


def deleteAnalysis(entry_id):
    entries = [entry for entry in loadHistory() if entry.get("id") != entry_id]
    _save(entries)
    return entries
