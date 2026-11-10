/* Entenda seu PC: cada peça explicada com a analogia da cozinha.
   O conteúdo vem de hardwareGuide.py pela ponte (get_guide). */
App.register("guide", (() => {
  const root = () => document.getElementById("page-guide");
  const PART_LINKS = {
    ram: { label: "Ver quem está ocupando a memória", page: "monitor" },
    gpu: { label: "Informar o modelo da placa", page: "computer" },
    mb: { label: "Informar o modelo da placa-mãe", page: "computer" },
  };
  let guide = null;
  let current = "cpu";
  let mythOpen = false;
  let term = null;
  let loading = false;
  let revealAnimation = false;

  async function load() {
    if (loading) return;
    loading = true;
    try {
      guide = await Bridge.call("get_guide");
    } finally {
      loading = false;
    }
    render();
  }

  /* ---------- Gabinete aberto (clique numa peça) ---------- */
  const BOX = { // x, y, largura, altura no desenho de 520 x 600, e onde fica a etiqueta
    mb: [150, 40, 310, 340, "flex-end", "flex-end"], cpu: [231, 81, 128, 128, "flex-start", "flex-start"], ram: [374, 72, 62, 162, "flex-start", "center"],
    gpu: [146, 254, 318, 82, "center", "center"], disk: [34, 114, 102, 212, "flex-start", "center"], psu: [36, 436, 308, 130, "flex-start", "flex-end"],
  };
  const ORDER = ["cpu", "ram", "gpu", "disk", "mb", "psu"];
  let hover = null;
  let hoverFrame = 0;

  function stateOf(key) {
    const mine = guide.mine[key];
    if (!mine) return "unk";
    if (/^não/i.test(mine.value || "")) return "unk";
    if (mine.warn) {
      const ram = App.state.hardware && App.state.hardware.memoria;
      return key === "ram" && ram && ram.usage_percent >= 90 ? "crit" : "warn";
    }
    return "ok";
  }
  const TONE = { ok: "var(--acc-text)", warn: "var(--warn)", crit: "var(--crit)", unk: "var(--faint)" };

  function gabinete() {
    const g = (key, body) => {
      const on = key === current, h = key === hover && !on;
      const tone = on ? "var(--acc-text)" : TONE[stateOf(key)];
      const style = `--tone:${tone};opacity:${on || h ? 1 : 0.38};transform-box:fill-box;transform-origin:center;transform:scale(${on ? (key === "mb" ? 1.01 : 1.04) : 1});${on ? "filter:drop-shadow(0 0 7px var(--tone))" : ""}`;
      return `<g class="part" data-part="${key}" style="${style}">${body(on ? "var(--tone)" : h ? "var(--text2)" : "var(--line2)", on ? 2.5 : 1.5, on)}</g>`;
    };
    const svg = `<svg viewBox="0 0 520 600" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">
      <rect x="10" y="4" width="500" height="592" rx="18" fill="var(--s0)" stroke="var(--line2)" stroke-width="2"></rect>
      <rect x="26" y="20" width="468" height="560" rx="10" fill="var(--s1)"></rect>
      <g style="opacity:.7"><rect x="474" y="44" width="14" height="196" rx="3" fill="var(--s3)"></rect><path d="M478 60 v20 M478 96 v12 M478 124 v12 M478 152 v30" stroke="var(--line2)" stroke-width="4" stroke-linecap="round"></path></g>
      ${g("mb", (st, sw) => `<rect x="150" y="40" width="310" height="340" rx="6" fill="var(--s2)" stroke="${st}" stroke-width="${sw}"></rect>
        <path d="M170 60 H220 V80 M170 230 H220 M440 240 H400 V250 M440 60 H372 M170 360 H184 M330 357 H440" fill="none" stroke="var(--line2)" stroke-width="1.5"></path>
        <rect x="380" y="300" width="44" height="44" rx="4" fill="var(--s3)" stroke="${st}"></rect><rect x="390" y="310" width="24" height="24" rx="2" fill="var(--line2)"></rect>`)}
      <g style="opacity:.45"><path d="M120 300 C150 330 150 350 190 357" fill="none" stroke="var(--line2)" stroke-width="5"></path><path d="M330 450 C380 430 440 410 446 382" fill="none" stroke="var(--line2)" stroke-width="7"></path><path d="M300 450 C300 420 280 400 270 330" fill="none" stroke="var(--line2)" stroke-width="6"></path></g>
      ${g("cpu", (st, sw, on) => `<rect x="235" y="85" width="120" height="120" rx="8" fill="var(--s3)" stroke="${st}" stroke-width="${sw}"></rect><circle cx="295" cy="145" r="48" fill="var(--s1)" stroke="${st}" stroke-width="1.5"></circle>
        <g><animateTransform attributeName="transform" type="rotate" from="0 295 145" to="360 295 145" dur="${on ? "2s" : "14s"}" repeatCount="indefinite"></animateTransform><path d="M295 145 Q300 112 318 106 Q312 128 295 145 Z M295 145 Q328 150 334 168 Q312 162 295 145 Z M295 145 Q290 178 272 184 Q278 162 295 145 Z M295 145 Q262 140 256 122 Q278 128 295 145 Z" fill="${on ? "var(--tone)" : "var(--line2)"}" opacity="${on ? .6 : 1}"></path></g><circle cx="295" cy="145" r="10" fill="var(--s2)" stroke="${st}"></circle>`)}
      ${g("ram", (st, sw, on) => `<rect x="380" y="78" width="10" height="150" rx="2" fill="${on ? "var(--tone)" : "var(--acc)"}" opacity="${on ? 1 : .55}"></rect><rect x="394" y="78" width="10" height="150" rx="2" fill="none" stroke="${on ? "var(--tone)" : "var(--line2)"}"></rect>
        <rect x="408" y="78" width="10" height="150" rx="2" fill="${on ? "var(--tone)" : "var(--acc)"}" opacity="${on ? 1 : .55}"></rect><rect x="422" y="78" width="10" height="150" rx="2" fill="none" stroke="${on ? "var(--tone)" : "var(--line2)"}"></rect>`)}
      ${g("gpu", (st, sw, on) => `<rect x="150" y="258" width="10" height="74" rx="2" fill="var(--s3)"></rect><rect x="158" y="262" width="300" height="66" rx="6" fill="var(--s2)" stroke="${st}" stroke-width="${sw}"></rect>
        ${on ? '<rect x="157" y="261" width="302" height="68" rx="7" fill="none" stroke="var(--tone)" stroke-width="2.5" stroke-dasharray="7 5" pointer-events="none"></rect>' : ""}
        <circle cx="258" cy="295" r="26" fill="var(--s1)" stroke="${st}"></circle><circle cx="358" cy="295" r="26" fill="var(--s1)" stroke="${st}"></circle>
        <g><animateTransform attributeName="transform" type="rotate" from="0 258 295" to="360 258 295" dur="${on ? "2s" : "14s"}" repeatCount="indefinite"></animateTransform><path d="M258 295 L258 271 M258 295 L279 307 M258 295 L237 307" stroke="${on ? "var(--tone)" : "var(--line2)"}" stroke-width="5" stroke-linecap="round"></path></g>
        <g><animateTransform attributeName="transform" type="rotate" from="0 358 295" to="360 358 295" dur="${on ? "2s" : "14s"}" repeatCount="indefinite"></animateTransform><path d="M358 295 L358 271 M358 295 L379 307 M358 295 L337 307" stroke="${on ? "var(--tone)" : "var(--line2)"}" stroke-width="5" stroke-linecap="round"></path></g><rect x="402" y="282" width="40" height="10" rx="2" fill="${on ? "var(--tone)" : "var(--line2)"}"></rect>`)}
      ${g("disk", (st, sw, on) => `<rect x="40" y="120" width="90" height="200" rx="6" fill="var(--s1)" stroke="${st}" stroke-width="${sw}"></rect><rect x="48" y="140" width="74" height="72" rx="4" fill="${on ? "var(--tone)" : "var(--s3)"}" opacity="${on ? .4 : 1}"></rect><rect x="48" y="226" width="74" height="72" rx="4" fill="${on ? "var(--tone)" : "var(--s3)"}" opacity="${on ? .4 : 1}"></rect>
        <circle cx="85" cy="176" r="20" fill="none" stroke="var(--line2)"></circle><rect x="190" y="350" width="110" height="14" rx="3" fill="${on ? "var(--tone)" : "var(--s3)"}"></rect>`)}
      <rect x="26" y="420" width="468" height="160" fill="var(--s0)" opacity=".7"></rect>
      ${g("psu", (st, sw, on) => `<rect x="40" y="440" width="300" height="122" rx="8" fill="var(--s2)" stroke="${st}" stroke-width="${sw}"></rect><circle cx="118" cy="501" r="42" fill="var(--s1)" stroke="${st}"></circle>
        <g><animateTransform attributeName="transform" type="rotate" from="0 118 501" to="360 118 501" dur="${on ? "2s" : "14s"}" repeatCount="indefinite"></animateTransform><path d="M80 501 H156 M118 463 V539 M91 474 L145 528 M145 474 L91 528" stroke="${on ? "var(--tone)" : "var(--line2)"}" stroke-width="2"></path></g><rect x="190" y="470" width="120" height="44" rx="4" fill="var(--s3)"></rect><path d="M202 484 h70 M202 498 h50" stroke="var(--line2)" stroke-width="3"></path>`)}
    </svg>`;
    const hots = ["mb", "cpu", "ram", "gpu", "disk", "psu"].map((key) => {
      const [x, y, w, h, a, j] = BOX[key];
      const on = key === current, part = guide.parts.find((p) => p.key === key);
      const st = stateOf(key);
      const labelTone = on ? "var(--line2)" : "var(--text)";
      const dotTone = on ? "var(--muted)" : "var(--acc-text)";
      return `<button type="button" class="hot" data-hot="${key}" aria-pressed="${on}" aria-label="${esc(part.short_name)}${on ? ", selecionada" : ""}"
        style="left:${x / 5.2}%;top:${y / 6}%;width:${w / 5.2}%;height:${h / 6}%;align-items:${a};justify-content:${j}">
        <span class="hot-tag ${on ? "on" : ""}" style="--label-tone:${labelTone};--dot-tone:${dotTone}"><span class="${!on && st === "crit" ? "pulse" : ""}" aria-hidden="true"></span>${esc(part.short_name)}</span></button>`;
    }).join("");
    return `<section class="gab" aria-label="Gabinete aberto: clique numa peça"><span class="faint" style="position:absolute;left:20px;top:14px;font-size:13px">Por dentro de um PC de mesa · clique numa peça</span>
      <div class="gab-draw">${svg}${hots}</div></section>`;
  }

  function side() {
    const part = guide.parts.find((item) => item.key === current) || guide.parts[0];
    const mine = guide.mine[part.key];
    const link = PART_LINKS[part.key];
    const [question, verdict, answer] = part.myth;
    const st = stateOf(part.key);
    const index = ORDER.indexOf(part.key);
    const first = part.specs.find((spec) => spec.ruler);
    return `<section class="stack in" style="gap:16px;min-width:0" aria-live="polite">
      <div class="row" style="justify-content:space-between"><span class="faint" style="font-weight:600">Peça ${index + 1} de 6</span>
        <div class="row" style="gap:6px"><button type="button" class="round-btn" id="g-prev" aria-label="Peça anterior">${icon("back", 15)}</button><button type="button" class="round-btn" id="g-next" aria-label="Próxima peça">${icon("arrow", 15)}</button></div></div>
      <div class="stack" style="gap:8px"><h2 class="display" style="margin:0;font-size:32px;font-weight:800;line-height:1.1">${esc(part.name)}</h2>
        <span class="pill warn" style="width:fit-content;font-size:14px">Na cozinha, é ${esc(part.role)}</span></div>
      <p class="muted" style="margin:0;font-size:16px;line-height:1.55">${esc(part.analogy)}</p>
      <div class="row" style="gap:14px;align-items:flex-start;padding:14px 16px;border-radius:16px;background:var(--s1);border:1px solid ${st === "unk" ? "var(--line2)" : TONE[st]}">
        <span style="flex-shrink:0;width:10px;height:10px;margin-top:6px;border-radius:50%;background:${TONE[st]}"></span>
        <div class="stack" style="gap:2px;min-width:0"><span class="faint" style="font-size:12px;font-weight:600">No seu PC</span>
          <span class="display" style="font-size:19px;font-weight:700">${esc(mine.value)}</span>${mine.note ? `<span class="muted" style="font-size:13.5px">${esc(mine.note)}</span>` : ""}
          ${link ? linkGo(link.label, `data-go="${link.page}"`) : ""}</div></div>
      ${first ? `<div class="stack" style="gap:6px"><span style="font-weight:700">${esc(first.term)}</span>${ruler(first, mine)}</div>` : ""}
      <div class="row" style="flex-wrap:wrap;gap:10px 14px;padding:14px 16px;border-radius:16px;background:var(--acc-soft)">
        <span class="pill warn">${mythOpen ? esc(verdict) : "Mito ou verdade?"}</span><span style="flex:1 1 220px;font-weight:600">${esc(question)}</span>
        ${mythOpen ? `<p class="in" style="margin:0;width:100%;font-size:14px">${esc(answer)}</p>` : `<button type="button" class="pill-btn ghost" id="myth-reveal" style="min-height:34px">Ver resposta</button>`}</div>
    </section>`;
  }

  function ruler(spec, mine) {
    const mark = mine.marks[spec.ruler_key];
    const warn = mine.warn;
    const stops = spec.ruler.map(([label, hint], index) => {
      const on = index === mark;
      const color = warn ? "var(--warn)" : "var(--acc)";
      return `<div class="stack" style="flex:1 1 0;min-width:0;gap:5px">
        <span style="height:8px;border-radius:4px;background:${on ? color : "var(--track)"};box-shadow:${on ? `0 0 0 2px var(--bg), 0 0 0 4px ${warn ? "var(--warn)" : "var(--acc-text)"}` : "none"}"></span>
        <span class="num" style="font-size:14px;font-weight:700;color:${on ? "var(--text)" : "var(--text2)"}">${esc(label)}</span>
        <span class="faint" style="font-size:12px;line-height:1.3">${esc(hint)}</span></div>`;
    }).join("");
    const note = mine.mark_notes[spec.ruler_key] || (App.state.hardware ? "Este valor não é lido automaticamente no seu PC." : "");
    const noteColor = mark !== undefined ? (warn ? "var(--warn)" : "var(--acc-text)") : "var(--muted)";
    return `<div class="stack" style="gap:6px;padding-top:4px">
      <div class="row" style="gap:4px;align-items:flex-start">${stops}</div>
      ${note ? `<span style="font-size:13px;font-weight:600;color:${noteColor}">${esc(note)}</span>` : ""}
    </div>`;
  }

  function specsSection() {
    const part = guide.parts.find((item) => item.key === current) || guide.parts[0];
    const mine = guide.mine[part.key];
    const specs = part.specs.map((spec, index) => `
      <article class="panel in" style="animation-delay:${index * 50}ms;padding:18px;background:var(--s0);display:flex;flex-direction:column;gap:10px">
        <div class="row" style="justify-content:space-between;align-items:baseline;flex-wrap:wrap"><span style="font-size:17px;font-weight:700">${esc(spec.term)}</span>
          ${spec.example ? `<span class="num faint" style="font-size:14px;font-weight:600">${esc(spec.example)}</span>` : ""}</div>
        <p class="muted" style="margin:0">${esc(spec.text)}</p>
        ${spec.ruler ? ruler(spec, mine) : ""}
        <div class="tip">${icon("info", 16)}<span><strong>Dica:</strong> ${esc(spec.tip)}</span></div>
      </article>`).join("");
    return `<section class="stack" style="gap:12px"><h3 class="section-title" style="font-size:19px">As especificações de ${esc(part.short_name.toLowerCase())}, uma por uma</h3>
      <div class="grid auto-300" style="gap:12px">${specs}</div></section>`;
  }

  function glossary() {
    const open = guide.glossary.find(([word]) => word === term);
    return `<section class="panel pad in" style="animation-delay:180ms;display:flex;flex-direction:column;gap:14px">
      <h2 class="section-title" style="font-size:19px">Dicionário rápido</h2>
      <span class="muted" style="font-size:14px">Palavras que aparecem no Mallard e em qualquer loja de informática.</span>
      <div class="row wrap" style="gap:8px">${guide.glossary.map(([word]) =>
        `<button type="button" class="chip" data-term="${esc(word)}" aria-expanded="${word === term}">${esc(word)}</button>`).join("")}</div>
      ${open ? `<p class="notice soft in" style="margin:0;color:var(--text);animation-duration:.25s"><strong>${esc(open[0])}:</strong> ${esc(open[1])}</p>` : ""}
    </section>`;
  }

  function render() {
    const head = pageHeader("ENTENDER", "Como funciona seu computador", "Clique numa peça do gabinete e veja o que ela faz, com a analogia da cozinha.");
    if (!guide) {
      root().innerHTML = head + `<div class="panel pad muted in">Preparando a aula…</div>`;
      return;
    }
    root().innerHTML = head + `<div class="guide-board">${gabinete()}${side()}</div>${specsSection()}${glossary()}`;
    if (revealAnimation) {
      revealAnimation = false;
      const parts = root().querySelectorAll(".part[data-part]");
      parts.forEach((part) => { part.style.animation = "none"; });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        parts.forEach((part) => { part.style.animation = ""; });
      }));
    }
    root().querySelectorAll("[data-hot]").forEach((button) => {
      button.addEventListener("click", () => { current = button.dataset.hot; mythOpen = false; revealAnimation = true; render(); });
      const enter = () => { hover = button.dataset.hot; softHover(); }, leave = () => { if (hover === button.dataset.hot) { hover = null; softHover(); } };
      button.addEventListener("mouseenter", enter); button.addEventListener("focus", enter);
      button.addEventListener("mouseleave", leave); button.addEventListener("blur", leave);
    });
    const step = (delta) => { current = ORDER[(ORDER.indexOf(current) + delta + ORDER.length) % ORDER.length]; mythOpen = false; revealAnimation = true; render(); };
    document.getElementById("g-prev").addEventListener("click", () => step(-1));
    document.getElementById("g-next").addEventListener("click", () => step(1));
    const reveal = document.getElementById("myth-reveal");
    if (reveal) reveal.addEventListener("click", () => { mythOpen = true; render(); });
    root().querySelectorAll("[data-term]").forEach((button) => button.addEventListener("click", () => {
      term = term === button.dataset.term ? null : button.dataset.term;
      render();
    }));
  }

  /* Hover atualiza só estilos: não recria os ventiladores nem reinicia a animação. */
  function softHover() {
    if (hoverFrame) cancelAnimationFrame(hoverFrame);
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
    const draw = root().querySelector(".gab-draw");
    if (!draw) return;
    draw.querySelectorAll(".part[data-part]").forEach((part) => {
      const selected = part.dataset.part === current;
      const hovered = part.dataset.part === hover && !selected;
      part.style.opacity = selected || hovered ? "1" : "0.38";
      part.style.transform = `scale(${selected ? (part.dataset.part === "mb" ? 1.01 : 1.04) : 1})`;
      part.style.filter = selected ? "drop-shadow(0 0 7px var(--tone))" : "none";
    });
    });
  }

  return {
    init() {
      render();
      App.on("hardware", () => load());
    },
    show(options) {
      if (options && options.part) { current = options.part; mythOpen = false; }
      if (!guide) load(); else render();
    },
  };
})());
