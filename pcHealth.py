"""Regras simples (sem IA) para o nível do PC e os pontos de atenção.

O nível vai do Ovo ao Cisne e é só uma estimativa rápida: quem faz a análise
completa é o Consultor de upgrades.
"""

LEVELS = ("Ovo", "Patinho", "Pato", "Pato-real", "Cisne")

LEVEL_TEXT = {
    0: "Ainda não deu para avaliar: faltam informações das peças principais.",
    1: "Dá conta do dia a dia, mas alguma peça está segurando o resto.",
    2: "Equilibrado para o dia a dia e jogos leves.",
    3: "Bem servido: aguenta jogos atuais e trabalho pesado na maioria dos casos.",
    4: "Máquina forte em todas as frentes.",
}


def _is_unknown(value):
    text = str(value or "").strip().lower()
    return not text or text.startswith("não identificado")


def _has_dedicated_gpu(names):
    lower = str(names or "").lower()
    return any(hint in lower for hint in ("nvidia", "geforce", "rtx", "gtx", "radeon rx", "radeon pro", "arc a", "quadro"))


def _fmt(value):
    return f"{value:.1f}".replace(".", ",")


def getPcLevel(hardware):
    """Devolve o nível do PC, o texto explicativo e o que levaria ao próximo nível."""
    memory = (hardware or {}).get("memoria") or {}
    system = (hardware or {}).get("sistema") or {}
    total = memory.get("total_gb")
    usage = memory.get("usage_percent") or 0
    cores = system.get("physical_cpu_cores")
    if not total or not cores:
        return {"index": 0, "name": LEVELS[0], "text": LEVEL_TEXT[0], "next_hint": ""}

    score = 0.0
    score += 2 if total >= 15 else 1 if total >= 7.5 else 0
    score += 2 if cores >= 8 else 1 if cores >= 6 else 0.5 if cores >= 4 else 0
    if _has_dedicated_gpu(hardware.get("placas_de_video")):
        score += 1.5
    if usage >= 90:
        score -= 1
    disks = hardware.get("discos_detalhes") or []
    if any(disk.get("percent", 0) >= 85 for disk in disks):
        score -= 0.5

    if score < 1.5:
        index = 1
    elif score < 3:
        index = 2
    elif score < 4.5:
        index = 3
    else:
        index = 4

    hint = ""
    if index < 4:
        if total < 15 or usage >= 85:
            hint = "Mais memória RAM (16 GB) é o passo que mais ajuda a subir de nível."
        elif not _has_dedicated_gpu(hardware.get("placas_de_video")):
            hint = "Uma placa de vídeo dedicada é o que falta para subir de nível."
        elif cores < 6:
            hint = "Um processador com mais núcleos é o próximo passo."
        else:
            hint = "Liberar espaço no disco e manter os drivers em dia ajudam a subir de nível."
    return {"index": index, "name": LEVELS[index], "text": LEVEL_TEXT[index], "next_hint": hint}


def getInsights(hardware):
    """Pontos de atenção mostrados no topo de Meu computador."""
    insights = []
    if not hardware:
        return insights
    memory = hardware.get("memoria") or {}
    usage = memory.get("usage_percent")
    total = memory.get("total_gb")
    if usage is not None and usage >= 85:
        insights.append({
            "kind": "warn",
            "title": "Memória quase cheia",
            "text": f"{_fmt(usage)}% de {_fmt(total)} GB em uso. Isso costuma causar travamentos ao abrir vários programas juntos.",
            "action": {"label": "Ver no monitoramento", "page": "monitor"},
        })
    for disk in hardware.get("discos_detalhes") or []:
        if disk.get("percent", 0) >= 85:
            insights.append({
                "kind": "warn",
                "title": f"Disco {disk['device']} com pouco espaço",
                "text": f"{_fmt(disk['percent'])}% usado: restam {_fmt(disk['free_gb'])} GB de {_fmt(disk['total_gb'])} GB. Abaixo de 15% livre o Windows fica mais lento.",
                "action": {"label": "Entender o armazenamento", "page": "guide", "part": "disk"},
            })
    missing = [label for key, label in (("placas_de_video", "placa de vídeo"), ("placa_mae", "placa-mãe")) if _is_unknown(hardware.get(key))]
    if missing:
        insights.append({
            "kind": "info",
            "title": "1 peça não identificada" if len(missing) == 1 else f"{len(missing)} peças não identificadas",
            "text": "Informe o modelo da " + " e da ".join(missing) + " para o consultor recomendar upgrades com segurança.",
            "action": None,
        })
    return insights
