/* Analisando: o pato mergulha enquanto o Gemini trabalha. */
App.register("analyzing", (() => {
  const root = () => document.getElementById("page-analyzing");
  const STEPS = [
    ["Mergulhando nas peças…", "Peças lidas"],
    ["Consultando o Gemini…", "O Gemini respondeu"],
    ["Montando o relatório…", "Relatório pronto"],
  ];
  let phase = 0;
  let running = false;
  let timers = [];
  let entryId = null;
  let request = null;

  function scene(diving) {
    return `<div aria-hidden="true" style="position:relative;width:min(560px,100%);height:240px;overflow:hidden;border-radius:8px;background:var(--bg)">
      <div class="${diving ? "dive" : "bob"}" style="position:absolute;left:50%;top:60px;width:200px;margin-left:-110px;transform-origin:62% 72%">${duckSide(200, 129)}</div>
      <div style="position:absolute;left:0;right:0;top:176px;bottom:0;background:var(--s2)"></div>
      <div style="position:absolute;left:0;right:0;top:166px;height:22px;overflow:hidden"><div class="wave" style="width:200%;height:22px;animation-duration:3.4s">${waves(22, 0)}</div></div>
      <div style="position:absolute;left:0;right:0;top:196px;height:22px;overflow:hidden;opacity:.6"><div class="wave" style="width:200%;height:22px;animation-duration:5.2s;animation-direction:reverse">${waves(22, 0)}</div></div>
    </div>`;
  }

  function render() {
    const done = phase >= 3;
    const steps = STEPS.map(([doing, finished], index) => {
      const state = index < phase ? "done" : index === phase ? "now" : "next";
      const mark = state === "done" ? `<span class="pop" style="display:flex;color:var(--acc-text)">${icon("check", 18, 2.6)}</span>`
        : state === "now" ? `<span class="spin" style="display:flex;color:var(--acc-text)">${icon("refresh", 17)}</span>`
        : `<span style="width:8px;height:8px;border-radius:50%;background:var(--line2)"></span>`;
      return `<li class="row" style="gap:12px;min-height:40px;padding:0 14px;border-radius:6px;background:${state === "now" ? "var(--s2)" : "transparent"};color:${state === "next" ? "var(--muted)" : "var(--text)"}">
        <span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center">${mark}</span>${state === "done" ? finished : doing}</li>`;
    }).join("");
    root().innerHTML = pageHeader("ANÁLISE EM ANDAMENTO", "Analisando seu computador", esc(request ? request.resumo : "")) + `
      <section class="panel in" style="animation-delay:80ms;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:24px">
        ${scene(!done)}
        <div class="stack" style="align-items:center;gap:6px;text-align:center">
          <span class="display" aria-live="polite" style="font-size:26px;font-weight:700">${done ? "Quack! Análise pronta." : STEPS[Math.min(phase, 2)][0]}</span>
          <span class="muted">${done ? "O Mallard voltou à superfície com o diagnóstico." : "O pato está lá embaixo, olhando peça por peça. Leva alguns segundos."}</span></div>
        <div class="bar" style="width:min(560px,100%);height:4px"><span style="width:${(phase / 3) * 100}%;background:var(--acc)"></span></div>
        <ol style="list-style:none;margin:0;padding:0;width:min(560px,100%);display:flex;flex-direction:column;gap:4px">${steps}</ol>
        ${done ? `<button type="button" class="btn btn-primary in" id="see-result">Ver resultado${icon("arrow", 17)}</button>` : ""}
      </section>`;
    const see = document.getElementById("see-result");
    if (see) see.addEventListener("click", () => App.go("result", { id: entryId }));
  }

  function setPhase(value) {
    phase = value;
    if (App.state.page === "analyzing") render();
  }

  async function start(newRequest) {
    if (running) return;
    running = true;
    request = newRequest;
    entryId = null;
    timers.forEach(clearTimeout);
    phase = 0;
    render();
    timers = [setTimeout(() => setPhase(1), 1400)];
    let response;
    try {
      response = await Bridge.call("run_analysis", request.perfil, request.preferencias);
    } catch (error) {
      response = { ok: false, error: "desconhecido", message: String(error) };
    }
    timers.forEach(clearTimeout);
    running = false;
    if (!response.ok) {
      App.refreshAi();
      if (App.state.page === "analyzing") App.go("error", { code: response.error, message: response.message, retrySeconds: response.retry_seconds || 0 });
      else App.toast("Não deu para concluir a análise.");
      return;
    }
    entryId = response.entry.id;
    App.emit("history-changed");
    setPhase(2);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setPhase(3);
    if (response.first) setTimeout(() => App.toast("Conquista desbloqueada: Primeiro mergulho"), 300);
    if (App.state.page === "analyzing") {
      setTimeout(() => { if (App.state.page === "analyzing") App.go("result", { id: entryId }); }, 1600);
    } else {
      App.toast("Análise pronta! Veja no Histórico.");
    }
  }

  return {
    show(options) {
      if (options && options.request) start(options.request);
      else render();
    },
  };
})());
