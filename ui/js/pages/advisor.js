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
  const PRESETS = [["R$ 500", "R$ 500"], ["R$ 800", "R$ 800"], ["R$ 1.500", "R$ 1.500"], ["R$ 3.000", "R$ 3.000"], ["Sem limite", ""]];
  const PRESET_HINT = ["Dá para um upgrade pontual.", "Bom para resolver o maior gargalo.", "Costuma cobrir um ou dois upgrades.", "Abre espaço para trocas maiores.", "O Consultor sugere o ideal, sem teto."];
  /* Peso de cada peça (0 a 3) por uso e tipo: processador, memória, vídeo, armazenamento. Só ilustra o que importa; não é a análise. */
  const WEIGHTS = {
    "Jogos": [[2, 2, 3, 1], [2, 3, 3, 2], [1, 2, 1, 1], [3, 3, 2, 2], [2, 3, 3, 2]],
    "Trabalho": [[1, 3, 0, 2], [2, 3, 0, 2], [3, 3, 2, 2], [3, 3, 3, 2], [2, 3, 1, 2]],
    "Uso doméstico": [[1, 3, 0, 2], [1, 2, 1, 2], [2, 2, 0, 1], [1, 1, 0, 3], [1, 3, 0, 2]],
  };
  const PART_NAMES = ["Processador", "Memória RAM", "Placa de vídeo", "Armazenamento"];
  const PART_LABELS = ["Pouco", "Ajuda", "Importa", "Essencial"];
  const EXTRA = [
    ["confirmacao_placa_mae", "Modelo exato da placa-mãe", "Ex.: ASUS PRIME H310M-E"],
    ["detalhes_ram_informados", "Memória instalada", "Ex.: 2x4 GB DDR4"],
    ["fonte_informada", "Fonte", "Ex.: 500 W (está na etiqueta)"],
    ["gabinete_informado", "Gabinete", "Ex.: mid tower"],
    ["correcao_manual_do_hardware", "Alguma peça veio errada?", "Ex.: tenho uma GTX 1650"],
  ];

  const form = {
    step: 1, uso: "Jogos", foco: 0, jogo: "", resolucao: "Não sei", orcamento: "", preset: null,
    goals: [], objetivo: "", extra: false, extras: {},
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
    return `<div class="stack in" style="gap:18px"><h2 class="display" style="margin:0;font-size:32px;font-weight:800;line-height:1.15">Para que você mais usa o PC?</h2>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px" role="radiogroup">${USES.map((use) => {
        const on = use.id === form.uso;
        return `<button type="button" data-use="${esc(use.id)}" role="radio" aria-checked="${on}" aria-pressed="${on}" class="use-card ${on ? "on" : ""}">
          <span class="use-ic">${icon(use.icon, 110, 1.1)}</span>
          <span class="display" style="font-size:24px;font-weight:800;line-height:1.15;position:relative">${esc(use.id)}</span>
          <span class="muted" style="position:relative">${esc(use.desc)}</span></button>`;
      }).join("")}</div></div>`;
  }

  function stepTwo() {
    const games = form.uso === "Jogos";
    return `<div class="stack in" style="gap:22px">
      <div class="stack" style="gap:16px"><h2 class="display" style="margin:0;font-size:32px;font-weight:800;line-height:1.15">${esc(QUESTION[form.uso])}</h2>
        <div class="row wrap" style="gap:10px">${FOCUS[form.uso].map((label, index) =>
          `<button type="button" class="chip" data-focus="${index}" aria-pressed="${index === form.foco}" style="min-height:52px;padding:0 20px;font-size:16px">${esc(label)}</button>`).join("")}</div>
        <span class="faint">Veja ao lado como isso muda as peças que mais importam.</span></div>
      ${games ? `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px">
        <label class="stack" style="gap:8px"><span style="font-weight:600">Jogo específico <span class="faint" style="font-weight:500">(opcional)</span></span>
          <input class="input" data-field="jogo" value="${esc(form.jogo)}" placeholder="Ex.: League of Legends" autocomplete="off"></label>
        <div class="stack" style="gap:8px"><span style="font-weight:600">Resolução do monitor <span class="faint" style="font-weight:500">(opcional)</span></span>
          ${seg("resolucao", ["Não sei", "1080p", "1440p", "4K"], form.resolucao)}</div></div>` : ""}
    </div>`;
  }

  function presetIndex() { const i = PRESETS.findIndex(([label]) => label === form.preset); return i < 0 ? 2 : i; }
  function budgetLabel() { if (form.preset) return form.preset; return form.orcamento.trim() || "Sem definir"; }
  function budgetHint() { return form.preset ? PRESET_HINT[presetIndex()] : form.orcamento.trim() ? "Valor digitado por você." : "Mexa no controle ou digite um valor. É opcional."; }

  function stepThree() {
    const goals = GOALS[form.uso === "Jogos" ? "Jogos" : "other"];
    return `<div class="stack in" style="gap:22px">
      <div class="stack" style="gap:12px"><h2 class="display" style="margin:0;font-size:32px;font-weight:800;line-height:1.15">Quanto dá para gastar?</h2>
        <div class="row wrap" style="align-items:baseline;gap:14px"><span class="display" id="adv-budget-big" style="font-size:56px;line-height:1;font-weight:800;letter-spacing:-.03em;color:var(--acc-text)">${esc(budgetLabel())}</span>
          <span class="muted" id="adv-budget-hint">${esc(budgetHint())}</span></div>
        <label class="stack" style="gap:8px"><span class="sr-only">Orçamento</span>
          <input type="range" id="adv-range" min="0" max="${PRESETS.length - 1}" step="1" value="${presetIndex()}" style="width:100%;height:28px;accent-color:var(--acc)">
          <span class="row" style="justify-content:space-between;font-size:12px;color:var(--muted)">${PRESETS.map(([label]) => `<span>${esc(label)}</span>`).join("")}</span></label>
        <label class="row wrap" for="adv-budget" style="gap:10px"><span class="faint" style="font-size:14px">Ou digite um valor:</span>
          <input id="adv-budget" class="input" data-field="orcamento" value="${esc(form.preset ? "" : form.orcamento)}" placeholder="Ex.: R$ 2.200" autocomplete="off" style="width:180px"></label>
        <span class="faint" style="font-size:14px">Se o valor não permitir um upgrade que valha a pena, o consultor explica e respeita seu limite.</span></div>
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

  function weightsPanel() {
    const w = (form.step >= 2 ? WEIGHTS[form.uso][form.foco] : WEIGHTS[form.uso][4]) || WEIGHTS.Jogos[4];
    const look = (v) => `opacity:${v === 0 ? 0.25 : 1};fill:${v === 3 ? "var(--acc)" : v === 2 ? "color-mix(in srgb, var(--acc) 60%, var(--s2))" : v === 1 ? "var(--s3)" : "var(--s2)"};${v === 3 ? "filter:drop-shadow(0 0 8px var(--acc))" : ""}`;
    const hw = App.state.hardware;
    const usage = hw ? Math.round(hw.memoria.usage_percent) : null;
    let hint = usage !== null && usage >= 85 ? `a memória está ${usage}% cheia. ${w[1] >= 2 ? "Para esse uso, ela é o primeiro gargalo." : "Mesmo sendo menos crítica para esse uso, vale ficar de olho."}` : "o Mallard compara as peças que mais importam com as do seu PC.";
    if (w[2] === 3 && hw && isUnknown(hw.placas_de_video)) hint = "a placa de vídeo não foi identificada. Informe o modelo para uma análise mais precisa.";
    const who = form.uso === "Uso doméstico" ? "o dia a dia" : form.uso.toLowerCase();
    return `<aside class="panel pad in stack" aria-labelledby="adv-imp" style="gap:14px"><div class="stack" style="gap:2px"><h2 id="adv-imp" class="display" style="margin:0;font-size:20px;font-weight:800">O que importa para ${esc(who)}</h2>
        <span class="faint" style="font-size:13px">As peças acendem conforme você responde.</span></div>
      <svg viewBox="0 0 520 600" role="img" aria-label="Peças mais importantes: ${esc(PART_NAMES.filter((n, i) => w[i] === 3).join(", ") || "nenhuma em destaque")}" style="width:min(220px,60%);align-self:center">
        <rect x="10" y="4" width="500" height="592" rx="18" fill="var(--s0)" stroke="var(--line2)" stroke-width="3"></rect>
        <rect x="150" y="40" width="310" height="340" rx="6" fill="var(--s2)" stroke="var(--line2)" stroke-width="2"></rect>
        <g class="pt"><rect x="235" y="85" width="120" height="120" rx="8" style="${look(w[0])}"></rect><circle cx="295" cy="145" r="42" fill="var(--s1)"></circle></g>
        <g class="pt"><rect x="380" y="78" width="12" height="150" rx="2" style="${look(w[1])}"></rect><rect x="408" y="78" width="12" height="150" rx="2" style="${look(w[1])}"></rect></g>
        <g class="pt"><rect x="158" y="262" width="300" height="66" rx="6" style="${look(w[2])}"></rect><circle cx="230" cy="295" r="24" fill="var(--s1)"></circle><circle cx="330" cy="295" r="24" fill="var(--s1)"></circle></g>
        <g class="pt"><rect x="40" y="120" width="90" height="200" rx="6" style="${look(w[3])}"></rect><rect x="190" y="350" width="110" height="16" rx="3" style="${look(w[3])}"></rect></g>
        <rect x="40" y="440" width="300" height="122" rx="8" fill="var(--s1)" stroke="var(--line2)" stroke-width="2"></rect></svg>
      <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px">${PART_NAMES.map((name, i) => `<li class="row" style="gap:10px">
        <span style="width:110px;font-weight:600;color:${w[i] >= 2 ? "var(--text)" : "var(--muted)"}">${name}</span>
        <span style="flex:1;height:8px;border-radius:4px;background:var(--track);overflow:hidden"><span style="display:block;width:${(w[i] / 3) * 100}%;height:100%;border-radius:4px;background:${w[i] === 3 ? "var(--acc)" : w[i] === 2 ? "color-mix(in srgb, var(--acc) 60%, var(--track))" : "var(--line2)"};transition:width .5s"></span></span>
        <span style="width:60px;text-align:right;font-size:12px;font-weight:700;color:${w[i] >= 2 ? "var(--text)" : "var(--muted)"}">${PART_LABELS[w[i]]}</span></li>`).join("")}</ul>
      <div class="notice warn" style="display:flex;gap:10px;align-items:flex-start"><span style="width:8px;height:8px;margin-top:7px;border-radius:50%;background:var(--warn);flex-shrink:0"></span><span><b>No seu PC:</b> ${esc(hint)}</span></div></aside>`;
  }

  function keyBlock() {
    return `<div class="stack" style="gap:8px">${keyBox()}${modelLine()}</div>`;
  }

  function keyBox() {
    const ai = App.state.ai;
    if (ai.has_key) {
      return `<div class="row" style="gap:10px;padding:12px 14px;border-radius:6px;background:var(--s0);font-size:14px">
        <span style="color:var(--acc-text);display:flex">${icon("check", 18)}</span><span style="flex:1">Chave preenchida${ai.masked ? ` · termina em ${esc(ai.masked)}` : " nesta sessão"}${ai.saved ? " · salva com criptografia do Windows" : ""}</span>
        <button type="button" class="link-go" id="adv-key-change" style="font-size:13px">${ai.saved ? "Trocar" : "Limpar"}</button></div>`;
    }
    return `<form class="stack" id="adv-key-form" style="gap:8px;padding:14px;border-radius:6px;border:1px solid var(--warn);background:var(--warn-soft)">
      <label for="adv-key" style="font-size:14px;font-weight:600">Chave do Gemini</label>
      <div class="row" style="gap:8px"><input id="adv-key" class="input" type="password" placeholder="Cole a chave que começa com AIza…" autocomplete="off" spellcheck="false" style="flex:1;min-width:0">
        <button type="submit" class="btn btn-secondary">Usar</button></div>
      <span class="muted" style="font-size:13px">Será guardada criptografada na sua conta do Windows e não vai para os arquivos do projeto. ${`<button type="button" class="link-go" data-url="https://aistudio.google.com/app/apikey" style="font-size:13px;display:inline-flex">Criar chave grátis</button>`}</span>
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
      <div class="advisor-board">
        <section class="panel pad in" style="animation-delay:60ms;min-width:0;display:flex;flex-direction:column;gap:24px;border-radius:24px">
          ${stepper()}
          ${notebook ? `<p class="notice soft" style="margin:0">${icon("info", 16)} Como é um notebook, o consultor só sugere memória RAM e armazenamento, ou um notebook novo quando eles não resolverem.</p>` : ""}
          ${body}
          <div class="row" style="justify-content:space-between;gap:12px;padding-top:18px;border-top:1px solid var(--line);flex-wrap:wrap">
            <div class="row wrap" style="gap:6px;flex:1">${chips().map((text) => `<span class="pill ok">${esc(text)}</span>`).join("")}</div>
            ${form.step > 1 ? `<button type="button" class="pill-btn ghost" id="adv-back" style="min-height:48px">Voltar</button>` : ""}
            ${form.step < 3 ? `<button type="button" class="pill-btn" id="adv-next" style="min-height:48px;padding:0 26px">Continuar${icon("arrow", 17)}</button>`
              : `<button type="button" class="pill-btn" data-analyze style="min-height:48px;padding:0 26px">${icon("spark", 17)}Analisar meu computador</button>`}
          </div>
        </section>
        <div class="stack" style="gap:16px;min-width:0">${weightsPanel()}
          <section class="panel pad in stack" aria-label="Resumo do pedido" style="animation-delay:120ms;gap:12px">
            <h2 class="section-title" style="font-size:18px">Seu pedido</h2>
            <dl style="margin:0">${summaryRows()}</dl>
            <div class="stack" style="gap:6px;padding:12px 14px;border-radius:12px;background:var(--s0)">
              <span class="label" style="font-size:12px">Será analisado</span><span style="font-size:14px;color:var(--text2)">${esc(hardwareLine())}</span></div>
            ${keyBlock()}
            <button type="button" class="pill-btn" data-analyze style="width:100%;justify-content:center">${icon("spark", 17)}Analisar meu computador</button>
          </section></div>
      </div>`;
    bind();
  }

  function chips() {
    const out = [form.uso];
    if (form.step >= 2) out.push(FOCUS[form.uso][form.foco].replace(/ \(.*\)/, ""));
    if (form.step >= 3 && budgetLabel()) out.push(budgetLabel());
    return out;
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
    const range = document.getElementById("adv-range");
    if (range) range.addEventListener("input", () => {
      const [label, value] = PRESETS[Number(range.value)];
      form.preset = label; form.orcamento = value;
      document.getElementById("adv-budget-big").textContent = label;
      document.getElementById("adv-budget-hint").textContent = PRESET_HINT[Number(range.value)];
      const typed = document.getElementById("adv-budget"); if (typed) typed.value = "";
      const aside = root().querySelector("aside dl, section[aria-label='Resumo do pedido'] dl"); if (aside) aside.innerHTML = summaryRows();
    });
    on("[data-goal]", "click", (e) => {
      readFields();
      const goal = e.currentTarget.dataset.goal;
      form.goals = form.goals.includes(goal) ? form.goals.filter((g) => g !== goal) : form.goals.concat([goal]);
      render();
    });
    on("[data-field='orcamento']", "input", () => {
      form.preset = null;
      const big = document.getElementById("adv-budget-big"), typed = document.getElementById("adv-budget");
      if (big) big.textContent = typed.value.trim() || "Sem definir";
      const hint = document.getElementById("adv-budget-hint"); if (hint) hint.textContent = typed.value.trim() ? "Valor digitado por você." : "Mexa no controle ou digite um valor. É opcional.";
    });
    on("[data-field]", "change", () => { readFields(); const dl = root().querySelector("section[aria-label='Resumo do pedido'] dl"); if (dl) dl.innerHTML = summaryRows(); });
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
      App.toast(App.state.ai.saved ? "Chave salva com criptografia na sua conta do Windows." : App.state.ai.save_error ? "Chave ativa nesta sessão, mas não foi possível salvá-la com segurança." : "Chave pronta nesta sessão.");
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
