/* Meu computador: nível do PC, pontos de atenção e as peças identificadas. */
App.register("computer", (() => {
  const root = () => document.getElementById("page-computer");
  let refreshing = false;
  let editing = null;

  /* ---------- Ficha do pato: peças de um lado, pato no meio, peças do outro ---------- */
  const TONE = { ok: "var(--acc-text)", warn: "var(--warn)", crit: "var(--crit)", none: "var(--faint)" };

  function segs(pct, tone) {
    const on = Math.round(pct / 10);
    return `<div class="segs" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<span style="background:${i < on ? TONE[tone] : "var(--track)"}"></span>`).join("")}</div>`;
  }

  function slot(side, o) {
    const empty = !!o.empty;
    return `<article class="slot ${side} ${empty ? "empty" : ""} in" style="--tone:${TONE[o.tone]};animation-delay:${o.delay || 0}ms">
      <div class="row" style="gap:10px"><span class="icon-tile">${icon(o.icon, 19, 1.7)}</span><span class="muted" style="flex:1;font-weight:600">${esc(o.label)}</span>
        <span class="slot-state" style="color:${TONE[o.tone]}">${esc(o.state)}</span></div>
      <span class="display slot-value" style="${empty ? "color:var(--muted)" : ""}">${esc(o.value)}</span>
      ${o.pct != null ? segs(o.pct, o.tone) : ""}
      ${o.form || `<span class="faint" style="font-size:13px">${esc(o.meta)}</span>`}
      ${o.button || ""}</article>`;
  }

  function useTone(pct, warnAt, critAt) { return pct >= critAt ? "crit" : pct >= warnAt ? "warn" : "ok"; }

  function manualSlot(part, iconName, label, value, isManual, hint, placeholder, delay) {
    const unknown = isUnknown(value) && !isManual;
    if (editing === part) {
      return slot("right", { icon: iconName, label, state: "…", tone: "none", value: unknown ? "Slot vazio" : value, empty: unknown, delay: 0,
        form: `<form class="stack in" data-manual-form="${part}" style="gap:8px"><input class="input" name="model" value="${isManual ? esc(value) : ""}" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="Modelo">
          <div class="row" style="gap:8px"><button type="submit" class="pill-btn" style="min-height:34px">Salvar</button><button type="button" class="pill-btn ghost" style="min-height:34px" data-manual-cancel>Cancelar</button></div></form>` });
    }
    return slot("right", { icon: iconName, label, state: unknown ? "?" : isManual ? "Você" : "OK", tone: unknown ? "none" : "ok", value: unknown ? "Slot vazio" : value, empty: unknown, delay,
      meta: unknown ? hint : isManual ? "Modelo informado por você." : "Modelo identificado pelo sistema.",
      button: `<button type="button" class="pill-btn ghost" data-manual-edit="${part}" style="align-self:flex-start;min-height:32px;padding:0 12px;font-size:13px">${unknown ? "+ Encaixar modelo" : isManual ? "Alterar modelo" : "Corrigir modelo"}</button>` });
  }

  function leftSlots(hw) {
    const cores = hw.sistema.physical_cpu_cores, threads = hw.sistema.logical_cpu_cores;
    const ram = hw.memoria;
    const list = [
      slot("left", { icon: "cpu", label: "Processador", state: hw.processador_parcial ? "Parcial" : "OK", tone: hw.processador_parcial ? "warn" : "ok", value: hw.processador, pct: cores ? Math.min(100, cores * 12) : null,
        meta: `${cores ? `${cores} núcleos · ${threads} threads` : ""}${hw.processador_parcial ? " · modelo exato não informado" : ""}`, delay: 80 }),
      slot("left", { icon: "ram", label: "Memória RAM", state: ram.usage_percent >= 90 ? "Cheia" : ram.usage_percent >= 80 ? "Alta" : "OK", tone: useTone(ram.usage_percent, 80, 90),
        value: `${fmt(ram.total_gb)} GB`, pct: ram.usage_percent, meta: `${fmt(ram.usage_percent)}% em uso · sobram ${fmt(ram.available_gb)} GB`, delay: 140 }),
    ];
    (hw.discos_detalhes || []).forEach((disk, index) => list.push(slot("left", { icon: "disk", label: `Disco ${disk.device}`, state: disk.percent >= 90 ? "Cheio" : disk.percent >= 85 ? "Apertado" : "OK",
      tone: useTone(disk.percent, 85, 90), value: `${fmt(disk.total_gb)} GB`, pct: disk.percent, meta: `${fmt(disk.percent)}% usado · ${fmt(disk.free_gb)} GB livres`, delay: 200 + index * 40 })));
    return list.join("");
  }

  function rightSlots(hw) {
    const manual = hw.informado_manualmente || {};
    const type = hw.tipo_de_maquina === "notebook" ? "Notebook" : "Desktop";
    return manualSlot("gpu", "gpu", "Placa de vídeo", hw.placas_de_video, manual.gpu, "O Windows não informou o modelo. Sem ele, o consultor não avalia vídeo.", "Ex.: GTX 1650, RX 580", 120)
      + manualSlot("mb", "mb", "Placa-mãe", hw.placa_mae, manual.mb, "Ela define o que é compatível com o seu PC.", "Ex.: ASUS PRIME H310M", 180)
      + slot("right", { icon: "monitor", label: "Sistema", state: "OK", tone: "ok", value: type, meta: `${hw.sistema.operating_system} · ${hw.sistema.architecture} · leitura ${hw.lido_em}`, delay: 240 });
  }

  function center(hw) {
    const level = hw.nivel;
    const first = (hw.pontos_de_atencao || []).find((item) => item.kind === "warn") || (hw.pontos_de_atencao || [])[0];
    const next = level.index < 4 ? LEVEL_NAMES[level.index + 1] : null;
    return `<div class="duck-stage in" style="animation-delay:40ms">
      <div class="stack" style="align-items:center;gap:2px;text-align:center"><span class="faint" style="font-weight:600">Nível do seu PC · ${level.index + 1} de 5</span>
        <span class="display" style="font-size:clamp(40px,5vw,56px);font-weight:800;line-height:1.05;letter-spacing:-.02em">${esc(level.name)}</span>
        <span class="muted" style="max-width:420px">${esc(level.text)}</span></div>
      <div class="duck-ring"><span class="ring-dash" aria-hidden="true"></span><span class="ring-glow" aria-hidden="true"></span>
        <div class="bob" style="position:relative;z-index:1" role="img" aria-label="${esc(level.name)}, o nível atual do PC">${levelIcon(level.index, 230, 184)}</div>
        ${first ? `<div class="bubble"><b class="display" style="display:block">Quack!</b><span>${esc(first.text)}</span></div>` : ""}</div>
      <div class="row wrap" style="gap:10px;justify-content:center">
        ${next ? `<button type="button" class="pill-btn" data-go="simulator">Ver como virar ${esc(next)}${icon("arrow", 16)}</button>` : ""}
        <button type="button" class="pill-btn ghost" id="refresh-hw" ${refreshing ? "disabled" : ""}><span class="${refreshing ? "spin" : ""}" style="display:flex">${icon("refresh", 16)}</span>${refreshing ? "Mergulhando…" : "Ler de novo"}</button></div></div>`;
  }

  function journey(level) {
    const current = level.index;
    const left = 4 - current;
    return `<section class="journey in" aria-label="Do ovo ao cisne" style="animation-delay:260ms">
      <div class="stack" style="gap:0;min-width:150px"><b class="display" style="font-size:16px">Do ovo ao cisne</b>
        <span class="faint" style="font-size:12.5px">${left > 0 ? `Faltam ${left} ${left === 1 ? "nível" : "níveis"} para o Cisne` : "Você chegou ao Cisne!"}</span></div>
      <ol class="steps"><li aria-hidden="true" class="track"></li><li aria-hidden="true" class="track fill" style="width:calc((100% - 44px) * ${current / 4})"></li>
        ${LEVEL_NAMES.map((name, i) => `<li class="step ${i < current ? "done" : i === current ? "now" : i === current + 1 ? "next" : ""}"><span class="dot"><b>${i + 1}</b></span><span>${esc(name)}</span></li>`).join("")}</ol></section>`;
  }

  function insights(list) {
    if (!list.length) return "";
    return `<section class="stack" style="gap:12px" aria-label="Pontos de atenção">
      <h2 class="label in" style="margin:0">Pontos de atenção</h2>
      <div class="grid auto-260">${list.map((item, index) => {
        const action = item.action
          ? linkGo(item.action.label, `data-go="${esc(item.action.page)}" ${item.action.part ? `data-part="${esc(item.action.part)}"` : ""}`)
          : "";
        return `<div class="panel hoverable in" style="animation-delay:${60 + index * 60}ms;padding:16px 18px;display:flex;gap:14px;align-items:flex-start">
          <span class="icon-tile ${item.kind === "warn" ? "warn" : ""}" style="width:38px;height:38px">${icon(item.kind === "warn" ? "warn" : "info", 20, 1.9)}</span>
          <div class="stack" style="gap:4px;min-width:0">
            <span style="font-size:16px;font-weight:600">${esc(item.title)}</span>
            <span class="muted" style="font-size:14px">${esc(item.text)}</span>${action}
          </div></div>`;
      }).join("")}</div></section>`;
  }

  function render() {
    const hw = App.state.hardware;
    if (!hw) {
      root().innerHTML = pageHeader("VISÃO GERAL", "Seu computador", "Lendo informações do computador…") + `<div class="panel pad muted in">Lendo as peças do computador…</div>`;
      return;
    }
    root().innerHTML = `<div class="pc-board"><div class="pc-col">${leftSlots(hw)}</div>${center(hw)}<div class="pc-col">${rightSlots(hw)}</div></div>
      ${journey(hw.nivel)}${insights(hw.pontos_de_atencao || [])}
      <div class="row" style="justify-content:center">${linkGo("O que é cada peça?", `data-go="guide"`)}</div>`;
    bind();
  }

  function bind() {
    const refresh = document.getElementById("refresh-hw");
    if (refresh) refresh.addEventListener("click", async () => {
      refreshing = true;
      render();
      const loaded = await App.loadHardware(true);
      refreshing = false;
      render();
      if (loaded) App.toast("Leitura atualizada.");
    });
    root().querySelectorAll("[data-manual-edit]").forEach((button) => button.addEventListener("click", () => {
      editing = button.dataset.manualEdit;
      render();
      const input = root().querySelector(`[data-manual-form="${editing}"] input`);
      if (input) input.focus();
    }));
    root().querySelectorAll("[data-manual-cancel]").forEach((button) => button.addEventListener("click", () => { editing = null; render(); }));
    root().querySelectorAll("[data-manual-form]").forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const part = form.dataset.manualForm;
      const model = form.elements.model.value.trim();
      App.state.hardware = await Bridge.call("set_manual_part", part, model);
      editing = null;
      App.emit("hardware", App.state.hardware);
      App.toast(model ? "Modelo salvo. Obrigado!" : "Modelo removido.");
    }));
  }

  return {
    init() {
      App.on("hardware", () => { if (!refreshing) render(); });
      render();
    },
    show() {},
  };
})());
