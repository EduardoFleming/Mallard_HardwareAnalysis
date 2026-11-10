/* Resultado da análise: veredito, gargalo, nível, upgrades e a conquista do cisne. */
App.register("result", (() => {
  const root = () => document.getElementById("page-result");
  const PRIORITY = { alta: "Alta", "média": "Média", media: "Média", baixa: "Baixa" };
  let entry = null;
  let menuOpen = false;

  function when(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function profileLine(e) {
    const p = e.preferencias || {};
    const focus = p.foco_de_jogos || p.foco_de_trabalho_ou_uso_domestico;
    return [e.perfil, focus, p.orcamento ? `Orçamento ${p.orcamento}` : "Sem orçamento definido"].filter(Boolean).join(" · ");
  }
  function list(items) {
    return (items || []).length ? `<ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
  }
  function priorityTag(priority) {
    const key = String(priority || "").toLowerCase();
    const style = key === "alta" ? "background:var(--acc);color:var(--on-acc);border-color:var(--acc)" : key.startsWith("m") ? "color:var(--warn);border-color:var(--warn)" : "";
    return `<span class="tag" style="${style}">${esc(PRIORITY[key] || priority || "—")}</span>`;
  }

  function summaryText(e) {
    const r = e.resultado;
    const lines = [`Mallard · ${profileLine(e)}`, "", r.verdict, ...(r.quick_summary || []).map((s) => `• ${s}`), ""];
    (r.recommendations || []).forEach((rec, i) => lines.push(`${i + 1}. ${rec.component}: ${rec.current || "atual"} → ${rec.suggestion} (prioridade ${rec.priority})`));
    return lines.join("\n");
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (error) { /* tenta o jeito antigo */ }
    const area = document.createElement("textarea");
    area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
    document.body.appendChild(area); area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }

  const checks = {};   // marcações de "Antes de comprar" (só na tela, por análise)
  let shopOpen = false;
  let copied = false;

  /* ---------- Lista de compra: o Mallard não consulta preços, quem digita o preço é você ---------- */
  const brl = (v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 })}`;
  function parseBudget(text) {
    const m = String(text || "").match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/);
    return m ? Number(m[1].replace(/\./g, "")) + (m[2] ? Number(`0.${m[2]}`) : 0) : null;
  }
  const budgetOf = (e) => parseBudget((e.preferencias || {}).orcamento);
  const shopItem = (e, i) => ({ incluir: true, preco: null, ...((e.compras || {})[i] || {}) });
  function shopTotals(e) {
    const recs = (e.resultado || {}).recommendations || [];
    let count = 0, priced = 0, total = 0;
    recs.forEach((rec, i) => {
      const it = shopItem(e, i);
      if (!it.incluir) return;
      count += 1;
      if (it.preco != null) { priced += 1; total += it.preco; }
    });
    return { count, priced, total, budget: budgetOf(e) };
  }
  function budgetLine(t) {
    if (!t.priced) return { level: "off", text: t.count ? "Digite o preço que você achou para somar" : "Nenhum upgrade na lista" };
    if (t.budget == null) return { level: "ok", text: `Total ${brl(t.total)}` };
    if (t.total <= t.budget) return { level: "ok", text: `Dentro do orçamento · sobram ${brl(t.budget - t.total)}` };
    return { level: "warn", text: `Passou do orçamento em ${brl(t.total - t.budget)}` };
  }
  function shopText(e) {
    const recs = (e.resultado || {}).recommendations || [];
    const t = shopTotals(e);
    const lines = ["Lista de compra · Mallard", ""];
    recs.forEach((rec, i) => {
      const it = shopItem(e, i);
      if (it.incluir) lines.push(`• ${rec.component}: ${rec.suggestion}${it.preco != null ? ` — ${brl(it.preco)}` : ""}`);
    });
    if (t.priced) lines.push("", `Total: ${brl(t.total)}${t.budget != null ? ` (orçamento ${brl(t.budget)})` : ""}`);
    lines.push("", "Preços digitados por mim; confira compatibilidade e estoque antes de comprar.");
    return lines.join("\n");
  }
  function shopBar() {
    const t = shopTotals(entry);
    const line = budgetLine(t);
    const pct = t.budget && t.priced ? Math.min(100, (t.total / t.budget) * 100) : 0;
    return `<div class="shop-bar no-print"><span style="color:var(--acc-text);display:flex">${icon("cart", 22)}</span>
      <span class="stack" style="gap:0;flex:1 1 200px;min-width:0"><b>Lista de compra · ${t.count} ${t.count === 1 ? "peça" : "peças"}</b>
        <span id="shop-bar-line" class="muted" style="font-size:14px">${esc(line.text)}</span></span>
      ${t.budget && t.priced ? `<span class="bar" aria-hidden="true" style="width:120px;height:10px"><span id="shop-bar-fill" style="width:${pct}%;background:${line.level === "warn" ? "var(--warn)" : "var(--acc)"}"></span></span>` : ""}
      <button type="button" class="pill-btn" id="shop-open" style="min-height:38px">Abrir a lista</button></div>`;
  }
  function shopModal() {
    if (!shopOpen) return "";
    const recs = (entry.resultado || {}).recommendations || [];
    const t = shopTotals(entry);
    const line = budgetLine(t);
    return `<div class="shop-modal" id="shop-modal" role="dialog" aria-modal="true" aria-label="Lista de compra">
      <div class="shop-card">
        <div class="row" style="justify-content:space-between"><h2 class="display" style="margin:0;font-size:24px;font-weight:800">Lista de compra</h2>
          <button type="button" class="round-btn" id="shop-close" aria-label="Fechar a lista" style="width:32px;height:32px">${icon("x", 15)}</button></div>
        <p class="muted" style="margin:0;font-size:14px">O Mallard não consulta preços. Abra a pesquisa, veja quanto custa e digite o valor para somar com o seu orçamento${t.budget != null ? ` de ${esc(brl(t.budget))}` : ""}.</p>
        ${recs.map((rec, i) => { const it = shopItem(entry, i); return `<div class="shop-item">
          <button type="button" role="checkbox" aria-checked="${it.incluir}" aria-label="Incluir ${esc(rec.component)}" class="ck" data-shop-inc="${i}" style="min-height:36px;padding:0"><span class="ckbox ${it.incluir ? "on" : ""}">${it.incluir ? icon("check", 12, 3.4) : ""}</span></button>
          <span class="stack" style="gap:0;flex:1;min-width:0"><span class="faint" style="font-size:12px">${esc(rec.component)}</span><b style="overflow-wrap:anywhere">${esc(rec.suggestion)}</b>
            ${rec.search_url ? `<button type="button" class="link-go" data-url="${esc(rec.search_url)}" style="font-size:13px;align-self:flex-start">Pesquisar preço<span class="arr">${icon("ext", 13)}</span></button>` : ""}</span>
          <label class="stack" style="gap:2px"><span class="faint" style="font-size:12px">Preço (R$)</span>
            <input class="input price-in" inputmode="decimal" data-shop-price="${i}" value="${it.preco != null ? String(it.preco).replace(".", ",") : ""}" placeholder="0,00" autocomplete="off"></label></div>`; }).join("")}
        <div class="row" role="status" style="gap:10px;padding:10px 14px;border-radius:12px;background:var(--s1);justify-content:space-between;flex-wrap:wrap">
          <span id="shop-modal-line" style="display:flex;align-items:center;gap:10px">${stateChip(line.level, line.level === "ok" ? "Ok" : line.level === "warn" ? "Atenção" : "Aguardando")}<span>${esc(line.text)}</span></span></div>
        <div class="row wrap" style="gap:10px;justify-content:flex-end"><button type="button" class="pill-btn ghost" id="shop-copy">${icon("copy", 16)}${copied ? "Lista copiada" : "Copiar lista"}</button>
          <button type="button" class="pill-btn" id="shop-done">Pronto</button></div></div></div>`;
  }
  function refreshShop() {
    const t = shopTotals(entry);
    const line = budgetLine(t);
    const barLine = document.getElementById("shop-bar-line");
    if (barLine) barLine.textContent = line.text;
    const modalLine = document.getElementById("shop-modal-line");
    if (modalLine) modalLine.innerHTML = `${stateChip(line.level, line.level === "ok" ? "Ok" : line.level === "warn" ? "Atenção" : "Aguardando")}<span>${esc(line.text)}</span>`;
  }
  async function saveShop(i, incluir, preco) {
    entry.compras = { ...(entry.compras || {}), [i]: { incluir, preco } };
    const saved = await Bridge.call("set_shopping", entry.id, i, incluir, preco);
    if (saved) entry.compras = saved.compras;
  }

  function render() {
    if (!entry) {
      root().innerHTML = pageHeader("DIAGNÓSTICO", "Resultado da análise", "Nenhuma análise aberta.") +
        `<div class="panel pad in stack" style="align-items:flex-start">${duckling(52, 42)}<span class="muted">Faça uma análise no Consultor ou abra uma pelo Histórico.</span>
        <button type="button" class="pill-btn" data-go="advisor">Ir para o Consultor</button></div>`;
      return;
    }
    const r = entry.resultado;
    const done = entry.feitos || [];
    const recs = r.recommendations || [];
    const nDone = done.filter(Boolean).length;
    const allDone = recs.length > 0 && nDone === recs.length;
    const budgetTone = r.budget_status === "no_worthwhile_upgrade" ? "warn" : "soft";
    const start = r.level_now, end = Math.max(r.level_after, r.level_now);
    const shown = recs.length ? start + Math.round((end - start) * nDone / recs.length) : start;
    const mid = Math.round((start + end) / 2);
    const marks = checks[entry.id] || (checks[entry.id] = {});

    const actions = `<div class="row wrap no-print" style="gap:10px">
      <div style="position:relative"><button type="button" class="pill-btn ghost" id="export-btn" aria-expanded="${menuOpen}">${icon("download", 17)}Exportar${icon("chev", 16)}</button>
        ${menuOpen ? `<div class="menu in" style="animation-duration:.2s">
          <button type="button" data-export="file"><strong>Salvar relatório</strong><span class="faint" style="font-size:13px">Arquivo que abre em qualquer navegador</span></button>
          <button type="button" data-export="print"><strong>Imprimir ou salvar em PDF</strong><span class="faint" style="font-size:13px">Escolha "Salvar como PDF" na impressora</span></button>
          <button type="button" data-export="copy"><strong>Copiar resumo</strong><span class="faint" style="font-size:13px">Para colar no WhatsApp ou no Discord</span></button></div>` : ""}</div>
      <button type="button" class="pill-btn" data-go="advisor">Nova consulta</button></div>`;

    const quests = recs.map((rec, i) => {
      const isDone = !!done[i];
      const prio = String(rec.priority || "").toLowerCase();
      const prioTone = prio === "alta" ? "crit" : prio.startsWith("m") ? "warn" : "";
      const verify = rec.verify_before_buying || [];
      return `<article class="quest ${isDone ? "done" : ""} in" style="animation-delay:${120 + i * 80}ms">
        <div class="row wrap quest-meta" style="gap:10px"><span class="qnum ${isDone ? "ok" : prioTone}">${i + 1}</span>
          <span class="pill ${prioTone}">Prioridade ${esc(PRIORITY[prio] || rec.priority || "—").toLowerCase()}</span>
          <span class="pill">Compatibilidade ${esc(rec.compatibility || "—")}</span>
          ${isDone ? `<span class="stamp pop" aria-label="Upgrade marcado como feito">FEITO</span>` : ""}</div>
        <div class="stack" style="gap:2px"><span class="faint" style="font-size:13px">${esc(rec.component)}</span>
          <span class="display" style="font-size:22px;font-weight:800;line-height:1.25">${rec.current ? `${esc(rec.current)} <span style="color:var(--acc-text)">→</span> ` : ""}${esc(rec.suggestion)}</span>
          <span class="muted">${esc(rec.reason)}</span></div>
        ${verify.length ? `<div class="stack" style="gap:2px;padding:8px 10px;border-radius:12px;background:var(--s0)"><span class="faint" style="font-size:12px;font-weight:700;padding:0 4px 4px">Antes de comprar</span>
          ${verify.map((text, j) => { const on = !!marks[`${i}-${j}`]; return `<button type="button" role="checkbox" aria-checked="${on}" class="ck" data-check="${i}-${j}">
            <span class="ckbox ${on ? "on" : ""}">${on ? icon("check", 12, 3.4) : ""}</span><span style="${on ? "text-decoration:line-through;color:var(--muted)" : ""}">${esc(text)}</span></button>`; }).join("")}</div>` : ""}
        <div class="row wrap no-print" style="gap:8px">
          ${rec.search_url ? `<button type="button" class="pill-btn ghost" data-url="${esc(rec.search_url)}" style="min-height:38px">Pesquisar preço${icon("ext", 15)}</button>` : ""}
          <button type="button" class="pill-btn ${isDone ? "ghost" : ""}" data-done="${i}" aria-pressed="${isDone}" style="min-height:38px">${isDone ? "Desfazer" : "Marcar como feito"}</button></div>
      </article>`;
    }).join("");

    root().innerHTML = `<div class="result-board">
      <section class="panel in pet" aria-label="Seu pato">
        <div class="stack" style="gap:6px"><span style="font-size:12px;font-weight:700;color:var(--acc-text)">Quack! Diagnóstico pronto · ${esc(profileLine(entry))}</span>
          <h1 class="display" style="margin:0;font-size:26px;line-height:1.25;font-weight:800">${esc(r.verdict)}</h1>
          <div class="row wrap" style="gap:6px"><span class="pill ${r.main_bottleneck ? "crit" : ""}">Gargalo: ${esc(r.main_bottleneck || "sem gargalo claro")}</span><span class="pill">Confiança ${esc(r.confidence || "—")}</span></div></div>
        <div class="stack" style="align-items:center;justify-content:center;flex:1;gap:4px;position:relative">
          <div class="bob" role="img" aria-label="Seu pato agora: ${esc(LEVEL_NAMES[shown])}" style="color:var(--acc-text)">${allDone ? `<span class="pop" style="display:flex">${swanIcon(210, 168)}</span>` : levelIcon(shown, 210, 168)}</div>
          <span class="display" style="margin-top:8px;font-size:38px;line-height:1.1;font-weight:800;letter-spacing:-.02em;color:${allDone ? "var(--acc-text)" : "var(--text)"}">${esc(allDone ? "Cisne" : LEVEL_NAMES[shown])}</span>
          <span class="muted" role="status" style="text-align:center">${allDone ? "Evoluiu! Seu PC virou cisne." : nDone ? "Subiu de nível! Continue os upgrades." : "Hoje. Faça os upgrades para evoluir."}</span></div>
        ${end > start ? `<div class="stack" style="gap:8px"><div class="row" style="justify-content:space-between;font-size:12px;font-weight:700"><span>${LEVEL_NAMES[start]}</span><span>${LEVEL_NAMES[mid]}</span><span style="color:var(--acc-text)">${LEVEL_NAMES[end]}</span></div>
          <div class="bar" style="height:12px"><span style="width:${recs.length ? (nDone / recs.length) * 100 : 0}%;background:linear-gradient(90deg,var(--series2),var(--text),var(--acc))"></span></div>
          <span class="faint" style="font-size:12px">Marque cada upgrade quando fizer e veja seu pato evoluir.</span></div>` : ""}
      </section>
      <div class="stack" style="gap:14px;min-width:0">
        <div class="row wrap" style="justify-content:space-between;align-items:flex-end;gap:12px"><div class="stack" style="gap:0"><h2 class="display" style="margin:0;font-size:26px;font-weight:800">Seu caminho</h2>
          <span class="faint">Em ordem de prioridade · ${esc(when(entry.data))}</span></div>
          <span class="display" style="font-size:18px;font-weight:800;color:var(--acc-text)">${nDone} de ${recs.length} feitos</span></div>
        ${r.budget_message ? `<p class="notice ${budgetTone}" style="margin:0"><strong>Orçamento:</strong> ${esc(r.budget_message)}</p>` : ""}
        ${quests || `<div class="panel pad muted">Nenhum upgrade recomendado agora. ${esc(r.budget_message || "")}</div>`}
        ${recs.length ? shopBar() : ""}
        <div class="row wrap no-print" style="gap:10px;justify-content:space-between"><span class="faint" style="font-size:12px;flex:1 1 220px">Preços não são consultados em tempo real: os links abrem uma busca.</span>${actions}</div>
      </div></div>
      <section class="grid in" style="animation-delay:300ms;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
        <div class="panel pad stack" style="gap:10px"><h2 class="section-title" style="font-size:19px">Resumo e análise completa</h2>${list(r.quick_summary)}${list(r.analysis)}
          ${(r.bottlenecks || []).length ? `<span class="label" style="font-size:12px;margin-top:6px">Gargalos</span>${list(r.bottlenecks)}` : ""}</div>
        ${(r.missing_information || []).length ? `<div class="panel pad stack" style="gap:10px"><h2 class="section-title" style="font-size:19px">Para uma análise mais precisa</h2>${list(r.missing_information)}
          ${linkGo("Informar peças em Meu PC", `data-go="computer"`)}</div>` : ""}
      </section>
      <p class="faint" style="margin:0;font-size:13px">Os links abrem uma pesquisa de preço; não são cotações. Confira a compatibilidade antes de comprar.</p>${shopModal()}`;
    bind();
  }

  function bind() {
    const exportBtn = document.getElementById("export-btn");
    if (exportBtn) exportBtn.addEventListener("click", () => { menuOpen = !menuOpen; render(); });
    root().querySelectorAll("[data-export]").forEach((button) => button.addEventListener("click", async () => {
      menuOpen = false;
      const kind = button.dataset.export;
      render();
      if (kind === "print") setTimeout(() => window.print(), 50);
      if (kind === "copy") App.toast(await copy(summaryText(entry)) ? "Resumo copiado." : "Não deu para copiar.");
      if (kind === "file") {
        const saved = await Bridge.call("export_report", entry.id);
        if (saved && saved.ok) App.toast("Relatório salvo.");
      }
    }));
    const openShop = document.getElementById("shop-open");
    if (openShop) openShop.addEventListener("click", () => { shopOpen = true; copied = false; render(); });
    const closeShop = () => { shopOpen = false; render(); };
    ["shop-close", "shop-done"].forEach((id) => { const b = document.getElementById(id); if (b) b.addEventListener("click", closeShop); });
    const modal = document.getElementById("shop-modal");
    if (modal) modal.addEventListener("click", (event) => { if (event.target === modal) closeShop(); });
    root().querySelectorAll("[data-shop-inc]").forEach((b) => b.addEventListener("click", async () => {
      const i = Number(b.dataset.shopInc);
      const it = shopItem(entry, i);
      await saveShop(i, !it.incluir, it.preco);
      render();
    }));
    root().querySelectorAll("[data-shop-price]").forEach((input) => {
      const i = Number(input.dataset.shopPrice);
      const read = () => { const v = Number(input.value.replace(/\./g, "").replace(",", ".")); return input.value.trim() && Number.isFinite(v) && v >= 0 ? v : null; };
      input.addEventListener("input", () => { entry.compras = { ...(entry.compras || {}), [i]: { ...shopItem(entry, i), preco: read() } }; refreshShop(); });
      input.addEventListener("change", () => saveShop(i, shopItem(entry, i).incluir, read()));
    });
    const copyShop = document.getElementById("shop-copy");
    if (copyShop) copyShop.addEventListener("click", async () => { copied = await copy(shopText(entry)); render(); });
    root().querySelectorAll("[data-check]").forEach((button) => button.addEventListener("click", () => {
      const marks = checks[entry.id] || (checks[entry.id] = {});
      marks[button.dataset.check] = !marks[button.dataset.check];
      render();
    }));
    root().querySelectorAll("[data-done]").forEach((button) => button.addEventListener("click", async () => {
      const index = Number(button.dataset.done);
      const response = await Bridge.call("set_upgrade_done", entry.id, index, !(entry.feitos || [])[index]);
      if (!response.entry) return;
      entry = response.entry;
      render();
      App.emit("history-changed");
      if (response.swan) {
        App.swanMoment();
        App.toast(response.first_swan ? "Conquista desbloqueada: Virou cisne" : "Quack! Seu PC virou cisne.");
        if (response.first_swan) {
          App.state.settings.achievements = { ...(App.state.settings.achievements || {}), cisne: true };
          App.emit("history-changed");
        }
      }
    }));
  }

  return {
    async show(options) {
      menuOpen = false;
      shopOpen = false;
      const id = options && options.id;
      if (id) entry = await Bridge.call("get_analysis", id);
      else if (!entry) {
        const history = await Bridge.call("get_history");
        entry = history[0] || null;
      }
      render();
    },
  };
})());
