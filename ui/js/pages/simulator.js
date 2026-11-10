/* Simulador de upgrade: "provador de peças". Escolhe uma peça e vê o antes e o depois, sem gastar a IA. */
App.register("simulator", (() => {
  const root = () => document.getElementById("page-simulator");
  let groups = null;
  let picked = {};      // grupo -> índice da opção escolhida
  let result = null;
  let token = 0;

  function choice() {
    const out = { ram_gb: null, ssd_gb: 0, nvme: false, gpu_tier: null };
    (groups || []).forEach((group) => {
      const opt = group.opts[picked[group.key] || 0];
      if (group.key === "ram") out.ram_gb = opt.ram_gb;
      if (group.key === "stor") { out.ssd_gb = opt.ssd_gb; out.nvme = !!opt.nvme; }
      if (group.key === "gpu") out.gpu_tier = opt.gpu_tier;
    });
    return out;
  }

  async function simulate() {
    const mine = ++token;
    const response = await Bridge.call("simulate_upgrade", choice());
    if (mine !== token) return;
    result = response;
    if (App.state.page === "simulator") renderResult();
  }

  function groupHtml(group) {
    return `<div class="stack" style="gap:10px"><span class="label">${esc(group.name)}</span>
      <div class="row wrap" style="gap:10px">${group.opts.map((opt, index) => `<button type="button" class="opt" data-group="${group.key}" data-index="${index}" aria-pressed="${(picked[group.key] || 0) === index}">
        <b style="font-size:16px">${esc(opt.name)}</b><small>${esc(opt.note)}</small></button>`).join("")}</div></div>`;
  }

  function impactRow(item) {
    const better = item.after > item.before;
    return `<div class="stack" style="gap:6px">
      <div class="row" style="justify-content:space-between"><span style="font-weight:600">${esc(item.name)}</span>
        <span class="num" style="font-size:15px"><span class="faint">${item.before}</span>${better ? ` → <b style="color:var(--acc-text)">${item.after}</b>` : ""}${item.name === "Espaço livre" ? "%" : ""}</span></div>
      <div class="meter"><i class="ghost" style="width:${item.before}%"></i>${better ? `<i style="width:${item.after}%;opacity:.9"></i><i class="ghost" style="width:${item.before}%;background:var(--line2)"></i>` : ""}</div></div>`;
  }

  function renderResult() {
    const box = document.getElementById("sim-result");
    if (!box || !result) return;
    const up = result.level > result.level_today;
    box.innerHTML = `
      <div class="row" style="justify-content:space-around;gap:12px;padding:8px 0 4px">
        <div class="stack" style="align-items:center;gap:4px">${levelIcon(result.level_today, 64, 52)}<span class="label" style="font-size:12px">Hoje</span><b class="display" style="font-size:19px">${esc(result.level_today_name)}</b></div>
        <span style="color:var(--acc-text);display:flex">${icon("arrow", 28)}</span>
        <div class="stack ${up ? "pop" : ""}" style="align-items:center;gap:4px">${levelIcon(result.level, 64, 52)}<span class="label" style="font-size:12px">Com a troca</span><b class="display" style="font-size:19px;color:${up ? "var(--acc-text)" : "var(--text)"}">${esc(result.level_name)}</b></div>
      </div>
      <p class="muted" style="margin:0;text-align:center">${up ? "Esse upgrade faz o seu PC subir de nível." : result.changed ? "O nível continua o mesmo, mas os números abaixo melhoram." : "Escolha uma peça ao lado para ver a diferença."}</p>
      <div class="stack" style="gap:14px">${result.impacts.map(impactRow).join("")}</div>
      ${result.checks.length ? `<div class="stack" style="gap:8px"><span class="label">Confira antes de comprar</span>${result.checks.map((text) => `<div class="notice warn" style="display:flex;gap:8px"><span style="color:var(--warn);display:flex">${icon("warn", 16)}</span><span>${esc(text)}</span></div>`).join("")}</div>` : ""}
      <div class="row wrap" style="gap:10px">
        <button type="button" class="pill-btn" data-go="advisor">${icon("spark", 16)}Pedir análise ao Consultor</button>
        <button type="button" class="pill-btn ghost" id="sim-reset">Limpar escolhas</button></div>
      <span class="faint" style="font-size:13px">Estimativa por regras simples. Não substitui a análise do Consultor.</span>`;
    const reset = document.getElementById("sim-reset");
    if (reset) reset.addEventListener("click", () => { picked = {}; render(); simulate(); });
  }

  function render() {
    if (!groups) { root().innerHTML = pageHeader("PROVADOR DE PEÇAS", "Simulador de upgrade", "Carregando as peças do seu computador…"); return; }
    root().innerHTML = pageHeader("PROVADOR DE PEÇAS", "Simulador de upgrade", "Escolha uma peça nova e veja como o seu PC mudaria. Nada é comprado nem instalado.") + `
      <div class="two-col">
        <section class="panel pad in stack" style="gap:22px">${groups.map(groupHtml).join("")}</section>
        <section class="panel pad in stack" id="sim-result" style="gap:18px;position:sticky;top:0"></section>
      </div>`;
    root().querySelectorAll("[data-group]").forEach((button) => button.addEventListener("click", () => {
      picked[button.dataset.group] = Number(button.dataset.index);
      root().querySelectorAll(`[data-group="${button.dataset.group}"]`).forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      simulate();
    }));
    renderResult();
  }

  async function load() {
    try { groups = await Bridge.call("get_simulation_options"); } catch (error) { groups = []; }
    picked = {};
    render();
    simulate();
  }

  return {
    init() { App.on("hardware", () => { groups = null; if (App.state.page === "simulator") load(); }); },
    show() { if (!groups) { render(); load(); } else { render(); simulate(); } },
  };
})());
