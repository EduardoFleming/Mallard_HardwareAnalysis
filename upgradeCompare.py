"""Antes e depois do upgrade: compara a semana antes da peça com a semana depois.

Os números vêm do Diário (journal.json), que anota o uso enquanto o Mallard está aberto, e as datas
vêm do Histórico (quando o usuário marcou a peça como feita). Nada aqui usa a IA nem a internet.

Estados de cada peça:
- "waiting": ainda não passaram 7 dias desde a instalação.
- "compared": há dados suficientes dos dois lados e a comparação é mostrada.
- "nodata": passaram os 7 dias, mas o Mallard esteve aberto em poucos dias (de um dos lados).
"""

from datetime import date, datetime, timedelta

import analysisHistory
import usageJournal

WINDOW_DAYS = 7
MIN_DAYS = 3        # dias com anotação, de cada lado, para comparar com algum sentido
MIN_SAMPLES = 20    # leituras (minutos) para um dia contar
HIGH = 90

MONTHS = ("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")


def _short(day):
    return f"{day.day} {MONTHS[day.month - 1]}"


def kindOf(component):
    text = str(component or "").lower()
    if any(word in text for word in ("ram", "memória", "memoria")):
        return "ram"
    if any(word in text for word in ("ssd", "armazen", "disco", "hd", "nvme")):
        return "ssd"
    if any(word in text for word in ("vídeo", "video", "gpu", "placa gráfica")):
        return "gpu"
    return "other"


def _days(data, start, end):
    """Registros dos dias [start, end] que têm leituras suficientes: [(date, record)]."""
    out = []
    day = start
    while day <= end:
        record = data.get(day.isoformat())
        if record and record.get("n", 0) >= MIN_SAMPLES:
            out.append((day, record))
        day += timedelta(days=1)
    return out


def _avg_ram(days):
    total = sum(record["ram_sum"] for _, record in days)
    count = sum(record["n"] for _, record in days)
    return round(total / count, 1) if count else None


def _verdict(before, after, lower_is_better=True, tolerance=0):
    """('better' | 'worse' | 'same')."""
    if before is None or after is None:
        return "same"
    delta = after - before
    if abs(delta) <= tolerance:
        return "same"
    improved = delta < 0 if lower_is_better else delta > 0
    return "better" if improved else "worse"


def _free_percent(record):
    if record and record.get("disk_total"):
        return round(100 * (1 - record["disk_used"] / record["disk_total"]), 1)
    return None


def _rows(kind, before, after):
    high_b = sum(1 for _, r in before if r["ram_peak"] >= HIGH)
    high_a = sum(1 for _, r in after if r["ram_peak"] >= HIGH)
    avg_b, avg_a = _avg_ram(before), _avg_ram(after)
    freeze_b = sum(r.get("freezes", 0) for _, r in before)
    freeze_a = sum(r.get("freezes", 0) for _, r in after)
    cpu_b = max((r["cpu_peak"] for _, r in before), default=None)
    cpu_a = max((r["cpu_peak"] for _, r in after), default=None)
    free_b, free_a = _free_percent(before[-1][1]), _free_percent(after[-1][1])

    memory_rows = [
        {"key": "high_days", "name": "Dias com a memória acima de 90%", "before": f"{high_b} de {len(before)}", "after": f"{high_a} de {len(after)}",
         "verdict": _verdict(high_b / len(before), high_a / len(after), tolerance=0.1)},
        {"key": "ram_avg", "name": "Memória média em uso", "before": f"{round(avg_b)}%", "after": f"{round(avg_a)}%", "verdict": _verdict(avg_b, avg_a, tolerance=3)},
    ]
    freeze_row = {"key": "freezes", "name": "Vezes que o PC travou", "before": str(freeze_b), "after": str(freeze_a), "verdict": _verdict(freeze_b, freeze_a)}
    cpu_row = {"key": "cpu_peak", "name": "Pico do processador", "before": f"{round(cpu_b)}%", "after": f"{round(cpu_a)}%", "verdict": _verdict(cpu_b, cpu_a, tolerance=5)}
    free_row = {"key": "free", "name": "Espaço livre no C:", "before": f"{round(free_b)}%" if free_b is not None else "—",
                "after": f"{round(free_a)}%" if free_a is not None else "—", "verdict": _verdict(free_b, free_a, lower_is_better=False, tolerance=2)}
    if kind == "ssd":
        return [free_row, freeze_row] + memory_rows[:1] + [cpu_row]
    return memory_rows + [freeze_row, cpu_row]


def _headline(rows, kind, name):
    better = sum(1 for r in rows if r["verdict"] == "better")
    worse = sum(1 for r in rows if r["verdict"] == "worse")
    if worse > better:
        return {"tone": "warn", "title": "Ficou mais pesado", "text": "O uso foi maior depois da peça. Costuma ser mudança de rotina (mais programas ou jogos), e não da peça."}
    if better >= 2 and worse == 0:
        top = next(r for r in rows if r["verdict"] == "better")
        return {"tone": "ok", "title": "Valeu a pena", "text": f"{top['name']}: de {top['before']} para {top['after']}. {name} fez diferença no dia a dia."}
    if better == 1 and worse == 0:
        top = next(r for r in rows if r["verdict"] == "better")
        return {"tone": "ok", "title": "Melhorou um pouco", "text": f"{top['name']}: de {top['before']} para {top['after']}. O resto ficou igual."}
    return {"tone": "neutral", "title": "Sem diferença clara", "text": "O uso foi parecido nas duas semanas. Isso é normal quando a peça não era o gargalo do seu dia a dia."}


def getBeforeAfter(today=None, history=None, journal=None):
    """Lista as peças já instaladas e, para cada uma, o estado da comparação."""
    today = today or date.today()
    history = analysisHistory.loadHistory() if history is None else history
    data = usageJournal._load() if journal is None else journal  # noqa: SLF001 - mesmo pacote
    parts = []
    for entry in history:
        done = entry.get("feitos") or []
        dates = entry.get("feitos_em") or []
        recs = (entry.get("resultado") or {}).get("recommendations") or []
        for index, flag in enumerate(done):
            if not flag or index >= len(dates) or not dates[index] or index >= len(recs):
                continue
            try:
                installed = datetime.fromisoformat(dates[index]).date()
            except ValueError:
                continue
            rec = recs[index]
            kind = kindOf(rec.get("component"))
            elapsed = (today - installed).days
            part = {
                "id": f"{entry.get('id')}:{index}", "kind": kind, "name": rec.get("component") or "Peça",
                "change": f"{rec.get('current')} → {rec.get('suggestion')}" if rec.get("current") else str(rec.get("suggestion") or ""),
                "installed": installed.isoformat(), "installed_label": _short(installed), "days": max(0, min(elapsed, WINDOW_DAYS)), "days_needed": WINDOW_DAYS,
            }
            before = _days(data, installed - timedelta(days=WINDOW_DAYS), installed - timedelta(days=1))
            after = _days(data, installed + timedelta(days=1), installed + timedelta(days=WINDOW_DAYS))
            if elapsed < WINDOW_DAYS:
                part["status"] = "waiting"
            elif len(before) < MIN_DAYS or len(after) < MIN_DAYS:
                part["status"] = "nodata"
                part["before_days"], part["after_days"] = len(before), len(after)
            else:
                part["status"] = "compared"
                rows = _rows(kind, before, after)
                part["rows"] = rows
                part["headline"] = _headline(rows, kind, part["name"])
                part["window"] = {"before": f"{_short(installed - timedelta(days=WINDOW_DAYS))} a {_short(installed - timedelta(days=1))}",
                                  "after": f"{_short(installed + timedelta(days=1))} a {_short(installed + timedelta(days=WINDOW_DAYS))}"}
                chart = []
                for offset in range(-WINDOW_DAYS, WINDOW_DAYS + 1):
                    if offset == 0:
                        continue
                    day = installed + timedelta(days=offset)
                    record = data.get(day.isoformat())
                    chart.append({"date": day.isoformat(), "label": _short(day), "after": offset > 0,
                                  "peak": record["ram_peak"] if record and record.get("n", 0) >= MIN_SAMPLES else None})
                part["chart"] = chart
            parts.append(part)
    parts.sort(key=lambda p: p["installed"], reverse=True)
    return parts
