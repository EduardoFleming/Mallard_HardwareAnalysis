import importlib.util
import os
import platform
import re
import subprocess
import sys
from datetime import datetime


def ensure_dependencies():
    """Install missing runtime packages into the Python running this app."""
    packages = {
        "PySide6": "PySide6",
        "psutil": "psutil",
        "google-generativeai": "google.generativeai",
        "nvidia-ml-py": "pynvml",
    }
    if platform.system() == "Windows":
        packages.update({"wmi": "wmi", "pywin32": "win32com"})

    missing = []
    for package, module in packages.items():
        try:
            installed = importlib.util.find_spec(module) is not None
        except ModuleNotFoundError:
            installed = False
        if not installed:
            missing.append(package)

    if not missing:
        return

    print("Instalando dependências necessárias: " + ", ".join(missing))
    if importlib.util.find_spec("pip") is None:
        raise SystemExit(
            "O pip não está disponível neste Python. Instale/ative o pip e execute "
            "python main.py novamente."
        )
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", *missing],
            check=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(
            "Não foi possível instalar as dependências automaticamente. "
            f"Confira a conexão com a internet e tente: {sys.executable} -m pip install "
            + " ".join(missing)
        ) from error


ensure_dependencies()

from PySide6.QtCore import QObject, QSettings, QThread, QTimer, Qt, Signal, Slot, QPointF, QUrl
from PySide6.QtGui import QDesktopServices, QFont, QPainter, QPen, QColor, QPalette
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QStackedWidget,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

import aiAnalysis
import hardwareInfo
import hardwareMonitoring


class TaskSignals(QObject):
    finished = Signal(object)
    failed = Signal(str)


class BackgroundTask(QThread):
    def __init__(self, callback):
        super().__init__()
        self.callback = callback
        self.signals = TaskSignals()

    def run(self):
        try:
            self.signals.finished.emit(self.callback())
        except Exception as error:
            self.signals.failed.emit(str(error))


class MetricChart(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.history = []
        self.background_color = QColor("#fafbfb")
        self.grid_color = QColor("#e7ebeb")
        self.label_color = QColor("#90989a")
        self.setMinimumHeight(230)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

    def set_theme(self, background, grid, label):
        self.background_color = QColor(background)
        self.grid_color = QColor(grid)
        self.label_color = QColor(label)
        self.update()

    def set_history(self, history):
        self.history = list(history)
        self.update()

    def paintEvent(self, event):
        del event
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.fillRect(self.rect(), self.background_color)
        if len(self.history) < 2:
            painter.setPen(self.label_color)
            painter.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, "Coletando amostras para montar o gráfico…")
            return

        left, right, top, bottom = 42, 16, 18, 28
        width = max(self.width() - left - right, 1)
        height = max(self.height() - top - bottom, 1)
        painter.setFont(QFont("Segoe UI", 8))
        for value in (0, 25, 50, 75, 100):
            y = top + height * (1 - value / 100)
            painter.setPen(QPen(self.grid_color, 1))
            painter.drawLine(left, round(y), self.width() - right, round(y))
            painter.setPen(self.label_color)
            painter.drawText(5, round(y) + 4, f"{value}%")

        series = (("CPU", "cpu", "#9e583a"), ("Memória", "ram", "#537782"), ("GPU", "gpu", "#74845a"))
        legend_x = left + 4
        for name, key, color in series:
            if not any(item.get(key) is not None for item in self.history):
                continue
            qcolor = QColor(color)
            painter.setPen(QPen(qcolor, 2.5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap, Qt.PenJoinStyle.RoundJoin))
            points = []
            for index, item in enumerate(self.history):
                value = item.get(key)
                if value is None:
                    continue
                x = left + width * index / max(len(self.history) - 1, 1)
                y = top + height * (1 - max(0.0, min(float(value), 100.0)) / 100)
                points.append(QPointF(x, y))
            if len(points) > 1:
                for start, end in zip(points, points[1:]):
                    painter.drawLine(start, end)
            painter.setPen(qcolor)
            painter.drawText(legend_x, self.height() - 7, name)
            legend_x += 58


def make_card(title, subtitle=None):
    frame = QFrame()
    frame.setObjectName("card")
    layout = QVBoxLayout(frame)
    layout.setContentsMargins(20, 18, 20, 18)
    layout.setSpacing(8)
    heading = QLabel(title)
    heading.setObjectName("cardHeading")
    layout.addWidget(heading)
    if subtitle:
        detail = QLabel(subtitle)
        detail.setObjectName("muted")
        detail.setWordWrap(True)
        layout.addWidget(detail)
    return frame, layout


def make_button(text, object_name="secondaryButton"):
    button = QPushButton(text)
    button.setObjectName(object_name)
    button.setCursor(Qt.CursorShape.PointingHandCursor)
    return button


def normalized_list(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    return [str(item) for item in value if item]


class HardwareAnalysisWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("HardwareAnalysis")
        self.resize(1180, 780)
        self.setMinimumSize(960, 660)

        self.hardware = None
        self.monitor_history = []
        self.analysis_thread = None
        self.hardware_thread = None
        self._closing = False
        self.settings = QSettings("HardwareAnalysis", "HardwareAnalysis")
        self.dark_mode = self.settings.value("dark_mode", False, type=bool)
        self.monitor_timer = QTimer(self)
        self.monitor_timer.setInterval(1000)
        self.monitor_timer.timeout.connect(self.update_monitor)

        self._build_shell()
        self._build_pages()
        self._apply_theme()
        self._load_saved_key()
        self.refresh_hardware()

    def _build_shell(self):
        root = QWidget()
        root_layout = QHBoxLayout(root)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        self.sidebar = QFrame()
        self.sidebar.setObjectName("sidebar")
        self.sidebar.setFixedWidth(238)
        side_layout = QVBoxLayout(self.sidebar)
        side_layout.setContentsMargins(20, 24, 20, 20)
        side_layout.setSpacing(9)

        brand = QLabel("HardwareAnalysis")
        brand.setObjectName("brand")
        side_layout.addWidget(brand)
        brand_sub = QLabel("HARDWARE · UPGRADES")
        brand_sub.setObjectName("brandSub")
        side_layout.addWidget(brand_sub)
        side_layout.addSpacing(28)

        self.nav_buttons = []
        for label, page in (
            ("Meu computador", 0),
            ("Monitoramento", 1),
            ("Consultor de upgrades", 2),
        ):
            button = QPushButton(label)
            button.setObjectName("navButton")
            button.setCheckable(True)
            button.setCursor(Qt.CursorShape.PointingHandCursor)
            button.clicked.connect(lambda checked=False, index=page: self.show_page(index))
            self.nav_buttons.append(button)
            side_layout.addWidget(button)

        side_layout.addSpacing(12)
        self.theme_button = QPushButton()
        self.theme_button.setObjectName("themeButton")
        self.theme_button.setCursor(Qt.CursorShape.PointingHandCursor)
        self.theme_button.clicked.connect(self.toggle_theme)
        side_layout.addWidget(self.theme_button)

        side_layout.addStretch(1)
        api_heading = QLabel("CONFIGURAÇÃO DA IA")
        api_heading.setObjectName("brandSub")
        side_layout.addWidget(api_heading)
        self.api_key_input = QLineEdit()
        self.api_key_input.setObjectName("apiKeyInput")
        self.api_key_input.setPlaceholderText("Chave Gemini")
        self.api_key_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.api_key_input.setToolTip("A chave é mantida nesta sessão e não é gravada pelo aplicativo.")
        self.api_key_input.textChanged.connect(self._update_key_status)
        side_layout.addWidget(self.api_key_input)
        self.api_key_status = QLabel()
        self.api_key_status.setObjectName("keyStatus")
        self.api_key_status.setWordWrap(True)
        self.api_key_status.setToolTip("Indicador local: mostra se foi digitada uma chave nesta sessão, sem exibir a chave completa.")
        side_layout.addWidget(self.api_key_status)
        api_link = QPushButton("Criar ou gerenciar chave ↗")
        api_link.setObjectName("textButton")
        api_link.clicked.connect(lambda: QDesktopServices.openUrl(QUrl("https://aistudio.google.com/app/apikey")))
        side_layout.addWidget(api_link)
        self.system_badge = QLabel("Detectando computador…")
        self.system_badge.setObjectName("systemBadge")
        self.system_badge.setWordWrap(True)
        side_layout.addWidget(self.system_badge)

        self.pages = QStackedWidget()
        self.pages.setObjectName("pages")
        root_layout.addWidget(self.sidebar)
        root_layout.addWidget(self.pages, 1)
        self.setCentralWidget(root)

    def _build_pages(self):
        self.pages.addWidget(self._build_computer_page())
        self.pages.addWidget(self._build_monitor_page())
        self.pages.addWidget(self._build_advisor_page())
        self.show_page(0)

    def _page_shell(self, eyebrow, title, description):
        page = QWidget()
        page.setObjectName("contentPage")
        page.setAutoFillBackground(True)
        page_layout = QVBoxLayout(page)
        page_layout.setContentsMargins(36, 30, 36, 28)
        page_layout.setSpacing(20)

        header = QHBoxLayout()
        header_labels = QVBoxLayout()
        header_labels.setSpacing(5)
        eyebrow_label = QLabel(eyebrow.upper())
        eyebrow_label.setObjectName("eyebrow")
        title_label = QLabel(title)
        title_label.setObjectName("pageTitle")
        description_label = QLabel(description)
        description_label.setObjectName("muted")
        description_label.setWordWrap(True)
        header_labels.addWidget(eyebrow_label)
        header_labels.addWidget(title_label)
        header_labels.addWidget(description_label)
        header.addLayout(header_labels, 1)
        page_layout.addLayout(header)
        return page, page_layout

    def _build_computer_page(self):
        page, layout = self._page_shell(
            "Visão geral",
            "Seu computador",
            "Componentes que conseguimos identificar neste equipamento.",
        )
        self.refresh_button = make_button("Atualizar componentes")
        self.refresh_button.clicked.connect(self.refresh_hardware)
        layout.itemAt(0).layout().addWidget(self.refresh_button, 0, Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignTop)

        self.hardware_status = QLabel("Lendo informações do computador…")
        self.hardware_status.setObjectName("muted")
        layout.addWidget(self.hardware_status)

        self.hardware_content = QWidget()
        self.hardware_grid = QGridLayout(self.hardware_content)
        self.hardware_grid.setContentsMargins(0, 0, 0, 0)
        self.hardware_grid.setSpacing(14)
        self.hardware_grid.setColumnStretch(0, 1)
        self.hardware_grid.setColumnStretch(1, 1)
        layout.addWidget(self.hardware_content)
        layout.addStretch(1)
        return page

    def _build_monitor_page(self):
        page, layout = self._page_shell(
            "Atividade",
            "Monitoramento",
            "Uso atual do computador, atualizado automaticamente a cada segundo.",
        )
        self.metric_labels = {}
        metric_row = QHBoxLayout()
        metric_row.setSpacing(14)
        for key, heading in (("cpu", "Processador"), ("ram", "Memória"), ("gpu", "Placa de vídeo")):
            card, card_layout = make_card(heading)
            value = QLabel("—")
            value.setObjectName("metricValue")
            note = QLabel("Aguardando leitura")
            note.setObjectName("muted")
            card_layout.addWidget(value)
            card_layout.addWidget(note)
            self.metric_labels[key] = (value, note)
            metric_row.addWidget(card, 1)
        layout.addLayout(metric_row)

        chart_card, chart_layout = make_card("Último minuto", "Histórico local das métricas enquanto o painel estiver aberto.")
        self.chart = MetricChart()
        self.chart.setObjectName("chartPlaceholder")
        chart_layout.addWidget(self.chart)
        layout.addWidget(chart_card, 1)
        self.monitor_note = QLabel(hardwareMonitoring.getPlatformNote() or "Sensores disponíveis conforme o sistema e os drivers.")
        self.monitor_note.setObjectName("muted")
        self.monitor_note.setWordWrap(True)
        layout.addWidget(self.monitor_note)
        return page

    def _build_advisor_page(self):
        page, layout = self._page_shell(
            "Planejamento",
            "Consultor de upgrades",
            "Conte o que você quer fazer no PC. Os campos opcionais podem ficar em branco.",
        )
        scroll = QScrollArea()
        scroll.setObjectName("advisorScroll")
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        form = QWidget()
        form.setObjectName("advisorForm")
        self.advisor_form = form
        form_layout = QVBoxLayout(form)
        form_layout.setContentsMargins(2, 2, 12, 18)
        form_layout.setSpacing(16)

        model_info_card, model_info_layout = make_card("Modelo usado nesta análise", "Este identificador é enviado ao Gemini quando você solicita recomendações.")
        self.model_name_label = QLabel(aiAnalysis.GEMINI_MODEL)
        self.model_name_label.setObjectName("modelName")
        model_info_layout.addWidget(self.model_name_label)
        form_layout.addWidget(model_info_card)

        preferences_card, preferences_layout = make_card("Seu uso", "As perguntas mudam de acordo com o que você escolher.")
        fields = QGridLayout()
        fields.setHorizontalSpacing(14)
        fields.setVerticalSpacing(10)

        self.use_case = QComboBox()
        self.use_case.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.use_case.addItems(["Jogos", "Trabalho", "Uso doméstico"])
        self.use_case.currentTextChanged.connect(self._update_profile_fields)
        self.focus_combo = QComboBox()
        self.focus_combo.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.focus_combo.setMinimumContentsLength(28)
        self.focus_combo.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon)
        self.resolution_combo = QComboBox()
        self.resolution_combo.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.resolution_combo.addItems(["Não sei / prefiro não informar", "1080p", "1440p", "4K"])
        self.resolution_label = QLabel("Resolução do monitor (opcional)")
        self.game_title = QLineEdit()
        self.game_title.setPlaceholderText("Ex.: League of Legends")
        self.game_title_label = QLabel("Jogo específico (opcional)")
        self.game_title_label.setObjectName("fieldLabel")
        self.focus_label = QLabel("O que você costuma fazer?")
        self.focus_label.setObjectName("fieldLabel")
        self.use_label = QLabel("Uso principal")
        self.use_label.setObjectName("fieldLabel")
        self.resolution_label.setObjectName("fieldLabel")

        fields.addWidget(self.use_label, 0, 0, 1, 2)
        fields.addWidget(self.use_case, 1, 0, 1, 2)
        fields.addWidget(self.focus_label, 2, 0, 1, 2)
        fields.addWidget(self.focus_combo, 3, 0, 1, 2)
        fields.addWidget(self.game_title_label, 4, 0)
        fields.addWidget(self.resolution_label, 4, 1)
        fields.addWidget(self.game_title, 5, 0)
        fields.addWidget(self.resolution_combo, 5, 1)
        fields.setColumnStretch(0, 1)
        fields.setColumnStretch(1, 1)
        fields.setHorizontalSpacing(18)
        fields.setVerticalSpacing(10)
        preferences_layout.addLayout(fields)
        form_layout.addWidget(preferences_card)

        budget_card, budget_layout = make_card("Orçamento e objetivo", "Se o valor não permitir um upgrade que valha a pena, o consultor vai explicar e respeitar seu limite.")
        budget_fields = QGridLayout()
        budget_fields.setHorizontalSpacing(14)
        budget_fields.setVerticalSpacing(10)
        self.budget = QLineEdit()
        self.budget.setPlaceholderText("Ex.: R$ 1.500 — deixe em branco se não tiver limite")
        self.purchase_preference = QComboBox()
        self.purchase_preference.addItems(["Tanto faz", "Somente novas", "Aceito usadas"])
        self.goal = QTextEdit()
        self.goal.setPlaceholderText("Opcional — por exemplo: menos travamentos ou mais FPS no jogo escolhido.")
        self.goal.setFixedHeight(78)
        budget_fields.addWidget(QLabel("Orçamento (opcional)"), 0, 0)
        budget_fields.addWidget(QLabel("Preferência por peças (opcional)"), 0, 1)
        budget_fields.addWidget(self.budget, 1, 0)
        budget_fields.addWidget(self.purchase_preference, 1, 1)
        budget_fields.addWidget(QLabel("O que você gostaria de melhorar? (opcional)"), 2, 0, 1, 2)
        budget_fields.addWidget(self.goal, 3, 0, 1, 2)
        budget_fields.setColumnStretch(0, 3)
        budget_fields.setColumnStretch(1, 2)
        budget_layout.addLayout(budget_fields)
        form_layout.addWidget(budget_card)

        self.extra_toggle = QCheckBox("Adicionar detalhes opcionais para verificar compatibilidade")
        self.extra_toggle.setObjectName("extraToggle")
        self.extra_toggle.toggled.connect(self._toggle_extra_fields)
        form_layout.addWidget(self.extra_toggle)
        self.extra_card, extra_layout = make_card("Detalhes do computador")
        extra_hint = QLabel("Preencha apenas o que você souber. Campos vazios serão ignorados.")
        extra_hint.setObjectName("muted")
        extra_hint.setWordWrap(True)
        extra_layout.addWidget(extra_hint)
        extra_fields = QGridLayout()
        extra_fields.setHorizontalSpacing(14)
        extra_fields.setVerticalSpacing(10)
        self.board_confirmation = QLineEdit()
        self.board_confirmation.setPlaceholderText("Ex.: modelo exato da placa-mãe")
        self.ram_confirmation = QLineEdit()
        self.ram_confirmation.setPlaceholderText("Ex.: 2x8 GB DDR4")
        self.psu_confirmation = QLineEdit()
        self.psu_confirmation.setPlaceholderText("Ex.: fonte 550 W")
        self.case_confirmation = QLineEdit()
        self.case_confirmation.setPlaceholderText("Ex.: limite de espaço para a GPU")
        self.hardware_correction = QLineEdit()
        self.hardware_correction.setPlaceholderText("Corrija algo que o app identificou errado")
        for row, (label, widget) in enumerate((
            ("Placa-mãe", self.board_confirmation),
            ("Memória RAM", self.ram_confirmation),
            ("Fonte", self.psu_confirmation),
            ("Gabinete", self.case_confirmation),
            ("Correção manual", self.hardware_correction),
        )):
            extra_fields.addWidget(QLabel(label), row, 0)
            extra_fields.addWidget(widget, row, 1)
        extra_fields.setColumnStretch(0, 1)
        extra_fields.setColumnStretch(1, 2)
        extra_layout.addLayout(extra_fields)
        self.extra_card.setVisible(False)
        form_layout.addWidget(self.extra_card)

        self.analyze_button = make_button("Analisar meu computador", "primaryButton")
        self.analyze_button.setMinimumHeight(46)
        self.analyze_button.clicked.connect(self.run_analysis)
        form_layout.addWidget(self.analyze_button)
        self.analysis_status = QLabel("")
        self.analysis_status.setObjectName("muted")
        self.analysis_status.setWordWrap(True)
        form_layout.addWidget(self.analysis_status)
        self.analysis_result = QWidget()
        self.analysis_result_layout = QVBoxLayout(self.analysis_result)
        self.analysis_result_layout.setContentsMargins(0, 0, 0, 0)
        self.analysis_result_layout.setSpacing(12)
        self.analysis_result.setVisible(False)
        form_layout.addWidget(self.analysis_result)
        form_layout.addStretch(1)
        scroll.setWidget(form)
        layout.addWidget(scroll, 1)
        self._update_profile_fields(self.use_case.currentText())
        return page

    def _apply_theme(self):
        self.theme_button.setText("☀  Usar tema claro" if self.dark_mode else "☾  Usar tema escuro")
        if self.dark_mode:
            colors = {
                "window": "#171a1c", "surface": "#202426", "surface_alt": "#252a2d",
                "border": "#363d40", "text": "#e7e9e7", "muted": "#a2aaa9",
                "accent": "#d18a64", "accent_hover": "#bd7550", "warning_bg": "#3a2b25",
                "warning": "#edb092", "input": "#1c2022", "selection": "#674533",
                "chart_grid": "#343a3c", "chart_label": "#a2aaa9", "chart_bg": "#1d2224",
                "sidebar": "#191e20", "nav_hover": "#2b3336", "nav_selected": "#343d40",
            }
        else:
            colors = {
                "window": "#f4f5f6", "surface": "#ffffff", "surface_alt": "#fafbfb",
                "border": "#e1e4e4", "text": "#202326", "muted": "#737b7e",
                "accent": "#9e583a", "accent_hover": "#87472e", "warning_bg": "#f8eee8",
                "warning": "#81472f", "input": "#ffffff", "selection": "#ead3c5",
                "chart_grid": "#e7ebeb", "chart_label": "#90989a", "chart_bg": "#fafbfb",
                "sidebar": "#20272b", "nav_hover": "#30393e", "nav_selected": "#394449",
            }
        self._theme_colors = colors
        for scroll in self.findChildren(QScrollArea):
            palette = scroll.viewport().palette()
            palette.setColor(QPalette.ColorRole.Window, QColor(colors["window"]))
            scroll.viewport().setPalette(palette)
            scroll.viewport().setAutoFillBackground(True)
        self.advisor_form.setAutoFillBackground(True)
        advisor_palette = self.advisor_form.palette()
        advisor_palette.setColor(QPalette.ColorRole.Window, QColor(colors["window"]))
        self.advisor_form.setPalette(advisor_palette)
        for page in self.pages.findChildren(QWidget, "contentPage"):
            page.setAutoFillBackground(True)
            page_palette = page.palette()
            page_palette.setColor(QPalette.ColorRole.Window, QColor(colors["window"]))
            page.setPalette(page_palette)
        self.pages.setAutoFillBackground(True)
        pages_palette = self.pages.palette()
        pages_palette.setColor(QPalette.ColorRole.Window, QColor(colors["window"]))
        self.pages.setPalette(pages_palette)
        self.chart.set_theme(colors["chart_bg"], colors["chart_grid"], colors["chart_label"])
        self.setStyleSheet(f"""
            QMainWindow, QWidget#pages, QWidget#contentPage, QWidget#advisorForm {{ background-color: {colors['window']}; color: {colors['text']}; }}
            QWidget {{ font-family: 'Segoe UI', 'Inter', sans-serif; font-size: 13px; color: {colors['text']}; }}
            QFrame#sidebar {{ background: {colors['sidebar']}; color: #f7f7f5; }}
            QLabel#brand {{ color: #ffffff; font-size: 17px; font-weight: 700; letter-spacing: 0; }}
            QLabel#brandSub {{ color: #aab3b3; font-size: 10px; font-weight: 700; letter-spacing: 1.1px; }}
            QLabel#systemBadge {{ color: #bec8c6; font-size: 11px; padding: 10px 0; }}
            QLabel#keyStatus {{ color: {colors['muted']}; font-size: 10px; padding-top: 1px; }}
            QLabel#keyStatus[configured="true"] {{ color: #82c79a; }}
            QLabel#keyStatus[configured="false"] {{ color: #d3a18b; }}
            QPushButton#navButton {{ text-align: left; color: #cbd1cf; background: transparent; border: 0; border-radius: 7px; padding: 11px 12px; font-weight: 550; }}
            QPushButton#navButton:hover {{ background: {colors['nav_hover']}; color: white; }}
            QPushButton#navButton:checked {{ color: #ffffff; background: {colors['nav_selected']}; border-left: 3px solid {colors['accent']}; padding-left: 9px; }}
            QPushButton#themeButton {{ text-align: left; color: #d1d8d6; background: {colors['nav_hover']}; border: 1px solid #3b4549; border-radius: 7px; padding: 10px 12px; }}
            QPushButton#themeButton:hover {{ color: white; border-color: {colors['accent']}; }}
            QPushButton#textButton {{ text-align: left; color: {colors['accent']}; background: transparent; border: 0; padding: 7px 0; }}
            QPushButton#textButton:hover {{ color: white; }}
            QLineEdit#apiKeyInput {{ background: #2a3338; color: white; border: 1px solid #3e494e; border-radius: 6px; padding: 9px; }}
            QLabel#eyebrow {{ color: {colors['accent']}; font-size: 10px; font-weight: 750; letter-spacing: 1.2px; }}
            QLabel#pageTitle {{ color: {colors['text']}; font-size: 27px; font-weight: 700; }}
            QLabel#muted {{ color: {colors['muted']}; }}
            QFrame#card {{ background: {colors['surface']}; border: 1px solid {colors['border']}; border-radius: 9px; }}
            QLabel#hardwareValue {{ color: {colors['text']}; font-size: 16px; font-weight: 650; padding-top: 5px; }}
            QLabel#hardwareLine {{ color: {colors['text']}; padding: 3px 0; }}
            QLabel#cardHeading {{ color: {colors['text']}; font-weight: 650; font-size: 14px; }}
            QLabel#modelName {{ color: {colors['accent']}; font-size: 15px; font-weight: 700; }}
            QLabel#metricValue {{ color: {colors['text']}; font-size: 29px; font-weight: 700; padding-top: 6px; }}
            QLabel#recommendationTitle {{ color: {colors['text']}; font-size: 16px; font-weight: 650; }}
            QLabel#budgetWarning {{ color: {colors['warning']}; background: {colors['warning_bg']}; border-radius: 5px; padding: 8px; }}
            QLabel#fieldLabel {{ color: {colors['text']}; font-weight: 600; }}
            QWidget#advisorForm {{ background-color: {colors['window']}; }}
            QScrollArea#advisorScroll {{ background-color: {colors['window']}; border: 0; }}
            QScrollArea#advisorScroll QWidget#qt_scrollarea_viewport {{ background-color: {colors['window']}; }}
            QLineEdit, QComboBox, QTextEdit {{ background: {colors['input']}; color: {colors['text']}; border: 1px solid {colors['border']}; border-radius: 6px; padding: 9px 10px; selection-background-color: {colors['selection']}; }}
            QLineEdit:focus, QComboBox:focus, QTextEdit:focus {{ border: 1px solid {colors['accent']}; }}
            QComboBox::drop-down {{ border: 0; width: 25px; }}
            QComboBox QAbstractItemView {{ background: {colors['surface']}; color: {colors['text']}; selection-background-color: {colors['selection']}; }}
            QCheckBox {{ color: {colors['muted']}; spacing: 8px; font-weight: 600; padding: 2px 0; }}
            QCheckBox:hover {{ color: {colors['accent']}; }}
            QCheckBox::indicator {{ width: 16px; height: 16px; border-radius: 4px; border: 1px solid {colors['border']}; background: {colors['surface']}; }}
            QCheckBox::indicator:checked {{ background: {colors['accent']}; border-color: {colors['accent']}; }}
            QPushButton#primaryButton {{ color: white; background: {colors['accent']}; border: 0; border-radius: 7px; padding: 11px 16px; font-weight: 650; }}
            QPushButton#primaryButton:hover {{ background: {colors['accent_hover']}; }}
            QPushButton#primaryButton:disabled {{ background: {colors['muted']}; }}
            QPushButton#secondaryButton {{ color: {colors['text']}; background: {colors['surface']}; border: 1px solid {colors['border']}; border-radius: 6px; padding: 9px 12px; font-weight: 600; }}
            QPushButton#secondaryButton:hover {{ background: {colors['surface_alt']}; border-color: {colors['muted']}; }}
            QPushButton#resultLink {{ color: {colors['accent']}; background: transparent; border: 0; padding: 4px 0; text-align: left; text-decoration: underline; }}
            QScrollBar:vertical {{ background: transparent; width: 10px; margin: 0; }}
            QScrollBar::handle:vertical {{ background: {colors['border']}; border-radius: 5px; min-height: 25px; }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
        """)

    @Slot()
    def toggle_theme(self):
        self.dark_mode = not self.dark_mode
        self.settings.setValue("dark_mode", self.dark_mode)
        self._apply_theme()

    def show_page(self, index):
        self.pages.setCurrentIndex(index)
        for position, button in enumerate(self.nav_buttons):
            button.setChecked(position == index)
        if index == 1:
            self.monitor_history.clear()
            self.monitor_timer.start()
            self.update_monitor()
        else:
            self.monitor_timer.stop()

    def _load_saved_key(self):
        self.api_key_input.blockSignals(True)
        self.api_key_input.setText(os.environ.get("GEMINI_API_KEY", ""))
        self.api_key_input.blockSignals(False)
        self._update_key_status(self.api_key_input.text())

    @Slot(str)
    def _update_key_status(self, value):
        key = value.strip()
        configured = bool(key)
        self.api_key_status.setProperty("configured", "true" if configured else "false")
        if configured:
            suffix = key[-4:] if len(key) >= 4 else "••••"
            self.api_key_status.setText(f"✓ Chave preenchida · termina em …{suffix}")
        else:
            self.api_key_status.setText("Chave não informada")
        self.api_key_status.style().unpolish(self.api_key_status)
        self.api_key_status.style().polish(self.api_key_status)
        self.api_key_status.update()

    def refresh_hardware(self):
        if self.hardware_thread and self.hardware_thread.isRunning():
            return
        self.refresh_button.setEnabled(False)
        self.hardware_status.setText("Lendo informações do computador…")
        self.hardware_thread = BackgroundTask(self._collect_hardware)
        self.hardware_thread.signals.finished.connect(self._hardware_loaded)
        self.hardware_thread.signals.failed.connect(self._hardware_failed)
        self.hardware_thread.start()

    @staticmethod
    def _collect_hardware():
        memory = hardwareInfo.getRamInfo()
        return {
            "sistema": hardwareInfo.getSystemInfo(),
            "processador": hardwareInfo.getCpuInfo(),
            "placas_de_video": hardwareInfo.getGpuInfo(),
            "placa_mae": hardwareInfo.getMotherboardInfo(),
            "memoria": memory,
            "detalhes_modulos_ram": hardwareInfo.getRamDetails(),
            "discos": hardwareInfo.getDiskInfo(),
        }

    @Slot(object)
    def _hardware_loaded(self, hardware):
        self.hardware = hardware
        self.refresh_button.setEnabled(True)
        self.hardware_status.setText("Leitura atualizada agora.")
        self.system_badge.setText(hardware["sistema"]["operating_system"])
        self._render_hardware_cards()

    @Slot(str)
    def _hardware_failed(self, error):
        self.refresh_button.setEnabled(True)
        self.hardware_status.setText(f"Não foi possível ler os componentes: {error}")

    def _render_hardware_cards(self):
        while self.hardware_grid.count():
            item = self.hardware_grid.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()

        if not self.hardware:
            return
        ram = self.hardware["memoria"]
        cards = [
            ("Processador", self.hardware["processador"], "Componente identificado pelo sistema"),
            ("Placa de vídeo", self.hardware["placas_de_video"], "Modelo detectado quando disponível"),
            ("Memória", f"{ram['total_gb']:.1f} GB", f"{ram['usage_percent']}% em uso · {self.hardware['detalhes_modulos_ram']}"),
            ("Placa-mãe", self.hardware["placa_mae"], "Confirme o modelo antes de comprar componentes"),
        ]
        for index, (title, value, subtitle) in enumerate(cards):
            card, card_layout = make_card(title, subtitle)
            value_label = QLabel(str(value))
            value_label.setWordWrap(True)
            value_label.setObjectName("hardwareValue")
            card_layout.addWidget(value_label)
            self.hardware_grid.addWidget(card, index // 2, index % 2)

        disk_card, disk_layout = make_card("Armazenamento")
        disks = self.hardware["discos"]
        if disks:
            for disk in disks:
                line = QLabel(f"•  {disk}")
                line.setObjectName("hardwareLine")
                disk_layout.addWidget(line)
        else:
            empty = QLabel("Nenhum volume acessível foi identificado.")
            empty.setObjectName("muted")
            disk_layout.addWidget(empty)
        self.hardware_grid.addWidget(disk_card, 2, 0, 1, 2)

    def update_monitor(self):
        cpu = hardwareMonitoring.getCpuUsage()
        ram = hardwareMonitoring.getRamUsage()
        gpu = hardwareMonitoring.getGpuUsage()
        self.metric_labels["cpu"][0].setText(f"{cpu}%")
        self.metric_labels["cpu"][1].setText("Uso total do processador")
        self.metric_labels["ram"][0].setText(f"{ram['percent']}%")
        self.metric_labels["ram"][1].setText(f"{ram['used_gb']:.1f} GB usados")
        if gpu["usage"] is None:
            self.metric_labels["gpu"][0].setText("Indisponível")
            self.metric_labels["gpu"][1].setText("Este sensor não está disponível")
        else:
            self.metric_labels["gpu"][0].setText(f"{gpu['usage']}%")
            temp = f" · {gpu['temp']} °C" if gpu["temp"] is not None else ""
            self.metric_labels["gpu"][1].setText(f"{gpu['name']}{temp}")

        sample = {
            "time": datetime.now().strftime("%H:%M:%S"),
            "cpu": float(cpu),
            "ram": float(ram["percent"]),
            "gpu": float(gpu["usage"]) if gpu["usage"] is not None else None,
        }
        self.monitor_history.append(sample)
        self.monitor_history = self.monitor_history[-60:]
        self._draw_chart()

    def closeEvent(self, event):
        self.monitor_timer.stop()
        active_threads = [
            thread for thread in (self.analysis_thread, self.hardware_thread)
            if thread and thread.isRunning()
        ]
        if active_threads:
            event.ignore()
            if not self._closing:
                self._closing = True
                self.setWindowTitle("HardwareAnalysis — finalizando tarefa")
                for thread in active_threads:
                    thread.finished.connect(self._close_after_tasks)
            return
        super().closeEvent(event)

    @Slot()
    def _close_after_tasks(self):
        if not any(
            thread and thread.isRunning()
            for thread in (self.analysis_thread, self.hardware_thread)
        ):
            self.close()

    def _draw_chart(self):
        self.chart.set_history(self.monitor_history)

    @Slot(bool)
    def _toggle_extra_fields(self, visible):
        self.extra_card.setVisible(visible)

    @Slot(str)
    def _update_profile_fields(self, use_case):
        self.focus_combo.clear()
        if use_case == "Jogos":
            self.focus_label.setText("Que tipo de jogo você quer jogar?")
            self.focus_combo.addItems([
                "Competitivos leves (LoL, Valorant, CS2)",
                "Jogos AAA com gráficos avançados",
                "Indie e jogos antigos",
                "Simuladores e estratégia",
                "Vários tipos de jogo",
            ])
            self.game_title_label.setVisible(True)
            self.game_title.setVisible(True)
            self.resolution_label.setText("Resolução do monitor (opcional)")
            self.resolution_label.setVisible(True)
            self.resolution_combo.setVisible(True)
        elif use_case == "Trabalho":
            self.focus_label.setText("Qual tipo de trabalho?")
            self.focus_combo.addItems([
                "Escritório e navegação", "Programação", "Edição de vídeo/foto",
                "Modelagem 3D/CAD", "Outro / vários tipos",
            ])
            self.game_title_label.setVisible(False)
            self.game_title.setVisible(False)
            self.resolution_label.setVisible(False)
            self.resolution_combo.setVisible(False)
        else:
            self.focus_label.setText("Qual é seu uso doméstico mais comum?")
            self.focus_combo.addItems([
                "Navegação e estudos", "Filmes e vídeos", "Chamadas de vídeo",
                "Armazenar/compartilhar arquivos", "Um pouco de tudo",
            ])
            self.game_title_label.setVisible(False)
            self.game_title.setVisible(False)
            self.resolution_label.setVisible(False)
            self.resolution_combo.setVisible(False)

    def run_analysis(self):
        if not self.hardware:
            self.analysis_status.setText("Aguarde a leitura dos componentes ou tente atualizar as informações.")
            return
        api_key = self.api_key_input.text().strip()
        if not api_key:
            QMessageBox.information(self, "Chave Gemini necessária", "Informe sua chave da API Gemini na barra lateral para pedir a análise.")
            return
        use_case = self.use_case.currentText()
        focus = self.focus_combo.currentText()
        preferences = {
            "resolucao": self.resolution_combo.currentText() if use_case == "Jogos" else None,
            "orcamento": self.budget.text().strip() or None,
            "preferencia_compra": self.purchase_preference.currentText(),
            "foco_de_jogos": focus if use_case == "Jogos" else None,
            "jogo_especifico": self.game_title.text().strip() or None if use_case == "Jogos" else None,
            "foco_de_trabalho_ou_uso_domestico": focus if use_case != "Jogos" else None,
            "objetivo_especifico": self.goal.toPlainText().strip() or None,
            "confirmacao_placa_mae": self.board_confirmation.text().strip() or None,
            "detalhes_ram_informados": self.ram_confirmation.text().strip() or None,
            "fonte_informada": self.psu_confirmation.text().strip() or None,
            "gabinete_informado": self.case_confirmation.text().strip() or None,
            "correcao_manual_do_hardware": self.hardware_correction.text().strip() or None,
        }
        self.analyze_button.setEnabled(False)
        self.analysis_status.setText("Analisando compatibilidade e prioridades de upgrade…")
        self.analysis_thread = BackgroundTask(
            lambda: aiAnalysis.consultar_gemini(api_key, self.hardware, use_case, preferences)
        )
        self.analysis_thread.signals.finished.connect(self._analysis_loaded)
        self.analysis_thread.signals.failed.connect(self._analysis_failed)
        self.analysis_thread.start()

    @Slot(object)
    def _analysis_loaded(self, analysis):
        self.analyze_button.setEnabled(True)
        self.analysis_status.setText("Análise concluída. Os links de pesquisa não são cotações de preço.")
        self._render_analysis(analysis)

    @Slot(str)
    def _analysis_failed(self, error):
        self.analyze_button.setEnabled(True)
        message = self._friendly_analysis_error(error)
        self.analysis_status.setText(message)

    @staticmethod
    def _friendly_analysis_error(error):
        text = str(error)
        lowered = text.lower()
        if "429" in lowered or "resource_exhausted" in lowered or "quota" in lowered:
            retry_seconds = None
            match = re.search(
                r"retry in (?:(\d+)h)?(?:(\d+)m)?([0-9]+(?:\.[0-9]+)?)s",
                text,
                flags=re.IGNORECASE,
            )
            if match:
                hours = int(match.group(1) or 0)
                minutes = int(match.group(2) or 0)
                seconds = int(float(match.group(3)))
                retry_seconds = max(1, hours * 3600 + minutes * 60 + seconds)
            else:
                match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", text, flags=re.IGNORECASE)
                if match:
                    retry_seconds = max(1, int(match.group(1)))
            if retry_seconds:
                hours, remainder = divmod(retry_seconds, 3600)
                minutes, seconds = divmod(remainder, 60)
                if hours:
                    wait = f"{hours} h, {minutes} min"
                elif minutes:
                    wait = f"{minutes} min e {seconds} s"
                else:
                    wait = f"{seconds} s"
                return (
                    "O Google Gemini recusou a solicitação por limite de uso. "
                    f"Aguarde pelo menos {wait} antes de tentar de novo. "
                    "Se continuar acontecendo, confira as cotas do projeto ligado a esta chave no Google AI Studio."
                )
            return (
                "O Google Gemini informou que a cota deste projeto ou modelo foi atingida. "
                "Aguarde a cota indicada no AI Studio ser renovada e confira se a chave pertence ao projeto esperado."
            )
        if "503" in lowered or "unavailable" in lowered or "overloaded" in lowered:
            return "O serviço Gemini está temporariamente indisponível ou sobrecarregado. Aguarde um pouco e tente novamente."
        return f"Não foi possível concluir a análise: {text}"

    def _clear_layout(self, layout):
        while layout.count():
            item = layout.takeAt(0)
            widget = item.widget()
            child_layout = item.layout()
            if widget:
                widget.deleteLater()
            elif child_layout:
                self._clear_layout(child_layout)

    def _render_analysis(self, analysis):
        self._clear_layout(self.analysis_result_layout)
        summary, summary_layout = make_card("Resumo", analysis.get("verdict", "Análise concluída."))
        confidence = QLabel(f"Confiança da análise: {analysis.get('confidence', 'não informada')}")
        confidence.setObjectName("muted")
        summary_layout.addWidget(confidence)
        self.analysis_result_layout.addWidget(summary)

        if analysis.get("budget_status") == "no_worthwhile_upgrade":
            budget_card, budget_layout = make_card("Sobre o seu orçamento")
            message = QLabel(analysis.get("budget_message") or "Com esse orçamento, não foi identificado um upgrade que valha a pena. Não é necessário comprar uma peça agora.")
            message.setWordWrap(True)
            message.setObjectName("budgetWarning")
            budget_layout.addWidget(message)
            self.analysis_result_layout.addWidget(budget_card)
        elif analysis.get("budget_message"):
            note_card, note_layout = make_card("Sobre o seu orçamento")
            note = QLabel(analysis["budget_message"])
            note.setWordWrap(True)
            note_layout.addWidget(note)
            self.analysis_result_layout.addWidget(note_card)

        self._add_list_card("Análise técnica", analysis.get("analysis", []))
        self._add_list_card("Gargalos identificados", analysis.get("bottlenecks", []))

        recommendations = analysis.get("recommendations", [])
        for item in recommendations:
            title = f"{str(item.get('priority', 'Prioridade não definida')).capitalize()} prioridade · {item.get('component', 'Componente')}"
            card, card_layout = make_card(title)
            suggestion = QLabel(item.get("suggestion", "Sem sugestão específica"))
            suggestion.setObjectName("recommendationTitle")
            suggestion.setWordWrap(True)
            card_layout.addWidget(suggestion)
            if item.get("current"):
                current = QLabel(f"Atual: {item['current']}")
                current.setObjectName("muted")
                card_layout.addWidget(current)
            reason = QLabel(item.get("reason", ""))
            reason.setWordWrap(True)
            card_layout.addWidget(reason)
            compatibility = QLabel(f"Compatibilidade: {item.get('compatibility', 'não informada')}")
            compatibility.setObjectName("muted")
            card_layout.addWidget(compatibility)
            checks = normalized_list(item.get("verify_before_buying"))
            if checks:
                verify = QLabel("Antes de comprar, confirme: " + "; ".join(checks))
                verify.setWordWrap(True)
                verify.setObjectName("budgetWarning")
                card_layout.addWidget(verify)
            query = str(item.get("search_query", "")).strip()
            if query:
                link = QPushButton("Pesquisar produtos (não é cotação) ↗")
                link.setObjectName("resultLink")
                link.setCursor(Qt.CursorShape.PointingHandCursor)
                link.clicked.connect(lambda checked=False, search=query: QDesktopServices.openUrl(QUrl(aiAnalysis.get_search_url(search))))
                card_layout.addWidget(link, 0, Qt.AlignmentFlag.AlignLeft)
            self.analysis_result_layout.addWidget(card)
        if not recommendations:
            no_recommendation, no_recommendation_layout = make_card("Nenhum upgrade recomendado")
            no_recommendation_layout.addWidget(QLabel("Com os dados atuais, faz mais sentido manter as peças ou confirmar algumas informações antes de comprar."))
            self.analysis_result_layout.addWidget(no_recommendation)

        missing = normalized_list(analysis.get("missing_information"))
        if missing:
            self._add_list_card("Informações que podem melhorar a análise", missing)
        self.analysis_result.setVisible(True)

    def _add_list_card(self, title, values):
        lines = normalized_list(values)
        if not lines:
            return
        card, card_layout = make_card(title)
        for line in lines:
            label = QLabel(f"•  {line}")
            label.setWordWrap(True)
            card_layout.addWidget(label)
        self.analysis_result_layout.addWidget(card)


def run_app():
    app = QApplication(sys.argv)
    app.setApplicationName("HardwareAnalysis")
    app.setFont(QFont("Segoe UI", 10))
    window = HardwareAnalysisWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(run_app())
