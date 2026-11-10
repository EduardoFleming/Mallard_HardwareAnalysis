/* Inicialização: programas que abrem junto com o Windows. Desligar não desinstala nada. */
App.register("startup", (() => {
  const root = () => document.getElementById("page-startup");
  let data = null;

  const IMPACT = { Alto: "crit", "Médio": "warn", Baixo: "" };

  function totals() {
    const on = data.items.filter((i) => i.enabled);
    const seconds = on.reduce((s, i) => s + (i.seconds || 0), 0);
    const memory = on.reduce((s, i) => s + (i.memory_mb || 0), 0);
    const saveable = data.items.filter((i) => i.enabled && i.suggest && !i.locked);
    return { seconds, memory, saveable, saveSeconds: saveable.reduce((s, i) => s + (i.seconds || 0), 0), saveMemory: saveable.reduce((s, i) => s + (i.memory_mb || 0), 0) };
  }

  function item(i) {
    return `<div class="toggle-row"><div class="stack" style="gap:2px;flex:1;min-width:0">
      <div class="row wrap" style="gap:8px"><b>${esc(i.name)}</b><span class="pill ${IMPACT[i.impact] || ""}">${esc(i.impact || "Baixo")}</span>
        ${i.suggest && i.enabled ? `<span class="tag acc">Dá para desligar</span>` : ""}${i.locked ? `<span class="tag">Protegido</span>` : ""}</div>
      <span class="muted" style="font-size:14px">${esc(i.hint || "")}</span></div>
      <span class="num faint" style="min-width:92px;text-align:right;font-size:14px">+${fmt(i.seconds || 0, 0)} s · ${fmt(i.memory_mb || 0, 0)} MB</span>
      <button type="button" class="switch" data-toggle="${esc(i.id)}" aria-pressed="${i.enabled}" aria-label="${i.enabled ? "Desligar" : "Ligar"} ${esc(i.name)}" ${i.locked ? "disabled style=\"opacity:.5;cursor:default\"" : ""}><span></span></button></div>`;
  }

  function render() {
    const head = pageHeader("INICIALIZAÇÃO", "Inicialização", "Quanto mais programas abrem com o Windows, mais demora para o PC ficar pronto.");
    if (!data) { root().innerHTML = head; return; }
    if (!data.supported) {
      root().innerHTML = head + `<section class="panel dashed pad in" style="text-align:center"><span class="muted">Esta tela lê a lista de inicialização do Windows. Neste sistema ela fica desligada.</span></section>`;
      return;
    }
    const t = totals();
    root().innerHTML = head + `<div class="two-col"><section class="panel in" style="overflow:hidden">${data.items.length ? data.items.map(item).join("") : `<div class="pad" style="padding:24px;text-align:center"><span class="muted">Nenhum programa abre junto com o Windows.</span></div>`}</section>
      <section class="panel pad in stack" style="gap:16px;position:sticky;top:0">
        <div class="stack" style="gap:2px"><span class="label">O PC liga em cerca de</span><span class="big-num">${fmt(data.base_seconds + t.seconds, 0)} s</span>
          <span class="faint" style="font-size:13px">${fmt(data.base_seconds, 0)} s do Windows + ${fmt(t.seconds, 0)} s dos programas · ${fmt(t.memory, 0)} MB de memória</span></div>
        ${t.saveable.length ? `<div class="notice soft">Desligando os ${t.saveable.length} sugeridos, o PC liga uns <b>${fmt(t.saveSeconds, 0)} s</b> mais rápido e libera ${fmt(t.saveMemory, 0)} MB.</div>
          <button type="button" class="pill-btn" id="st-suggest">${icon("check", 16)}Desligar os sugeridos</button>` : `<div class="notice soft">Nada a sugerir: sua inicialização está enxuta.</div>`}
        <span class="faint" style="font-size:13px">Desligar não desinstala. Dá para ligar de novo aqui. A mudança vale no próximo ligar do PC.</span></section></div>`;
    root().querySelectorAll("[data-toggle]").forEach((button) => button.addEventListener("click", () => toggle(button.dataset.toggle, button.getAttribute("aria-pressed") !== "true")));
    const suggest = document.getElementById("st-suggest");
    if (suggest) suggest.addEventListener("click", async () => { for (const i of t.saveable) await toggle(i.id, false, true); render(); });
  }

  async function toggle(id, enabled, quiet) {
    try { data = await Bridge.call("set_startup_enabled", id, enabled); } catch (error) { App.toast("Não deu para alterar este item."); return; }
    if (!quiet) render();
  }

  return {
    async show() {
      render();
      try { data = await Bridge.call("get_startup"); } catch (error) { data = { supported: false, items: [], base_seconds: 30 }; }
      if (App.state.page === "startup") render();
    },
  };
})());
