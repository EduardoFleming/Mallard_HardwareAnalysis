/* Configurações: escolha do pato, movimento e a história do nome.
   A chave do Gemini não aparece aqui: ela é pedida no Consultor e fica só na memória. */
App.register("settings", (() => {
  const root = () => document.getElementById("page-settings");

  function duckCard(theme, current) {
    const on = theme.id === current;
    return `<button type="button" class="th-${theme.id}" data-pick-theme="${theme.id}" aria-pressed="${on}"
      style="text-align:left;cursor:pointer;color:var(--text);background:var(--s1);border:1px solid var(--line2);border-radius:8px;padding:0;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 0 0 2px ${on ? "var(--acc-text)" : "transparent"};transition:transform .15s, box-shadow .2s">
      <span style="display:block;width:100%;padding:16px 16px 6px;background:var(--bg)">${duckSide("100%", 96)}</span>
      <span class="stack" style="padding:14px 16px 16px;gap:6px;width:100%">
        <span class="row" style="justify-content:space-between"><span class="display" style="font-size:18px;font-weight:700">${esc(theme.name)}</span>
          ${on ? `<span class="row num" style="gap:4px;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--acc-text)">${icon("check", 14, 2.6)}SEU PATO</span>` : ""}</span>
        <span class="label" style="font-size:12px">${esc(theme.kind)}</span>
        <span class="muted" style="font-size:13px">${esc(theme.desc)}</span>
        <span class="row" style="gap:8px;margin-top:6px"><span style="flex:1;height:6px;border-radius:3px;background:var(--track);overflow:hidden"><span style="display:block;width:64%;height:6px;background:var(--acc)"></span></span>
          <span style="height:24px;padding:0 9px;border-radius:3px;background:var(--acc);color:var(--on-acc);font-size:12px;font-weight:700;display:flex;align-items:center">Analisar</span></span>
      </span></button>`;
  }

  function row(label, desc, control) {
    return `<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px 20px;padding-top:14px;border-top:1px solid var(--line)">
      <div class="stack" style="gap:3px;min-width:0"><span style="font-weight:600">${label}</span><span class="faint" style="font-size:14px">${desc}</span></div>${control}</div>`;
  }

  function render() {
    const s = App.state.settings;
    if (!s) {
      root().innerHTML = pageHeader("AJUSTES", "Configurações", "Carregando suas preferências…");
      return;
    }
    const info = App.state.info || { version: "2.0", os: "" };
    const ai = App.state.ai || { has_key: false };
    root().innerHTML = pageHeader("AJUSTES", "Configurações", "Seu pato, a chave da IA e a forma como o Mallard se mexe.") + `
      <section class="panel pad in" style="animation-delay:60ms;display:flex;flex-direction:column;gap:18px">
        <div class="stack" style="gap:4px"><h2 class="section-title">Escolha seu pato</h2>
          <span class="muted" style="font-size:14px">Cada tema usa as cores de uma plumagem. A escolha vale para o app inteiro.</span></div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(165px,1fr))">${App.availableThemes().map((t) => duckCard(t, s.theme)).join("")}</div>
      </section>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(360px,1fr));align-items:start;gap:16px">
        <section class="panel pad in" style="animation-delay:90ms;display:flex;flex-direction:column;gap:14px">
          <div class="stack" style="gap:4px"><h2 class="section-title">Inteligência artificial</h2>
            <span class="muted" style="font-size:14px">O Consultor usa o Google Gemini. A chave fica só na memória e some quando você fecha o Mallard.</span></div>
          ${ai.has_key
            ? `<div class="row" style="gap:10px;padding:12px 14px;border-radius:6px;background:var(--s0)"><span style="color:var(--acc-text);display:flex">${icon("key", 18)}</span>
                <span style="flex:1">Chave preenchida${ai.masked ? ` · termina em ${esc(ai.masked)}` : " nesta sessão"}${ai.from_env ? " · lida da variável GEMINI_API_KEY" : ""}</span>
                <button type="button" class="btn btn-secondary btn-sm" id="forget-key">Esquecer</button></div>`
            : `<form class="row wrap" id="set-key-form" style="gap:8px"><label class="sr-only" for="set-key">Chave do Gemini</label>
                <input id="set-key" class="input" type="password" placeholder="Cole a chave que começa com AIza…" autocomplete="off" spellcheck="false" style="flex:1 1 240px">
                <button type="submit" class="btn btn-primary">Usar nesta sessão</button></form>`}
          ${ai.model ? `<span class="faint" style="font-size:13px">Modelo: <b class="num" style="color:var(--acc-text)">${esc(ai.model)}</b> · o Mallard só chama a IA quando você clica em Analisar.</span>` : ""}
          ${linkGo("Criar ou gerenciar chave no Google AI Studio", `data-url="https://aistudio.google.com/app/apikey"`)}
        </section>
        <section class="panel pad in" style="animation-delay:120ms;display:flex;flex-direction:column;gap:14px">
          <div class="stack" style="gap:4px"><h2 class="section-title">Movimento</h2><span class="muted" style="font-size:14px">Para quem prefere uma tela mais calma.</span></div>
          ${row("Reduzir animações", "Desliga transições, ondas e o pato balançando. O Windows também pode pedir isso.",
            `<button type="button" class="switch" id="reduce-switch" aria-pressed="${!!s.reduce_motion}" aria-label="Reduzir animações"><span></span></button>`)}
        </section>
        <section class="panel pad in" style="animation-delay:180ms;display:flex;flex-direction:column;gap:12px">
          <div class="row">${logoSymbol(44, 10)}<div class="stack" style="gap:0"><h2 class="section-title">Sobre o Mallard</h2>
            <span class="num faint" style="font-size:14px;font-weight:600">v${esc(info.version)} · ${esc(info.os)}</span></div></div>
          <p class="muted" style="margin:0;font-size:14px">O nome homenageia o Patinho Feio, primeiro computador projetado e construído no Brasil (Escola Politécnica da USP, 1972). Mallard é o pato-real em inglês, e o Mallard é especialista em <strong style="color:var(--acc-text)">PATO</strong>logia de PC.</p>
          <p class="muted" style="margin:0;font-size:14px">Uso e temperatura da placa de vídeo dependem de placa NVIDIA, NVML e driver compatível.</p>
          ${linkGo("Repositório no GitHub", `data-url="https://github.com/EduardoFleming/MonitorPc"`)}
        </section>
      </div>`;

    root().querySelectorAll("[data-pick-theme]").forEach((button) => button.addEventListener("click", async () => {
      await App.setTheme(button.dataset.pickTheme);
      render();
    }));
    const keyForm = document.getElementById("set-key-form");
    if (keyForm) keyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = document.getElementById("set-key").value;
      if (!value.trim()) return;
      await App.setApiKey(value);
      App.toast("Chave pronta. Ela some quando você fechar o Mallard.");
      render();
    });
    const forget = document.getElementById("forget-key");
    if (forget) forget.addEventListener("click", async () => { await App.forgetApiKey(); render(); });
    document.getElementById("reduce-switch").addEventListener("click", async (event) => {
      const on = event.currentTarget.getAttribute("aria-pressed") !== "true";
      event.currentTarget.setAttribute("aria-pressed", String(on));
      await App.setReduceMotion(on);
    });
  }

  return {
    init() { App.on("theme", () => { if (App.state.page === "settings") render(); }); },
    show() { render(); },
  };
})());
