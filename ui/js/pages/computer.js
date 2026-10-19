/* Meu computador: nível do PC, pontos de atenção e as peças identificadas. */
App.register("computer", (() => {
  const root = () => document.getElementById("page-computer");
  let refreshing = false;
  let editing = null;

  function header(hardware) {
    const subtitle = hardware
      ? `Componentes identificados neste equipamento · leitura das ${esc(hardware.lido_em)}`
      : "Lendo informações do computador…";
    const button = `<button type="button" class="btn btn-secondary" id="refresh-hw" ${refreshing ? "disabled" : ""}>
      <span class="${refreshing ? "spin" : ""}" style="display:flex">${icon("refresh", 18)}</span>${refreshing ? "Mergulhando nas peças…" : "Atualizar componentes"}</button>`;
    return pageHeader("VISÃO GERAL", "Seu computador", subtitle, button);
  }

  function levelTrack(current) {
    const next = current > 0 && current < 4 ? current + 1 : null;
    return `<div class="row" style="align-items:flex-end;gap:4px;flex-wrap:wrap">${LEVEL_NAMES.map((name, index) => {
      const isCurrent = index === current;
      const isNext = index === next;
      const visible = index <= current || isNext;
      const border = isCurrent ? "1.5px solid var(--acc-text)" : isNext ? "1.5px dashed var(--acc-text)" : "1.5px solid transparent";
      const step = `<div class="stack" style="align-items:center;gap:6px;min-width:62px;opacity:${visible ? 1 : 0.38}">
        <span style="display:flex;align-items:center;justify-content:center;width:58px;height:50px;border-radius:8px;border:${border};background:${isCurrent ? "var(--acc-soft)" : "transparent"}">${levelIcon(index)}</span>
        <span style="font-size:13px;font-weight:${isCurrent ? 700 : 500};color:${visible ? "var(--text)" : "var(--muted)"}">${name}</span>
        <span class="num" style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--acc-text);height:13px">${isCurrent ? "VOCÊ ESTÁ AQUI" : isNext ? "PRÓXIMO" : ""}</span>
      </div>`;
      const line = index < LEVEL_NAMES.length - 1
        ? `<span aria-hidden="true" style="flex:1 1 10px;max-width:34px;height:2px;margin-bottom:47px;background:${index < current ? "var(--acc)" : "var(--line2)"}"></span>`
        : "";
      return step + line;
    }).join("")}</div>`;
  }

  function levelCard(level) {
    return `<section class="panel pad in" style="animation-delay:40ms;display:flex;flex-wrap:wrap;gap:20px 36px;align-items:center">
      <div class="stack" style="flex:1 1 300px;min-width:0">
        <span class="label">Nível do seu PC</span>
        <span class="display" style="font-size:30px;font-weight:700;line-height:1">${esc(level.name)}</span>
        <p class="muted" style="margin:0">${esc(level.text)}${level.next_hint ? ` ${esc(level.next_hint)}` : ""}</p>
        <span class="faint" style="font-size:13px">Estimativa rápida. O Consultor de upgrades faz a análise completa.</span>
      </div>
      <div style="flex:2 1 440px;min-width:0">${levelTrack(level.index)}</div>
    </section>`;
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

  function cardHead(iconName, label, tag = "") {
    return `<div class="row"><span class="icon-tile">${icon(iconName, 19, 1.7)}</span><h3 class="label" style="margin:0">${esc(label)}</h3>${tag ? `<span style="margin-left:auto">${tag}</span>` : ""}</div>`;
  }

  function cpuCard(hw, delay) {
    const cores = hw.sistema.physical_cpu_cores;
    const threads = hw.sistema.logical_cpu_cores;
    const tag = hw.processador_parcial ? `<span class="tag warn-line">Identificação parcial</span>` : "";
    const note = hw.processador_parcial
      ? "O Windows informou só a família do processador; o modelo exato (como i5 ou i7) não apareceu."
      : "Modelo informado pelo sistema.";
    return `<article class="panel pad hoverable in" style="animation-delay:${delay}ms;display:flex;flex-direction:column;gap:14px">
      ${cardHead("cpu", "Processador", tag)}
      <span class="display" style="font-size:21px;font-weight:700;line-height:1.2">${esc(hw.processador)}</span>
      ${cores ? `<div class="row wrap"><span class="tag">${cores} núcleos</span><span class="tag">${threads} threads</span></div>` : ""}
      <span class="muted" style="font-size:14px;margin-top:auto">${note}</span>
    </article>`;
  }

  function ramCard(hw, delay) {
    const ram = hw.memoria;
    const usage = ram.usage_percent;
    const level = usage >= 90 ? "crit" : usage >= 80 ? "warn" : "";
    const details = String(hw.detalhes_modulos_ram || "");
    return `<article class="panel pad hoverable in" style="animation-delay:${delay}ms;display:flex;flex-direction:column;gap:14px">
      ${cardHead("ram", "Memória", `<span class="tag ${level ? "warn" : ""}">${fmt(usage)}% em uso</span>`)}
      <div class="row" style="align-items:baseline;gap:6px"><span class="num" style="font-size:44px;font-weight:700;line-height:.9">${fmt(ram.total_gb)}</span><span class="num faint" style="font-size:18px;font-weight:700">GB</span></div>
      <div class="bar ${level === "crit" ? "warn" : level}"><span style="width:0" data-width="${usage}%"></span></div>
      <span class="muted" style="font-size:14px;margin-top:auto">${esc(details.endsWith(".") ? details : details + ".")}</span>
    </article>`;
  }

  function diskCard(disk, delay) {
    const level = disk.percent >= 85 ? "warn" : "";
    return `<article class="panel pad hoverable in" style="animation-delay:${delay}ms;display:flex;flex-direction:column;gap:14px">
      ${cardHead("disk", "Armazenamento", `<span class="tag ${level}">${fmt(disk.percent)}% usado</span>`)}
      <div class="row" style="align-items:baseline;gap:8px"><span class="num faint" style="font-size:20px;font-weight:700">${esc(disk.device)}</span><span class="num" style="font-size:44px;font-weight:700;line-height:.9">${fmt(disk.total_gb)}</span><span class="num faint" style="font-size:18px;font-weight:700">GB</span></div>
      <div class="bar ${level}"><span style="width:0" data-width="${disk.percent}%"></span></div>
      <span class="muted" style="font-size:14px;margin-top:auto">${fmt(disk.free_gb)} GB livres.</span>
      ${linkGo("O que é armazenamento?", `data-go="guide" data-part="disk"`)}
    </article>`;
  }

  function manualCard(part, iconName, label, value, isManual, hint, placeholder, delay) {
    const unknown = isUnknown(value) && !isManual;
    const tag = isManual ? `<span class="tag acc">Informado por você</span>` : unknown ? `<span class="tag">Não identificada</span>` : "";
    const form = editing === part
      ? `<form class="row wrap in" data-manual-form="${part}" style="align-items:flex-end;gap:8px">
          <label class="stack" style="gap:6px;flex:1 1 200px;min-width:0"><span class="muted" style="font-size:13px;font-weight:600">Modelo</span>
            <input class="input" name="model" value="${isManual ? esc(value) : ""}" placeholder="${esc(placeholder)}" autocomplete="off"></label>
          <button type="submit" class="btn btn-primary">Salvar</button>
          <button type="button" class="btn btn-secondary" data-manual-cancel>Cancelar</button>
        </form>`
      : `<span class="muted" style="font-size:14px">${esc(unknown ? hint : isManual ? "Modelo informado por você. Altere se estiver errado." : "Modelo identificado pelo sistema.")}</span>
         <button type="button" class="btn btn-secondary btn-sm" data-manual-edit="${part}" style="align-self:flex-start;margin-top:auto">${icon("edit", 16)}${isManual ? "Alterar modelo" : unknown ? "Informar modelo" : "Corrigir modelo"}</button>`;
    return `<article class="panel pad ${unknown ? "dashed" : "hoverable"} in" style="animation-delay:${delay}ms;display:flex;flex-direction:column;gap:14px">
      ${cardHead(iconName, label, tag)}
      <span class="display" style="font-size:21px;font-weight:700;line-height:1.2;color:${unknown ? "var(--muted)" : "var(--text)"}">${unknown ? "Não identificada" : esc(value)}</span>
      ${form}
    </article>`;
  }

  function render() {
    const hw = App.state.hardware;
    if (!hw) {
      root().innerHTML = header(null) + `<div class="panel pad muted in">Lendo as peças do computador…</div>`;
      bind();
      return;
    }
    const manual = hw.informado_manualmente || {};
    const cards = [cpuCard(hw, 220), ramCard(hw, 280)]
      .concat((hw.discos_detalhes || []).map((disk, index) => diskCard(disk, 340 + index * 40)))
      .concat([
        manualCard("gpu", "gpu", "Placa de vídeo", hw.placas_de_video, manual.gpu, "Sem o modelo, o consultor não avalia upgrades de vídeo.", "Ex.: GTX 1650, RX 580", 420),
        manualCard("mb", "mb", "Placa-mãe", hw.placa_mae, manual.mb, "Ela define o que é compatível. Confira o modelo antes de comprar memória ou processador.", "Ex.: ASUS PRIME H310M", 480),
      ]);
    root().innerHTML = header(hw)
      + levelCard(hw.nivel)
      + insights(hw.pontos_de_atencao || [])
      + `<section class="stack" style="gap:12px" aria-label="Componentes">
          <div class="row in" style="justify-content:space-between;flex-wrap:wrap"><h2 class="label" style="margin:0">Componentes</h2>
            ${linkGo("O que é cada peça?", `data-go="guide"`)}</div>
          <div class="grid auto-300">${cards.join("")}</div>
        </section>`;
    bind();
    requestAnimationFrame(() => root().querySelectorAll("[data-width]").forEach((bar) => { bar.style.width = bar.dataset.width; }));
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
