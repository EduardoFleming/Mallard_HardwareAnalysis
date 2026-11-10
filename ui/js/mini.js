/* Mini-modo: o pato no canto da tela, numa janela própria (sempre por cima se o alfinete estiver ligado).
   Mostra memória, processador ou disco com o mesmo humor do Monitor. Arraste pela barra de cima. */
(() => {
  const root = document.getElementById("mini");
  const $ = (id) => document.getElementById(id);
  const NAMES = { mem: "Memória", cpu: "Processador", disk: "Disco do sistema" };
  const LIMITS = { mem: [80, 95], cpu: [75, 92], disk: [85, 95] };
  const TANK = 220, MAXW = 172;

  let res = "mem";
  let compact = false;
  let pinned = true;
  let last = null;
  let programs = [];
  let confirming = null;
  let ticks = 0;
  let busy = false;

  const level = (key, v) => (v >= LIMITS[key][1] ? "crit" : v >= LIMITS[key][0] ? "warn" : "ok");
  const value = (key) => (!last ? 0 : key === "mem" ? last.ram.percent : key === "cpu" ? last.cpu : last.disk ? last.disk.percent : 0);
  const tone = (lv) => STATE_TONE[lv];

  function bar() {
    return `<div class="mini-bar pywebview-drag-region">
      <span aria-hidden="true" class="pywebview-drag-region" style="display:flex;gap:3px;margin-right:4px">${"<i class='pywebview-drag-region' style='width:3px;height:3px;border-radius:50%;background:var(--faint);display:block'></i>".repeat(3)}</span>
      <span class="nm pywebview-drag-region">Mallard</span>
      <button type="button" class="mini-btn" id="m-pin" aria-pressed="${pinned}" aria-label="${pinned ? "Sempre por cima: ligado" : "Sempre por cima: desligado"}" title="${pinned ? "Sempre por cima: ligado" : "Sempre por cima: desligado"}">${icon("pin", 17)}</button>
      <button type="button" class="mini-btn" id="m-compact" aria-label="${compact ? "Mostrar a janela inteira" : "Encolher para uma barra"}" title="${compact ? "Mostrar a janela inteira" : "Encolher para uma barra"}">${icon(compact ? "expand" : "shrink", 17)}</button>
      <button type="button" class="mini-btn" id="m-open" aria-label="Abrir o Mallard completo" title="Abrir o Mallard completo">${icon("ext", 17)}</button>
      <button type="button" class="mini-btn" id="m-close" aria-label="Fechar o mini-modo" title="Fechar o mini-modo">${icon("x", 16)}</button></div>`;
  }

  function build() {
    const body = compact
      ? `<div class="row" style="padding:10px 14px 12px;gap:10px;flex:1;align-items:center">
          <span class="bob" style="display:flex;flex-shrink:0">${duckSide(56, 36)}</span>
          <span class="stack" style="flex:1;min-width:0;gap:0"><span class="muted" id="m-name" style="font-size:13px"></span><span class="display" id="m-pct" role="status" style="font-size:26px;line-height:28px;font-weight:800"></span></span>
          <span id="m-chip"></span></div>`
      : `<div class="stack" style="padding:12px 14px 14px;gap:10px;flex:1">
          <div class="mini-tabs" role="radiogroup" aria-label="O que o mini-modo mostra">${Object.keys(NAMES).map((k) => `<button type="button" role="radio" aria-checked="${res === k}" data-res="${k}">${NAMES[k]}</button>`).join("")}</div>
          <div class="mini-tank" id="m-tank"><span id="m-chip" style="position:absolute;left:10px;top:10px;z-index:3"></span>
            <div class="mini-line" id="m-line" style="top:${Math.round(TANK - 0.9 * MAXW)}px" aria-hidden="true"></div>
            <div class="mini-water" id="m-water"><div class="water-top"><div class="wave" style="width:200%;animation-duration:3.4s">${waves(10, 0.35)}</div></div>
              <div class="stack" style="position:absolute;left:12px;bottom:8px;gap:0"><span class="display" id="m-pct" role="status" style="font-size:54px;line-height:52px;font-weight:800;letter-spacing:-2px"></span><span id="m-name" style="font-size:13px;font-weight:600"></span></div></div>
            <div class="mini-duck" id="m-duck"><div class="bob">${duckSide(96, 62)}</div></div></div>
          <div class="row" style="gap:10px;min-height:38px"><span class="stack" style="flex:1;min-width:0;gap:0"><b id="m-hot" style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></b><span id="m-note" class="muted" style="font-size:13px"></span></span>
            <button type="button" class="pill-btn ghost" id="m-act" style="min-height:32px;padding:0 14px;font-size:13px"></button></div></div>`;
    root.innerHTML = bar() + body;
    bindBar();
    root.querySelectorAll("[data-res]").forEach((b) => b.addEventListener("click", () => { res = b.dataset.res; confirming = null; build(); update(); }));
    const act = $("m-act");
    if (act) act.addEventListener("click", onAction);
  }

  function bindBar() {
    $("m-pin").addEventListener("click", async () => { pinned = !pinned; await Bridge.call("set_mini_option", "pinned", pinned).catch(() => {}); build(); update(); });
    $("m-compact").addEventListener("click", async () => { compact = !compact; await Bridge.call("set_mini_option", "compact", compact).catch(() => {}); build(); update(); });
    $("m-open").addEventListener("click", () => Bridge.call("expand_from_mini").catch(() => {}));
    $("m-close").addEventListener("click", () => Bridge.call("close_mini").catch(() => {}));
  }

  function hot() {
    if (res === "mem") {
      const p = programs.find((x) => x.closable);
      if (!p || !last) return { name: "Lendo os programas…", note: "", act: null };
      const gb = p.memory_mb / 1000;
      return { name: p.name, note: `${fmt(gb)} GB · ${Math.round((100 * gb) / last.ram.total_gb)}% da memória`, act: confirming === p.key ? "Tem certeza?" : "Fechar", key: p.key };
    }
    if (res === "cpu") return { name: "Quem está pesando?", note: "Veja os programas no Monitor", act: "Ver no Monitor", page: "monitor" };
    const d = last && last.disk;
    return { name: d && d.percent >= 85 ? "Disco quase cheio" : "Disco do sistema", note: d ? `Restam ${Math.round(100 - d.percent)}% (${fmt(d.free_gb)} GB)` : "", act: "Limpar", page: "cleanup" };
  }

  async function onAction() {
    const h = hot();
    if (h.page) { Bridge.call("show_main", h.page).catch(() => {}); return; }
    if (!h.key) return;
    if (confirming !== h.key) { confirming = h.key; update(); setTimeout(() => { if (confirming === h.key) { confirming = null; update(); } }, 4000); return; }
    confirming = null;
    try { await Bridge.call("close_program", h.key); } catch (error) { /* segue */ }
    setTimeout(loadPrograms, 1500);
    update();
  }

  function update() {
    if (!last) return;
    const v = value(res), lv = level(res, v), t = tone(lv);
    const chip = $("m-chip");
    if (chip) chip.innerHTML = stateChip(lv);
    $("m-pct").innerHTML = `${Math.round(v)}<span style="font-size:${compact ? 15 : 24}px;letter-spacing:0">%</span>`;
    $("m-name").textContent = NAMES[res];
    root.setAttribute("aria-label", `Mini-modo: ${NAMES[res]} em ${Math.round(v)}%`);
    if (compact) return;
    $("m-tank").style.setProperty("--tone", t);
    const h = Math.round((Math.max(2, Math.min(100, v)) / 100) * MAXW);
    $("m-water").style.height = `${h}px`;
    $("m-duck").style.top = `${TANK - h - 52}px`;
    const info = hot();
    $("m-hot").textContent = info.name;
    $("m-note").textContent = info.note;
    const act = $("m-act");
    act.hidden = !info.act;
    if (info.act) { act.textContent = info.act; act.style.borderColor = info.act === "Tem certeza?" ? "var(--warn)" : ""; act.style.color = info.act === "Tem certeza?" ? "var(--warn)" : ""; }
  }

  async function loadPrograms() {
    try { programs = await Bridge.call("get_top_programs"); } catch (error) { programs = []; }
    update();
  }

  async function tick() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      last = await Bridge.call("get_metrics");
      update();
      ticks += 1;
      if (ticks % 6 === 1) loadPrograms();
    } catch (error) { /* tenta de novo no próximo segundo */ } finally { busy = false; }
  }

  async function start() {
    try {
      const s = await Bridge.call("get_settings");
      pinned = s.mini_pinned !== false;
      compact = !!s.mini_compact;
      const known = ["mallard", "pekin", "femea", "cinzento", "cayuga", "patinho"];
      const theme = known.includes(s.theme) ? s.theme : "mallard";
      document.documentElement.className = `th-${theme}`;
      if (s.reduce_motion) document.documentElement.classList.add("reduce-motion");
    } catch (error) { /* usa os padrões */ }
    build();
    tick();
    setInterval(tick, 1000);
  }

  start();
})();
