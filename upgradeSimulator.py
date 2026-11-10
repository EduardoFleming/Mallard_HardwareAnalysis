"""Simulador de upgrade ("provador de peças"): mostra como o PC mudaria com uma peça nova.

Usa as mesmas regras de nível do Meu computador (pcHealth) sobre uma cópia do hardware
com a peça trocada. É uma estimativa por regras simples: não gasta a IA e não substitui
a análise do Consultor.
"""

import copy

import gameCheck
import pcHealth

RAM_TIERS = (4, 8, 16, 32, 64)
GPU_NAMES = ("Vídeo integrado", "GeForce GTX 1050 (simulada)", "GeForce GTX 1660 (simulada)", "GeForce RTX 3060 (simulada)")
GPU_LABELS = ("integrada", "de entrada", "intermediária", "de alto desempenho")
GPU_NOTES = ("", "Jogos leves em 1080p", "Jogos atuais em 1080p", "Jogos pesados em 1080p")
LEVEL_NAMES = pcHealth.LEVELS


def _is_notebook(hardware):
    return (hardware or {}).get("tipo_de_maquina") == "notebook"


def _tier_of(total):
    return min(RAM_TIERS, key=lambda t: abs(t - total))


def _fmt(value):
    return f"{value:.1f}".replace(".", ",")


def getOptions(hardware):
    """Os grupos de peças com as opções que fazem sentido para ESTE computador."""
    hw = hardware or {}
    total = float((hw.get("memoria") or {}).get("total_gb") or 8)
    today = _tier_of(total)
    higher = [t for t in RAM_TIERS if t > today][:2]
    ram = [{"name": f"{today} GB", "note": "O que você tem", "ram_gb": today}]
    ram += [{"name": f"{t} GB", "note": f"2 × {t // 2} GB", "ram_gb": t} for t in higher]

    disks = hw.get("discos_detalhes") or []
    c_note = "Só o disco que você tem"
    if disks:
        d = disks[0]
        c_note = f"{_fmt(d['total_gb'])} GB" + (", quase cheio" if d.get("percent", 0) >= 85 else f", {_fmt(d['free_gb'])} GB livres")
    storage = [{"name": f"Só o {disks[0]['device'] if disks else 'C:'}", "note": c_note, "ssd_gb": 0, "nvme": False},
               {"name": "+ SSD 500 GB", "note": "SATA, na baia" if not _is_notebook(hw) else "No lugar do disco atual", "ssd_gb": 500, "nvme": False},
               {"name": "+ SSD 1 TB", "note": "NVMe, encaixe M.2", "ssd_gb": 1000, "nvme": True}]

    groups = [{"key": "ram", "name": "Memória RAM", "opts": ram}, {"key": "stor", "name": "Armazenamento", "opts": storage}]
    if not _is_notebook(hw):
        now = gameCheck.gpuTier(hw.get("placas_de_video"))
        now_tier = now if now is not None else 0
        gpu_name = "A de hoje"
        gpu_note = "Não identificada" if now is None else f"{GPU_LABELS[now_tier].capitalize()}"
        gpu = [{"name": gpu_name, "note": gpu_note, "gpu_tier": None}]
        names = {1: "De entrada", 2: "Intermediária", 3: "Alta"}
        gpu += [{"name": names[t], "note": GPU_NOTES[t], "gpu_tier": t} for t in (1, 2, 3) if t > now_tier][:2]
        groups.append({"key": "gpu", "name": "Placa de vídeo", "opts": gpu})
    return groups


def _impact(name, before, after):
    return {"name": name, "before": before, "after": after}


def _multi(used_gb, total_gb):
    """Quanto o PC aguenta vários programas ao mesmo tempo (0 a 100), pela folga de memória."""
    u = used_gb / max(total_gb, 0.1)
    return max(5, min(98, round(117 - 91.8 * u)))


def _games(gpu_tier, total_gb, nvme):
    base = (35, 60, 80, 92)[gpu_tier if gpu_tier is not None else 0]
    return max(5, min(98, base + (8 if total_gb >= 15 else -10 if total_gb < 7.5 else 0) + (4 if nvme else 0)))


def simulate(hardware, ram_gb=None, ssd_gb=0, nvme=False, gpu_tier=None):
    """Devolve o nível e os números "hoje" e "com o upgrade" para a combinação escolhida."""
    hw = copy.deepcopy(hardware or {})
    memory = hw.get("memoria") or {}
    total = float(memory.get("total_gb") or 8)
    usage = float(memory.get("usage_percent") or 50)
    used = total * usage / 100
    new_total = float(ram_gb) if ram_gb and float(ram_gb) > total + 0.5 else total
    disks = hw.get("discos_detalhes") or []
    disk = disks[0] if disks else {"percent": 50, "free_gb": 100, "total_gb": 200, "device": "C:"}
    now_tier = gameCheck.gpuTier(hw.get("placas_de_video"))
    new_tier = gpu_tier if gpu_tier is not None and gpu_tier > (now_tier or 0) else now_tier

    today_level = pcHealth.getPcLevel(hw)["index"]
    sim = copy.deepcopy(hw)
    sim["memoria"] = {**memory, "total_gb": new_total, "usage_percent": round(100 * used / new_total, 1)}
    if gpu_tier is not None and new_tier != now_tier:
        sim["placas_de_video"] = GPU_NAMES[new_tier]
    free_before = disk["free_gb"] / disk["total_gb"] * 100
    free_after = (disk["free_gb"] + ssd_gb) / (disk["total_gb"] + ssd_gb) * 100 if ssd_gb else free_before
    if ssd_gb:
        sim["discos_detalhes"] = [{**disk, "percent": round(100 - free_after, 1), "free_gb": disk["free_gb"] + ssd_gb, "total_gb": disk["total_gb"] + ssd_gb}] + disks[1:]
    level = pcHealth.getPcLevel(sim)["index"]
    level = max(level, today_level) if (new_total > total or ssd_gb or new_tier != now_tier) else level

    impacts = [
        _impact("Vários programas", _multi(used, total), _multi(used, new_total)),
        _impact("Jogos", _games(now_tier, total, False), _games(new_tier, new_total, nvme)),
        _impact("Espaço livre", round(free_before), round(free_after)),
    ]
    mb_unknown = str(hw.get("placa_mae") or "").lower().startswith("não identificado") or not hw.get("placa_mae")
    checks = []
    if new_total > total:
        checks.append("Confirme se a placa-mãe usa o mesmo tipo de memória (DDR3, DDR4 ou DDR5) e quantos slots estão livres.")
    if nvme:
        checks.append("O SSD NVMe precisa de encaixe M.2" + (", e a placa-mãe não foi identificada." if mb_unknown else ". Confira no manual da placa-mãe."))
    if new_tier != now_tier:
        checks.append("Confira a potência da fonte e o comprimento de placa que cabe no gabinete.")
    return {"level": level, "level_name": LEVEL_NAMES[level], "level_today": today_level, "level_today_name": LEVEL_NAMES[today_level],
            "changed": bool(checks) or bool(ssd_gb), "impacts": impacts, "checks": checks,
            "ram_gb": int(new_total) if new_total > total else None, "ssd_gb": ssd_gb, "nvme": bool(nvme), "gpu_tier": new_tier if new_tier != now_tier else None}
