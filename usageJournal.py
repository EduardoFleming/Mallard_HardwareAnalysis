"""Diário do PC: anota, a cada minuto em que o Mallard está aberto, como o computador se comportou.

Cada dia vira um humor (Tranquilo, Atento, Memória cheia, Travou), uma pequena história
e os horários importantes. Tudo fica em journal.json, ao lado das configurações, só no
computador do usuário. O diário só anota enquanto o Mallard está aberto.
"""

import json
import os
import threading
import time
from datetime import date, datetime, timedelta

import psutil

import settingsStore

SAMPLE_SECONDS = 60
KEEP_DAYS = 90
HIGH = 90      # % de memória: "cheia"
FREEZE = 97    # % de memória: o PC provavelmente travou
CALM = 80      # abaixo disso, a memória voltou ao normal
MAX_EVENTS = 12

WEEKDAYS = ("Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom")
WEEKDAYS_FULL = ("Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo")
FRIENDLY = {"chrome": "Chrome", "msedge": "Edge", "firefox": "Firefox", "brave": "Brave", "discord": "Discord",
            "teams": "Teams", "ms-teams": "Teams", "steam": "Steam", "spotify": "Spotify", "code": "VS Code",
            "onedrive": "OneDrive", "explorer": "Explorador de Arquivos", "opera": "Opera"}

_lock = threading.Lock()
_state = {"high": False, "freeze": False}
_sampler = {"thread": None}


# ---------------------------------------------------------------------------
# Armazenamento
# ---------------------------------------------------------------------------
def _path():
    return settingsStore._config_path().parent / "journal.json"


def _load():
    try:
        data = json.loads(_path().read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save(data):
    cutoff = (date.today() - timedelta(days=KEEP_DAYS)).isoformat()
    data = {key: value for key, value in data.items() if key >= cutoff}
    path = _path()
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    os.replace(temp, path)


# ---------------------------------------------------------------------------
# Anotação
# ---------------------------------------------------------------------------
def _friendly(name):
    base = str(name or "").lower().rsplit(".", 1)[0]
    return FRIENDLY.get(base, base.capitalize() if base else "")


def _top_process():
    """O programa que mais usa memória agora (nome amigável e GB)."""
    best, best_rss = None, 0
    totals = {}
    for proc in psutil.process_iter(["name", "memory_info"]):
        try:
            rss = proc.info["memory_info"].rss if proc.info["memory_info"] else 0
            name = _friendly(proc.info["name"])
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        if name:
            totals[name] = totals.get(name, 0) + rss
    for name, rss in totals.items():
        if rss > best_rss:
            best, best_rss = name, rss
    return best, round(best_rss / (1024 ** 3), 1)


def _system_disk():
    root = os.environ.get("SystemDrive", "C:") + "\\" if os.name == "nt" else "/"
    try:
        usage = psutil.disk_usage(root)
        return round(usage.used / 1024 ** 3, 1), round(usage.total / 1024 ** 3, 1)
    except OSError:
        return None, None


def _add_event(day, when, text, kind):
    if len(day["events"]) < MAX_EVENTS:
        day["events"].append([when, text, kind])


def recordSample(now=None, ram=None, cpu=None, top=None, disk=None):
    """Anota uma leitura. Os parâmetros existem para poder testar sem depender do computador."""
    now = now or datetime.now()
    if ram is None:
        ram = psutil.virtual_memory().percent
    if cpu is None:
        cpu = psutil.cpu_percent(interval=None)
    if top is None:
        top = _top_process()
    if disk is None:
        disk = _system_disk()
    hhmm = now.strftime("%H:%M")
    key = now.date().isoformat()
    with _lock:
        data = _load()
        day = data.setdefault(key, {"n": 0, "ram_peak": 0, "ram_sum": 0, "cpu_peak": 0, "hours": {}, "events": [], "top": {},
                                    "freezes": 0, "high_minutes": 0, "disk_used": None, "disk_total": None})
        first = day["n"] == 0
        day["n"] += 1
        day["ram_peak"] = max(day["ram_peak"], round(ram, 1))
        day["ram_sum"] = round(day["ram_sum"] + ram, 1)
        day["cpu_peak"] = max(day["cpu_peak"], round(cpu, 1))
        hour = day["hours"].setdefault(str(now.hour), [0, 0])
        hour[0] = round(hour[0] + ram, 1)
        hour[1] += 1
        if disk and disk[0]:
            day["disk_used"], day["disk_total"] = disk
        name, gb = top if top else (None, 0)
        if name and ram >= HIGH:
            day["top"][name] = day["top"].get(name, 0) + 1

        if first:
            boot = datetime.fromtimestamp(psutil.boot_time())
            if boot.date() == now.date():
                _add_event(day, boot.strftime("%H:%M"), "Ligou o PC", "ok")
            else:
                _add_event(day, hhmm, "O pato começou a anotar o dia", "ok")
        if ram >= HIGH:
            day["high_minutes"] += SAMPLE_SECONDS // 60
            if not _state["high"]:
                _state["high"] = True
                extra = f" ({name} usa {str(gb).replace('.', ',')} GB)" if name and gb else ""
                _add_event(day, hhmm, "Memória passou de 90%" + extra, "dificil")
        elif ram < CALM and _state["high"]:
            _state["high"] = False
            _state["freeze"] = False
            _add_event(day, hhmm, "Voltou ao normal", "ok")
        if ram >= FREEZE and not _state["freeze"]:
            _state["freeze"] = True
            day["freezes"] += 1
            _add_event(day, hhmm, f"Memória em {round(ram)}%: o PC provavelmente travou", "travou")
        _save(data)


def _loop(interval):
    while True:
        try:
            recordSample()
        except Exception:  # noqa: BLE001 - o diário nunca pode derrubar o app
            pass
        time.sleep(interval)


def startSampler(interval=SAMPLE_SECONDS):
    """Liga a anotação em segundo plano (uma vez só)."""
    if _sampler["thread"] and _sampler["thread"].is_alive():
        return
    thread = threading.Thread(target=_loop, args=(interval,), daemon=True, name="mallard-diario")
    _sampler["thread"] = thread
    thread.start()


# ---------------------------------------------------------------------------
# Leitura: dias da semana, histórias e o que o pato aprendeu
# ---------------------------------------------------------------------------
def _mood(peak):
    if peak >= FREEZE:
        return "travou"
    if peak >= HIGH:
        return "dificil"
    if peak >= 75:
        return "atento"
    return "ok"


def _story(mood, day, top_name):
    peak = round(day["ram_peak"])
    avg = round(day["ram_sum"] / max(1, day["n"]))
    minutes = day.get("high_minutes", 0)
    hours_text = f"cerca de {max(1, round(minutes / 60))} h" if minutes >= 60 else f"uns {minutes} min"
    app = f" com {top_name} aberto" if top_name else ""
    if mood == "ok":
        return f"Dia tranquilo. A memória nunca passou de {peak}% e ficou em {avg}% na maior parte do tempo."
    if mood == "atento":
        return f"Dia de uso mais puxado{app}. A memória chegou a {peak}%, mas o PC deu conta."
    if mood == "dificil":
        return f"A memória ficou cheia por {hours_text}{app}. Chegou a {peak}%: o PC fica lento, mas não chegou a travar."
    n = day.get("freezes", 1)
    times = "uma vez" if n == 1 else f"{n} vezes"
    return f"A memória encheu de vez{app} e o PC provavelmente travou {times}. O pico foi de {peak}%."


def _tip(mood, top_name):
    if mood == "ok":
        return "Dias assim são o normal do seu PC. Ótimo!"
    if mood == "atento":
        return "Tudo certo, mas sem muita folga. Mais memória daria espaço para respirar."
    if mood == "dificil":
        who = top_name or "o programa que mais pesa"
        return f"Fechar {who} e abrir de novo costuma liberar a memória que ele segura."
    return "Esse é o sinal mais claro de que falta memória RAM. Veja quanto 16 GB resolveriam no Simulador."


def _day_payload(day_date, record, today):
    weekday = day_date.weekday()
    base = {"date": day_date.isoformat(), "label": WEEKDAYS[weekday], "full": WEEKDAYS_FULL[weekday],
            "short_date": day_date.strftime("%d/%m"), "today": day_date == today, "future": day_date > today}
    if base["future"]:
        return base
    if not record or not record.get("n"):
        base["empty"] = True
        return base
    top = record.get("top") or {}
    top_name = max(top, key=top.get) if top else None
    mood = _mood(record["ram_peak"])
    events = sorted(record.get("events", []), key=lambda e: e[0])
    base.update({"mood": mood, "peak": round(record["ram_peak"]), "story": _story(mood, record, top_name),
                 "tip": _tip(mood, top_name), "events": events, "minutes": record["n"]})
    return base


def _insights(days_payload, records, everything):
    """Até 3 conclusões da semana, em linguagem simples, cada uma com um botão para resolver."""
    out = []
    # 1) Horário em que a memória costuma encher.
    hours = {}
    for rec in records:
        for h, (total, count) in (rec.get("hours") or {}).items():
            if count:
                hours.setdefault(int(h), []).append(total / count)
    hot = sorted(h for h, values in hours.items() if len(values) >= 2 and sum(values) / len(values) >= 85)
    if hot:
        top = {}
        for rec in records:
            for name, count in (rec.get("top") or {}).items():
                top[name] = top.get(name, 0) + count
        who = ", ".join(sorted(top, key=top.get, reverse=True)[:2])
        out.append({"kind": "warn", "title": "A memória enche num horário fixo",
                    "text": f"Entre {hot[0]}h e {hot[-1] + 1}h" + (f", com {who} abertos," if who else ",") + " ela passa de 85% em mais de um dia.",
                    "action": {"label": "Ver quem está usando", "page": "monitor"}})
    # 2) Travadas.
    freezes = sum(rec.get("freezes", 0) for rec in records)
    if freezes:
        names = [d["full"].lower() for d in days_payload if d.get("mood") == "travou"]
        out.append({"kind": "crit", "title": "O PC travou 1 vez" if freezes == 1 else f"O PC travou {freezes} vezes",
                    "text": ("Foi na " if len(names) == 1 else "Aconteceu em ") + ", ".join(names) + ", com a memória cheia. Mais memória RAM resolveria.",
                    "action": {"label": "Testar 16 GB no Simulador", "page": "simulator"}})
    # 3) Ritmo do disco (precisa de alguns dias de histórico).
    disk = [(k, v["disk_used"], v["disk_total"]) for k, v in sorted(everything.items()) if v.get("disk_used")]
    if len(disk) >= 3:
        d0, d1 = datetime.fromisoformat(disk[0][0]), datetime.fromisoformat(disk[-1][0])
        days = max(1, (d1 - d0).days)
        grow = (disk[-1][1] - disk[0][1]) / days
        free = disk[-1][2] - disk[-1][1]
        if grow > 0.05 and free / grow < 720:
            months = max(1, round(free / grow / 30))
            out.append({"kind": "warn", "title": f"O disco enche em uns {months} {'mês' if months == 1 else 'meses'}",
                        "text": "No ritmo atual, o disco do sistema fica sem espaço. Dá para ganhar tempo limpando o que sobra.",
                        "action": {"label": "Limpar o disco", "page": "cleanup"}})
    # Preenche com uma boa notícia ou um convite ao aprendizado.
    if not out:
        counted = sum(1 for d in days_payload if d.get("mood"))
        if counted >= 3:
            out.append({"kind": "ok", "title": "Semana tranquila", "text": "A memória não passou de 90% e o PC não travou. Nada a fazer por enquanto.",
                        "action": {"label": "Ver o nível do PC", "page": "computer"}})
        else:
            out.append({"kind": "atento", "title": "O pato ainda está aprendendo",
                        "text": "Ele só anota enquanto o Mallard está aberto. Em alguns dias aparecem as primeiras conclusões.",
                        "action": {"label": "Ver o Monitoramento", "page": "monitor"}})
    return out[:3]


def getJournal(week_offset=0, today=None):
    """Os 7 dias de uma semana (0 = esta, 1 = passada), com a história de cada um e as conclusões."""
    today = today or date.today()
    week_offset = max(0, min(int(week_offset or 0), 12))
    monday = today - timedelta(days=today.weekday()) - timedelta(days=7 * week_offset)
    with _lock:
        data = _load()
    days = [_day_payload(monday + timedelta(days=i), data.get((monday + timedelta(days=i)).isoformat()), today) for i in range(7)]
    records = [data[d["date"]] for d in days if d["date"] in data and not d.get("future")]
    start = (monday).isoformat()
    label = "nesta semana" if week_offset == 0 else "na semana passada" if week_offset == 1 else f"há {week_offset} semanas"
    selected = next((i for i in range(6, -1, -1) if days[i].get("mood")), 0)
    return {"days": days, "insights": _insights(days, records, data), "week_label": label, "selected": selected,
            "has_data": bool(records), "week_start": start}
