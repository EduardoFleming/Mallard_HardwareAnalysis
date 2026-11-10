/* Configurações: escolha do pato, movimento e a história do nome. */
App.register("settings", (() => {
  const root = () => document.getElementById("page-settings");
  let tray = null;   // {available, enabled, snoozed, status, text}

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

  function flag(key, label, desc, s, enabled = true) {
    return `<div class="row" style="justify-content:space-between;gap:12px 20px;${enabled ? "" : "opacity:.5"}">
      <div class="stack" style="gap:2px;min-width:0"><span style="font-weight:600">${label}</span><span class="faint" style="font-size:14px">${desc}</span></div>
      <button type="button" class="switch" data-flag="${key}" aria-pressed="${!!s[key]}" aria-label="${label}" ${enabled ? "" : "disabled"}><span></span></button></div>`;
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
            <span class="muted" style="font-size:14px">A chave é guardada criptografada na conta do Windows deste usuário, fora dos saves e do repositório. Você pode removê-la quando quiser.</span></div>
          ${ai.has_key
            ? `<div class="row" style="gap:10px;padding:12px 14px;border-radius:6px;background:var(--s0)"><span style="color:var(--acc-text);display:flex">${icon("key", 18)}</span>
                <span style="flex:1">Chave preenchida${ai.masked ? ` · termina em ${esc(ai.masked)}` : " nesta sessão"}${ai.saved ? " · salva com criptografia do Windows" : ai.from_env ? " · lida da variável GEMINI_API_KEY" : ""}</span>
                ${ai.from_env ? "" : `<button type="button" class="btn btn-secondary btn-sm" id="forget-key">Esquecer</button>`}</div>`
            : `<form class="row wrap" id="set-key-form" style="gap:8px"><label class="sr-only" for="set-key">Chave do Gemini</label>
                <input id="set-key" class="input" type="password" placeholder="Cole a chave que começa com AIza…" autocomplete="off" spellcheck="false" style="flex:1 1 240px">
                <button type="submit" class="btn btn-primary">Salvar chave</button></form>`}
          ${ai.model ? `<span class="faint" style="font-size:13px">Modelo: <b class="num" style="color:var(--acc-text)">${esc(ai.model)}</b> · o Mallard só chama a IA quando você clica em Analisar.</span>` : ""}
          ${linkGo("Criar ou gerenciar chave no Google AI Studio", `data-url="https://aistudio.google.com/app/apikey"`)}
        </section>
        <section class="panel pad in" style="animation-delay:120ms;display:flex;flex-direction:column;gap:14px">
          <div class="stack" style="gap:4px"><h2 class="section-title">Movimento</h2><span class="muted" style="font-size:14px">Para quem prefere uma tela mais calma.</span></div>
          ${row("Reduzir animações", "Desliga transições, ondas e o pato balançando. O Windows também pode pedir isso.",
            `<button type="button" class="switch" id="reduce-switch" aria-pressed="${!!s.reduce_motion}" aria-label="Reduzir animações"><span></span></button>`)}
        </section>
        <section class="panel pad in" style="animation-delay:150ms;display:flex;flex-direction:column;gap:14px">
          <div class="stack" style="gap:4px"><h2 class="section-title">Avisos e mini-modo</h2>
            <span class="muted" style="font-size:14px">O pato avisa na bandeja do Windows quando algo passa do ponto e pode ficar num cantinho da tela. Tudo local, nada sai do computador.</span></div>
          ${tray && !tray.available ? `<p class="notice warn" style="margin:0">A bandeja do Windows não está disponível agora (faltam os pacotes pystray e Pillow). Os avisos ficam desligados; o mini-modo continua funcionando.</p>` : ""}
          ${flag("tray_alerts", "Avisos na bandeja", "Um ícone perto do relógio e uma notificação quando algo exige atenção. Só funcionam com o Mallard aberto.", s)}
          ${flag("alert_mem", "Memória acima de 90%", "Avisa depois de cerca de 1 minuto acima da linha d'água, dizendo quem mais usa.", s, s.tray_alerts)}
          ${flag("alert_disk", "Disco quase cheio", "Avisa quando o disco do sistema passa de 90%, com atalho para a Limpeza.", s, s.tray_alerts)}
          ${flag("alert_temp", "Temperatura crítica", "Avisa quando o processador ou a placa de vídeo passam do limite (só se o computador mostrar a temperatura).", s, s.tray_alerts)}
          <div class="row wrap" style="gap:10px"><button type="button" class="pill-btn ghost" id="test-alert" ${s.tray_alerts ? "" : "disabled"}>${icon("bell", 16)}Ver o aviso</button>
            ${tray && tray.snoozed ? `<button type="button" class="pill-btn ghost" id="unsnooze">Voltar a avisar hoje</button>` : ""}</div>
          <div style="border-top:1px solid var(--line);padding-top:14px" class="stack">
            ${flag("mini_pinned", "Mini-modo sempre por cima", "Uma janelinha com o pato que fica por cima dos outros programas.", s)}
            <button type="button" class="pill-btn ghost" id="open-mini" style="align-self:flex-start">${icon("mini", 16)}Abrir o mini-modo</button></div>
        </section>
        <section class="panel pad in" style="animation-delay:180ms;display:flex;flex-direction:column;gap:12px">
          <div class="row">${logoSymbol(44, 10)}<div class="stack" style="gap:0"><h2 class="section-title">Sobre o Mallard</h2>
            <span class="num faint" style="font-size:14px;font-weight:600">v${esc(info.version)} · ${esc(info.os)}</span></div></div>
          <p class="muted" style="margin:0;font-size:14px">O nome homenageia o Patinho Feio, primeiro computador projetado e construído no Brasil (Escola Politécnica da USP, 1972). Mallard é o pato-real em inglês, e o Mallard é especialista em <strong style="color:var(--acc-text)">PATO</strong>logia de PC.</p>
          <p class="muted" style="margin:0;font-size:14px">Métricas de GPU dependem de placa NVIDIA, NVML e driver compatível.</p>
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
      if (App.state.ai.saved) App.toast("Chave salva com criptografia na sua conta do Windows.");
      else if (App.state.ai.save_error) App.toast("Chave ativa nesta sessão, mas o armazenamento seguro não está disponível neste sistema.");
      else App.toast("Chave pronta nesta sessão.");
      render();
    });
    const forget = document.getElementById("forget-key");
    if (forget) forget.addEventListener("click", async () => { await App.forgetApiKey(); App.toast("Chave removida do armazenamento seguro."); render(); });
    root().querySelectorAll("[data-flag]").forEach((button) => button.addEventListener("click", async () => {
      const key = button.dataset.flag;
      App.state.settings = await App.setFlag(key, button.getAttribute("aria-pressed") !== "true");
      render();
    }));
    const test = document.getElementById("test-alert");
    if (test) test.addEventListener("click", async () => {
      const ok = await Bridge.call("send_test_alert", "mem").catch(() => false);
      if (!ok) App.toast("Não deu para mostrar o aviso agora.");
    });
    const unsnooze = document.getElementById("unsnooze");
    if (unsnooze) unsnooze.addEventListener("click", async () => { tray = await Bridge.call("set_tray_snooze", false); render(); });
    document.getElementById("open-mini").addEventListener("click", () => Bridge.call("open_mini").catch(() => App.toast("Não deu para abrir o mini-modo.")));
    document.getElementById("reduce-switch").addEventListener("click", async (event) => {
      const on = event.currentTarget.getAttribute("aria-pressed") !== "true";
      event.currentTarget.setAttribute("aria-pressed", String(on));
      await App.setReduceMotion(on);
    });
  }

  return {
    init() {
      App.on("theme", () => { if (App.state.page === "settings") render(); });
      App.on("settings", () => { if (App.state.page === "settings") render(); });
    },
    show() {
      render();
      App.refreshSettings().catch(() => {});
      Bridge.call("get_tray_info").then((info) => { tray = info; if (App.state.page === "settings") render(); }).catch(() => {});
    },
  };
})());
