/* Temperatura: o termômetro do pato. Processador, disco, placa de vídeo e ventoinhas, com aviso de calor.
   O que aparece depende dos sensores do computador: o que não dá para ler fica como "Sem sensor", nunca inventado. */
App.register("temperature", (() => {
  const root = () => document.getElementById("page-temperature");
  const $ = (id) => document.getElementById(id);
  const MAX = 30;
  const POLL_MS = 5000;
  const RANGE = { cpu: [20, 100], ssd: [20, 85], gpu: [20, 100] };
  const NAMES = { cpu: "Processador", ssd: "Disco (SSD)", gpu: "Placa de vídeo", fan: "Ventoinhas" };
  const CAPTION = { cpu: "Limite do fabricante: cerca de 100 °C", ssd: "Limite do fabricante: cerca de 85 °C", gpu: "Limite do fabricante: cerca de 90 °C" };
  const FAN_WORD = { ok: "Normal", warn: "Rápida", crit: "No máximo", off: "Sem sensor" };

  let data = null;
  let hist = { cpu: [], ssd: [], gpu: [], fan: [] };
  let sel = "cpu";
  let timer = null;
  let failed = false;

  const limits = (key) => (data && data.limits && data.limits[key]) || [70, 85];
  const readings = (key) => (key === "fan" ? data.fan.rpm : data[key].temp);
  const ready = (key) => data && data[key] && data[key].state !== "off";
  const num = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  function spark(values, lo, hi) {
    const W = 120, H = 34;
    if (values.length < 2) return { line: `M0 30 L${W} 30`, area: `M0 ${H}Z` };
    const pts = values.map((v, i) => [(i * W / (values.length - 1)).toFixed(1), (H - 4 - Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * (H - 10)).toFixed(1)]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
    return { line, area: `${line} L${W} ${H} L0 ${H} Z` };
  }

  function card(key) {
    const entry = data[key];
    const on = ready(key);
    const selectable = key !== "fan" && on;
    const tone = STATE_TONE[entry.state];
    const range = key === "fan" ? [0, 4000] : RANGE[key];
    const s = spark(hist[key], range[0], range[1]);
    const shown = on ? readings(key) : null;
    const unit = key === "fan" ? " rpm" : " °C";
    const label = key === "fan" ? FAN_WORD[entry.state] : STATE_LABEL[entry.state];
    let detail;
    if (!on) detail = key === "gpu" ? "Aparece em placas NVIDIA com driver" : key === "fan" ? "Este computador não informa a rotação" : "Este computador não mostra ao Mallard";
    else if (key === "fan") detail = entry.state === "ok" ? "Girando devagar, sem esforço" : "Girando forte para esfriar o PC";
    else if (key === "gpu") detail = [entry.name, entry.usage != null ? `${entry.usage}% em uso` : ""].filter(Boolean).join(" · ");
    else detail = `O aviso do Mallard dispara aos ${limits(key)[1]} °C`;
    const inner = `<span class="row" style="justify-content:space-between;gap:8px"><b class="muted">${NAMES[key]}</b>${stateChip(entry.state, label)}</span>
      <span class="row" style="justify-content:space-between;align-items:flex-end;gap:10px"><span class="display" style="font-size:30px;font-weight:800;line-height:1">${on ? num(shown) : "—"}<span class="faint" style="font-size:14px;font-weight:700">${on ? unit : ""}</span></span>
        <svg width="110" height="34" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true"><path d="${on ? s.area : "M0 34Z"}" fill="${tone}" opacity=".16"></path><path d="${on ? s.line : "M0 30 L120 30"}" fill="none" stroke="${on ? tone : "var(--line2)"}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path></svg></span>
      <span class="faint" style="font-size:12px">${esc(detail)}</span>`;
    if (selectable) return `<button type="button" role="radio" aria-checked="${sel === key}" class="res ${sel === key ? "on" : ""}" data-sel="${key}" style="--tone:${tone}">${inner}</button>`;
    return `<div class="res ${on ? "" : "off"}" style="cursor:default;--tone:${tone}">${inner}</div>`;
  }

  function thermometer() {
    const key = sel;
    const entry = data[key];
    const on = ready(key);
    const [lo, hi] = RANGE[key];
    const [warn, crit] = limits(key);
    const frac = (t) => Math.max(0, Math.min(1, (t - lo) / (hi - lo)));
    const v = on ? entry.temp : null;
    const level = entry.state;
    const tone = STATE_TONE[level];
    const fw = frac(warn), fc = frac(crit);
    const mark = (center, state, title, sub) => `<span class="t-mark" style="top:calc(84px + (100% - 140px) * ${(1 - center).toFixed(3)} - 17px);color:${STATE_TONE[state]}"><b>${title}</b><span class="faint">${sub}</span></span>`;
    const mood = !on ? ["Sem sensor", "Não consigo sentir a temperatura."]
      : level === "crit" ? ["Estou fritando!", "Salve seu trabalho e alivie o PC."]
      : level === "warn" ? ["Esquentando", "Já estou abanando as penas."]
      : ["Fresquinho", "Estou numa boa, sem suar."];
    const duckTop = on ? `calc(84px + (100% - 140px) * ${(1 - frac(v)).toFixed(3)} - 56px)` : "calc(50% - 40px)";
    return `<section class="thermo in" aria-label="Termômetro" style="--tone:${tone}">
      <div style="position:absolute;left:22px;top:18px;z-index:3" class="stack">
        <span class="display" style="font-size:20px;font-weight:700">${NAMES[key]}</span>
        <span class="faint" style="font-size:12px">${CAPTION[key]}</span></div>
      <div class="stack" style="position:absolute;left:22px;bottom:22px;gap:6px;z-index:3;max-width:130px">
        <span class="display" role="status" style="font-size:64px;line-height:.95;font-weight:800;letter-spacing:-.04em;color:${on ? "var(--text)" : "var(--muted)"}">${on ? num(v) : "?"}<span style="font-size:.38em;letter-spacing:0">${on ? " °C" : ""}</span></span>
        ${stateChip(level)}
        <span style="font-size:13px;line-height:1.3"><b>${mood[0]}</b><br><span class="muted">${mood[1]}</span></span></div>
      <div class="tube" aria-hidden="true">
        <div class="zone crit" style="top:0;height:${((1 - fc) * 100).toFixed(1)}%"></div>
        <div class="zone warn" style="top:${((1 - fc) * 100).toFixed(1)}%;height:${((fc - fw) * 100).toFixed(1)}%"></div>
        <div class="zone ok" style="top:${((1 - fw) * 100).toFixed(1)}%;bottom:0"></div>
        <div class="mercury" style="height:${on ? (frac(v) * 100).toFixed(1) : 0}%"></div></div>
      ${mark((1 + fc) / 2, "crit", "Crítico", `${crit} °C ou mais`)}
      ${mark((fc + fw) / 2, "warn", "Alto", `${warn} a ${crit - 1} °C`)}
      ${mark(fw / 2, "ok", "Normal", `até ${warn - 1} °C`)}
      <div class="t-duck" style="top:${duckTop}"><div class="bob">${duckSide(120, 78)}</div></div>
    </section>`;
  }

  function tips(level, v) {
    const T = (ic, title, desc, go) => ({ ic, title, desc, go });
    const dust = T("broom", "Limpe a poeira das ventoinhas", "Desligue o PC da tomada antes e use um pincel macio.");
    const air = T("fan", "Deixe as saídas de ar livres", "Não cubra o PC nem use o notebook sobre cobertor.");
    const mon = T("monitor", "Veja o que está pesando", "Programas abertos demais fazem o processador trabalhar a mil.", { page: "monitor", label: "Abrir o Monitor" });
    if (level === "off") return { title: "Sem leitura de temperatura", head: "Este computador não mostra a temperatura ao Mallard. Os outros dados continuam funcionando.", tone: "off", list: [T("gpu", "Placas NVIDIA aparecem sozinhas", "Com o driver instalado, a temperatura da placa de vídeo é lida sem configurar nada."), air] };
    if (level === "ok") return { title: "O que fazer", head: `Tudo dentro da faixa segura: ${num(v)} °C.`, tone: "ok", list: [air, T("broom", "Limpe a poeira a cada 6 meses", "Poeira dentro da caixa é a causa mais comum de calor.")] };
    if (level === "warn") return { title: "O que fazer", head: `Está esquentando: ${num(v)} °C. Ainda é seguro, mas vale agir.`, tone: "warn", list: [mon, dust, T("monitor", "Notebook? Use sobre superfície dura", "Assim as entradas de ar de baixo respiram.")] };
    return { title: "O que fazer agora", head: `Perigo: ${num(v)} °C. O PC pode desligar sozinho para se proteger.`, tone: "crit", list: [T("download", "Salve o que está fazendo agora", "Se o PC desligar, você não perde o trabalho."), { ...mon, title: "Feche os programas pesados", desc: "É o jeito mais rápido de esfriar." }, T("broom", "Se repetir, limpe o PC por dentro", "Poeira e pasta térmica velha são as causas mais comuns.")] };
  }

  function whatToDo() {
    const key = sel;
    const on = ready(key);
    const t = tips(on ? data[key].state : "off", on ? data[key].temp : null);
    const tone = STATE_TONE[t.tone];
    return `<section class="panel pad in stack" style="gap:6px;padding:16px 20px">
      <h2 class="section-title" style="font-size:18px">${t.title}</h2>
      <div class="row" style="gap:10px;padding:8px 12px;border-radius:12px;align-items:flex-start;background:color-mix(in srgb, ${tone} 13%, transparent)" role="status">
        <span style="color:${tone};display:flex;margin-top:1px">${icon(`st-${t.tone}`, 18, 3)}</span><span style="font-size:15px">${esc(t.head)}</span></div>
      ${t.list.map((tip) => `<div class="tip"><span class="tip-ic">${icon(tip.ic, 18)}</span>
        <span class="stack" style="gap:2px;flex:1"><b>${esc(tip.title)}</b><span class="muted" style="font-size:14px">${esc(tip.desc)}</span></span>
        ${tip.go ? `<button type="button" class="pill-btn ghost" data-go="${tip.go.page}" style="min-height:34px;font-size:14px;align-self:center">${esc(tip.go.label)}</button>` : ""}</div>`).join("")}
    </section>`;
  }

  function render() {
    const head = pageHeader("FERRAMENTA", "Temperatura", `<span class="row" style="gap:8px"><span class="${data && data.supported ? "live" : ""}" style="width:8px;height:8px;border-radius:50%;background:${data && data.supported ? "var(--acc-text)" : "var(--muted)"}"></span>${data && data.supported ? "Ao vivo · atualiza a cada poucos segundos" : "Sem sensores"}</span>`);
    if (!data) {
      root().innerHTML = head + `<section class="panel pad in muted">${failed ? "Não foi possível ler os sensores agora." : "Lendo os sensores…"}</section>`;
      return;
    }
    if (!ready(sel)) sel = ["cpu", "ssd", "gpu"].find(ready) || "cpu";
    root().innerHTML = head + `<div class="temp-board">${thermometer()}
      <div class="stack" style="gap:16px;min-width:0">
        <div class="res-grid" id="temp-cards" role="radiogroup" aria-label="O que o termômetro mostra">${["cpu", "ssd", "gpu", "fan"].map(card).join("")}</div>
        ${whatToDo()}
        ${data.note ? `<p class="faint" style="margin:0;font-size:14px">${esc(data.note)}</p>` : `<p class="faint" style="margin:0;font-size:13px">${data.cpu.source ? `Processador: ${esc(data.cpu.source)}. ` : ""}Os limites são os mesmos do aviso na bandeja (Configurações).</p>`}
      </div></div>`;
    root().querySelectorAll("[data-sel]").forEach((button) => button.addEventListener("click", () => { sel = button.dataset.sel; render(); }));
  }

  async function poll(force) {
    try {
      data = await Bridge.call("get_temperatures", !!force);
      failed = false;
      ["cpu", "ssd", "gpu", "fan"].forEach((key) => {
        if (!ready(key)) { hist[key] = []; return; }
        hist[key].push(readings(key));
        while (hist[key].length > MAX) hist[key].shift();
      });
    } catch (error) { failed = true; }
    if (App.state.page === "temperature") render();
  }

  return {
    show() {
      hist = { cpu: [], ssd: [], gpu: [], fan: [] };
      render();
      poll(true);
      clearInterval(timer);
      timer = setInterval(() => { if (!document.hidden) poll(false); }, POLL_MS);
    },
    hide() { clearInterval(timer); timer = null; },
  };
})());
