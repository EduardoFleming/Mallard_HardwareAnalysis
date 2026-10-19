/* Consultor de upgrades: 3 passos (uso, detalhes, orçamento) com os patinhos seguindo a mãe. */
App.register("advisor", (() => {
  const root = () => document.getElementById("page-advisor");
  const USES = [
    { id: "Jogos", icon: "pad", desc: "Desempenho e FPS nos seus jogos." },
    { id: "Trabalho", icon: "case", desc: "Programas, edição e multitarefa." },
    { id: "Uso doméstico", icon: "home", desc: "Navegação, vídeos e o dia a dia." },
  ];
  const FOCUS = {
    "Jogos": ["Competitivos leves (LoL, Valorant, CS2)", "Jogos AAA com gráficos avançados", "Indie e jogos antigos", "Simuladores e estratégia", "Vários tipos de jogo"],
    "Trabalho": ["Escritório e navegação", "Programação", "Edição de vídeo/foto", "Modelagem 3D/CAD", "Outro / vários tipos"],
    "Uso doméstico": ["Navegação e estudos", "Filmes e vídeos", "Chamadas de vídeo", "Armazenar/compartilhar arquivos", "Um pouco de tudo"],
  };
  const QUESTION = { "Jogos": "Que tipo de jogo você quer jogar?", "Trabalho": "Qual tipo de trabalho?", "Uso doméstico": "Qual é seu uso doméstico mais comum?" };
  const GOALS = {
    "Jogos": ["Mais FPS", "Menos travamentos", "Carregar jogos mais rápido", "Jogar e fazer live"],
    other: ["Menos travamentos", "Abrir programas mais rápido", "Multitarefa", "Mais espaço em disco"],
  };
  const PRESETS = [["Até R$ 800", "R$ 800"], ["R$ 1.500", "R$ 1.500"], ["R$ 3.000", "R$ 3.000"], ["Sem limite", ""]];
  const EXTRA = [
    ["confirmacao_placa_mae", "Modelo exato da placa-mãe", "Ex.: ASUS PRIME H310M-E"],
    ["detalhes_ram_informados", "Memória instalada", "Ex.: 2x4 GB DDR4"],
    ["fonte_informada", "Fonte", "Ex.: 500 W (está na etiqueta)"],
    ["gabinete_informado", "Gabinete", "Ex.: mid tower"],
    ["correcao_manual_do_hardware", "Alguma peça veio errada?", "Ex.: tenho uma GTX 1650"],
  ];

  const form = {
    step: 1, uso: "Jogos", foco: 0, jogo: "", resolucao: "Não sei", orcamento: "", preset: null,
    compra: "Tanto faz", goals: [], objetivo: "", extra: false, extras: {},
  };

  function stepper() {
    const step = (n, label) => {
      const lit = n <= form.step;
      return `<button type="button" class="stepper-btn" data-step="${n}" aria-current="${n === form.step ? "step" : "false"}" aria-label="Passo ${n}: ${label}"
        style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:72px;min-height:44px;padding:0;border:0;background:transparent;cursor:pointer;font-size:14px;font-weight:600;color:${lit ? "var(--text)" : "var(--muted)"}">
        <span class="${n === form.step ? "bob" : ""}" style="display:block;padding:0 6px;background:var(--s1)">${duckling(44, 36, lit)}</span>${label}</button>`;
    };
    return `<div style="position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:8px">
      <span aria-hidden="true" style="position:absolute;left:36px;right:48px;bottom:26px;height:2px;background:var(--track)">
        <span style="display:block;height:2px;width:${((form.step - 1) / 3) * 100}%;background:var(--acc);transition:width .6s cubic-bezier(.2,.8,.2,1)"></span></span>
      ${step(1, "Uso")}${step(2, "Detalhes")}${step(3, "Orçamento")}
      <span style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:14px;font-weight:600;color:var(--muted)">
        <span style="display:block;padding:0 6px;background:var(--s1)">${duckSide(76, 49)}</span>Análise</span>
    </div>`;
  }

  function seg(name, options, current) {
    return `<div class="row wrap" style="gap:4px;padding:4px;border-radius:6px;background:var(--input);border:1px solid var(--line2);width:fit-content;max-width:100%">
      ${options.map((option) => `<button type="button" data-seg="${name}" data-value="${esc(option)}" aria-pressed="${option === current}"
        style="min-height:38px;padding:0 14px;border-radius:4px;border:0;cursor:pointer;font-size:14px;font-weight:600;background:${option === current ? "var(--acc)" : "transparent"};color:${option === current ? "var(--on-acc)" : "var(--text2)"}">${esc(option)}</button>`).join("")}</div>`;
  }

  function stepOne() {
    return `<div class="stack in" style="gap:14px"><h2 class="section-title" style="font-size:23px">Para que você mais usa o computador?</h2>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px">${USES.map((use) => {
        const on = use.id === form.uso;
        return `<button type="button" data-use="${esc(use.id)}" aria-pressed="${on}" class="panel" style="text-align:left;cursor:pointer;color:var(--text);padding:18px;display:flex;flex-direction:column;gap:10px;min-height:150px;border:1.5px solid ${on ? "var(--acc-text)" : "var(--line)"};background:${on ? "var(--acc-soft)" : "var(--s2)"}">
          <span class="row" style="justify-content:space-between;width:100%"><span style="color:${on ? "var(--acc-text)" : "var(--text2)"};display:flex">${icon(use.icon, 30, 1.5)}</span>
            <span style="width:22px;height:22px;border-radius:50%;border:1.5px solid ${on ? "var(--acc-text)" : "var(--line2)"};background:${on ? "var(--acc)" : "transparent"};color:var(--on-acc);display:flex;align-items:center;justify-content:center">${on ? icon("check", 13, 3) : ""}</span></span>
          <span class="display" style="font-size:21px;font-weight:700;margin-top:auto">${esc(use.id)}</span>
          <span class="muted" style="font-size:14px">${esc(use.desc)}</span></button>`;
      }).join("")}</div></div>`;
  }

  function stepTwo() {
    const games = form.uso === "Jogos";
    return `<div class="stack in" style="gap:22px">
      <div class="stack" style="gap:12px"><h2 class="section-title" style="font-size:23px">${esc(QUESTION[form.uso])}</h2>
        <div class="row wrap" style="gap:8px">${FOCUS[form.uso].map((label, index) =>
          `<button type="button" class="chip" data-focus="${index}" aria-pressed="${index === form.foco}" style="min-height:44px">${esc(label)}</button>`).join("")}</div></div>
      ${games ? `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px">
        <label class="stack" style="gap:8px"><span style="font-weight:600">Jogo específico <span class="faint" style="font-weight:500">(opcional)</span></span>
          <input class="input" data-field="jogo" value="${esc(form.jogo)}" placeholder="Ex.: League of Legends" autocomplete="off"></label>
        <div class="stack" style="gap:8px"><span style="font-weight:600">Resolução do monitor <span class="faint" style="font-weight:500">(opcional)</span></span>
          ${seg("resolucao", ["Não sei", "1080p", "1440p", "4K"], form.resolucao)}</div></div>` : ""}
    </div>`;
  }

  function stepThree() {
    const goals = GOALS[form.uso === "Jogos" ? "Jogos" : "other"];
    return `<div class="stack in" style="gap:22px">
      <div class="stack" style="gap:8px"><label for="adv-budget" style="font-weight:600">Orçamento <span class="faint" style="font-weight:500">(opcional)</span></label>
        <div class="row wrap" style="gap:8px">
          <input id="adv-budget" class="input" data-field="orcamento" value="${esc(form.orcamento)}" placeholder="Ex.: R$ 1.500" autocomplete="off" style="width:200px">
          ${PRESETS.map(([label]) => `<button type="button" class="chip" data-preset="${esc(label)}" aria-pressed="${form.preset === label}" style="font-size:14px">${esc(label)}</button>`).join("")}</div>
        <span class="faint" style="font-size:14px">Se o valor não permitir um upgrade que valha a pena, o consultor explica e respeita seu limite.</span></div>
      <div class="stack" style="gap:8px"><span style="font-weight:600">Preferência por peças <span class="faint" style="font-weight:500">(opcional)</span></span>
        ${seg("compra", ["Tanto faz", "Somente novas", "Aceito usadas"], form.compra)}</div>
      <div class="stack" style="gap:10px"><span style="font-weight:600">O que você gostaria de melhorar? <span class="faint" style="font-weight:500">(opcional, pode marcar vários)</span></span>
        <div class="row wrap" style="gap:8px">${goals.map((goal) =>
          `<button type="button" class="chip" data-goal="${esc(goal)}" aria-pressed="${form.goals.includes(goal)}">${form.goals.includes(goal) ? icon("check", 15, 2.4) : ""} ${esc(goal)}</button>`).join("")}</div>
        <label class="sr-only" for="adv-goal">Detalhes do que melhorar</label>
        <textarea id="adv-goal" class="input" data-field="objetivo" rows="2" style="height:auto;padding:12px 14px;resize:vertical" placeholder="Algo mais? Ex.: o jogo trava quando abro o Discord junto.">${esc(form.objetivo)}</textarea></div>
      <div class="stack" style="gap:12px;padding:14px 16px;border-radius:6px;background:var(--s0);border:1px solid var(--line)">
        <label class="row" style="gap:12px;cursor:pointer;font-weight:500"><input type="checkbox" id="adv-extra" ${form.extra ? "checked" : ""} style="width:20px;height:20px;margin:0;accent-color:var(--acc)">Adicionar detalhes para verificar compatibilidade</label>
        ${form.extra ? `<div class="grid in" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">${EXTRA.map(([key, label, placeholder]) =>
          `<label class="stack" style="gap:6px"><span style="font-size:14px;font-weight:600">${label}</span>
            <input class="input" data-extra="${key}" value="${esc(form.extras[key] || "")}" placeholder="${esc(placeholder)}" autocomplete="off"></label>`).join("")}</div>` : ""}
      </div>
    </div>`;
  }

  function summaryRows() {
    const dash = (value) => (value && String(value).trim() ? value : "—");
    const rows = [
      ["Uso", form.uso],
      ["Tipo", FOCUS[form.uso][form.foco]],
      ...(form.uso === "Jogos" ? [["Jogo", form.jogo], ["Resolução", form.resolucao === "Não sei" ? "" : form.resolucao]] : []),
      ["Orçamento", form.preset === "Sem limite" ? "Sem limite" : form.orcamento],
      ["Peças", form.compra === "Tanto faz" ? "" : form.compra],
      ["Melhorar", form.goals.join(", ")],
    ];
    return rows.map(([key, value]) => `<div class="row" style="justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid var(--line)">
      <dt class="faint" style="font-size:14px;flex-shrink:0">${key}</dt><dd style="margin:0;font-size:14px;font-weight:600;text-align:right;color:${dash(value) === "—" ? "var(--faint)" : "var(--text)"}">${esc(dash(value))}</dd></div>`).join("");
  }

  /* Modelo usado e a regra de uma solicitação por clique (pedido do commit do Eduardo de 13/10). */
  function modelLine() {
    const model = App.state.ai.model || (App.state.info && App.state.info.ai_model) || "";
    return model ? `<span class="faint" style="font-size:13px">Modelo usado nesta análise: <b class="num" style="color:var(--acc-text)">${esc(model)}</b>.
      Cada clique em Analisar faz uma única solicitação ao Gemini.</span>` : "";
  }

  function keyBlock() {
    return `<div class="stack" style="gap:8px">${keyBox()}${modelLine()}</div>`;
  }

  function keyBox() {
    const ai = App.state.ai;
    if (ai.has_key) {
      return `<div class="row" style="gap:10px;padding:12px 14px;border-radius:6px;background:var(--s0);font-size:14px">
        <span style="color:var(--acc-text);display:flex">${icon("check", 18)}</span><span style="flex:1">Chave preenchida${ai.masked ? ` · termina em ${esc(ai.masked)}` : " nesta sessão"}</span>
        <button type="button" class="link-go" id="adv-key-change" style="font-size:13px">Trocar</button></div>`;
    }
    return `<form class="stack" id="adv-key-form" style="gap:8px;padding:14px;border-radius:6px;border:1px solid var(--warn);background:var(--warn-soft)">
      <label for="adv-key" style="font-size:14px;font-weight:600">Chave do Gemini</label>
      <div class="row" style="gap:8px"><input id="adv-key" class="input" type="password" placeholder="Cole a chave que começa com AIza…" autocomplete="off" spellcheck="false" style="flex:1;min-width:0">
        <button type="submit" class="btn btn-secondary">Usar</button></div>
      <span class="muted" style="font-size:13px">Fica só na memória até você fechar o Mallard. ${`<button type="button" class="link-go" data-url="https://aistudio.google.com/app/apikey" style="font-size:13px;display:inline-flex">Criar chave grátis</button>`}</span>
    </form>`;
  }

  function hardwareLine() {
    const hw = App.state.hardware;
    if (!hw) return "Lendo as peças do computador…";
    const gpu = isUnknown(hw.placas_de_video) ? "placa de vídeo não identificada" : hw.placas_de_video;
    return `${hw.tipo_de_maquina === "notebook" ? "Notebook" : "Desktop"} · ${hw.processador} · ${fmt(hw.memoria.total_gb)} GB de RAM · ${gpu}`;
  }

  function render() {
    const notebook = App.state.hardware && App.state.hardware.tipo_de_maquina === "notebook";
    const body = form.step === 1 ? stepOne() : form.step === 2 ? stepTwo() : stepThree();
    root().innerHTML = pageHeader("PLANEJAMENTO", "Consultor de upgrades", "Responda em 3 passos. Os campos opcionais podem ficar em branco.") + `
      <div class="row" style="flex-wrap:wrap;gap:20px;align-items:flex-start">
        <section class="panel pad in" style="animation-delay:60ms;flex:999 1 520px;min-width:0;display:flex;flex-direction:column;gap:24px">
          ${stepper()}
          ${notebook ? `<p class="notice soft" style="margin:0">${icon("info", 16)} Como é um notebook, o consultor só sugere memória RAM e armazenamento, ou um notebook novo quando eles não resolverem.</p>` : ""}
          ${body}
          <div class="row" style="justify-content:space-between;gap:12px;padding-top:18px;border-top:1px solid var(--line)">
            <div>${form.step > 1 ? `<button type="button" class="btn btn-secondary" id="adv-back">${icon("back", 17)}Voltar</button>` : ""}</div>
            ${form.step < 3 ? `<button type="button" class="btn btn-primary" id="adv-next">Continuar${icon("arrow", 17)}</button>`
              : `<button type="button" class="btn btn-primary" data-analyze>${icon("spark", 17)}Analisar meu computador</button>`}
          </div>
        </section>
        <aside class="panel pad in" aria-label="Resumo do pedido" style="animation-delay:120ms;flex:1 1 290px;min-width:0;display:flex;flex-direction:column;gap:16px">
          <h2 class="section-title">Seu pedido</h2>
          <dl style="margin:0">${summaryRows()}</dl>
          <div class="stack" style="gap:6px;padding:12px 14px;border-radius:6px;background:var(--s0)">
            <span class="label" style="font-size:12px">Será analisado</span><span style="font-size:14px;color:var(--text2)">${esc(hardwareLine())}</span></div>
          ${keyBlock()}
          <button type="button" class="btn btn-primary" data-analyze style="width:100%">${icon("spark", 17)}Analisar meu computador</button>
        </aside>
      </div>`;
    bind();
  }

  function readFields() {
    root().querySelectorAll("[data-field]").forEach((input) => { form[input.dataset.field] = input.value; });
    root().querySelectorAll("[data-extra]").forEach((input) => { form.extras[input.dataset.extra] = input.value; });
  }

  function buildRequest() {
    readFields();
    const games = form.uso === "Jogos";
    const focus = FOCUS[form.uso][form.foco];
    const goal = [...form.goals, form.objetivo.trim()].filter(Boolean).join("; ");
    const extras = {};
    EXTRA.forEach(([key]) => { extras[key] = (form.extras[key] || "").trim() || null; });
    return {
      perfil: form.uso,
      preferencias: {
        resolucao: games ? (form.resolucao === "Não sei" ? "Não sei / prefiro não informar" : form.resolucao) : null,
        orcamento: form.preset === "Sem limite" ? null : (form.orcamento.trim() || null),
        preferencia_compra: form.compra,
        foco_de_jogos: games ? focus : null,
        jogo_especifico: games ? (form.jogo.trim() || null) : null,
        foco_de_trabalho_ou_uso_domestico: games ? null : focus,
        objetivo_especifico: goal || null,
        ...extras,
      },
      resumo: [form.uso, focus, form.preset === "Sem limite" ? "Sem limite de orçamento" : (form.orcamento.trim() ? `Orçamento ${form.orcamento.trim()}` : "")].filter(Boolean).join(" · "),
    };
  }

  async function analyze() {
    if (!App.state.ai.has_key) {
      const input = document.getElementById("adv-key");
      if (input && input.value.trim()) {
        await App.setApiKey(input.value);
      } else {
        App.toast("Cole a chave do Gemini para analisar.");
        if (input) input.focus();
        return;
      }
    }
    App.state.request = buildRequest();
    App.go("analyzing", { request: App.state.request });
  }

  function bind() {
    const on = (selector, event, handler) => root().querySelectorAll(selector).forEach((el) => el.addEventListener(event, handler));
    on("[data-step]", "click", (e) => { readFields(); form.step = Number(e.currentTarget.dataset.step); render(); });
    on("[data-use]", "click", (e) => { form.uso = e.currentTarget.dataset.use; form.foco = 0; form.goals = []; render(); });
    on("[data-focus]", "click", (e) => { readFields(); form.foco = Number(e.currentTarget.dataset.focus); render(); });
    on("[data-seg]", "click", (e) => { readFields(); form[e.currentTarget.dataset.seg] = e.currentTarget.dataset.value; render(); });
    on("[data-preset]", "click", (e) => {
      const label = e.currentTarget.dataset.preset;
      const preset = PRESETS.find(([name]) => name === label);
      readFields(); form.preset = label; form.orcamento = preset[1]; render();
    });
    on("[data-goal]", "click", (e) => {
      readFields();
      const goal = e.currentTarget.dataset.goal;
      form.goals = form.goals.includes(goal) ? form.goals.filter((g) => g !== goal) : form.goals.concat([goal]);
      render();
    });
    on("[data-field='orcamento']", "input", () => { form.preset = null; });
    on("[data-field]", "change", () => { readFields(); const aside = root().querySelector("aside dl"); if (aside) aside.innerHTML = summaryRows(); });
    on("[data-analyze]", "click", analyze);
    const extra = document.getElementById("adv-extra");
    if (extra) extra.addEventListener("change", () => { readFields(); form.extra = extra.checked; render(); });
    const next = document.getElementById("adv-next");
    if (next) next.addEventListener("click", () => { readFields(); form.step += 1; render(); });
    const back = document.getElementById("adv-back");
    if (back) back.addEventListener("click", () => { readFields(); form.step -= 1; render(); });
    const keyForm = document.getElementById("adv-key-form");
    if (keyForm) keyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      readFields();
      const value = document.getElementById("adv-key").value;
      if (!value.trim()) return;
      await App.setApiKey(value);
      App.toast("Chave pronta. Ela some quando você fechar o Mallard.");
      render();
    });
    const change = document.getElementById("adv-key-change");
    if (change) change.addEventListener("click", async () => { readFields(); await App.forgetApiKey(); render(); });
  }

  return {
    init() {
      App.on("hardware", () => { if (App.state.page === "advisor") render(); });
      App.on("ai", () => { if (App.state.page === "advisor") render(); });
    },
    show() { render(); },
    reset() { Object.assign(form, { step: 1 }); },
  };
})());
