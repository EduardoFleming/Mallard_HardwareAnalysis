/* Antes e depois do upgrade: a semana antes da peça contra a semana depois, com os dados do Diário.
   Não é uma tela sozinha: aparece como segunda aba do Histórico (history.js chama BeforeAfter.mount). */
const BeforeAfter = (() => {
  let parts = [];
  let sel = 0;
  let host = null;
  const VERDICT = { better: ["ok", "Melhorou"], worse: ["warn", "Piorou"], same: ["off", "Igual"] };

  function willCompare(part) {
    if (part.kind === "ssd") return [["disk", "Espaço livre no C:"], ["activity", "Vezes que o PC travou"], ["cpu", "Pico do processador"]];
    return [["ram", "Dias com a memória acima de 90%"], ["activity", "Memória média em uso"], ["warn", "Vezes que o PC travou"]];
  }

  function chart(points, label) {
    const W = 740, H = 176;
    const x = (i) => 14 + i * ((W - 28) / (points.length - 1));
    const y = (v) => H - 8 - (Math.max(40, Math.min(100, v)) - 40) / 60 * (H - 24);
    const seg = (after) => {
      const pts = points.map((p, i) => ({ ...p, i })).filter((p) => p.after === after && p.peak != null);
      if (!pts.length) return { line: "", area: "" };
      const line = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.peak).toFixed(1)}`).join(" ");
      return { line, area: `${line} L${x(pts[pts.length - 1].i).toFixed(1)} ${H} L${x(pts[0].i).toFixed(1)} ${H} Z`, pts };
    };
    const B = seg(false), A = seg(true);
    const cut = (x(points.findIndex((p) => p.after) - 1) + x(points.findIndex((p) => p.after))) / 2;
    const ticks = [0, points.findIndex((p) => p.after) - 1, points.findIndex((p) => p.after), points.length - 1];
    const dots = (s, fill) => (s.pts || []).map((p) => `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.peak).toFixed(1)}" r="4" fill="${fill}" stroke="var(--s1)" stroke-width="1.8"></circle>`).join("");
    return `<svg viewBox="0 0 ${W} 206" width="100%" role="img" aria-label="${esc(label)}" style="display:block;overflow:visible">
      <rect x="0" y="0" width="${cut.toFixed(1)}" height="${H}" rx="10" fill="var(--s0)"></rect>
      <line x1="0" x2="${W}" y1="${y(90).toFixed(1)}" y2="${y(90).toFixed(1)}" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="5 5" opacity=".8"></line>
      <text x="${W - 2}" y="${(y(90) - 6).toFixed(1)}" text-anchor="end" font-size="13" font-weight="700" fill="var(--warn)">Linha d'água · 90%</text>
      <path d="${B.area}" fill="var(--text)" opacity=".06"></path><path d="${B.line}" fill="none" stroke="var(--text2)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"></path>
      <path d="${A.area}" fill="var(--acc-text)" opacity=".16"></path><path d="${A.line}" fill="none" stroke="var(--acc-text)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"></path>
      <line x1="${cut.toFixed(1)}" x2="${cut.toFixed(1)}" y1="0" y2="${H}" stroke="var(--text)" stroke-width="2" stroke-dasharray="2 4"></line>
      ${dots(B, "var(--text2)")}${dots(A, "var(--acc-text)")}
      ${ticks.map((i, k) => `<text x="${x(i).toFixed(1)}" y="198" text-anchor="${k % 2 ? "end" : "start"}" font-size="13" fill="var(--muted)">${esc(points[i].label)}</text>`).join("")}
    </svg>`;
  }

  function compare(part) {
    const tone = part.headline.tone === "ok" ? "var(--acc-text)" : part.headline.tone === "warn" ? "var(--warn)" : "var(--muted)";
    const level = part.headline.tone === "ok" ? "ok" : part.headline.tone === "warn" ? "warn" : "off";
    const peaks = part.chart.filter((p) => p.peak != null);
    return `<div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px">
        <div class="stack" style="gap:0"><span class="faint" style="font-size:13px;font-weight:700">Comparando ${esc(part.window.before)} (antes) com ${esc(part.window.after)} (depois)</span>
          <h2 class="display" style="margin:0;font-size:26px;font-weight:800">${esc(part.name)}: ${esc(part.change)}</h2></div>
        </div>
      <div class="row" role="status" style="gap:12px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:color-mix(in srgb, ${tone} 13%, transparent)">
        <span style="color:${tone};display:flex;margin-top:2px">${icon(`st-${level}`, 20, 3)}</span>
        <span class="stack" style="gap:0"><span class="display" style="font-size:18px;font-weight:800">${esc(part.headline.title)}</span><span>${esc(part.headline.text)}</span></span></div>
      <div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><b>Pico de memória por dia</b>
          <span class="row faint" style="gap:14px;font-size:13px"><span class="row" style="gap:6px"><i style="width:18px;border-top:3px solid var(--text2)"></i>Antes</span><span class="row" style="gap:6px"><i style="width:18px;border-top:3px solid var(--acc-text)"></i>Depois</span></span></div>
        ${chart(part.chart, `Pico de memória por dia: ${peaks.length} dias anotados, antes e depois de ${part.installed_label}.`)}</div>
      <div class="stack" style="gap:0;border-top:1px solid var(--line)">${part.rows.map((r) => {
        const [lvl, word] = VERDICT[r.verdict];
        return `<div class="ba-row"><span style="flex:1;min-width:0;font-weight:600">${esc(r.name)}</span><span class="num muted" style="width:70px;text-align:right">${esc(r.before)}</span>
          <span aria-hidden="true" class="faint">→</span><span class="num" style="width:70px;font-weight:800">${esc(r.after)}</span><span style="width:104px;display:flex;justify-content:flex-end">${stateChip(lvl, word)}</span></div>`;
      }).join("")}</div>
      <span class="faint" style="font-size:13px">O uso muda com o que você faz, então a diferença é uma estimativa e não uma garantia.</span>`;
  }

  function waiting(part) {
    const left = part.days_needed - part.days;
    return `<div class="stack" style="gap:0"><span class="faint" style="font-size:13px;font-weight:700">${esc(part.name)} instalada em ${esc(part.installed_label)}</span>
        <h2 class="display" style="margin:0;font-size:26px;font-weight:800">Faltam ${left} ${left === 1 ? "dia" : "dias"} para comparar</h2></div>
      <div class="stack" role="status" style="gap:10px;padding:14px 16px;border-radius:14px;background:var(--s0)">
        <span class="row" style="gap:10px;font-weight:700">${icon("clock", 20)}${part.days} de ${part.days_needed} dias anotados</span>
        <div class="bar" style="height:12px" aria-hidden="true"><span style="width:${(part.days / part.days_needed) * 100}%;background:var(--acc)"></span></div>
        <span class="muted" style="font-size:14px">O pato anota o uso de cada dia enquanto o Mallard está aberto. Quanto mais dias, melhor a comparação.</span></div>
      <b style="margin-top:4px">O que vai ser comparado</b>
      <div class="stack" style="gap:0">${willCompare(part).map(([ic, name]) => `<div class="ba-row"><span class="tip-ic" style="width:28px;height:28px">${icon(ic, 16)}</span><span style="flex:1;font-weight:600">${esc(name)}</span></div>`).join("")}</div>
      <span class="faint" style="font-size:13px">Marque um upgrade como feito no resultado e mantenha o Diário aberto para coletar dados.</span>`;
  }

  function nodata(part) {
    return `<div class="stack" style="gap:0"><span class="faint" style="font-size:13px;font-weight:700">${esc(part.name)} instalada em ${esc(part.installed_label)}</span>
        <h2 class="display" style="margin:0;font-size:26px;font-weight:800">Poucos dias anotados</h2></div>
      <div class="row" role="status" style="gap:10px;padding:14px 16px;border-radius:14px;background:var(--warn-soft);align-items:flex-start"><span style="color:var(--warn);display:flex">${icon("st-warn", 20, 3)}</span>
        <span>Para comparar com sentido o Mallard precisa ter anotado pelo menos 3 dias de cada lado. Foram ${part.before_days} antes e ${part.after_days} depois. O Diário só anota enquanto o app está aberto.</span></div>
      <span class="muted" style="font-size:14px">Deixe o Mallard aberto durante o uso nos próximos dias e volte aqui.</span>`;
  }

  function empty() {
    return `<div class="stack muted" style="flex:1;align-items:center;justify-content:center;gap:10px;text-align:center;padding:40px 12px">
      <span style="color:var(--muted);display:flex">${icon("activity", 56, 1.5)}</span>
      <span class="muted" style="max-width:360px">A comparação aparece aqui: pico de memória, travadas e o que mais mudou.</span></div>`;
  }

  function side(visible) {
    if (!visible.length) {
      return `<div class="stack" style="gap:12px;align-items:flex-start"><div class="panel pad stack" style="gap:12px;align-items:center;text-align:center;width:100%">${duckling(70, 56)}
          <h2 class="display" style="margin:0;font-size:22px;font-weight:800">Nenhuma peça instalada ainda</h2>
          <span class="muted">Quando você instalar uma peça e marcar como feita no Resultado, o pato compara a semana de antes com a de depois.</span>
          <button type="button" class="pill-btn" data-go="result">Ver o meu caminho</button></div></div>`;
    }
    return `<div class="stack" style="gap:10px" role="radiogroup" aria-label="Peças instaladas">${visible.map((part, i) => {
      const chip = part.status === "compared" ? stateChip("ok", "Comparado") : part.status === "waiting" ? stateChip("off", `Faltam ${part.days_needed - part.days} dias`) : stateChip("warn", "Poucos dados");
      return `<button type="button" role="radio" aria-checked="${i === sel}" aria-pressed="${i === sel}" class="ba-part" data-ba="${i}">
        <span class="row" style="justify-content:space-between;align-items:flex-start;gap:8px"><span class="stack" style="gap:0"><span class="display" style="font-size:19px;font-weight:800">${esc(part.name)}</span><span class="muted">${esc(part.change)}</span></span>${chip}</span>
        <span class="faint" style="font-size:13px">Instalada em ${esc(part.installed_label)}</span></button>`;
    }).join("")}
      <div class="stack" style="gap:6px;padding:14px 16px;border-radius:16px;background:var(--s1);border:1px solid var(--line)"><b>Como a comparação funciona</b>
        <span class="muted" style="font-size:14px">O pato guarda os 7 dias antes da peça e compara com os 7 dias depois, usando as anotações do Diário. Marque a peça como feita no Resultado para começar a contar.</span></div></div>`;
  }

  function paint() {
    if (!host) return;
    const visible = parts;
    sel = Math.max(0, Math.min(sel, visible.length - 1));
    const cur = visible[sel];
    const body = !cur ? empty() : cur.status === "compared" ? compare(cur) : cur.status === "waiting" ? waiting(cur) : nodata(cur);
    host.innerHTML = `<div class="ba-board">${side(visible)}<section class="panel in stack" aria-label="Comparação" style="padding:22px 24px;gap:12px;min-height:560px">${body}</section></div>`;
    host.querySelectorAll("[data-ba]").forEach((b) => b.addEventListener("click", () => { sel = Number(b.dataset.ba); paint(); }));
  }

  return {
    async mount(container) {
      host = container;
      host.innerHTML = `<section class="panel pad in muted">Lendo as anotações do Diário…</section>`;
      try { parts = await Bridge.call("get_before_after"); } catch (error) { parts = []; }
      sel = 0;
      paint();
    },
  };
})();
