/* Abertura (só na primeira vez): ovo, escolha do pato, leitura do computador. */
App.register("intro", (() => {
  const box = () => document.getElementById("intro");
  let step = "egg";

  function eggStep() {
    return `<div class="bob" aria-hidden="true" style="color:var(--acc-text)">${eggIcon(112, 90)}</div>
      <h1 class="display" style="margin:0;font-size:40px">Mallard</h1>
      <p class="muted" style="margin:0;font-size:18px">Especialista em PATOlogia de PC</p>
      <button type="button" class="pill-btn" id="in-peck" style="margin-top:8px">Começar</button>`;
  }

  function duckStep() {
    const current = App.state.settings.theme;
    return `<h1 class="display" style="margin:0;font-size:34px">Quack! Escolha o seu pato</h1>
      <p class="muted" style="margin:0">Ele muda as cores do app. Dá para trocar depois nas Configurações.</p>
      <div class="intro-ducks">${THEMES.map((theme) => `<button type="button" class="intro-duck th-${theme.id}" data-duck="${theme.id}" aria-pressed="${theme.id === current}">
        <span style="display:block;width:100%;background:var(--bg);border-radius:8px;padding:8px 6px 2px">${duckSide("100%", 66)}</span>
        <b class="display">${esc(theme.name)}</b><small class="faint">${esc(theme.kind)}</small></button>`).join("")}</div>
      <button type="button" class="pill-btn" id="in-next">Continuar${icon("arrow", 16)}</button>`;
  }

  function scanStep() {
    return `<div class="bob" aria-hidden="true">${duckSide(190, 122)}</div>
      <h1 class="display" style="margin:0;font-size:30px">O pato está lendo o seu PC…</h1>
      <div class="bar" style="width:min(420px,100%);height:6px"><span id="in-bar" style="width:0%;background:var(--acc)"></span></div>
      <span class="muted" id="in-msg">Olhando as peças</span>`;
  }

  function render() {
    box().innerHTML = `<div class="intro-box in">${step === "egg" ? eggStep() : step === "ducks" ? duckStep() : scanStep()}</div>`;
    const peck = document.getElementById("in-peck");
    if (peck) peck.addEventListener("click", () => { step = "ducks"; render(); });
    box().querySelectorAll("[data-duck]").forEach((button) => button.addEventListener("click", () => { App.setTheme(button.dataset.duck); render(); }));
    const next = document.getElementById("in-next");
    if (next) next.addEventListener("click", () => { step = "scan"; render(); scan(); });
  }

  function scan() {
    const bar = document.getElementById("in-bar");
    const msg = document.getElementById("in-msg");
    if (bar) bar.style.width = "35%";
    if (msg) msg.textContent = "Lendo os componentes detectados";
    App.loadHardware(true).then((loaded) => {
      if (!loaded) return;
      if (bar) bar.style.width = "100%";
      if (msg) msg.textContent = "Pronto! Conheça seu PC.";
      finish();
    });
  }

  async function finish() {
    App.state.settings = await Bridge.call("save_settings", { onboarded: true });
    box().hidden = true;
    App.go("computer");
  }

  return {
    open() { step = "egg"; box().hidden = false; render(); },
  };
})());
