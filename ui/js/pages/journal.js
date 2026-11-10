/* Diário do PC: como o computador se comportou em cada dia da semana, em linguagem simples. */
App.register("journal", (() => {
  const root = () => document.getElementById("page-journal");
  let data = null;
  let week = 0;
  let sel = 0;

  const MOOD = {
    ok: ["Tranquilo", "ok", "var(--acc-text)"],
    atento: ["Atento", "warn", "var(--warn)"],
    dificil: ["Puxado", "warn", "var(--warn)"],
    travou: ["Travou", "crit", "var(--crit)"],
  };
  const KIND = { ok: "", warn: "warn", crit: "crit" };

  function dayChip(day, index) {
    if (day.future || day.empty) {
      return `<button type="button" class="day-chip" disabled aria-label="${esc(day.full)}: sem registro"><b>${esc(day.label)}</b><span class="faint" style="font-size:12px">${esc(day.short_date)}</span><span class="faint">—</span></button>`;
    }
    const [, , color] = MOOD[day.mood] || MOOD.ok;
    return `<button type="button" class="day-chip" data-day="${index}" aria-pressed="${index === sel}" aria-label="${esc(day.full)}: ${esc((MOOD[day.mood] || MOOD.ok)[0])}">
      <b>${esc(day.label)}${day.today ? " · hoje" : ""}</b><span class="faint" style="font-size:12px">${esc(day.short_date)}</span>
      <span class="num" style="font-size:20px;font-weight:700;color:${color}">${day.peak}%</span></button>`;
  }

  function dayDetail(day) {
    if (!day || !day.mood) return `<section class="panel dashed pad in" style="text-align:center"><span class="muted">Sem registro neste dia. O diário anota enquanto o Mallard está aberto.</span></section>`;
    const [name, tone] = MOOD[day.mood];
    return `<section class="panel pad in stack" style="gap:16px">
      <div class="row wrap" style="justify-content:space-between;gap:10px"><div class="stack" style="gap:2px"><span class="label">${esc(day.full)} · ${esc(day.short_date)}</span>
        <h2 class="display" style="margin:0;font-size:24px;font-weight:700">${esc(name)}</h2></div>
        <span class="pill ${tone}">Pico de memória: ${day.peak}%</span></div>
      <p style="margin:0;font-size:16px">${esc(day.story)}</p>
      ${day.events.length ? `<ul class="timeline">${day.events.map(([time, text, kind]) => `<li class="${KIND[kind] || ""}"><b class="num" style="min-width:48px">${esc(time)}</b><span>${esc(text)}</span></li>`).join("")}</ul>` : ""}
      <div class="tip">${icon("info", 16)}<span>${esc(day.tip)}</span></div></section>`;
  }

  function insights() {
    return `<section class="panel pad in stack" style="gap:12px"><h2 class="section-title">O que o diário percebeu</h2>${data.insights.map((item) => `
      <div class="check-row" style="align-items:flex-start;flex-direction:column;gap:6px"><div class="row" style="gap:8px"><span class="pill ${KIND[item.kind] === "" ? "ok" : KIND[item.kind] || "warn"}">${esc(item.title)}</span></div>
        <span class="muted" style="font-size:14px">${esc(item.text)}</span>
        ${item.action ? linkGo(item.action.label, `data-go="${esc(item.action.page)}"`) : ""}</div>`).join("")}</section>`;
  }

  function render() {
    if (!data) { root().innerHTML = pageHeader("DIÁRIO", "Diário do PC", "Lendo o diário…"); return; }
    const day = data.days[sel];
    root().innerHTML = pageHeader("DIÁRIO", "Diário do PC", "A história da sua semana: quando a memória encheu e o que isso causou.",
      `<div class="row" style="gap:8px"><button type="button" class="pill-btn ghost" id="jr-prev" aria-label="Semana anterior">${icon("back", 16)}</button>
        <span style="min-width:130px;text-align:center;font-weight:600">${esc(data.week_label.charAt(0).toUpperCase() + data.week_label.slice(1))}</span>
        <button type="button" class="pill-btn ghost" id="jr-next" aria-label="Semana seguinte" ${week === 0 ? "disabled" : ""}>${icon("arrow", 16)}</button></div>`) + `
      <div class="row" style="gap:8px;align-items:stretch">${data.days.map(dayChip).join("")}</div>
      <div class="two-col">${dayDetail(day)}${insights()}</div>
      ${data.has_data ? "" : `<p class="faint" style="margin:0;text-align:center">Ainda não há registros nesta semana.</p>`}`;
    root().querySelectorAll("[data-day]").forEach((button) => button.addEventListener("click", () => { sel = Number(button.dataset.day); render(); }));
    document.getElementById("jr-prev").addEventListener("click", () => load(week + 1));
    document.getElementById("jr-next").addEventListener("click", () => load(Math.max(0, week - 1)));
  }

  async function load(newWeek) {
    week = newWeek;
    try { data = await Bridge.call("get_journal", week); } catch (error) { data = { days: [], insights: [], week_label: "nesta semana", selected: 0, has_data: false }; }
    sel = data.selected || 0;
    if (App.state.page === "journal") render();
  }

  return { show() { render(); load(0); } };
})());
