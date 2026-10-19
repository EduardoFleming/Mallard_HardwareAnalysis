/* Erros com o pato: cada problema tem uma explicação simples e o que fazer. */
App.register("error", (() => {
  const root = () => document.getElementById("page-error");
  const ERRORS = {
    sem_chave: ["Falta a chave do Gemini", "O consultor usa o Google Gemini. A chave é gratuita e fica só na memória até você fechar o Mallard.", "key"],
    chave_invalida: ["Esse pato não é seu", "O Gemini recusou a chave. Ela pode ter sido colada errada, com espaço sobrando, ou foi desativada no AI Studio.", "key"],
    sem_conexao: ["O pato se perdeu", "Não foi possível falar com o Gemini. Confira se a internet está ligada e tente de novo.", "lost"],
    limite: ["O pato precisa descansar", "O limite de uso gratuito do Gemini foi atingido por agora. Espere alguns minutos e tente de novo.", "sleep"],
    servico_indisponivel: ["O Gemini está de folga", "O serviço está sobrecarregado ou fora do ar neste momento. Espere alguns minutos e tente de novo.", "sleep"],
    resposta_invalida: ["O pato não entendeu a resposta", "O Gemini respondeu num formato inesperado. Tentar de novo costuma resolver.", "lost"],
    desconhecido: ["Algo deu errado", "Não foi possível concluir a análise.", "lost"],
  };
  let current = { code: "desconhecido", message: "", retrySeconds: 0 };
  let waitUntil = 0;
  let countdown = null;

  function waitLabel(seconds) {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    if (h) return m ? `${h} h e ${m} min` : `${h} h`;
    if (m) return s ? `${m} min e ${s} s` : `${m} min`;
    return `${s} s`;
  }

  /* No erro de limite (429), o botão "Tentar de novo" só libera depois da espera pedida pelo Google. */
  function tick() {
    const button = document.getElementById("err-retry");
    const label = document.getElementById("err-wait");
    const left = Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000));
    if (!button || App.state.page !== "error") { clearInterval(countdown); countdown = null; return; }
    button.disabled = left > 0;
    if (label) label.textContent = left > 0 ? `Dá para tentar de novo em ${waitLabel(left)}.` : "Pronto, já dá para tentar de novo.";
    if (left <= 0) { clearInterval(countdown); countdown = null; }
  }

  function art(kind) {
    const badge = kind === "key"
      ? `<span class="pop" style="position:absolute;left:150px;top:-6px;width:44px;height:44px;border-radius:50%;background:var(--s3);border:1px solid var(--crit);display:flex;align-items:center;justify-content:center;color:var(--crit)">${icon("key", 22)}</span>`
      : kind === "lost"
        ? `<span class="pop display" style="position:absolute;left:150px;top:-6px;width:44px;height:44px;border-radius:50%;background:var(--s3);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:var(--acc-text)">?</span>`
        : `<span style="position:absolute;left:144px;top:37px;width:13px;height:8px;border-radius:0 0 8px 8px;background:var(--d-head);border-bottom:2px solid var(--d-eye)"></span>
           <span class="zz display" style="position:absolute;left:168px;top:8px;font-size:18px;font-weight:700;color:var(--acc-text)">z</span>
           <span class="zz display" style="position:absolute;left:182px;top:-6px;font-size:24px;font-weight:700;color:var(--acc-text);animation-delay:1.2s">z</span>`;
    return `<div aria-hidden="true" style="position:relative;width:220px;height:150px">
      <div class="${kind === "sleep" ? "" : "bob"}" style="position:absolute;left:10px;top:20px">${duckSide(190, 122)}</div>${badge}</div>`;
  }

  function render() {
    const [title, text, kind] = ERRORS[current.code] || ERRORS.desconhecido;
    const needsKey = kind === "key";
    const isLimit = current.code === "limite";
    const body = isLimit && current.message ? current.message : text;
    const extra = current.code === "desconhecido" && current.message
      ? `<span class="faint" style="font-size:13px">${esc(current.message)}</span>`
      : isLimit
        ? `${current.retrySeconds ? `<span class="num" id="err-wait" role="status" style="font-size:15px;font-weight:600;color:var(--warn)"></span>` : ""}
           <button type="button" class="link-go" data-url="https://aistudio.google.com/usage">Ver as cotas desta chave no Google AI Studio${icon("ext", 15)}</button>`
        : "";
    root().innerHTML = pageHeader("ALGO DEU ERRADO", "Não deu para analisar agora", "Nada foi perdido. Suas respostas continuam no Consultor.") + `
      <section class="panel in" style="animation-delay:60ms;padding:40px 28px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center">
        ${art(kind)}
        <h2 class="display" style="margin:8px 0 0;font-size:30px;font-weight:700">${esc(title)}</h2>
        <p class="muted" style="margin:0;max-width:540px;font-size:16px">${esc(body)}</p>${extra}
        <span class="num" style="font-size:13px;font-weight:600;color:var(--faint)">Código: ${esc(current.code)}</span>
        ${needsKey ? `<form id="err-key-form" class="row wrap" style="gap:8px;justify-content:center;width:min(520px,100%)">
            <label class="sr-only" for="err-key">Chave do Gemini</label>
            <input id="err-key" class="input" type="password" placeholder="Cole a chave que começa com AIza…" autocomplete="off" spellcheck="false" style="flex:1 1 260px">
            <button type="submit" class="btn btn-primary">Usar e tentar de novo</button></form>
          <button type="button" class="link-go" data-url="https://aistudio.google.com/app/apikey">Criar ou ver minhas chaves no Google AI Studio${icon("ext", 15)}</button>`
        : `<div class="row wrap" style="gap:10px;justify-content:center">
            <button type="button" class="btn btn-primary" id="err-retry">${icon("refresh", 17)}Tentar de novo</button>
            <button type="button" class="btn btn-secondary" data-go="advisor">Voltar ao Consultor</button></div>`}
        <span class="faint" style="font-size:14px">O monitoramento e o resto do Mallard continuam funcionando sem a IA.</span>
      </section>`;
    const retry = document.getElementById("err-retry");
    if (isLimit && current.retrySeconds && waitUntil > Date.now()) {
      clearInterval(countdown);
      tick();
      countdown = setInterval(tick, 1000);
    }
    if (retry) retry.addEventListener("click", () => App.go("analyzing", { request: App.state.request }));
    const keyForm = document.getElementById("err-key-form");
    if (keyForm) keyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = document.getElementById("err-key").value;
      if (!value.trim()) return;
      await App.setApiKey(value);
      App.go("analyzing", { request: App.state.request });
    });
  }

  return {
    show(options) {
      if (options && options.code) {
        current = { code: options.code, message: options.message || "", retrySeconds: Number(options.retrySeconds) || 0 };
        waitUntil = current.retrySeconds ? Date.now() + current.retrySeconds * 1000 : 0;
      }
      render();
    },
  };
})());
