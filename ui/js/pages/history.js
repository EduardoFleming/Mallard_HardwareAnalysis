/* Histórico: cada análise é uma pegada na trilha, com antes e depois e as conquistas. */
App.register("history", (() => {
  const root = () => document.getElementById("page-history");
  let entries = [];
  let selected = null;
  let confirmDelete = false;

  function when(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }
  function title(e) {
    const p = e.preferencias || {};
    const focus = p.foco_de_jogos || p.foco_de_trabalho_ou_uso_domestico || "";
    return [e.perfil, focus.replace(/\s*\(.*\)$/, "")].filter(Boolean).join(" · ");
  }
  function systemDisk(e) {
    const disks = (e.pecas && e.pecas.discos) || [];
    return disks[0] || null;
  }

  function achievements() {
    const s = App.state.settings || {};
    const tried = (s.tried_themes || []).filter((t) => t !== "patinho").length;
    const got = s.achievements || {};
    const list = [
      { on: entries.length > 0, name: "Primeiro mergulho", desc: "Fez a primeira análise", art: `<span style="display:flex;transform:rotate(-35deg)">${levelIcon(3, 34, 26)}</span>` },
      { on: !!got.ninho, name: "Ninho arrumado", desc: "Deixou o disco abaixo de 80%", art: `<span style="display:flex;color:var(--acc-text)">${icon("broom", 24)}</span>` },
      { on: tried >= 5, name: "Bando completo", desc: `Testou os 5 patos (${Math.min(5, tried)}/5)`, art: `<span class="row" style="gap:2px">${THEMES.map((t) => `<span style="width:7px;height:7px;border-radius:50%;background:${t.plume}"></span>`).join("")}</span>` },
      { on: !!got.cisne, name: "Virou cisne", desc: "Fez todos os upgrades recomendados", art: swanIcon(34, 27) },
      s.unlocked_1972
        ? { on: true, name: "Skin Patinho Feio", desc: "Desbloqueou o tema retrô verde de 1972", art: `<span style="width:40px;height:40px;border-radius:50%;background:#041207;color:#33FF66;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600">1972</span>` }
        : { on: false, name: "???", desc: "Skin secreta · tema retrô de 1972", art: `<span class="display" style="font-size:20px;font-weight:700;color:var(--muted)">?</span>` },
    ];
    const count = list.filter((a) => a.on).length;
    return `<section class="panel pad in" aria-label="Conquistas" style="animation-delay:40ms;display:flex;flex-direction:column;gap:14px">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap"><h2 class="section-title row" style="gap:8px;font-size:20px"><span style="color:var(--acc-text);display:flex">${icon("trophy", 20)}</span>Conquistas</h2>
        <span class="num muted" style="font-size:15px;font-weight:700">${count} de 5 desbloqueadas</span></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">${list.map((a) => `
        <div class="row" style="gap:12px;padding:12px;border-radius:8px;background:var(--s0);border:1px solid ${a.on ? "var(--acc-text)" : "var(--line)"};opacity:${a.on ? 1 : 0.55}">
          <span style="width:48px;height:48px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--s3);filter:${a.on ? "none" : "grayscale(1)"}">${a.art}</span>
          <span class="stack" style="gap:2px;min-width:0"><span style="font-weight:600">${a.name}</span><span class="faint" style="font-size:13px;line-height:1.35">${a.desc}</span></span>
        </div>`).join("")}</div></section>`;
  }

  function trail() {
    return `<section aria-label="Trilha de análises" style="flex:1 1 380px;min-width:0;display:flex;flex-direction:column">
      ${entries.map((e, i) => {
        const on = e.id === selected;
        const w = when(e.data);
        const r = e.resultado || {};
        const tag = r.main_bottleneck ? `<span class="tag warn" style="align-self:flex-start">Gargalo: ${esc(r.main_bottleneck)}</span>` : `<span class="tag" style="align-self:flex-start">Sem gargalo claro</span>`;
        return `<div class="row" style="align-items:stretch;gap:10px">
          <div aria-hidden="true" style="position:relative;width:70px;flex-shrink:0;display:flex;justify-content:center">
            <span style="position:absolute;left:34px;top:${i === 0 ? "36px" : "0"};bottom:${i === entries.length - 1 ? "calc(100% - 36px)" : "0"};border-left:2px dashed var(--line2)"></span>
            <span style="position:relative;margin-top:18px;margin-left:${i % 2 ? "18px" : "-18px"};width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bg);color:${on ? "var(--acc-text)" : "var(--muted)"};transform:rotate(${i % 2 ? 14 : -14}deg) scale(${on ? 1.15 : 1});transition:color .25s, transform .3s cubic-bezier(.2,.8,.2,1)">${footprint(26)}</span>
          </div>
          <button type="button" data-entry="${e.id}" aria-pressed="${on}" class="panel in" style="animation-delay:${80 + i * 40}ms;flex:1;min-width:0;margin-bottom:12px;text-align:left;cursor:pointer;color:var(--text);padding:16px 18px;display:flex;flex-direction:column;gap:6px;border-color:${on ? "var(--acc-text)" : "var(--line)"};background:${on ? "var(--acc-soft)" : "var(--s1)"}">
            <span class="row num faint" style="justify-content:space-between;font-size:14px;font-weight:600"><span>${w.date}</span><span>${w.time}</span></span>
            <span class="display" style="font-size:17px;font-weight:700">${esc(title(e))}</span>
            <span class="muted" style="font-size:13px">Nível: ${LEVEL_NAMES[r.level_now ?? 1]}</span>${tag}
          </button></div>`;
      }).join("")}</section>`;
  }

  function beforeAfter(current, previous) {
    if (!previous) return `<span class="faint" style="font-size:14px">Primeira pegada da trilha: ainda não há com o que comparar.</span>`;
    const pct = (v) => (v === null || v === undefined ? "—" : `${fmt(v)}%`);
    const delta = (a, b) => {
      if (a == null || b == null) return ["Sem dado", "var(--muted)"];
      const d = b - a;
      if (Math.abs(d) < 0.05) return ["Igual", "var(--muted)"];
      return [`${d > 0 ? "+" : "−"}${fmt(Math.abs(d))} ponto · ${d > 0 ? "piorou" : "melhorou"}`, d > 0 ? "var(--warn)" : "var(--acc-text)"];
    };
    const dA = systemDisk(previous), dB = systemDisk(current);
    const lvA = (previous.resultado || {}).level_now ?? 1, lvB = (current.resultado || {}).level_now ?? 1;
    const samePerfil = previous.perfil === current.perfil;
    const cards = [
      ["Memória em uso", pct(previous.pecas.memoria_uso_percent), pct(current.pecas.memoria_uso_percent), ...delta(previous.pecas.memoria_uso_percent, current.pecas.memoria_uso_percent)],
      ["Disco do sistema", pct(dA && dA.percent), pct(dB && dB.percent), ...delta(dA && dA.percent, dB && dB.percent)],
      ["Nível", LEVEL_NAMES[lvA], LEVEL_NAMES[lvB], lvA === lvB ? "Mesmo nível" : !samePerfil ? "Perfis diferentes" : lvB > lvA ? "Subiu" : "Desceu", "var(--muted)"],
    ];
    return `<span class="label" style="font-size:12px">Antes e depois · comparado a ${when(previous.data).date}</span>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">${cards.map(([k, a, b, note, color]) => `
        <div class="stack" style="gap:4px;padding:12px 14px;border-radius:6px;background:var(--s0)">
          <span class="faint" style="font-size:13px">${k}</span><span class="num" style="font-size:18px;font-weight:700">${a} → ${b}</span>
          <span style="font-size:13px;font-weight:600;color:${color}">${note}</span></div>`).join("")}</div>`;
  }

  function detail() {
    const index = entries.findIndex((e) => e.id === selected);
    const e = entries[index];
    const r = e.resultado || {};
    const w = when(e.data);
    const done = e.feitos || [];
    return `<section class="panel pad in" aria-label="Detalhes da análise" style="animation-delay:140ms;flex:999 1 440px;min-width:0;display:flex;flex-direction:column;gap:18px;align-self:flex-start">
      <div class="stack" style="gap:6px"><span class="num faint" style="font-size:14px;font-weight:600">${w.date} · ${w.time}</span>
        <h2 class="display" style="margin:0;font-size:26px;font-weight:700;line-height:1.15">${esc(title(e))}</h2></div>
      <div class="stack" style="gap:6px"><span class="label" style="font-size:12px">Veredito</span><p style="margin:0;font-size:16px">${esc(r.verdict)}</p></div>
      <div class="stack" style="gap:8px">${beforeAfter(e, entries[index + 1])}</div>
      <div class="stack" style="gap:8px"><span class="label" style="font-size:12px">Recomendações daquela vez</span>
        ${(r.recommendations || []).map((rec, i) => `<div class="row" style="gap:12px;padding:10px 14px;border-radius:6px;background:var(--s0)">
          <span class="num faint" style="font-size:18px;font-weight:700">0${i + 1}</span><span style="flex:1">${esc(rec.component)}: ${esc(rec.suggestion)}</span>
          ${done[i] ? `<span class="tag acc">${icon("check", 13, 2.6)} Feito</span>` : ""}</div>`).join("") || `<span class="faint">Nenhum upgrade recomendado.</span>`}</div>
      <div class="row wrap" style="gap:10px;margin-top:4px">
        <button type="button" class="btn btn-primary" id="hist-open">Abrir relatório</button>
        <button type="button" class="btn btn-secondary" data-go="advisor">${icon("refresh", 17)}Refazer análise</button>
        ${confirmDelete
          ? `<span class="row" style="gap:8px;margin-left:auto"><span class="muted" style="font-size:14px">Apagar esta pegada?</span>
              <button type="button" class="btn btn-primary btn-sm" id="hist-del-yes">Apagar</button><button type="button" class="btn btn-secondary btn-sm" id="hist-del-no">Não</button></span>`
          : `<button type="button" class="btn btn-secondary" id="hist-del" aria-label="Apagar esta análise" style="margin-left:auto;width:46px;padding:0;color:var(--crit)">${icon("trash", 18)}</button>`}
      </div></section>`;
  }

  function render() {
    const right = entries.length
      ? `<span class="row num" style="gap:10px;min-height:36px;padding:0 14px;border-radius:999px;background:var(--s1);border:1px solid var(--line);font-size:15px;font-weight:700;color:var(--text2)"><span style="color:var(--acc-text);display:flex">${footprint(18)}</span>${entries.length} ${entries.length === 1 ? "pegada" : "pegadas"} desde ${when(entries[entries.length - 1].data).date}</span>`
      : "";
    const body = entries.length
      ? `<div class="row" style="flex-wrap:wrap;gap:20px;align-items:flex-start">${trail()}${detail()}</div>`
      : `<section class="panel pad in stack" style="align-items:center;text-align:center;gap:12px;padding:40px">
          <span style="color:var(--muted);display:flex;gap:10px">${footprint(30)}${footprint(30)}</span>
          <h2 class="section-title">Ainda não há pegadas</h2>
          <span class="muted">Cada análise do Consultor vira uma pegada aqui, para você comparar o antes e o depois.</span>
          <button type="button" class="btn btn-primary" data-go="advisor">Fazer a primeira análise</button></section>`;
    root().innerHTML = pageHeader("TRILHA", "Histórico de análises", "Cada pegada é uma consulta ao Mallard. Clique para rever.", right) + achievements() + body;
    root().querySelectorAll("[data-entry]").forEach((b) => b.addEventListener("click", () => { selected = b.dataset.entry; confirmDelete = false; render(); }));
    const openBtn = document.getElementById("hist-open");
    if (openBtn) openBtn.addEventListener("click", () => App.go("result", { id: selected }));
    const del = document.getElementById("hist-del");
    if (del) del.addEventListener("click", () => { confirmDelete = true; render(); });
    const no = document.getElementById("hist-del-no");
    if (no) no.addEventListener("click", () => { confirmDelete = false; render(); });
    const yes = document.getElementById("hist-del-yes");
    if (yes) yes.addEventListener("click", async () => {
      entries = await Bridge.call("delete_analysis", selected);
      selected = entries[0] ? entries[0].id : null;
      confirmDelete = false;
      render();
      App.toast("Pegada apagada.");
    });
  }

  async function load() {
    const [history, settings] = await Promise.all([
      Bridge.call("get_history"),
      Bridge.call("get_settings"),
    ]);
    entries = history;
    App.state.settings = settings;
    if (!entries.some((e) => e.id === selected)) selected = entries[0] ? entries[0].id : null;
    render();
  }

  return {
    init() { App.on("history-changed", () => { if (App.state.page === "history") load(); }); },
    show() { confirmDelete = false; load(); },
  };
})());
