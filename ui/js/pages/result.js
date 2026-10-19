/* Resultado da análise: veredito, gargalo, nível, upgrades e a conquista do cisne. */
App.register("result", (() => {
  const root = () => document.getElementById("page-result");
  const PRIORITY = { alta: "Alta", "média": "Média", media: "Média", baixa: "Baixa" };
  let entry = null;
  let open = 0;
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

  function render() {
    if (!entry) {
      root().innerHTML = pageHeader("DIAGNÓSTICO", "Resultado da análise", "Nenhuma análise aberta.") +
        `<div class="panel pad in stack" style="align-items:flex-start">${duckling(52, 42)}<span class="muted">Faça uma análise no Consultor ou abra uma pelo Histórico.</span>
        <button type="button" class="btn btn-primary" data-go="advisor">Ir para o Consultor</button></div>`;
      return;
    }
    const r = entry.resultado;
    const done = entry.feitos || [];
    const recs = r.recommendations || [];
    const nDone = done.filter(Boolean).length;
    const allDone = recs.length > 0 && nDone === recs.length;
    const budgetTone = r.budget_status === "no_worthwhile_upgrade" ? "warn" : "soft";
    const actions = `<div class="row wrap no-print" style="gap:10px">
      <div style="position:relative"><button type="button" class="btn btn-secondary" id="export-btn" aria-expanded="${menuOpen}">${icon("download", 17)}Exportar${icon("chev", 16)}</button>
        ${menuOpen ? `<div class="menu in" style="animation-duration:.2s">
          <button type="button" data-export="file"><strong>Salvar relatório</strong><span class="faint" style="font-size:13px">Arquivo que abre em qualquer navegador</span></button>
          <button type="button" data-export="print"><strong>Imprimir ou salvar em PDF</strong><span class="faint" style="font-size:13px">Escolha "Salvar como PDF" na impressora</span></button>
          <button type="button" data-export="copy"><strong>Copiar resumo</strong><span class="faint" style="font-size:13px">Para colar no WhatsApp ou no Discord</span></button></div>` : ""}</div>
      <button type="button" class="btn btn-primary" data-go="advisor">Nova consulta</button></div>`;

    const recCards = recs.map((rec, i) => {
      const isOpen = open === i;
      return `<article class="panel hoverable in" style="animation-delay:${160 + i * 80}ms;overflow:hidden">
        <button type="button" class="rec-head" data-rec="${i}" aria-expanded="${isOpen}">
          <span class="num faint" style="font-size:26px;font-weight:700;width:30px">0${i + 1}</span>
          ${priorityTag(rec.priority)}
          <span class="stack" style="gap:3px;flex:1 1 260px;min-width:0"><span class="faint" style="font-size:13px;font-weight:600">${esc(rec.component)}</span>
            <span class="display" style="font-size:20px;font-weight:700;line-height:1.2">${rec.current ? `${esc(rec.current)} → ` : ""}${esc(rec.suggestion)}</span></span>
          ${done[i] ? `<span class="tag acc pop">${icon("check", 13, 2.6)} Feito</span>` : ""}
          <span class="tag">Compatibilidade ${esc(rec.compatibility || "—")}</span>
          <span class="rec-chev">${icon("chev", 20)}</span>
        </button>
        ${isOpen ? `<div class="stack in" style="padding:0 20px 20px 66px;gap:14px;animation-duration:.3s">
          <p style="margin:0;line-height:1.6">${esc(rec.reason)}</p>
          ${(rec.verify_before_buying || []).length ? `<div class="notice soft"><strong style="color:var(--text)">Antes de comprar:</strong>${list(rec.verify_before_buying)}</div>` : ""}
          <div class="row wrap no-print" style="gap:10px">
            ${rec.search_url ? `<button type="button" class="btn btn-secondary" data-url="${esc(rec.search_url)}">Pesquisar preço${icon("ext", 16)}</button>` : ""}
            <button type="button" class="btn btn-secondary" data-done="${i}" aria-pressed="${!!done[i]}" style="${done[i] ? "border-color:var(--acc-text);color:var(--acc-text);background:var(--acc-soft)" : ""}">${icon("check", 16, 2.4)}${done[i] ? "Feito" : "Marcar como feito"}</button>
          </div></div>` : ""}
      </article>`;
    }).join("");

    root().innerHTML = pageHeader(`QUACK! DIAGNÓSTICO PRONTO · ${when(entry.data)}`, "Resultado da análise", esc(profileLine(entry)), actions) + `
      <section class="grid in" style="animation-delay:60ms;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
        <div class="panel pad stack" style="gap:10px">
          <div class="row" style="justify-content:space-between"><span class="label">Veredito</span><span class="tag">Confiança ${esc(r.confidence || "—")}</span></div>
          <p class="display" style="margin:0;font-size:24px;font-weight:700;line-height:1.2">${esc(r.verdict)}</p>
          ${list(r.quick_summary)}
        </div>
        <div class="panel pad stack" style="gap:12px">
          <span class="num" style="font-size:13px;font-weight:700;letter-spacing:.12em;color:${r.main_bottleneck ? "var(--warn)" : "var(--text2)"}">GARGALO PRINCIPAL</span>
          <span class="display" style="font-size:27px;font-weight:700;line-height:1">${esc(r.main_bottleneck || "Sem gargalo claro")}</span>
          <div class="row wrap" style="gap:10px;padding-top:12px;border-top:1px solid var(--line)">
            <span class="label" style="font-size:12px;width:100%">Nível do PC</span>
            ${levelIcon(r.level_now)}<span style="font-weight:600">${LEVEL_NAMES[r.level_now]}</span>
            ${r.level_after > r.level_now ? `<span style="color:var(--acc-text);display:flex">${icon("arrow", 18)}</span>${levelIcon(r.level_after)}<span style="font-weight:600">${LEVEL_NAMES[r.level_after]}</span><span class="faint" style="font-size:13px">depois dos upgrades</span>` : ""}
          </div>
        </div>
      </section>
      ${r.budget_message ? `<p class="notice ${budgetTone} in" style="margin:0;animation-delay:90ms"><strong>Orçamento:</strong> ${esc(r.budget_message)}</p>` : ""}
      ${recs.length ? `<section class="panel in no-print" style="animation-delay:110ms;padding:18px 22px;display:flex;align-items:center;gap:18px;flex-wrap:wrap">
        <span style="display:flex">${allDone ? `<span class="pop" style="display:flex">${swanSymbol(52, 12)}</span>` : logoSymbol(52, 12)}</span>
        <div class="stack" style="flex:1 1 280px;min-width:0">
          <div class="row" style="justify-content:space-between"><span class="display" style="font-size:19px;font-weight:700">${allDone ? "Seu PC virou cisne!" : "Do patinho ao cisne"}</span>
            <span class="num muted" style="font-size:15px;font-weight:700">${nDone} de ${recs.length} upgrades feitos</span></div>
          <div class="bar"><span style="width:${(nDone / recs.length) * 100}%;background:var(--acc)"></span></div>
          <span class="muted" style="font-size:14px">${allDone ? "Todos os upgrades recomendados foram feitos." : `Marque cada upgrade quando fizer. Faça ${recs.length === 1 ? "ele" : `os ${recs.length}`} e veja o que acontece.`}</span>
        </div></section>` : ""}
      <section class="stack" style="gap:12px">
        <h2 class="label in" style="margin:0;animation-delay:120ms">Recomendações, em ordem de prioridade</h2>
        ${recCards || `<div class="panel pad muted">Nenhum upgrade recomendado agora. ${esc(r.budget_message || "")}</div>`}
      </section>
      <section class="grid in" style="animation-delay:300ms;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
        <div class="panel pad stack" style="gap:10px"><h2 class="section-title" style="font-size:19px">Análise completa</h2>${list(r.analysis)}
          ${(r.bottlenecks || []).length ? `<span class="label" style="font-size:12px;margin-top:6px">Gargalos</span>${list(r.bottlenecks)}` : ""}</div>
        ${(r.missing_information || []).length ? `<div class="panel pad stack" style="gap:10px"><h2 class="section-title" style="font-size:19px">Para uma análise mais precisa</h2>${list(r.missing_information)}
          ${linkGo("Informar peças em Meu computador", `data-go="computer"`)}</div>` : ""}
      </section>
      <p class="faint" style="margin:0;font-size:13px">Os links abrem uma pesquisa de preço; não são cotações. Confira a compatibilidade antes de comprar.</p>`;
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
    root().querySelectorAll("[data-rec]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.rec);
      open = open === index ? -1 : index;
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
      open = 0;
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
