"""Vai rodar? Compara o que um jogo ou programa pede com as peças do computador.

Os requisitos abaixo são valores de referência (variam com a versão e as configurações).
Para um título que não está na lista, a tela oferece perguntar ao Gemini, que devolve o
mesmo formato; a comparação em si é sempre feita aqui, com regras simples e sem IA.

Níveis (0 a 3) usados para processador e placa de vídeo:
  CPU: 0 = 2 núcleos, 1 = 4 núcleos, 2 = 6 núcleos, 3 = 8 ou mais.
  GPU: 0 = vídeo integrado, 1 = entrada (GTX 1050), 2 = intermediária (GTX 1660, RTX 3050), 3 = alta (RTX 3060 ou melhor).
"""

import re

# chave: (nome, tipo, "jogo" | "programa", RAM mín., RAM ideal, CPU mín., CPU ideal, texto CPU,
#         GPU mín., GPU ideal, texto GPU, disco em GB)
_DB = {
    "valorant": ("Valorant", "Jogo competitivo", "jogo", 4, 4, 0, 1, "Core i3-4150 ou parecido", 0, 1, "Intel HD 4000; ideal GTX 1050 Ti", 30),
    "lol": ("League of Legends", "Jogo competitivo", "jogo", 4, 8, 0, 1, "Core i3 ou parecido", 0, 1, "Placa integrada serve; ideal GTX 560", 16),
    "cs2": ("Counter-Strike 2", "Jogo competitivo", "jogo", 8, 16, 1, 2, "Core i5 de 4 núcleos ou melhor", 1, 2, "GTX 1050 Ti ou melhor", 85),
    "fortnite": ("Fortnite", "Jogo", "jogo", 8, 16, 1, 2, "Core i5-7300U ou parecido", 0, 2, "Intel HD 4000; ideal GTX 960", 30),
    "minecraft": ("Minecraft (Java)", "Jogo", "jogo", 4, 8, 1, 1, "Intel Core i5 ou equivalente", 0, 0, "Placa integrada recente já serve", 4),
    "roblox": ("Roblox", "Jogo", "jogo", 4, 8, 0, 1, "Qualquer processador de 2 GHz", 0, 0, "Placa integrada já serve", 2),
    "gta5": ("GTA V", "Jogo", "jogo", 4, 8, 1, 2, "Core 2 Quad; ideal i5-3470", 1, 2, "GTX 660; ideal GTX 1060", 90),
    "sims4": ("The Sims 4", "Jogo", "jogo", 4, 8, 1, 1, "Core 2 Duo; ideal i5", 0, 1, "Placa integrada serve; ideal GTX 650", 50),
    "fc24": ("EA Sports FC 24", "Jogo", "jogo", 8, 12, 1, 2, "Core i5-6600K ou parecido", 1, 2, "GTX 1050 Ti; ideal GTX 1660", 100),
    "apex": ("Apex Legends", "Jogo competitivo", "jogo", 6, 8, 1, 2, "Core i3-6300 ou melhor", 1, 2, "GTX 970; ideal GTX 1070", 56),
    "rocketleague": ("Rocket League", "Jogo competitivo", "jogo", 4, 8, 1, 1, "Core i5 ou equivalente", 1, 1, "GTX 760 ou melhor", 20),
    "overwatch2": ("Overwatch 2", "Jogo competitivo", "jogo", 6, 8, 1, 2, "Core i3 ou melhor", 1, 2, "GTX 600; ideal GTX 1060", 50),
    "genshin": ("Genshin Impact", "Jogo", "jogo", 8, 16, 1, 2, "Core i7 ou i5 recente", 1, 2, "GTX 1030 ou melhor", 30),
    "witcher3": ("The Witcher 3", "Jogo", "jogo", 6, 8, 1, 2, "Core i5-2500K ou parecido", 1, 2, "GTX 660; ideal GTX 770", 50),
    "cyberpunk": ("Cyberpunk 2077", "Jogo AAA", "jogo", 12, 16, 2, 3, "Core i7-6700 ou Ryzen 5 1600", 2, 3, "GTX 1060 6 GB; ideal RTX 2060", 70),
    "eldenring": ("Elden Ring", "Jogo AAA", "jogo", 12, 16, 2, 2, "Core i5-8400 ou Ryzen 3 3300X", 2, 3, "GTX 1060 3 GB; ideal GTX 1070", 60),
    "rdr2": ("Red Dead Redemption 2", "Jogo AAA", "jogo", 8, 12, 2, 2, "Core i5-2500K ou Ryzen 5 1500X", 2, 2, "GTX 770; ideal GTX 1060", 150),
    "godofwar": ("God of War", "Jogo AAA", "jogo", 8, 8, 2, 2, "Core i5-2500K ou Ryzen 3 1200", 2, 2, "GTX 960; ideal GTX 1060", 70),
    "hogwarts": ("Hogwarts Legacy", "Jogo AAA", "jogo", 16, 16, 2, 3, "Core i5-6600 ou Ryzen 5 1400", 2, 3, "GTX 960; ideal GTX 1080 Ti", 85),
    "forza5": ("Forza Horizon 5", "Jogo AAA", "jogo", 8, 16, 2, 2, "Core i5-4460 ou Ryzen 3 1200", 2, 3, "GTX 970; ideal RTX 2080", 110),
    "photoshop": ("Adobe Photoshop", "Programa de edição", "programa", 8, 16, 0, 1, "Processador 64 bits com SSE 4.2", 0, 1, "Placa com DirectX 12 e 1,5 GB de memória", 5),
    "premiere": ("Adobe Premiere Pro", "Programa de vídeo", "programa", 8, 16, 1, 2, "Core i5 de 6ª geração ou melhor", 0, 1, "Placa com 2 GB; ideal 4 GB", 8),
    "davinci": ("DaVinci Resolve", "Programa de vídeo", "programa", 16, 32, 2, 3, "Core i7 ou Ryzen 7", 1, 2, "GPU com 2 GB; ideal 4 GB", 10),
    "blender": ("Blender", "Programa 3D", "programa", 8, 16, 1, 2, "Processador de 4 núcleos ou mais", 1, 2, "Placa com 2 GB; ideal 8 GB", 1),
    "autocad": ("AutoCAD", "Programa de projeto", "programa", 8, 16, 1, 2, "Processador de 2,5 GHz ou mais", 0, 1, "Placa com 1 GB; ideal 4 GB", 10),
    "obs": ("OBS Studio", "Programa de gravação", "programa", 4, 8, 1, 2, "Core i5 de 4 núcleos ou melhor", 0, 1, "Placa com DirectX 11", 1),
    "vscode": ("Visual Studio Code", "Programa de código", "programa", 2, 4, 0, 1, "Processador de 1,6 GHz ou mais", 0, 0, "Qualquer placa serve", 1),
    "zoom": ("Zoom", "Videochamada", "programa", 4, 8, 0, 1, "Processador de 2 núcleos ou mais", 0, 0, "Qualquer placa serve", 1),
}

_ALIASES = {
    "lol": ("lol", "league", "liga das lendas"), "cs2": ("cs2", "cs go", "csgo", "counter"), "gta5": ("gta", "gta 5", "gta v", "grand theft"),
    "sims4": ("sims",), "fc24": ("fifa", "fc24", "ea fc", "ea sports"), "apex": ("apex",), "rocketleague": ("rocket",),
    "overwatch2": ("overwatch",), "genshin": ("genshin",), "witcher3": ("witcher",), "cyberpunk": ("cyberpunk", "cyber punk"),
    "eldenring": ("elden",), "rdr2": ("red dead", "rdr"), "godofwar": ("god of war",), "hogwarts": ("hogwarts", "harry potter"),
    "forza5": ("forza",), "photoshop": ("photoshop", "ps"), "premiere": ("premiere",), "davinci": ("davinci", "da vinci", "resolve"),
    "autocad": ("autocad", "cad"), "obs": ("obs",), "vscode": ("vscode", "visual studio code", "vs code"), "valorant": ("valorant", "valo"),
    "minecraft": ("minecraft", "mine"), "roblox": ("roblox",), "fortnite": ("fortnite",), "blender": ("blender",), "zoom": ("zoom",),
}


def examples():
    """Os títulos que a tela mostra como exemplos para tocar."""
    return ["valorant", "minecraft", "photoshop", "cyberpunk"]


def _entry(key):
    (name, kind, noun, ram_min, ram_rec, cpu_min, cpu_rec, cpu_text, gpu_min, gpu_rec, gpu_text, disk) = _DB[key]
    return {"name": name, "kind": kind, "noun": noun, "ram_min": ram_min, "ram_rec": ram_rec, "cpu_min": cpu_min, "cpu_rec": cpu_rec,
            "cpu_text": cpu_text, "gpu_min": gpu_min, "gpu_rec": gpu_rec, "gpu_text": gpu_text, "disk_gb": disk}


def findGame(query):
    """Acha um título pelo nome (ignora maiúsculas, acentos simples e pedaços do nome)."""
    text = re.sub(r"[^a-z0-9 ]", " ", str(query or "").lower()).strip()
    if not text:
        return None
    for key, entry in _DB.items():
        names = [re.sub(r"[^a-z0-9 ]", " ", entry[0].lower()).strip(), key]
        names += list(_ALIASES.get(key, ()))
        if any(text == name or (len(text) >= 3 and (name.startswith(text) or text in name.split())) for name in names):
            return _entry(key)
    for key, entry in _DB.items():
        if len(text) >= 4 and text in re.sub(r"[^a-z0-9 ]", " ", entry[0].lower()):
            return _entry(key)
    return None


def listTitles():
    return [{"key": key, "name": value[0]} for key, value in _DB.items()]


def exampleEntries():
    return [{"key": key, "name": _DB[key][0]} for key in examples()]


# ---------------------------------------------------------------------------
# Níveis das peças do computador
# ---------------------------------------------------------------------------
def cpuTier(hardware):
    cores = ((hardware or {}).get("sistema") or {}).get("physical_cpu_cores") or 0
    return 3 if cores >= 8 else 2 if cores >= 6 else 1 if cores >= 4 else 0


def gpuTier(names):
    """None = não identificada; 0 = vídeo integrado; 1 a 3 = placa dedicada."""
    text = str(names or "").lower()
    if not text.strip() or text.strip().startswith("não identificado"):
        return None
    best = None

    def put(value):
        nonlocal best
        best = value if best is None else max(best, value)

    for brand, number in re.findall(r"(gtx|rtx|gt|rx|mx)\s*-?\s*(\d{3,4})", text):
        n = int(number)
        if brand in ("gt", "mx"):
            put(1 if brand == "mx" or n >= 1000 else 0)
        elif brand == "gtx":
            put(1 if n < 1060 else 2)
        elif brand == "rtx":
            put(2 if n in (2060, 2050) or n < 2060 or (n >= 3000 and n % 1000 < 60) else 3)
        elif brand == "rx":
            put(1 if n < 570 else 2 if n < 5600 or n in (6400, 6500) else 3)
    if best is not None:
        return best
    if re.search(r"arc\s*a\d", text):
        return 2
    if any(word in text for word in ("geforce", "nvidia", "radeon rx", "radeon pro", "quadro")):
        return 2
    if any(word in text for word in ("intel", "uhd", "iris", "hd graphics", "radeon graphics", "vega", "microsoft basic")):
        return 0
    return None


_TIER_NAMES = ("integrado", "de entrada", "intermediária", "de alto desempenho")
_CPU_NAMES = ("de 2 núcleos", "de 4 núcleos", "de 6 núcleos", "de 8 núcleos ou mais")

_STATE = {"ok": "ok", "warn": "warn", "crit": "crit", "unk": "unk"}


def _row(part, state, label, you, need, scale=None):
    row = {"part": part, "s": state, "state": label, "you": you, "need": need}
    if scale:
        row["scale"] = scale
    return row


def compare(requirement, hardware):
    """Compara um título com o computador. Devolve veredito (0 a 100), linhas e a fala do pato."""
    hw = hardware or {}
    memory = hw.get("memoria") or {}
    total = float(memory.get("total_gb") or 0)
    usage = float(memory.get("usage_percent") or 0)
    free_ram = max(0.0, total * (1 - usage / 100))
    effective = round(total)  # 7,8 GB aparece como 8 GB na caixa
    cpu = cpuTier(hw)
    gpu = gpuTier(hw.get("placas_de_video"))
    disks = hw.get("discos_detalhes") or []
    free_disk = float(disks[0].get("free_gb")) if disks else None
    cores = (hw.get("sistema") or {}).get("physical_cpu_cores") or 0
    r = requirement
    score = 100
    rows = []

    # Processador
    cpu_you = f"{(hw.get('processador') or 'Não identificado')[:38]}, {cores} núcleos" if cores else str(hw.get("processador") or "Não identificado")
    if cpu >= r["cpu_rec"]:
        rows.append(_row("Processador", "ok", "Passa", cpu_you, r["cpu_text"]))
    elif cpu >= r["cpu_min"]:
        rows.append(_row("Processador", "warn", "No limite", cpu_you, r["cpu_text"]))
        score -= 20
    else:
        rows.append(_row("Processador", "crit", "Fraco", cpu_you, r["cpu_text"]))
        score -= 45

    # Memória
    ram_you = f"{str(round(total, 1)).replace('.', ',')} GB · {round(usage)}% já em uso"
    ram_need = f"{r['ram_min']} GB, ideal {r['ram_rec']} GB" if r["ram_min"] != r["ram_rec"] else f"{r['ram_min']} GB"
    scale = {"max": max(20, r["ram_rec"] * 1.25), "min": r["ram_min"], "rec": r["ram_rec"], "val": round(total, 1),
             "min_label": f"{r['ram_min']} GB", "rec_label": f"{r['ram_rec']} GB"}
    if effective < r["ram_min"]:
        rows.append(_row("Memória RAM", "crit", "Falta memória", ram_you, ram_need, scale))
        score -= 60
    elif effective < r["ram_rec"]:
        rows.append(_row("Memória RAM", "warn", "Abaixo do ideal", ram_you, ram_need, scale))
        score -= 30
    elif free_ram < r["ram_min"] and usage >= 80:
        rows.append(_row("Memória RAM", "warn", "No limite", ram_you, ram_need, scale))
        score -= 25
    else:
        rows.append(_row("Memória RAM", "ok", "Passa", ram_you, ram_need, scale))

    # Placa de vídeo
    gpu_you = str(hw.get("placas_de_video") or "Não identificada")
    if gpu is None:
        if r["gpu_min"] == 0:
            rows.append(_row("Placa de vídeo", "unk", "Provável", gpu_you, r["gpu_text"]))
            score -= 5
        else:
            rows.append(_row("Placa de vídeo", "unk", "Confira", gpu_you, r["gpu_text"]))
            score -= 15
    elif gpu >= r["gpu_rec"]:
        rows.append(_row("Placa de vídeo", "ok", "Passa", gpu_you, r["gpu_text"]))
    elif gpu >= r["gpu_min"]:
        rows.append(_row("Placa de vídeo", "warn", "Abaixo do ideal", gpu_you, r["gpu_text"]))
        score -= 20
    else:
        rows.append(_row("Placa de vídeo", "crit", "Fraca", gpu_you, r["gpu_text"]))
        score -= 55

    # Espaço no disco (só entra quando o título é grande ou falta espaço)
    if free_disk is not None:
        need = r["disk_gb"]
        d_scale = {"max": max(100, need * 1.5), "min": need, "rec": need, "val": round(free_disk, 1), "min_label": f"{need} GB", "rec_label": f"{need} GB"}
        d_you = f"{str(round(free_disk, 1)).replace('.', ',')} GB livres no {disks[0].get('device', 'C:')}"
        if free_disk < need:
            rows.append(_row("Espaço no disco", "crit", "Falta espaço", d_you, f"{need} GB livres", d_scale))
            score -= 30
        elif need >= 40 and free_disk < need * 1.3:
            rows.append(_row("Espaço no disco", "warn", "Cabe, mas apertado", d_you, f"{need} GB livres", d_scale))
            score -= 8
        elif need >= 40:
            rows.append(_row("Espaço no disco", "ok", "Cabe", d_you, f"{need} GB livres", d_scale))

    score = max(2, min(98, score))
    verdict, color = (("Deve rodar bem", "ok") if score >= 85 else ("Roda", "ok") if score >= 68 else ("No limite", "warn") if score >= 40 else ("Não roda bem", "crit"))
    crit = [row for row in rows if row["s"] == "crit"]
    warn = [row for row in rows if row["s"] == "warn"]
    worst = (crit or warn or [None])[0]
    if worst is None:
        duck = "Quack! Pelo que eu vi, esse roda de boa no seu PC. Feche o navegador antes de abrir para ter mais folga."
        cta = {"label": "Ver o PC no Simulador", "page": "simulator"}
    elif worst["part"] == "Memória RAM":
        duck = ("Socorro! Falta memória para esse. Precisa de upgrade antes." if worst["s"] == "crit"
                else "Abre, mas a memória já está apertada. Com mais memória ficaria tranquilo.")
        cta = {"label": "Testar com 16 GB no Simulador", "page": "simulator"}
    elif worst["part"] == "Placa de vídeo":
        duck = ("Essa placa de vídeo não dá conta. Uma dedicada resolveria." if worst["s"] == "crit"
                else "Roda, mas sem capricho nos gráficos. Uma placa melhor ajudaria.")
        cta = {"label": "Ver placas no Simulador", "page": "simulator"}
    elif worst["part"] == "Espaço no disco":
        duck = "O jogo não cabe no disco agora. Libere espaço ou use um SSD maior."
        cta = {"label": "Limpar o disco", "page": "cleanup"}
    else:
        duck = "O processador está no limite para esse. Pode engasgar em momentos pesados."
        cta = {"label": "Ver o PC no Simulador", "page": "simulator"}
    return {"name": r["name"], "kind": r["kind"], "noun": r["noun"], "score": score, "verdict": verdict, "color": color,
            "duck": duck, "cta": cta, "rows": rows}


def check(query, hardware):
    """Procura o título na lista de referência e compara. found=False pede ajuda do Gemini."""
    requirement = findGame(query)
    if not requirement:
        return {"found": False, "query": str(query or "").strip()}
    return {"found": True, "source": "lista", **compare(requirement, hardware)}


def fromRemote(data, hardware):
    """Compara um título cujos requisitos vieram do Gemini (formato validado em aiAnalysis)."""
    requirement = {
        "name": data["name"], "kind": data.get("kind") or "Jogo ou programa", "noun": data.get("noun") or "programa",
        "ram_min": data["ram_min_gb"], "ram_rec": data["ram_rec_gb"], "cpu_min": data["cpu_min_tier"], "cpu_rec": data["cpu_rec_tier"],
        "cpu_text": data.get("cpu_text") or "Veja a página oficial", "gpu_min": data["gpu_min_tier"], "gpu_rec": data["gpu_rec_tier"],
        "gpu_text": data.get("gpu_text") or "Veja a página oficial", "disk_gb": data["disk_gb"],
    }
    return {"found": True, "source": "gemini", **compare(requirement, hardware)}
