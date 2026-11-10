/* Bateria: saúde, histórico e quem mais gasta. Só aparece em notebooks. */
App.register("battery", (() => {
  const root = () => document.getElementById("page-battery");
  let data = null;

  function healthWord(p) {
    if (p == null) return ["Sem leitura", ""];
    if (p >= 80) return ["Boa", "ok"];
    if (p >= 60) return ["Já cansada", "warn"];
    return ["Hora de trocar", "crit"];
  }

  function history(series) {
    if (!series || series.length < 2) return `<span class="muted">O Windows ainda não guardou histórico suficiente.</span>`;
    const max = Math.max(...series.map((p) => p.wh));
    return `<div class="spark-bars">${series.map((p) => `<div><span class="num">${fmt(p.wh, 0)}</span><i style="height:${Math.max(6, (p.wh / max) * 90)}px"></i><span>${esc(p.label)}</span></div>`).join("")}</div>`;
  }

  function render() {
    const head = pageHeader("NOTEBOOK", "Bateria", "Quanto da bateria de fábrica ainda existe e o que mais a consome.");
    if (!data) { root().innerHTML = head; return; }
    if (!data.supported) {
      root().innerHTML = head + `<section class="panel dashed pad in" style="text-align:center"><span class="muted">Este computador não tem bateria (é um desktop). Esta tela é só para notebooks.</span></section>`;
      return;
    }
    const [word, tone] = healthWord(data.health_percent);
    root().innerHTML = head + `<div class="two-col"><div class="stack" style="gap:18px">
      <section class="panel pad in stack" style="gap:16px">
        <div class="row wrap" style="gap:24px;align-items:center"><div class="stack" style="gap:2px"><span class="label">Saúde</span><span class="big-num" style="font-size:56px">${data.health_percent != null ? `${data.health_percent}%` : "—"}</span>
            <span class="pill ${tone}" style="width:fit-content">${word}</span></div>
          <div class="stack" style="gap:6px;flex:1;min-width:220px">
            <div class="row" style="justify-content:space-between"><span class="muted">Agora</span><b class="num">${data.percent}%${data.plugged ? " · na tomada" : ""}</b></div>
            <div class="row" style="justify-content:space-between"><span class="muted">De fábrica</span><b class="num">${data.design_wh != null ? `${fmt(data.design_wh)} Wh` : "—"}</b></div>
            <div class="row" style="justify-content:space-between"><span class="muted">Cheia hoje</span><b class="num">${data.full_wh != null ? `${fmt(data.full_wh)} Wh` : "—"}</b></div>
            <div class="row" style="justify-content:space-between"><span class="muted">Ciclos de carga</span><b class="num">${data.cycles != null ? data.cycles : "—"}</b></div></div></div>
        ${data.has_report ? "" : `<div class="notice warn">O Windows não entregou o relatório da bateria agora. Mostramos só a carga atual.</div>`}</section>
      <section class="panel pad in stack" style="gap:12px"><h2 class="section-title">Capacidade ao longo do tempo (Wh)</h2>${history(data.history)}</section></div>
      <section class="panel pad in stack" style="gap:14px;position:sticky;top:0"><h2 class="section-title">Quem mais usa o processador</h2>
        ${data.drain && data.drain.length ? data.drain.map((d) => `<div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between"><b>${esc(d.name)}</b><span class="num">${d.percent}%</span></div><div class="bar"><span style="width:${d.percent}%;background:var(--acc)"></span></div></div>`).join("") : `<span class="muted">Nada pesando agora.</span>`}
        <span class="faint" style="font-size:13px">É uma estimativa: quem usa mais o processador costuma gastar mais bateria.</span>
        <div class="row wrap" style="gap:10px"><button type="button" class="pill-btn ghost" id="bt-refresh">${icon("refresh", 16)}Atualizar</button>
          <button type="button" class="pill-btn ghost" id="bt-power">Configurações de energia</button></div></section></div>`;
    document.getElementById("bt-refresh").addEventListener("click", () => load(true));
    document.getElementById("bt-power").addEventListener("click", () => Bridge.call("open_power_settings").catch(() => {}));
  }

  async function load(refresh) {
    try { data = await Bridge.call("get_battery", !!refresh); } catch (error) { data = { supported: false }; }
    if (App.state.page === "battery") render();
  }

  return { show() { render(); load(false); } };
})());
