/* Entenda seu PC: cada peça explicada com a analogia da cozinha.
   O conteúdo vem de hardwareGuide.py pela ponte (get_guide). */
App.register("guide", (() => {
  const root = () => document.getElementById("page-guide");
  const PART_ICONS = { cpu: "cpu", ram: "ram", gpu: "gpu", disk: "disk", mb: "mb", psu: "plug" };
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

  function tiles() {
    return guide.parts.map((part) => {
      const on = part.key === current;
      return `<button type="button" class="panel" data-part-tile="${part.key}" aria-pressed="${on}"
        style="cursor:pointer;text-align:left;padding:14px;display:flex;flex-direction:column;gap:10px;min-height:108px;border:1.5px solid ${on ? "var(--acc-text)" : "var(--line)"};background:${on ? "var(--acc-soft)" : "var(--s0)"};color:var(--text)">
        <span class="icon-tile" style="width:38px;height:38px;border-radius:8px;color:${on ? "var(--acc-text)" : "var(--text2)"}">${icon(PART_ICONS[part.key], 21, 1.7)}</span>
        <span class="stack" style="gap:2px"><span style="font-size:15px;font-weight:600">${esc(part.short_name)}</span>
        <span class="faint" style="font-size:13px">é ${esc(part.role)}</span></span>
      </button>`;
    }).join("");
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

  function detail() {
    const part = guide.parts.find((item) => item.key === current) || guide.parts[0];
    const mine = guide.mine[part.key];
    const link = PART_LINKS[part.key];
    const [question, verdict, answer] = part.myth;
    const specs = part.specs.map((spec, index) => `
      <article class="panel in" style="animation-delay:${index * 50}ms;padding:18px;background:var(--s0);display:flex;flex-direction:column;gap:10px">
        <div class="row" style="justify-content:space-between;align-items:baseline;flex-wrap:wrap"><span style="font-size:17px;font-weight:700">${esc(spec.term)}</span>
          ${spec.example ? `<span class="num faint" style="font-size:14px;font-weight:600">${esc(spec.example)}</span>` : ""}</div>
        <p class="muted" style="margin:0">${esc(spec.text)}</p>
        ${spec.ruler ? ruler(spec, mine) : ""}
        <div class="tip">${icon("info", 16)}<span><strong>Dica:</strong> ${esc(spec.tip)}</span></div>
      </article>`).join("");
    return `<section class="panel pad in" style="animation-delay:120ms;display:flex;flex-direction:column;gap:24px">
      <div class="row" style="flex-wrap:wrap;gap:20px;align-items:stretch">
        <div class="row" style="flex:999 1 420px;min-width:0;gap:18px;align-items:flex-start">
          <span style="width:68px;height:68px;border-radius:14px;flex-shrink:0;background:var(--acc-soft);color:var(--acc-text);display:flex;align-items:center;justify-content:center">${icon(PART_ICONS[part.key], 34, 1.5)}</span>
          <div class="stack" style="min-width:0">
            <span class="label">Na cozinha, é ${esc(part.role)}</span>
            <h2 class="display" style="margin:0;font-size:28px;font-weight:700;line-height:1.05">${esc(part.name)}</h2>
            <p class="muted" style="margin:0;font-size:16px;line-height:1.6">${esc(part.analogy)}</p>
          </div>
        </div>
        <div class="stack" style="flex:1 1 280px;min-width:0;padding:16px 18px;border-radius:8px;background:var(--s0);border:1px solid ${mine.warn ? "var(--warn)" : "var(--line2)"};gap:6px">
          <span class="label" style="font-size:12px">No seu PC</span>
          <span class="display" style="font-size:18px;font-weight:700;color:${mine.warn ? "var(--warn)" : "var(--text)"}">${esc(mine.value)}</span>
          ${mine.note ? `<span class="muted" style="font-size:14px">${esc(mine.note)}</span>` : ""}
          ${link ? linkGo(link.label, `data-go="${link.page}"`) : ""}
        </div>
      </div>
      <div class="stack" style="gap:12px">
        <h3 class="section-title" style="font-size:19px">As especificações, uma por uma</h3>
        <div class="grid auto-300" style="gap:12px">${specs}</div>
      </div>
      <div class="row" style="flex-wrap:wrap;gap:14px 20px;padding:18px 20px;border-radius:8px;background:var(--acc-soft)">
        <span class="num" style="font-size:13px;font-weight:700;letter-spacing:.12em;color:var(--acc-text)">MITO OU VERDADE?</span>
        <span style="flex:1 1 300px;font-size:17px;font-weight:600">${esc(question)}</span>
        ${mythOpen
          ? `<p class="in" style="margin:0;width:100%;animation-duration:.3s"><strong style="color:var(--acc-text)">${esc(verdict)}</strong> ${esc(answer)}</p>`
          : `<button type="button" class="btn btn-secondary" id="myth-reveal">Ver resposta</button>`}
      </div>
    </section>`;
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
    const head = pageHeader("ENTENDA SEU PC", "Como funciona seu computador", "Cada peça explicada sem complicação, com o que os números querem dizer.");
    if (!guide) {
      root().innerHTML = head + `<div class="panel pad muted in">Preparando a aula…</div>`;
      return;
    }
    root().innerHTML = head + `
      <section class="panel pad in" style="animation-delay:60ms;display:flex;flex-direction:column;gap:16px">
        <div class="row" style="gap:14px;flex-wrap:wrap">${duckling(52, 42)}
          <div class="stack" style="gap:2px;flex:1 1 300px;min-width:0">
            <h2 class="section-title">Pense no seu PC como uma cozinha</h2>
            <span class="muted">Cada peça tem um papel. Escolha uma para entender o que ela faz e o que significam os números dela.</span>
          </div></div>
        <div class="grid auto-150">${tiles()}</div>
      </section>` + detail() + glossary();

    root().querySelectorAll("[data-part-tile]").forEach((button) => button.addEventListener("click", () => {
      current = button.dataset.partTile;
      mythOpen = false;
      render();
    }));
    const reveal = document.getElementById("myth-reveal");
    if (reveal) reveal.addEventListener("click", () => { mythOpen = true; render(); });
    root().querySelectorAll("[data-term]").forEach((button) => button.addEventListener("click", () => {
      term = term === button.dataset.term ? null : button.dataset.term;
      render();
    }));
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
