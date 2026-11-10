/* Vai rodar?: compara um jogo ou programa com as peças do PC. A lista é local; títulos novos podem ir ao Gemini. */
App.register("gamecheck", (() => {
  const root = () => document.getElementById("page-gamecheck");
  let examples = [];
  let query = "";
  let state = { phase: "idle" };   // idle | loading | result | notfound | error

  const COLOR = { ok: "ok", warn: "warn", crit: "crit", unk: "" };
  const STATE_ICON = { ok: "check", warn: "warn", crit: "x", unk: "info" };

  function scale(row) {
    const sc = row.scale;
    if (!sc || !sc.max) return "";
    const pct = (value) => Math.max(0, Math.min(100, (value / sc.max) * 100));
    const tone = row.s === "crit" ? "crit" : row.s === "warn" ? "warn" : "";
    return `<div class="stack" style="gap:6px;margin-top:6px"><div class="meter"><i class="${tone}" style="width:${pct(sc.val)}%"></i>
        <u style="left:${pct(sc.min)}%" title="Mínimo"></u><u style="left:${pct(sc.rec)}%;background:var(--acc-text)" title="Recomendado"></u></div>
      <div class="row" style="justify-content:space-between;font-size:12.5px;color:var(--muted)"><span>Mínimo: ${esc(sc.min_label)}</span><span>Recomendado: ${esc(sc.rec_label)}</span></div></div>`;
  }

  function rowHtml(row) {
    const tone = COLOR[row.s];
    return `<div class="panel" style="padding:14px 16px;background:var(--s2)"><div class="row" style="gap:12px;align-items:flex-start">
      <span class="pill ${tone}" style="min-width:34px;justify-content:center;padding:6px">${icon(STATE_ICON[row.s] || "info", 16, 2.4)}</span>
      <div class="stack" style="gap:2px;flex:1;min-width:0">
        <div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap"><b>${esc(row.part)}</b><span class="pill ${tone}">${esc(row.state)}</span></div>
        <span class="muted" style="font-size:14px">Seu PC: ${esc(row.you)}</span><span class="faint" style="font-size:14px">Pede: ${esc(row.need)}</span>${scale(row)}</div></div></div>`;
  }

  function resultHtml(r) {
    const tone = COLOR[r.color] || "";
    return `<section class="panel pad in stack" style="gap:18px">
      <div class="row wrap" style="gap:16px;justify-content:space-between">
        <div class="stack" style="gap:4px"><span class="label">${esc(r.kind || "Jogo ou programa")}${state.source === "gemini" ? " · requisitos buscados pelo Gemini" : ""}</span>
          <h2 class="display" style="margin:0;font-size:28px;font-weight:700">${esc(r.name)}</h2>
          <span class="pill ${tone}" style="width:fit-content;font-size:15px;padding:6px 14px">${esc(r.verdict)}</span></div>
        <div class="stack" style="align-items:center;gap:2px"><span class="big-num" style="color:${tone === "crit" ? "var(--crit)" : tone === "warn" ? "var(--warn)" : "var(--acc-text)"}">${r.score}</span><span class="label" style="font-size:11px">de 100</span></div>
      </div>
      <div class="stack" style="gap:10px">${r.rows.map(rowHtml).join("")}</div>
      ${r.cta ? `<div class="row wrap" style="gap:10px"><button type="button" class="pill-btn" data-go="${esc(r.cta.page)}">${esc(r.cta.label)}${icon("arrow", 16)}</button></div>` : ""}
      ${state.source === "gemini" ? `<span class="faint" style="font-size:13px">Os requisitos vieram do Gemini e podem errar. Confira na página oficial do título.</span>` : `<span class="faint" style="font-size:13px">Comparação com os requisitos publicados. Não mede o desempenho real do seu PC.</span>`}
    </section>`;
  }

  function body() {
    if (state.phase === "loading") return `<section class="panel pad in row" style="gap:14px"><span class="spin" style="display:flex;color:var(--acc-text)">${icon("refresh", 22)}</span><span>${esc(state.message || "Procurando…")}</span></section>`;
    if (state.phase === "result") return resultHtml(state.data);
    if (state.phase === "notfound") {
      const hasKey = App.state.ai.has_key;
      return `<section class="panel pad in stack" style="gap:12px"><h2 class="section-title">Não achei “${esc(state.query)}” na lista</h2>
        <p class="muted" style="margin:0">A lista local tem ${examples.length ? "os títulos mais comuns" : "poucos títulos"}. Para outros, o Gemini pode buscar os requisitos (uma única solicitação).</p>
        ${hasKey ? "" : `<div class="notice warn">Para títulos que não estão na lista local, é necessária uma chave própria do Gemini. Ela não vem incluída no Mallard. No Windows, fica salva com criptografia na sua conta. Configure-a em Configurações de IA.</div>`}
        <div class="row wrap" style="gap:10px"><button type="button" class="pill-btn" id="gc-ask" ${hasKey ? "" : "disabled"}>${icon("spark", 16)}Perguntar ao Gemini</button>
          ${hasKey ? "" : `<button type="button" class="pill-btn ghost" data-go="settings">Configurar Gemini</button>`}</div></section>`;
    }
    if (state.phase === "error") return `<section class="panel pad in stack" style="gap:10px"><h2 class="section-title">Não deu para consultar o Gemini</h2><p class="muted" style="margin:0">${esc(state.message || "Tente de novo em instantes.")}</p></section>`;
    return `<section class="panel dashed pad in stack" style="gap:8px;text-align:center;align-items:center">${duckling(56, 46, true)}<b class="display" style="font-size:20px">Digite um jogo ou programa</b><span class="muted">Ex.: Valorant, Minecraft, Photoshop.</span></section>`;
  }

  function render() {
    root().innerHTML = pageHeader("COMPATIBILIDADE", "Vai rodar?", "Escolha um jogo ou programa e veja se o seu PC dá conta.") + `
      <section class="panel pad in stack" style="gap:14px">
        <form class="row wrap" id="gc-form" style="gap:10px"><label class="sr-only" for="gc-q">Nome do jogo ou programa</label>
          <input id="gc-q" class="input" value="${esc(query)}" placeholder="Ex.: Valorant" autocomplete="off" style="flex:1 1 260px;border-radius:999px;padding:0 18px">
          <button type="submit" class="pill-btn">Verificar</button></form>
        ${examples.length ? `<div class="row wrap" style="gap:8px"><span class="faint" style="font-size:14px">Experimente:</span>${examples.map((item) => `<button type="button" class="chip" data-example="${esc(item.name)}">${esc(item.name)}</button>`).join("")}</div>` : ""}
      </section>${body()}`;
    document.getElementById("gc-form").addEventListener("submit", (event) => { event.preventDefault(); run(document.getElementById("gc-q").value); });
    root().querySelectorAll("[data-example]").forEach((chip) => chip.addEventListener("click", () => run(chip.dataset.example)));
    const ask = document.getElementById("gc-ask");
    if (ask) ask.addEventListener("click", askGemini);
  }

  async function run(text) {
    query = String(text || "").trim();
    if (!query) return;
    state = { phase: "loading", message: "Comparando com o seu PC…" };
    render();
    try {
      const data = await Bridge.call("check_game", query);
      state = data.found ? { phase: "result", data, source: data.source } : { phase: "notfound", query: data.query || query };
    } catch (error) {
      state = { phase: "error", message: String(error) };
    }
    render();
  }

  async function askGemini() {
    state = { phase: "loading", message: "Perguntando ao Gemini…" };
    render();
    let response;
    try { response = await Bridge.call("ask_game", query); } catch (error) { response = { ok: false, message: String(error) }; }
    await App.refreshAi();
    if (!response.ok) {
      const wait = response.retry_seconds ? ` Espere ${response.retry_seconds} s antes de tentar de novo.` : "";
      state = { phase: "error", message: (response.message || "Não foi possível falar com o Gemini.") + wait };
    } else if (!response.found) {
      state = { phase: "error", message: `O Gemini não reconheceu “${query}”. Confira o nome do título.` };
    } else {
      state = { phase: "result", data: response, source: "gemini" };
    }
    render();
  }

  return {
    init() {
      App.on("hardware", () => { if (App.state.page === "gamecheck" && state.phase === "result") run(query); });
      App.on("ai", () => { if (App.state.page === "gamecheck" && state.phase === "notfound") render(); });
    },
    async show() {
      if (!examples.length) { try { examples = await Bridge.call("get_game_examples"); } catch (error) { examples = []; } }
      render();
    },
  };
})());
