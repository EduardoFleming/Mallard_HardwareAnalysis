/* Limpeza: procura o que dá para jogar fora e só limpa o que o usuário marcar. */
App.register("cleanup", (() => {
  const root = () => document.getElementById("page-cleanup");
  let phase = "scan";          // scan | ready | cleaning | done | unsupported
  let scan = null;
  let checked = {};
  let job = null;
  let timer = null;

  function size(bytes) {
    const gb = bytes / 1e9, mb = bytes / 1e6;
    if (gb >= 1) return `${fmt(gb, 1)} GB`;
    if (mb >= 1) return `${fmt(mb, 0)} MB`;
    return bytes > 0 ? "menos de 1 MB" : "0 MB";
  }

  function selectedBytes() {
    return scan.categories.filter((c) => checked[c.key]).reduce((sum, c) => sum + c.bytes, 0);
  }

  function diskBar(disk) {
    if (!disk) return "";
    const tone = disk.percent >= 90 ? "crit" : disk.percent >= 80 ? "warn" : "";
    return `<div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between"><b>Disco ${esc(disk.device)}</b>
      <span class="num">${fmt(disk.used_bytes / 1e9)} de ${fmt(disk.total_bytes / 1e9)} GB · ${fmt(disk.percent)}% usado</span></div>
      <div class="bar ${tone}"><span style="width:${disk.percent}%"></span></div></div>`;
  }

  function rowHtml(c) {
    return `<label class="check-row" style="cursor:pointer"><input type="checkbox" data-cat="${c.key}" ${checked[c.key] ? "checked" : ""} ${c.bytes === 0 ? "disabled" : ""}>
      <span class="stack" style="gap:2px;flex:1;min-width:0"><b>${esc(c.name)}${c.review ? ` <span class="tag warn">Confira antes</span>` : ""}</b><span class="muted" style="font-size:14px">${esc(c.desc)}</span></span>
      <span class="num" style="font-size:18px;font-weight:700">${size(c.bytes)}</span></label>`;
  }

  function render() {
    const head = pageHeader("MANUTENÇÃO", "Limpeza", "Libera espaço sem mexer nos seus arquivos pessoais. Só limpa o que você marcar.");
    if (phase === "unsupported") {
      root().innerHTML = head + `<section class="panel dashed pad in" style="text-align:center"><span class="muted">A limpeza do disco funciona no Windows. Neste sistema ela fica desligada.</span></section>`;
      return;
    }
    if (phase === "scan") {
      root().innerHTML = head + `<section class="panel pad in row" style="gap:14px"><span class="spin" style="display:flex;color:var(--acc-text)">${icon("refresh", 22)}</span><span>Procurando o que dá para limpar…</span></section>`;
      return;
    }
    if (phase === "cleaning") {
      const p = job ? job.progress : 0;
      root().innerHTML = head + `<section class="panel pad in stack" style="gap:16px;align-items:center;text-align:center">
        <div class="bob" style="display:flex;color:var(--acc-text)">${icon("broom", 44)}</div><h2 class="section-title">Limpando…</h2>
        <span class="muted">${esc(job && job.current ? job.current : "Preparando")}</span>
        <div class="bar" style="width:min(520px,100%);height:8px"><span style="width:${p}%;background:var(--acc)"></span></div><span class="num">${p}%</span></section>`;
      return;
    }
    if (phase === "done") {
      const freed = job.freed || 0;
      const names = Object.fromEntries(scan.categories.map((c) => [c.key, c.name]));
      root().innerHTML = head + `<section class="panel pad in stack" style="gap:18px">
        <div class="row" style="gap:16px"><span class="pop" style="display:flex;color:var(--acc-text)">${icon("check", 40, 2.4)}</span>
          <div class="stack" style="gap:2px"><h2 class="display" style="margin:0;font-size:28px">${size(freed)} liberados</h2>
            <span class="muted">${job.error ? `Houve um problema: ${esc(job.error)}` : "Pronto! O ninho está mais arrumado."}</span></div></div>
        ${diskBar(job.disk || (scan && scan.disk))}
        <div class="stack" style="gap:8px">${Object.entries(job.per_key || {}).map(([key, r]) => `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">
          <span>${esc(names[key] || key)}</span><span class="num">${size(r.freed)}${r.skipped ? ` · ${r.skipped} em uso ficaram` : ""}</span></div>`).join("")}</div>
        <div class="row wrap" style="gap:10px"><button type="button" class="pill-btn" id="cl-again">${icon("refresh", 16)}Procurar de novo</button></div></section>`;
      document.getElementById("cl-again").addEventListener("click", start);
      return;
    }
    const total = selectedBytes();
    root().innerHTML = head + `<div class="two-col"><section class="panel pad in stack" style="gap:12px">${scan.categories.map(rowHtml).join("")}</section>
      <section class="panel pad in stack" style="gap:16px;position:sticky;top:0">${diskBar(scan.disk)}
        <div class="stack" style="gap:2px"><span class="label">Dá para liberar</span><span class="big-num" style="color:var(--acc-text)">${size(total)}</span></div>
        <div class="notice soft">Arquivos recentes e em uso ficam de fora. Downloads antigos vão para a Lixeira, de onde dá para recuperar.</div>
        <button type="button" class="pill-btn" id="cl-go" ${total > 0 ? "" : "disabled"}>${icon("broom", 16)}Limpar o que marquei</button></section></div>`;
    root().querySelectorAll("[data-cat]").forEach((box) => box.addEventListener("change", () => { checked[box.dataset.cat] = box.checked; render(); }));
    document.getElementById("cl-go").addEventListener("click", clean);
  }

  async function start() {
    clearInterval(timer);
    phase = "scan";
    render();
    try { await Bridge.call("reset_cleanup"); } catch (error) { /* segue */ }
    try { scan = await Bridge.call("scan_cleanup"); } catch (error) { scan = { supported: false, categories: [] }; }
    if (!scan.supported) phase = "unsupported";
    else {
      checked = {};
      scan.categories.forEach((c) => { checked[c.key] = !c.review && c.bytes > 0; });
      phase = "ready";
    }
    if (App.state.page === "cleanup") render();
  }

  async function clean() {
    const keys = scan.categories.filter((c) => checked[c.key]).map((c) => c.key);
    if (!keys.length) return;
    phase = "cleaning";
    job = { progress: 0, current: "" };
    render();
    job = await Bridge.call("start_cleanup", keys);
    clearInterval(timer);
    timer = setInterval(poll, 500);
    poll();
  }

  async function poll() {
    try { job = await Bridge.call("get_cleanup_status"); } catch (error) { return; }
    if (job.phase === "done") {
      clearInterval(timer);
      phase = "done";
      if (job.first_ninho) { App.toast("Conquista desbloqueada: Ninho arrumado"); App.emit("history-changed"); }
    }
    if (App.state.page === "cleanup") render();
  }

  return {
    show() { if (phase === "cleaning") { render(); return; } start(); },
    hide() { clearInterval(timer); if (phase === "cleaning") timer = setInterval(poll, 1500); },
  };
})());
