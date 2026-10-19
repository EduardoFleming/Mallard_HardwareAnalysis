"""Conteúdo didático da aba "Entenda seu PC".

Este módulo não lê o hardware: ele guarda os textos e as regras simples que
transformam o dicionário montado em main.py (a partir do hardwareInfo) em
explicações para quem não entende de computador.
"""

import re

# Cada peça é explicada com a mesma analogia: o computador como uma cozinha.
# "ruler" é uma régua de referência (do mais fraco ao mais forte) e
# "ruler_key" liga a régua ao valor real do computador em describeForComputer().
PARTS = [
    {
        "key": "cpu",
        "name": "Processador (CPU)",
        "short_name": "Processador",
        "role": "o cozinheiro",
        "analogy": (
            "É quem lê cada receita (os programas) e executa os passos. Tudo o que o "
            "computador faz passa por ele. Quanto mais cozinheiros trabalhando juntos e "
            "mais rápidos eles forem, mais pratos saem ao mesmo tempo."
        ),
        "specs": [
            {
                "term": "Núcleos",
                "example": "ex.: 6 núcleos",
                "text": "Quantos cozinheiros trabalham ao mesmo tempo. Com mais núcleos, o PC faz várias coisas juntas sem engasgar.",
                "tip": "Para jogos e programas pesados, procure 6 núcleos ou mais.",
                "ruler_key": "cpu_cores",
                "ruler": [("2", "Fraco"), ("4", "Dia a dia"), ("6", "Jogos"), ("8+", "Trabalho pesado")],
            },
            {
                "term": "Threads",
                "example": "ex.: 12 threads",
                "text": "Quantas tarefas cada núcleo consegue tocar em paralelo. Um núcleo com 2 threads é como um cozinheiro usando as duas mãos.",
                "tip": "Mais threads ajudam em edição de vídeo e quando há vários programas abertos.",
            },
            {
                "term": "Frequência (GHz)",
                "example": "ex.: 3,5 GHz",
                "text": "A velocidade de cada cozinheiro. 3,5 GHz quer dizer 3,5 bilhões de passos por segundo.",
                "tip": "Só compare GHz entre processadores da mesma geração. Um modelo novo mais lento no papel pode ganhar de um antigo.",
            },
            {
                "term": "Geração",
                "example": "ex.: 12ª geração",
                "text": "A idade do projeto. Gerações novas fazem mais trabalho na mesma frequência e gastam menos energia.",
                "tip": "No nome Intel, o primeiro número depois do i3/i5/i7 indica a geração: i5-8400 é de 8ª, i5-12400 é de 12ª.",
            },
        ],
        "myth": (
            "Mais GHz é sempre melhor?",
            "Mito.",
            "Um processador novo a 3,5 GHz pode ser mais rápido que um antigo a 4 GHz, porque cada passo dele rende mais.",
        ),
    },
    {
        "key": "ram",
        "name": "Memória RAM",
        "short_name": "Memória RAM",
        "role": "a bancada",
        "analogy": (
            "É a bancada onde ficam os ingredientes que estão sendo usados agora. Se a "
            "bancada é pequena, o cozinheiro precisa ir e voltar da despensa toda hora, e "
            "tudo fica lento. Ela se esvazia quando o PC desliga."
        ),
        "specs": [
            {
                "term": "Capacidade (GB)",
                "example": "ex.: 16 GB",
                "text": "O tamanho da bancada. Cada programa aberto ocupa um pedaço: navegador, jogo, Discord e o próprio Windows.",
                "tip": "Se a memória vive acima de 85% de uso, aumentar a capacidade é o upgrade que mais faz diferença.",
                "ruler_key": "ram_total",
                "ruler": [("4 GB", "Pouco"), ("8 GB", "Básico"), ("16 GB", "Jogos e multitarefa"), ("32 GB", "Edição pesada")],
            },
            {
                "term": "Tipo (DDR3, DDR4, DDR5)",
                "example": "ex.: DDR4",
                "text": "A geração do pente de memória. Cada placa-mãe aceita só um tipo: os encaixes são diferentes e um não serve no lugar do outro.",
                "tip": "Antes de comprar memória, confirme qual tipo a sua placa-mãe aceita.",
            },
            {
                "term": "Frequência (MHz)",
                "example": "ex.: 3200 MHz",
                "text": "A velocidade com que a bancada entrega os ingredientes ao cozinheiro.",
                "tip": "Ao adicionar um pente, prefira a mesma frequência do que já está instalado.",
            },
            {
                "term": "Dual channel",
                "example": "ex.: 2 × 8 GB",
                "text": "Dois pentes iguais trabalham juntos, como duas bancadas lado a lado. A comida circula mais rápido.",
                "tip": "Dois pentes de 8 GB costumam render mais que um pente só de 16 GB.",
            },
        ],
        "myth": (
            "Mais RAM deixa qualquer PC mais rápido?",
            "Mito.",
            "Só ajuda até o ponto em que ela faltava. Se você usa 6 GB, ter 32 GB não muda nada. Quem vive com a memória cheia sente muita diferença.",
        ),
    },
    {
        "key": "gpu",
        "name": "Placa de vídeo (GPU)",
        "short_name": "Placa de vídeo",
        "role": "o confeiteiro",
        "analogy": (
            "É quem monta e decora cada prato antes de ele sair: tudo o que aparece na tela "
            "passa por ela. Em jogos, cada imagem é um prato, e 60 FPS são 60 pratos "
            "montados por segundo."
        ),
        "specs": [
            {
                "term": "Integrada ou dedicada",
                "example": "",
                "text": "A integrada vem dentro do processador e divide a bancada (a RAM) com ele. A dedicada é uma placa separada, com bancada própria e muito mais força.",
                "tip": "Para jogos atuais, uma placa dedicada faz toda a diferença.",
            },
            {
                "term": "Memória de vídeo (VRAM)",
                "example": "ex.: 8 GB",
                "text": "A bancada própria do confeiteiro, onde ficam as texturas e imagens do jogo.",
                "tip": "Para jogos atuais em 1080p, procure 8 GB.",
                "ruler_key": "gpu_vram",
                "ruler": [("2 GB", "Só o básico"), ("4 GB", "Jogos leves"), ("8 GB", "Jogos atuais"), ("12 GB+", "Jogos pesados")],
            },
            {
                "term": "O nome do modelo",
                "example": "ex.: RTX 4060",
                "text": "Em \"RTX 4060\", o 40 é a geração e o 60 é a faixa. Na mesma geração, número maior quer dizer placa mais forte.",
                "tip": "Na NVIDIA, 4050 é menor que 4060, que é menor que 4070. Na AMD a lógica é parecida: RX 7600, 7700, 7800.",
            },
            {
                "term": "FPS",
                "example": "ex.: 60 FPS",
                "text": "Quantas imagens por segundo a placa consegue montar. Quanto mais, mais suave o movimento.",
                "tip": "30 FPS é jogável, 60 é fluido, e acima de 120 só faz diferença em monitores rápidos.",
            },
        ],
        "myth": (
            "Mais memória de vídeo quer dizer placa mais forte?",
            "Mito.",
            "Uma placa fraca com muita memória continua fraca. Compare pelo modelo e pela geração, não pelos GB.",
        ),
    },
    {
        "key": "disk",
        "name": "Armazenamento (SSD ou HD)",
        "short_name": "Armazenamento",
        "role": "a despensa",
        "analogy": (
            "É onde tudo fica guardado, mesmo com o PC desligado: o Windows, os programas, "
            "os jogos e as fotos. Na hora de usar, os ingredientes saem da despensa e vão "
            "para a bancada."
        ),
        "specs": [
            {
                "term": "SSD ou HD",
                "example": "",
                "text": "O SSD é uma despensa organizada, onde você acha tudo na hora. O HD é um porão: guarda muito, mas demora para achar as coisas.",
                "tip": "Com o Windows num SSD, o PC liga e abre programas várias vezes mais rápido.",
                "ruler_key": "disk_type",
                "ruler": [("HD", "Lento"), ("SSD SATA", "Rápido"), ("SSD NVMe", "Muito rápido")],
            },
            {
                "term": "SATA ou NVMe",
                "example": "",
                "text": "Dois jeitos de ligar o SSD. O NVMe usa um encaixe pequeno na placa-mãe (o M.2) e pode ser várias vezes mais rápido que o SATA.",
                "tip": "Antes de comprar um SSD NVMe, confira se a placa-mãe tem encaixe M.2.",
            },
            {
                "term": "Capacidade",
                "example": "ex.: 500 GB",
                "text": "O tamanho da despensa. Um jogo atual pode ocupar de 50 a mais de 100 GB.",
                "tip": "Para quem joga, 1 TB evita ter que desinstalar um jogo para caber outro.",
            },
            {
                "term": "Espaço livre",
                "example": "",
                "text": "O Windows precisa de espaço sobrando para atualizações e arquivos temporários.",
                "tip": "Deixe sempre pelo menos 15% do disco livre.",
                "ruler_key": "disk_free",
                "ruler": [("Menos de 15%", "Apertado"), ("15 a 30%", "Ok"), ("Mais de 30%", "Folgado")],
            },
        ],
        "myth": (
            "SSD aumenta o FPS dos jogos?",
            "Mito.",
            "O SSD acelera o carregamento e a abertura dos programas. Quem decide o FPS é a placa de vídeo e o processador.",
        ),
    },
    {
        "key": "mb",
        "name": "Placa-mãe",
        "short_name": "Placa-mãe",
        "role": "a própria cozinha",
        "analogy": (
            "É a cozinha em si: as tomadas, os encanamentos e os balcões onde tudo se "
            "encaixa. Ela não cozinha nada, mas decide quais peças cabem e quantas dá para "
            "colocar."
        ),
        "specs": [
            {
                "term": "Soquete",
                "example": "ex.: AM4, LGA 1700",
                "text": "O encaixe do processador. O processador e a placa precisam ter o mesmo soquete, senão não encaixa.",
                "tip": "Antes de trocar o processador, confira se o soquete e o chipset da placa aceitam o modelo novo.",
            },
            {
                "term": "Chipset",
                "example": "ex.: B550",
                "text": "O gerente da placa. Define recursos como quantas portas USB existem e se dá para acelerar o processador.",
                "tip": "Para quem não vai mexer em configurações avançadas, um chipset intermediário já basta.",
            },
            {
                "term": "Slots de memória",
                "example": "ex.: 2 slots",
                "text": "Quantos pentes de RAM cabem na placa. A maioria tem 2 ou 4.",
                "tip": "Se todos os slots estiverem ocupados, aumentar a memória exige trocar os pentes, não só adicionar.",
            },
            {
                "term": "Encaixe M.2",
                "example": "",
                "text": "Uma vaga pequena para SSD NVMe, o tipo mais rápido, que fica direto na placa, sem cabos.",
                "tip": "Placas mais antigas podem não ter. Confira antes de comprar um SSD NVMe.",
            },
        ],
        "myth": (
            "Uma placa-mãe mais cara deixa o PC mais rápido?",
            "Quase mito.",
            "Ela quase não muda a velocidade. O que importa é o que ela aceita: soquete, tipo de memória e encaixes.",
        ),
    },
    {
        "key": "psu",
        "name": "Fonte de alimentação",
        "short_name": "Fonte",
        "role": "o quadro de luz",
        "analogy": (
            "Leva energia da tomada para todas as peças. Se for fraca, a cozinha \"desarma\" "
            "quando todo mundo liga os equipamentos ao mesmo tempo: o PC reinicia ou desliga "
            "sozinho no meio do jogo."
        ),
        "specs": [
            {
                "term": "Potência (W)",
                "example": "ex.: 500 W",
                "text": "Quanta energia ela consegue entregar ao mesmo tempo.",
                "tip": "Antes de trocar a placa de vídeo, confira a potência que o fabricante da placa recomenda.",
                "ruler_key": "psu_watts",
                "ruler": [("400 W", "Sem placa dedicada"), ("500 W", "Placa de entrada"), ("650 W", "Placa intermediária"), ("750 W+", "Placa forte")],
            },
            {
                "term": "Selo 80 Plus",
                "example": "ex.: Bronze",
                "text": "Indica a eficiência: quanto melhor o selo, menos energia vira calor e mais estável é a fonte.",
                "tip": "Bronze já é uma boa escolha. Desconfie de fontes sem nenhum selo.",
            },
            {
                "term": "Conectores",
                "example": "ex.: PCIe 8 pinos",
                "text": "Os cabos que saem da fonte. Placas de vídeo mais fortes precisam de cabos próprios.",
                "tip": "Veja quantos e quais conectores a placa de vídeo pede antes de comprar.",
            },
        ],
        "myth": (
            "Qualquer fonte serve, desde que ligue?",
            "Mito.",
            "Fonte genérica fraca é uma das causas mais comuns de PC que desliga sozinho, e pode danificar outras peças.",
        ),
    },
]

GLOSSARY = [
    ("Gargalo", "A peça que segura as outras. Como numa garrafa: não importa o tamanho dela, o líquido sai na velocidade do gargalo."),
    ("FPS", "Quadros por segundo: quantas imagens o jogo mostra a cada segundo. Mais FPS quer dizer movimento mais suave."),
    ("Driver", "O manual de instruções que ensina o Windows a conversar com uma peça. Driver desatualizado pode deixar a peça lenta ou instável."),
    ("BIOS", "O programa que liga o PC antes do Windows. É ali que a placa-mãe reconhece as peças."),
    ("Overclock", "Fazer uma peça trabalhar acima da velocidade de fábrica. Ganha desempenho, mas esquenta mais e tem riscos."),
    ("Upgrade", "Trocar ou adicionar uma peça para melhorar o PC, sem precisar comprar outro inteiro."),
    ("Pente", "O jeito popular de chamar cada módulo de memória RAM: uma plaquinha comprida que encaixa na placa-mãe."),
    ("Gabinete", "A caixa onde ficam as peças. O tamanho dele limita, por exemplo, o comprimento da placa de vídeo."),
]

_INTEGRATED_GPU_HINTS = ("intel(r) uhd", "intel(r) hd", "uhd graphics", "hd graphics", "iris", "radeon(tm) graphics", "radeon graphics", "vega")
_DEDICATED_GPU_HINTS = ("nvidia", "geforce", "rtx", "gtx", "radeon rx", "radeon pro", "arc a", "quadro")


def getGuideParts():
    return PARTS


def getGuidePart(key):
    for part in PARTS:
        if part["key"] == key:
            return part
    return PARTS[0]


def getGlossary():
    return GLOSSARY


def _is_unknown(value):
    text = str(value or "").strip().lower()
    return not text or text.startswith("não identificado")


def _number(text):
    try:
        return float(str(text).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _format_gb(value):
    return f"{value:.1f}".replace(".", ",") + " GB"


def _parse_disk(line):
    """Lê as linhas do hardwareInfo.getDiskInfo(), como 'C:\\: 236.7 GB total, 87.1% usado'."""
    total = re.search(r"([\d.,]+)\s*GB total", line)
    used = re.search(r"([\d.,]+)%\s*usado", line)
    name = line.split(":")[0] + ":" if ":" in line else line
    return {
        "name": name,
        "total_gb": _number(total.group(1)) if total else None,
        "used_percent": _number(used.group(1)) if used else None,
    }


def _cores_index(cores):
    if cores <= 2:
        return 0
    if cores <= 4:
        return 1
    if cores <= 6:
        return 2
    return 3


def _ram_index(total_gb):
    if total_gb < 6:
        return 0
    if total_gb < 12:
        return 1
    if total_gb < 24:
        return 2
    return 3


def _free_index(free_percent):
    if free_percent < 15:
        return 0
    if free_percent < 30:
        return 1
    return 2


def describeForComputer(key, hardware):
    """Monta o bloco "No seu PC" e marca as réguas com os dados reais.

    Retorna um dicionário com:
      value: o valor principal em destaque;
      note: uma frase explicando o que isso significa;
      warn: True quando vale chamar atenção;
      marks: {ruler_key: posição na régua} e
      mark_notes: {ruler_key: frase abaixo da régua}.
    """
    result = {"value": "", "note": "", "warn": False, "marks": {}, "mark_notes": {}}
    if not hardware:
        result["value"] = "Lendo informações do computador…"
        return result

    if key == "cpu":
        name = hardware.get("processador", "")
        system = hardware.get("sistema", {}) or {}
        physical = system.get("physical_cpu_cores")
        logical = system.get("logical_cpu_cores")
        result["value"] = name if not _is_unknown(name) else "Não identificado"
        if physical and logical:
            result["note"] = f"{physical} núcleos e {logical} threads."
            result["marks"]["cpu_cores"] = _cores_index(physical)
            result["mark_notes"]["cpu_cores"] = f"Seu PC: {physical} núcleos."
        if "family" in name.lower() and "model" in name.lower():
            result["note"] = (result["note"] + " " if result["note"] else "") + (
                "O Windows informou só a família do processador; o modelo exato não apareceu."
            )
        return result

    if key == "ram":
        memory = hardware.get("memoria", {}) or {}
        total = memory.get("total_gb")
        usage = memory.get("usage_percent")
        if total is None:
            result["value"] = "Não identificada"
            return result
        result["value"] = f"{_format_gb(total)} · {str(usage).replace('.', ',')}% em uso"
        result["marks"]["ram_total"] = _ram_index(total)
        result["mark_notes"]["ram_total"] = f"Seu PC: {_format_gb(total)}."
        notes = []
        if usage is not None and usage >= 85:
            result["warn"] = True
            notes.append("Sua bancada está quase lotada. É comum isso causar travamentos.")
        elif usage is not None and usage >= 70:
            notes.append("A bancada está bem ocupada, mas ainda dá conta.")
        else:
            notes.append("Ainda sobra espaço na bancada.")
        if abs(round(total) - total) > 0.05:
            notes.append(
                f"Aparece {_format_gb(total)} e não {round(total)} GB porque uma parte fica reservada para o sistema e o vídeo integrado."
            )
        details = hardware.get("detalhes_modulos_ram")
        if details and "não" not in str(details).lower():
            notes.append(f"Pentes instalados: {details}.")
        result["note"] = " ".join(notes)
        return result

    if key == "gpu":
        names = hardware.get("placas_de_video", "")
        if _is_unknown(names):
            result["value"] = "Não identificada"
            result["note"] = "Se não houver uma placa separada, quem desenha a tela é o vídeo integrado do processador, que é bem mais simples."
            return result
        lower = names.lower()
        integrated = any(hint in lower for hint in _INTEGRATED_GPU_HINTS)
        dedicated = any(hint in lower for hint in _DEDICATED_GPU_HINTS)
        result["value"] = names
        if integrated and dedicated:
            result["note"] = "Seu PC tem as duas: a integrada, para o dia a dia, e uma dedicada, que entra em ação nos jogos."
        elif dedicated:
            result["note"] = "É uma placa dedicada, com bancada própria."
        elif integrated:
            result["note"] = "É um vídeo integrado: serve bem para o dia a dia e jogos leves, mas fica para trás em jogos pesados."
        return result

    if key == "disk":
        disks = [_parse_disk(line) for line in hardware.get("discos", []) or []]
        disks = [disk for disk in disks if disk["used_percent"] is not None]
        if not disks:
            result["value"] = "Nenhum disco acessível foi identificado"
            return result
        fullest = max(disks, key=lambda disk: disk["used_percent"])
        free = 100 - fullest["used_percent"]
        total = fullest["total_gb"] or 0
        result["value"] = f"Disco {fullest['name']} {_format_gb(total)} · {str(fullest['used_percent']).replace('.', ',')}% usado"
        result["marks"]["disk_free"] = _free_index(free)
        result["mark_notes"]["disk_free"] = f"Seu PC: {free:.1f}".replace(".", ",") + f"% livre no disco {fullest['name'].rstrip(':')}."
        result["mark_notes"]["disk_type"] = "Esta leitura não informa se o seu disco é SSD ou HD."
        if free < 15:
            result["warn"] = True
            result["note"] = f"Sobram {_format_gb(total * free / 100)}. Uma despensa lotada deixa o Windows mais lento para atualizar e organizar arquivos."
        else:
            result["note"] = f"Sobram {_format_gb(total * free / 100)} livres."
        if len(disks) > 1:
            result["note"] += f" Foram encontrados {len(disks)} discos ou partições."
        return result

    if key == "mb":
        board = hardware.get("placa_mae", "")
        if _is_unknown(board):
            result["value"] = "Não identificada"
        else:
            result["value"] = board
        result["note"] = "Ela define o que é compatível com o seu PC. Confira o modelo antes de comprar memória ou processador."
        return result

    if key == "psu":
        result["value"] = "Não dá para ler pelo Windows"
        result["note"] = "O modelo e a potência ficam numa etiqueta na lateral da fonte, dentro do gabinete."
        result["mark_notes"]["psu_watts"] = "Anote a potência da etiqueta e informe no Consultor de upgrades."
        return result

    return result
