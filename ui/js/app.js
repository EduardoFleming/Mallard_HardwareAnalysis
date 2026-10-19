/* Núcleo da interface: estado, navegação, temas (os patos) e avisos. */

const THEMES = [
  { id: "mallard", name: "Mallard", kind: "Pato-real macho", plume: "#1F8A57", beak: "#E9C23A", desc: "Cabeça verde iridescente e espéculo azul-violeta. O tema padrão." },
  { id: "pekin", name: "Pekin", kind: "Branco", plume: "#F7F5EF", beak: "#F28A2E", desc: "O pato doméstico mais famoso: penas brancas e bico laranja. Tema claro." },
  { id: "femea", name: "Fêmea", kind: "Marrom e bege", plume: "#A9805A", beak: "#E08A3A", desc: "A camuflagem da fêmea do pato-real, com o espéculo azul. Claro e quente." },
  { id: "cinzento", name: "Cinzento", kind: "Cinza", plume: "#8E949B", beak: "#F2B53A", desc: "Do cinza-claro ao chumbo, com bico amarelo. Escuro e neutro." },
  { id: "cayuga", name: "Cayuga", kind: "Preto", plume: "#1B2A22", beak: "#38C47A", desc: "Penas pretas com brilho verde-besouro. O tema mais escuro." },
];
const SECRET_THEME = { id: "patinho", name: "Patinho Feio", kind: "Tema secreto · 1972", plume: "#041207", beak: "#33FF66", desc: "Verde de fósforo no fundo preto, em homenagem ao primeiro computador feito no Brasil." };

/* ---------- Utilidades ---------- */
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmt(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits).replace(".", ",");
}
function isUnknown(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return !text || text.startsWith("não identificado");
}
function linkGo(label, attrs) {
  return `<button type="button" class="link-go" ${attrs}>${esc(label)}<span class="arr">${icon("arrow", 16)}</span></button>`;
}
function pageHeader(kicker, title, subtitle, right = "") {
  return `<header class="page-header in">
    <div class="stack" style="gap:0;min-width:0">
      <span class="kicker">${esc(kicker)}</span>
      <h1 class="page-title">${esc(title)}</h1>
      <p class="muted" style="margin:0">${subtitle}</p>
    </div>${right}</header>`;
}

/* ---------- Aplicativo ---------- */
const App = {
  state: { settings: null, hardware: null, page: null, info: null, ai: { has_key: false }, request: null },
  navOf: { analyzing: "advisor", result: "advisor", error: "advisor" },
  pages: {},
  listeners: {},
  logoClicks: 0,
  logoTimer: null,

  register(id, page) { this.pages[id] = page; },
  on(event, handler) { (this.listeners[event] ||= []).push(handler); },
  emit(event, data) { (this.listeners[event] || []).forEach((handler) => handler(data)); },

  async start() {
    document.querySelectorAll(".nav-btn").forEach((button) => {
      button.insertAdjacentHTML("afterbegin", icon(button.dataset.icon, 19));
    });
    document.getElementById("settings-link-label").insertAdjacentHTML("afterbegin", icon("gear", 17));
    document.getElementById("brand-logo").innerHTML = logoSymbol(40, 10);

    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-page]");
      if (target && !target.closest(".page")) this.go(target.dataset.page);
      const go = event.target.closest("[data-go]");
      if (go) this.go(go.dataset.go, { part: go.dataset.part });
      const url = event.target.closest("[data-url]");
      if (url) { event.preventDefault(); Bridge.call("open_url", url.dataset.url); }
    });
    document.getElementById("brand-logo").addEventListener("click", () => this.logoClick());

    Object.values(this.pages).forEach((page) => page.init && page.init());

    try {
      this.state.settings = await Bridge.call("get_settings");
    } catch (error) {
      this.showFatal(error);
      return;
    }
    this.applyTheme(this.state.settings.theme);
    this.applyReduceMotion(this.state.settings.reduce_motion);
    this.renderDuckPicker();
    this.go("computer");

    Bridge.call("get_app_info").then((info) => {
      this.state.info = info;
      document.getElementById("version-label").textContent = `${info.os} · v${info.version}`;
    }).catch((error) => this.showFatal(error));
    const loaded = await this.loadHardware(false);
    if (!loaded) return;
    await this.refreshAi();
  },

  showFatal(error) {
    const main = document.getElementById("content");
    main.innerHTML = `<section class="page active" style="display:flex;max-width:760px;margin:10vh auto;gap:18px">
      <span class="kicker">INICIALIZAÇÃO</span><h1 class="page-title">Não foi possível iniciar o Mallard</h1>
      <p class="muted">O backend Python não conseguiu carregar os dados reais do computador. Feche esta janela e inicie novamente com <code>python app.py</code>.</p>
      <pre class="panel pad" style="white-space:pre-wrap">${esc(error)}</pre></section>`;
  },

  /* ---------- IA (a chave fica só na memória do Python) ---------- */
  async refreshAi() {
    this.state.ai = await Bridge.call("get_ai_status");
    this.renderAiStatus();
    return this.state.ai;
  },
  async setApiKey(key) {
    this.state.ai = await Bridge.call("set_api_key", key);
    this.renderAiStatus();
    this.emit("ai", this.state.ai);
    return this.state.ai;
  },
  async forgetApiKey() {
    this.state.ai = await Bridge.call("forget_api_key");
    this.renderAiStatus();
    this.emit("ai", this.state.ai);
  },
  renderAiStatus() {
    const ok = this.state.ai.has_key;
    document.getElementById("ai-dot").style.background = ok ? "var(--acc-text)" : "var(--warn)";
    const text = document.getElementById("ai-text");
    text.textContent = ok ? `IA: pronta${this.state.ai.masked ? ` · chave ${this.state.ai.masked}` : " nesta sessão"}` : "IA: chave não informada";
    text.style.color = ok ? "var(--text2)" : "var(--warn)";
  },

  /* ---------- Conquista: virou cisne ---------- */
  swanMoment() {
    const logo = document.getElementById("brand-logo");
    logo.innerHTML = `<span class="pop" style="display:flex">${swanSymbol(40, 10)}</span>`;
    clearTimeout(this.swanTimer);
    this.swanTimer = setTimeout(() => { logo.innerHTML = logoSymbol(40, 10); }, 4500);
  },

  async loadHardware(refresh) {
    this.emit("hardware-loading");
    try {
      this.state.hardware = await Bridge.call("get_hardware", !!refresh);
      const type = this.state.hardware.tipo_de_maquina === "notebook" ? "Notebook" : "Desktop";
      document.getElementById("device-label").textContent = `${type} · ${this.state.hardware.sistema.operating_system}`;
      this.emit("hardware", this.state.hardware);
      return true;
    } catch (error) {
      this.emit("hardware-error", String(error));
      this.showFatal(error);
      return false;
    }
  },

  go(id, options = {}) {
    if (!this.pages[id]) return;
    if (this.state.page && this.state.page !== id) {
      const previous = this.pages[this.state.page];
      previous.hide && previous.hide();
      document.getElementById(`page-${this.state.page}`).classList.remove("active");
    }
    this.state.page = id;
    document.getElementById(`page-${id}`).classList.add("active");
    const navId = this.navOf[id] || id;
    document.querySelectorAll(".nav-btn, .settings-link").forEach((button) => {
      const active = button.dataset.page === navId;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    document.getElementById("content").scrollTop = 0;
    this.pages[id].show && this.pages[id].show(options);
  },

  /* ---------- Os patos ---------- */
  availableThemes() {
    return this.state.settings && this.state.settings.unlocked_1972 ? THEMES.concat([SECRET_THEME]) : THEMES;
  },
  applyTheme(id) {
    const theme = this.availableThemes().find((item) => item.id === id) || THEMES[0];
    document.documentElement.className = document.documentElement.className.replace(/\bth-\S+/g, "").trim();
    document.documentElement.classList.add(`th-${theme.id}`);
    document.getElementById("duck-name").textContent = theme.name;
  },
  async setTheme(id) {
    if (!this.state.settings) return;
    const tried = new Set(this.state.settings.tried_themes || []);
    const normal = (set) => [...set].filter((item) => item !== "patinho").length;
    const before = normal(tried);
    tried.add(id);
    if (before < 5 && normal(tried) >= 5) setTimeout(() => this.toast("Conquista desbloqueada: Bando completo"), 400);
    this.state.settings.theme = id;
    this.applyTheme(id);
    this.renderDuckPicker();
    this.emit("theme", id);
    this.state.settings = await Bridge.call("save_settings", { theme: id, tried_themes: [...tried] });
  },
  renderDuckPicker() {
    const current = this.state.settings.theme;
    document.getElementById("duck-picker").innerHTML = this.availableThemes().map((theme) => `
      <button type="button" class="swatch ${theme.id === current ? "active" : ""}" data-theme="${theme.id}"
        aria-pressed="${theme.id === current}" aria-label="Usar o tema ${esc(theme.name)}" title="${esc(theme.name)}">
        <span class="swatch-dot" style="background:${theme.plume}"><span class="swatch-beak" style="background:${theme.beak}"></span></span>
      </button>`).join("");
    document.querySelectorAll("#duck-picker .swatch").forEach((button) => {
      button.addEventListener("click", () => this.setTheme(button.dataset.theme));
    });
  },
  applyReduceMotion(on) {
    document.documentElement.classList.toggle("reduce-motion", !!on);
  },
  async setReduceMotion(on) {
    this.applyReduceMotion(on);
    this.state.settings = await Bridge.call("save_settings", { reduce_motion: !!on });
  },

  /* Easter egg: 5 cliques seguidos na logo destravam o tema de 1972. */
  async logoClick() {
    if (!this.state.settings) return;
    this.logoClicks += 1;
    clearTimeout(this.logoTimer);
    this.logoTimer = setTimeout(() => { this.logoClicks = 0; }, 1600);
    if (this.logoClicks < 5) return;
    this.logoClicks = 0;
    const first = !this.state.settings.unlocked_1972;
    this.state.settings = await Bridge.call("save_settings", { unlocked_1972: true });
    await this.setTheme("patinho");
    this.toast(first
      ? "Skin secreta desbloqueada! Patinho Feio (1972) está no seletor de temas e em Configurações."
      : "Quack! Skin Patinho Feio ativada.");
  },

  /* ---------- Avisos ---------- */
  toast(text, ms = 3800) {
    const root = document.getElementById("toast-root");
    const item = document.createElement("div");
    item.className = "toast";
    item.innerHTML = `${logoSymbol(30, 8)}<span>${esc(text)}</span>`;
    root.appendChild(item);
    setTimeout(() => { item.classList.add("out"); setTimeout(() => item.remove(), 260); }, ms);
  },
};
