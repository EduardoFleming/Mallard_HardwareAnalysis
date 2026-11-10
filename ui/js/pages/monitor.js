/* Monitor: a lagoa. Quanto mais cheio o recurso, mais a água sobe e mais agitado fica o pato.
   Leitura a cada segundo enquanto a tela está aberta; a lista de programas atualiza a cada poucos segundos. */
App.register("monitor", (() => {
  const root = () => document.getElementById("page-monitor");
  const $ = (id) => document.getElementById(id);
  const MAX = 30;
  const LIMITS = { cpu: [75, 92], ram: [80, 95], gpu: [85, 96], disk: [85, 95] };
  const NAMES = { ram: "Memória", cpu: "Processador", disk: "Disco", gpu: "Placa de vídeo" };

  let hist = { cpu: [], ram: [], disk: [], gpu: [] };
  let last = null;
  let sel = "ram";
  let paused = false;
  let busy = false;
  let timer = null;
  let ticks = 0;
  let programs = [];
  let confirming = null;
  let built = false;

  function tone(value, key) {
    const [warn, crit] = LIMITS[key];
    if (value >= crit) return { c: "var(--crit)", label: "Crítico", level: "crit" };
    if (value >= warn) return { c: "var(--warn)", label: "Alto", level: "warn" };
    return { c: "var(--acc-text)", label: "Normal", level: "ok" };
  }

  function spark(values) {
    if (values.length < 2) return { line: "M0 30 L120 30", area: "M0 34Z" };
    const pts = values.map((v, i) => [(i * 120 / (values.length - 1)).toFixed(1), (32 - Math.min(100, v) / 100 * 28).toFixed(1)]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
    return { line, area: `${line} L120 34 L0 34 Z` };
  }

  function detail(key, v) {
    if (!last) return "Aguardando leitura…";
    if (key === "ram") return `${fmt(last.ram.used_gb)} de ${fmt(last.ram.total_gb)} GB usados`;
    if (key === "cpu") return `${App.state.hardware ? App.state.hardware.sistema.physical_cpu_cores || "" : ""} núcleos trabalhando`.trim();
    if (key === "disk" && last.disk) return `${fmt(last.disk.free_gb)} GB livres de ${fmt(last.disk.total_gb)} GB (${last.disk.device})`;
    if (key === "gpu" && last.gpu) return last.gpu.temp !== null && last.gpu.temp !== undefined ? `${last.gpu.name} · ${last.gpu.temp} °C` : (last.gpu.name || "");
    return "";
  }

  function gpuOn() { return last && last.gpu && last.gpu.usage !== null && last.gpu.usage !== undefined; }
  const value = (key) => { const a = hist[key]; return a.length ? a[a.length - 1] : 0; };

  function skeleton() {
    root().innerHTML = `<div class="lagoon-board">
      <section class="tank in" id="tank" aria-label="Lagoa">
        <div style="position:absolute;left:22px;top:18px;z-index:3" class="stack"><span class="display" id="tk-name" style="font-size:20px;font-weight:700">Memória</span>
          <span class="faint" style="font-size:12px">Quanto mais cheio, mais a água sobe</span></div>
        <div aria-hidden="true" style="position:absolute;left:0;right:0;top:28%;border-top:1.5px dashed var(--warn);opacity:.7"></div>
        <span class="st" style="--tone:var(--warn);position:absolute;right:16px;top:calc(28% - 14px);z-index:2;background:var(--s1);border:1px solid color-mix(in srgb, var(--warn) 45%, transparent)">${icon("st-warn", 13, 3)}Linha d'água · 90%</span>
        <div aria-hidden="true" style="position:absolute;left:0;right:0;top:60%;border-top:1px dashed var(--line2)"></div>
        <span aria-hidden="true" class="faint" style="position:absolute;right:16px;top:calc(60% - 22px);font-size:12px">50%</span>
        <div class="water" id="water"><div class="water-top"><div class="wave" id="wave" style="width:200%;animation-duration:5s">${waves(16, 0.35)}</div></div>
          <span class="bub" style="left:12%;bottom:14%;width:10px;height:10px"></span><span class="bub" style="left:48%;bottom:24%;width:7px;height:7px;animation-delay:1.8s"></span><span class="bub" style="left:72%;bottom:8%;width:12px;height:12px;animation-delay:3.1s"></span>
          <div class="stack" style="position:absolute;left:28px;bottom:26px;gap:0"><span class="display" id="tk-pct" role="status" style="font-size:clamp(64px,9vw,112px);line-height:.95;font-weight:800;letter-spacing:-.04em">—</span>
            <span id="tk-detail" style="font-size:16px;font-weight:600;opacity:.85"></span></div></div>
        <div class="floater" id="floater"><div class="bob" id="mascot">${duckSide(150, 96)}</div>
          <span class="bubble2"><b class="display" id="mood-title" style="display:block">Acordando…</b><span id="mood-text">Esperando a primeira leitura.</span></span>
          <span id="sweat" style="display:none"><span class="drip" style="position:absolute;left:92px;top:2px;width:7px;height:10px;border-radius:50%;background:#6EC1FF"></span></span></div>
      </section>
      <div class="stack" style="gap:16px;min-width:0">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div class="stack" style="gap:2px"><span class="kicker">ATIVIDADE</span><h1 class="page-title" style="font-size:30px;margin:2px 0">Monitor</h1>
            <span class="row muted" style="gap:8px"><span id="live-dot" class="live" style="width:8px;height:8px;border-radius:50%;background:var(--acc-text)"></span><span id="live-text">Ao vivo · atualiza a cada segundo</span></span></div>
          <div class="row" style="gap:8px"><button type="button" class="icon-btn" id="mini-btn" aria-label="Abrir o mini-modo" title="Mini-modo: o pato no canto da tela">${icon("mini", 18)}</button>
            <button type="button" class="pill-btn ghost" id="pause-btn">${icon("pause", 16)}Pausar</button></div></div>
        <div class="res-grid" id="res" role="radiogroup" aria-label="O que a lagoa mostra"></div>
        <section class="panel in" style="padding:16px 18px;display:flex;flex-direction:column;gap:8px">
          <div class="row" style="justify-content:space-between;align-items:baseline"><h2 class="section-title" style="font-size:18px">Quem está enchendo a lagoa</h2><span class="faint" style="font-size:12px">Memória por programa</span></div>
          <ul id="progs" style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column"></ul>
        </section></div></div>
      <p class="faint" id="monitor-note" style="margin:0;font-size:14px">Sensores disponíveis conforme o sistema e os drivers instalados.</p>`;
    built = true;
    $("pause-btn").addEventListener("click", togglePause);
    $("mini-btn").addEventListener("click", () => Bridge.call("open_mini").catch(() => App.toast("Não deu para abrir o mini-modo.")));
  }

  function renderRes() {
    const keys = ["ram", "cpu", "disk"].concat(gpuOn() ? ["gpu"] : []);
    const cards = keys.map((key) => {
      const v = value(key), t = tone(v, key), s = spark(hist[key]), on = sel === key;
      return `<button type="button" role="radio" aria-checked="${on}" class="res ${on ? "on" : ""}" data-res="${key}" style="--tone:${t.c}">
        <span class="row" style="justify-content:space-between"><b class="muted">${NAMES[key]}</b>${stateChip(t.level)}</span>
        <span class="row" style="justify-content:space-between;align-items:flex-end;gap:10px"><span class="display" style="font-size:30px;font-weight:800;line-height:1">${fmt(v)}<span class="faint" style="font-size:14px;font-weight:700">%</span></span>
          <svg width="110" height="34" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true"><path d="${s.area}" fill="${t.c}" opacity=".16"></path><path d="${s.line}" fill="none" stroke="${t.c}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path></svg></span>
        <span class="faint" style="font-size:12px">${esc(detail(key, v))}</span></button>`;
    });
    if (!gpuOn()) cards.push(`<div class="res off"><span class="row" style="justify-content:space-between"><b class="muted">Placa de vídeo</b>${stateChip("off")}</span>
      <span class="faint" style="font-size:13px">Uso e temperatura dependem de placa NVIDIA, NVML e driver compatível.</span>${linkGo("Informar modelo da placa", `data-go="computer"`)}</div>`);
    $("res").innerHTML = cards.join("");
    $("res").querySelectorAll("[data-res]").forEach((button) => button.addEventListener("click", () => { sel = button.dataset.res; update(); }));
  }

  function renderPrograms() {
    const list = $("progs");
    if (!programs.length) { list.innerHTML = `<li class="faint" style="padding:12px 0">Lendo os programas…</li>`; return; }
    list.innerHTML = programs.map((p) => `<li class="prow"><span aria-hidden="true" class="pinit">${esc(p.name.charAt(0).toUpperCase())}</span>
      <span style="flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span>
      <span aria-hidden="true" class="pbar"><span style="width:${p.share}%"></span></span>
      <span class="num" style="width:68px;text-align:right;font-weight:700">${p.memory_mb >= 1000 ? `${fmt(p.memory_mb / 1000)} GB` : `${p.memory_mb} MB`}</span>
      ${p.closable ? `<button type="button" class="pill-btn ghost" data-close="${esc(p.key)}" aria-label="Fechar ${esc(p.name)}" style="min-height:30px;width:96px;padding:0;justify-content:center;font-size:13px;${confirming === p.key ? "border-color:var(--warn);color:var(--warn)" : ""}">${confirming === p.key ? "Tem certeza?" : "Fechar"}</button>`
        : `<span class="faint" style="width:96px;text-align:center;font-size:12px;font-weight:600">Do sistema</span>`}</li>`).join("");
    list.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeProgram(button.dataset.close)));
  }

  async function closeProgram(key) {
    if (confirming !== key) { confirming = key; renderPrograms(); setTimeout(() => { if (confirming === key) { confirming = null; renderPrograms(); } }, 4000); return; }
    confirming = null;
    const name = (programs.find((p) => p.key === key) || {}).name || "O programa";
    try {
      const result = await Bridge.call("close_program", key);
      App.toast(result.closed ? `${name} foi fechado. O que não estava salvo pode ter se perdido.` : "Não deu para fechar este programa.");
    } catch (error) { App.toast("Não deu para fechar este programa."); }
    setTimeout(loadPrograms, 1500);
    renderPrograms();
  }

  async function loadPrograms() {
    try { programs = await Bridge.call("get_top_programs"); } catch (error) { programs = []; }
    if (App.state.page === "monitor" && built) renderPrograms();
  }

  function update() {
    if (!built || !last) return;
    const v = value(sel), t = tone(v, sel);
    const tank = $("tank");
    tank.style.setProperty("--tone", t.c);
    $("tk-name").textContent = NAMES[sel];
    $("tk-pct").innerHTML = `${fmt(v)}<span style="font-size:.42em;letter-spacing:0">%</span>`;
    $("tk-detail").textContent = detail(sel, v);
    const level = Math.max(2, Math.min(100, v)) * 0.8;
    $("water").style.height = `${level}%`;
    $("floater").style.bottom = `calc(${level}% - 8px)`;
    $("wave").style.animationDuration = `${Math.max(1.2, 7 - 5.8 * v / 100).toFixed(2)}s`;
    updateMood(v);
    renderRes();
    tank.setAttribute("aria-label", `Lagoa: ${NAMES[sel]} em ${fmt(v)}%`);
  }

  function updateMood(v) {
    let title = "Tranquilo", text = "Só boiando por aqui.";
    if (v >= 90) { title = "Socorro!"; text = "A lagoa está quase transbordando."; }
    else if (v >= 80) { title = "Suado"; text = "Pedalando com tudo."; }
    else if (v >= 50) { title = "Atento"; text = "Pedalando firme embaixo d'água."; }
    if (paused) { title = "Dormindo"; text = "Monitor pausado. Tirei um cochilo."; }
    $("mood-title").textContent = title;
    $("mood-text").textContent = text;
    $("sweat").style.display = !paused && v >= 80 ? "" : "none";
    $("mascot").style.animationDuration = `${Math.max(0.6, 2.2 - 1.6 * v / 100).toFixed(2)}s`;
  }

  async function tick() {
    if (busy || paused || document.hidden) return;
    busy = true;
    try {
      const m = await Bridge.call("get_metrics");
      last = m;
      hist.cpu.push(m.cpu); hist.ram.push(m.ram.percent); hist.disk.push(m.disk ? m.disk.percent : 0);
      hist.gpu.push(m.gpu && m.gpu.usage !== null && m.gpu.usage !== undefined ? m.gpu.usage : 0);
      Object.values(hist).forEach((a) => { while (a.length > MAX) a.shift(); });
      if (sel === "gpu" && !gpuOn()) sel = "ram";
      if (m.note) $("monitor-note").textContent = m.note;
      update();
      ticks += 1;
      if (ticks % 6 === 0) loadPrograms();
    } catch (error) {
      $("monitor-note").textContent = `Não foi possível ler os sensores agora: ${error}`;
    } finally {
      busy = false;
    }
  }

  function togglePause() {
    paused = !paused;
    $("pause-btn").innerHTML = paused ? `${icon("play", 16)}Retomar` : `${icon("pause", 16)}Pausar`;
    $("live-text").textContent = paused ? "Pausado" : "Ao vivo · atualiza a cada segundo";
    $("live-dot").classList.toggle("live", !paused);
    $("live-dot").style.background = paused ? "var(--muted)" : "var(--acc-text)";
    ["wave", "mascot"].forEach((id) => { $(id).style.animationPlayState = paused ? "paused" : "running"; });
    updateMood(value(sel));
  }

  return {
    init() { skeleton(); renderPrograms(); },
    show() {
      hist = { cpu: [], ram: [], disk: [], gpu: [] };
      ticks = 0;
      tick();
      loadPrograms();
      clearInterval(timer);
      timer = setInterval(tick, 1000);
    },
    hide() { clearInterval(timer); timer = null; },
  };
})());
