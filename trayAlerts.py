"""Aviso na bandeja do Windows: o pato avisa quando algo está passando do ponto, sem precisar abrir o app.

Duas partes separadas:
- AlertEngine decide QUANDO avisar (limites, sustentação e tempo de espera). Não depende de tela nem de
  sistema operacional, então dá para testar com leituras de mentira.
- TrayService mostra o ícone da bandeja (pystray), o menu e as notificações. Se o pystray ou o Pillow não
  existirem (ou não houver bandeja), o app segue funcionando sem os avisos.

Os avisos só funcionam enquanto o Mallard está aberto, como o Diário. Nada é enviado para fora do computador.
"""

import threading
import time
from datetime import date

import temperatureSensors

MEM_LIMIT = 90        # % de memória
MEM_REARM = 80        # volta a avisar só depois de cair abaixo disso
MEM_SAMPLES = 12      # leituras seguidas (~1 minuto) acima do limite: não avisa por um pico de segundos
DISK_LIMIT = 90       # % do disco do sistema
DISK_REARM = 85
COOLDOWN_SECONDS = 30 * 60
CHECK_SECONDS = 5
TEMP_CHECK_SECONDS = 30

KINDS = ("mem", "disk", "temp")


def _fmt(value, digits=1):
    return f"{value:.{digits}f}".replace(".", ",")


class AlertEngine:
    """Guarda o que já foi avisado e decide se vale avisar de novo."""

    def __init__(self, cooldown=COOLDOWN_SECONDS, samples=MEM_SAMPLES):
        self.cooldown = cooldown
        self.samples = samples
        self._streak = 0
        self._armed = {kind: True for kind in KINDS}
        self._last = {kind: None for kind in KINDS}

    def _ready(self, kind, now):
        last = self._last[kind]
        return self._armed[kind] and (last is None or now - last >= self.cooldown)

    def _fire(self, kind, now):
        self._armed[kind] = False
        self._last[kind] = now

    def evaluate(self, sample, prefs, now=None, top_fn=None):
        """sample: {"ram": {percent, used_gb, total_gb}, "disk": {percent, free_gb, total_gb} | None, "temps": dict | None}.

        Devolve a lista de avisos novos: [{"kind", "sev", "title", "text", "page"}]."""
        now = time.monotonic() if now is None else now
        alerts = []

        ram = sample.get("ram") or {}
        percent = ram.get("percent")
        if percent is not None:
            self._streak = self._streak + 1 if percent >= MEM_LIMIT else 0
            if percent < MEM_REARM:
                self._armed["mem"] = True
            if prefs.get("alert_mem", True) and self._streak >= self.samples and self._ready("mem", now):
                self._fire("mem", now)
                alerts.append(self._memory_alert(ram, top_fn))

        disk = sample.get("disk")
        if disk and disk.get("percent") is not None:
            if disk["percent"] < DISK_REARM:
                self._armed["disk"] = True
            if prefs.get("alert_disk", True) and disk["percent"] >= DISK_LIMIT and self._ready("disk", now):
                self._fire("disk", now)
                free_pct = max(0, round(100 - disk["percent"]))
                alerts.append({"kind": "disk", "sev": "warn", "page": "cleanup",
                               "title": "O disco C: está quase cheio",
                               "text": f"Restam {free_pct}% ({_fmt(disk.get('free_gb', 0))} GB). A Limpeza mostra o que dá para apagar com segurança."})

        temps = sample.get("temps")
        if temps:
            hot = [(kind, temps[kind]["temp"]) for kind in ("cpu", "gpu") if temps.get(kind, {}).get("state") == "crit"]
            if not hot:
                self._armed["temp"] = True
            elif prefs.get("alert_temp", True) and self._ready("temp", now):
                self._fire("temp", now)
                kind, value = max(hot, key=lambda item: item[1])
                name = "Processador" if kind == "cpu" else "Placa de vídeo"
                alerts.append({"kind": "temp", "sev": "crit", "page": "temperature",
                               "title": f"{name} a {round(value)} °C",
                               "text": "Está esquentando demais. Salve seu trabalho e feche programas pesados."})
        return alerts

    @staticmethod
    def _memory_alert(ram, top_fn):
        text = "O computador pode ficar lento ou travar. Feche o que você não estiver usando."
        top = None
        try:
            top = top_fn() if top_fn else None
        except Exception:  # noqa: BLE001
            top = None
        if top and top.get("name") and top.get("memory_mb") and ram.get("total_gb"):
            gb = top["memory_mb"] / 1000
            share = round(100 * gb / ram["total_gb"])
            text = f"O {top['name']} usa {_fmt(gb)} GB. Fechar libera cerca de {share}% da memória."
        return {"kind": "mem", "sev": "crit", "page": "monitor", "title": f"Memória em {round(ram['percent'])}%", "text": text}


def sampleSeverity(sample):
    """Resumo para o menu da bandeja: ('ok' | 'warn' | 'crit', texto curto)."""
    ram = (sample.get("ram") or {}).get("percent")
    disk = (sample.get("disk") or {}).get("percent")
    temps = sample.get("temps") or {}
    if ram is not None and ram >= MEM_LIMIT:
        return "crit", f"Memória em {round(ram)}%"
    if any(temps.get(k, {}).get("state") == "crit" for k in ("cpu", "gpu")):
        return "crit", "Temperatura alta"
    if disk is not None and disk >= DISK_LIMIT:
        return "warn", f"Disco C: em {round(disk)}%"
    if ram is not None and ram >= 80:
        return "warn", f"Memória em {round(ram)}%"
    return "ok", "Tudo certo por aqui"


class TrayService:
    """Ícone da bandeja + notificações. Cria uma thread própria e nunca derruba o app."""

    COLORS = {"ok": (56, 196, 122), "warn": (242, 169, 59), "crit": (255, 107, 107)}

    def __init__(self, sample_fn, prefs_fn, top_fn=None, on_open=None, on_mini=None, on_quit=None):
        self._sample_fn = sample_fn
        self._prefs_fn = prefs_fn
        self._top_fn = top_fn
        self._on_open = on_open or (lambda page=None: None)
        self._on_mini = on_mini or (lambda: None)
        self._on_quit = on_quit or (lambda: None)
        self.engine = AlertEngine()
        self.icon = None
        self.available = False
        self.status = ("ok", "Tudo certo por aqui")
        self._snooze_day = None
        self._stop = threading.Event()
        self._thread = None
        self._last_temps = None
        self._last_temp_at = 0.0

    # -- estado ---------------------------------------------------------
    @property
    def snoozed(self):
        return self._snooze_day == date.today()

    def setSnooze(self, on):
        self._snooze_day = date.today() if on else None
        self._refresh_menu()

    def setVisible(self, visible):
        if self.icon is not None:
            try:
                self.icon.visible = bool(visible)
            except Exception:  # noqa: BLE001
                pass

    def info(self):
        return {"available": self.available, "snoozed": self.snoozed, "status": self.status[0], "text": self.status[1]}

    # -- ícone ----------------------------------------------------------
    def _image(self, level):
        from PIL import Image, ImageDraw  # noqa: PLC0415 - só existe com o pacote instalado

        size = 64
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((2, 2, size - 2, size - 2), radius=14, fill=(11, 15, 13, 255))
        d.ellipse((14, 10, 46, 42), fill=(31, 138, 87, 255))                 # cabeça
        d.polygon([(40, 24), (60, 28), (40, 34)], fill=(233, 194, 58, 255))  # bico
        d.ellipse((30, 19, 36, 25), fill=(255, 255, 255, 255))               # olho
        d.ellipse((32, 20, 35, 24), fill=(11, 15, 13, 255))
        d.rectangle((14, 42, 50, 54), fill=(31, 138, 87, 255))               # corpo
        d.ellipse((40, 40, 62, 62), fill=self.COLORS[level] + (255,), outline=(11, 15, 13, 255), width=3)  # luz de estado
        return img

    def _build_icon(self):
        import pystray  # noqa: PLC0415

        menu = pystray.Menu(
            pystray.MenuItem(lambda item: self.status[1], None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Abrir o Mallard", lambda icon, item: self._on_open(None), default=True),
            pystray.MenuItem("Ver o Monitor", lambda icon, item: self._on_open("monitor")),
            pystray.MenuItem("Mini-modo", lambda icon, item: self._on_mini()),
            pystray.MenuItem("Pausar avisos por hoje", lambda icon, item: self.setSnooze(not self.snoozed), checked=lambda item: self.snoozed),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair do Mallard", lambda icon, item: self._on_quit()),
        )
        return pystray.Icon("mallard", self._image("ok"), "Mallard", menu)

    def _refresh_menu(self):
        if self.icon is not None:
            try:
                self.icon.update_menu()
            except Exception:  # noqa: BLE001
                pass

    def _set_status(self, level, text):
        changed = self.status[0] != level
        self.status = (level, text)
        if self.icon is not None:
            try:
                if changed:
                    self.icon.icon = self._image(level)
                self.icon.title = f"Mallard · {text}"
                self.icon.update_menu()
            except Exception:  # noqa: BLE001
                pass

    # -- avisos ---------------------------------------------------------
    def notify(self, title, text):
        """Mostra uma notificação do sistema. Devolve False se não deu."""
        if self.icon is None:
            return False
        try:
            self.icon.notify(text[:250], title[:60])
            return True
        except Exception:  # noqa: BLE001
            return False

    def sendTest(self, kind="mem"):
        """Mostra um aviso de exemplo (botão "Ver o aviso" nas Configurações)."""
        samples = {
            "mem": ("Memória em 95%", "Exemplo: o Google Chrome usa 1,9 GB. Fechar libera cerca de 24% da memória."),
            "disk": ("O disco C: está quase cheio", "Exemplo: restam 9% (21,3 GB). A Limpeza mostra o que dá para apagar."),
            "temp": ("Processador a 88 °C", "Exemplo: está esquentando demais. Salve seu trabalho e feche programas pesados."),
        }
        title, text = samples.get(kind, samples["mem"])
        return self.notify(title, text)

    def _tick(self):
        prefs = self._prefs_fn() or {}
        if not prefs.get("tray_alerts", True):
            return
        sample = self._sample_fn() or {}
        now = time.monotonic()
        if prefs.get("alert_temp", True) and now - self._last_temp_at >= TEMP_CHECK_SECONDS:
            self._last_temps = temperatureSensors.readTemperatures()
            self._last_temp_at = now
        sample["temps"] = self._last_temps if prefs.get("alert_temp", True) else None
        self._set_status(*sampleSeverity(sample))
        alerts = self.engine.evaluate(sample, prefs, now, self._top_fn)
        if self.snoozed:
            return
        for alert in alerts:
            self.notify(alert["title"], alert["text"])

    def _loop(self):
        while not self._stop.wait(CHECK_SECONDS):
            try:
                self._tick()
            except Exception:  # noqa: BLE001 - o aviso nunca pode derrubar o app
                pass

    # -- ciclo de vida --------------------------------------------------
    def start(self):
        """Liga a bandeja. Devolve True se o ícone apareceu."""
        try:
            self.icon = self._build_icon()
            self.icon.run_detached()
            self.available = True
        except Exception:  # noqa: BLE001 - sem pystray/Pillow/bandeja: o app segue sem avisos
            self.icon = None
            self.available = False
            return False
        self._thread = threading.Thread(target=self._loop, daemon=True, name="mallard-bandeja")
        self._thread.start()
        return True

    def stop(self):
        self._stop.set()
        if self.icon is not None:
            try:
                self.icon.stop()
            except Exception:  # noqa: BLE001
                pass
