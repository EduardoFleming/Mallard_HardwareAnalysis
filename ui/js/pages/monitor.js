/* Monitoramento: leituras a cada segundo, gráfico com linha d'água e o humor do pato. */
App.register("monitor", (() => {
  const root = () => document.getElementById("page-monitor");
  const $ = (id) => document.getElementById(id);
  const MAX = 60;
  const W = 600;
  const Y = (v) => 210 - Math.max(0, Math.min(100, v)) / 100 * 200;
  const LIMITS = { cpu: [75, 92], ram: [80, 95], gpu: [85, 96], disk: [85, 95] };

  let history = [];
  let timer = null;
  let paused = false;
  let active = false;
  let busy = false;
  let last = null;
  const shown = { cpu: true, ram: true, gpu: true };
  const disp = { cpu: 0, ram: 0, gpu: 0 };
  let tweenFrame = null;
  let waveDuration = null;

  function tone(value, [warn, crit]) {
    if (value >= crit) return { color: "var(--crit)", label: "Crítico", bar: "crit" };
    if (value >= warn) return { color: "var(--warn)", label: "Alto", bar: "warn" };
    return { color: "var(--ok)", label: "Normal", bar: "" };
  }

  function metricCard(key, iconName, title, delay) {
    return `<article class="panel pad hoverable in" style="animation-delay:${delay}ms;display:flex;flex-direction:column;gap:12px" id="card-${key}">
      <div class="row"><span class="icon-tile">${icon(iconName, 19, 1.7)}</span><h2 class="label" style="margin:0">${title}</h2>
        <span class="num" id="m-${key}-status" style="margin-left:auto;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">—</span></div>
      <div class="row" style="align-items:baseline;gap:4px"><span class="num" id="m-${key}-val" style="font-size:52px;font-weight:700;line-height:.9">—</span><span class="num faint" style="font-size:20px;font-weight:700" id="m-${key}-unit">%</span></div>
      <div class="bar" id="m-${key}-barwrap"><span id="m-${key}-bar" style="width:0"></span></div>
      <span class="muted" style="font-size:14px" id="m-${key}-sub">Aguardando leitura…</span>
    </article>`;
  }

  function skeleton() {
    const right = `<div class="row wrap" style="gap:10px">
      <span class="row num" style="gap:10px;min-height:36px;padding:0 14px;border-radius:999px;background:var(--s1);border:1px solid var(--line);font-size:14px;font-weight:700;letter-spacing:.08em">
        <span id="live-dot" class="live" style="width:8px;height:8px;border-radius:50%;background:var(--acc-text)"></span><span id="live-text">AO VIVO · 1 S</span></span>
      <button type="button" class="btn btn-secondary" id="pause-btn">${icon("pause", 16)}Pausar</button></div>`;
    const yLabels = [[10, "100%"], [60, "75%"], [110, "50%"], [160, "25%"], [210, "0%"]]
      .map(([y, t]) => `<span class="num faint" style="position:absolute;left:0;top:${y - 8}px;font-size:13px;font-weight:600">${t}</span>`).join("");
    const legend = (key, color, label) => `<button type="button" class="chip" data-series="${key}" aria-pressed="true" style="font-size:14px;min-height:36px;display:inline-flex;align-items:center;gap:8px">
      <span style="width:14px;height:3px;border-radius:2px;background:${color}"></span>${label}</button>`;

    root().innerHTML = pageHeader("ATIVIDADE", "Monitoramento", "Atualizado a cada segundo enquanto esta tela estiver aberta.", right) + `
      <div class="grid auto-230">
        ${metricCard("cpu", "cpu", "Processador", 60)}
        ${metricCard("ram", "ram", "Memória", 120)}
        <div id="gpu-slot" style="display:contents"></div>
        ${metricCard("disk", "disk", "Disco", 240)}
      </div>
      <div class="row" style="flex-wrap:wrap;gap:16px;align-items:stretch">
        <section class="panel in" style="animation-delay:300ms;flex:999 1 560px;min-width:0;padding:20px 22px 18px;display:flex;flex-direction:column;gap:16px">
          <div class="row" style="justify-content:space-between;flex-wrap:wrap;align-items:flex-start">
            <div class="stack" style="gap:4px"><h2 class="section-title" style="font-size:20px">Último minuto</h2>
              <span class="muted" style="font-size:14px">O pato boia no uso atual do processador. Quanto maior o uso, mais agitada a água.</span></div>
            <div class="row" style="gap:8px">${legend("cpu", "var(--acc-text)", "CPU")}${legend("ram", "var(--series2)", "Memória")}<span id="gpu-legend"></span></div>
          </div>
          <div class="row" style="gap:10px;align-items:stretch">
            <div style="position:relative;width:40px;height:220px;flex-shrink:0">${yLabels}</div>
            <div style="position:relative;flex:1;min-width:0;height:220px">
              <svg width="100%" height="220" viewBox="0 0 ${W} 220" preserveAspectRatio="none" role="img" aria-label="Gráfico de uso de processador e memória no último minuto" style="display:block;overflow:visible">
                <path d="M0 10H600M0 60H600M0 110H600M0 160H600M0 210H600" fill="none" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>
                <path id="a-ram" fill="var(--series2)" opacity="0.08"/>
                <path id="p-ram" fill="none" stroke="var(--series2)" stroke-width="2" vector-effect="non-scaling-stroke"/>
                <path id="p-gpu" fill="none" stroke="var(--warn)" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>
                <path id="a-cpu" fill="var(--acc-text)" opacity="0.1"/>
                <path id="p-cpu" fill="none" stroke="var(--acc-text)" stroke-width="2.25" vector-effect="non-scaling-stroke"/>
              </svg>
              <div aria-hidden="true" style="position:absolute;left:0;right:0;top:203px;height:22px;overflow:hidden;pointer-events:none">
                <div id="water" class="wave" style="width:200%;height:22px;animation-duration:5s">${waves()}</div></div>
              <span id="floater" aria-hidden="true" style="position:absolute;right:-20px;top:210px;width:40px;height:30px;margin-top:-25px;transition:top .9s linear;pointer-events:none;display:none">
                <span class="ripple" id="rip1" style="position:absolute;left:2px;top:22px;width:34px;height:9px;border-radius:50%;border:1.5px solid var(--acc-text);animation-duration:2s"></span>
                <span class="ripple" id="rip2" style="position:absolute;left:2px;top:22px;width:34px;height:9px;border-radius:50%;border:1.5px solid var(--acc-text);animation-duration:2s;animation-delay:1s"></span>
                <span class="bob" style="position:absolute;left:0;top:0;display:block">${duckMini()}</span></span>
            </div>
          </div>
          <div class="row num faint" style="justify-content:space-between;padding-left:50px;margin-top:8px;font-size:13px;font-weight:600"><span>-60 s</span><span>-30 s</span><span>agora</span></div>
        </section>
        <section class="panel in" aria-label="Humor do pato" style="animation-delay:340ms;flex:1 1 250px;min-width:0;padding:20px;display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center">
          <span class="label" style="align-self:flex-start">Como o pato está</span>
          <div aria-hidden="true" style="position:relative;width:190px;height:132px;margin-top:6px">
            <div class="bob" id="mascot" style="position:absolute;left:0;top:6px">${duckSide(180, 116)}</div>
            <span id="sweat" style="display:none">
              <span class="drip" style="position:absolute;left:112px;top:2px;width:7px;height:10px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:#6EC1FF"></span>
              <span class="drip" style="position:absolute;left:150px;top:10px;width:6px;height:9px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:#6EC1FF;animation-delay:.5s"></span></span>
            <span id="sleep" style="display:none">
              <span style="position:absolute;left:128px;top:27px;width:12px;height:7px;border-radius:0 0 7px 7px;background:var(--d-head);border-bottom:2px solid var(--d-eye)"></span>
              <span class="zz display" style="position:absolute;left:150px;top:6px;font-size:16px;font-weight:700;color:var(--acc-text)">z</span>
              <span class="zz display" style="position:absolute;left:162px;top:-6px;font-size:21px;font-weight:700;color:var(--acc-text);animation-delay:1.2s">z</span></span>
          </div>
          <span class="display" id="mood-title" style="font-size:20px;font-weight:700">Acordando…</span>
          <span class="muted" id="mood-text" style="font-size:14px">Esperando a primeira leitura.</span>
        </section>
      </div>
      <p class="faint in" id="monitor-note" style="margin:0;font-size:14px;animation-delay:360ms">Sensores disponíveis conforme o sistema e os drivers instalados.</p>`;

    $("pause-btn").addEventListener("click", togglePause);
    root().querySelectorAll("[data-series]").forEach(bindLegend);
  }

  function bindLegend(button) {
    button.addEventListener("click", () => {
      const key = button.dataset.series;
      shown[key] = !shown[key];
      button.setAttribute("aria-pressed", String(shown[key]));
      drawChart();
    });
  }

  function renderGpuSlot(gpu) {
    const available = gpu && gpu.usage !== null && gpu.usage !== undefined;
    const slot = $("gpu-slot");
    if (slot.dataset.mode === (available ? "on" : "off")) return;
    slot.dataset.mode = available ? "on" : "off";
    if (available) {
      slot.innerHTML = metricCard("gpu", "gpu", "Placa de vídeo", 180);
      $("gpu-legend").innerHTML = `<button type="button" class="chip" data-series="gpu" aria-pressed="${shown.gpu}" style="font-size:14px;min-height:36px;display:inline-flex;align-items:center;gap:8px">
        <span style="width:14px;height:3px;border-radius:2px;background:var(--warn)"></span>GPU</button>`;
      bindLegend($("gpu-legend").firstElementChild);
    } else {
      slot.innerHTML = `<article class="panel pad dashed in" style="animation-delay:180ms;display:flex;flex-direction:column;gap:12px">
        <div class="row"><span class="icon-tile" style="color:var(--muted)">${icon("gpuoff", 19, 1.7)}</span><h2 class="label" style="margin:0">Placa de vídeo</h2></div>
        <span style="font-size:17px;font-weight:600">Sensor indisponível</span>
        <span class="muted" style="font-size:14px">Uso e temperatura dependem de uma placa NVIDIA e de driver compatível.</span>
        ${linkGo("Informar modelo da placa", `data-go="computer"`)}
      </article>`;
      $("gpu-legend").innerHTML = "";
    }
  }

  function setMetric(key, value, sub) {
    const t = tone(value, LIMITS[key]);
    const status = $(`m-${key}-status`);
    if (!status) return;
    status.textContent = t.label;
    status.style.color = t.color;
    $(`m-${key}-bar`).style.width = `${Math.min(100, value)}%`;
    $(`m-${key}-barwrap`).className = `bar ${t.bar}`;
    $(`m-${key}-val`).style.color = t.bar === "crit" ? "var(--crit)" : "var(--text)";
    $(`m-${key}-sub`).textContent = sub;
  }

  function tweenTo(targets) {
    const from = { ...disp };
    const start = performance.now();
    cancelAnimationFrame(tweenFrame);
    const step = (now) => {
      const k = Math.min(1, (now - start) / 600);
      const e = 1 - Math.pow(1 - k, 3);
      Object.keys(targets).forEach((key) => {
        disp[key] = from[key] + (targets[key] - from[key]) * e;
        const el = $(`m-${key}-val`);
        if (el) el.textContent = fmt(disp[key]);
      });
      if (k < 1) tweenFrame = requestAnimationFrame(step);
    };
    tweenFrame = requestAnimationFrame(step);
  }

  function smoothPath(values, offset) {
    const points = values.map((v, i) => [((offset + i) / (MAX - 1)) * W, Y(v)]);
    if (points.length < 2) return "";
    let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
      const c = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]];
      d += " C" + c.map((n) => n.toFixed(1)).join(" ");
    }
    return d;
  }

  function drawChart() {
    const offset = MAX - history.length;
    const series = (key) => history.map((s) => s[key]);
    const set = (id, d, visible) => { const el = $(id); if (el) { el.setAttribute("d", d); el.style.display = visible ? "" : "none"; } };
    const area = (d) => d ? `${d} L${W} 210 L${(offset / (MAX - 1)) * W} 210 Z` : "";
    const cpu = smoothPath(series("cpu"), offset);
    const ram = smoothPath(series("ram"), offset);
    const gpuValues = history.filter((s) => s.gpu !== null);
    const gpu = gpuValues.length === history.length ? smoothPath(series("gpu"), offset) : "";
    set("p-cpu", cpu, shown.cpu); set("a-cpu", area(cpu), shown.cpu);
    set("p-ram", ram, shown.ram); set("a-ram", area(ram), shown.ram);
    set("p-gpu", gpu, shown.gpu);
    const floater = $("floater");
    if (history.length && shown.cpu) {
      floater.style.display = "block";
      floater.style.top = `${Y(history[history.length - 1].cpu).toFixed(1)}px`;
    } else {
      floater.style.display = "none";
    }
  }

  function updateWater(cpu) {
    const duration = Math.max(1.2, 7 - 5.8 * cpu / 100);
    if (waveDuration === null || Math.abs(duration - waveDuration) > 0.6) {
      waveDuration = duration;
      $("water").style.animationDuration = `${duration.toFixed(2)}s`;
      const ripple = Math.max(0.8, 2.4 - 1.6 * cpu / 100);
      $("rip1").style.animationDuration = `${ripple.toFixed(2)}s`;
      $("rip2").style.animationDuration = `${ripple.toFixed(2)}s`;
      $("rip2").style.animationDelay = `${(ripple / 2).toFixed(2)}s`;
    }
  }

  function updateMood(cpu) {
    let title, text;
    if (paused) { title = "Dormindo"; text = "Monitor pausado. O pato tirou um cochilo."; }
    else if (cpu >= 80) { title = "Suado"; text = "Uso alto! O pato está pedalando com tudo."; }
    else if (cpu >= 50) { title = "Atento"; text = "O PC está trabalhando. O pato pedala firme embaixo d'água."; }
    else { title = "Tranquilo"; text = "Uso baixo. O pato só está boiando."; }
    $("mood-title").textContent = title;
    $("mood-text").textContent = text;
    $("sweat").style.display = !paused && cpu >= 80 ? "" : "none";
    $("sleep").style.display = paused ? "" : "none";
    $("mascot").style.animationDuration = `${Math.max(0.6, 2.2 - 1.6 * cpu / 100).toFixed(2)}s`;
  }

  async function tick() {
    if (busy || paused || document.hidden) return;
    busy = true;
    try {
      const m = await Bridge.call("get_metrics");
      last = m;
      renderGpuSlot(m.gpu);
      const gpuOn = m.gpu && m.gpu.usage !== null && m.gpu.usage !== undefined;
      history.push({ cpu: m.cpu, ram: m.ram.percent, gpu: gpuOn ? m.gpu.usage : null });
      if (history.length > MAX) history.shift();

      setMetric("cpu", m.cpu, "Uso total do processador");
      setMetric("ram", m.ram.percent, `${fmt(m.ram.used_gb)} de ${fmt(m.ram.total_gb)} GB usados`);
      const targets = { cpu: m.cpu, ram: m.ram.percent };
      if (gpuOn) {
        setMetric("gpu", m.gpu.usage, m.gpu.temp !== null ? `${m.gpu.name} · ${m.gpu.temp} °C` : m.gpu.name);
        targets.gpu = m.gpu.usage;
      }
      if (m.disk) setMetric("disk", m.disk.percent, `${fmt(m.disk.free_gb)} GB livres de ${fmt(m.disk.total_gb)} GB (${m.disk.device})`);
      else $("m-disk-sub").textContent = "Volume do sistema indisponível";
      if (m.note) $("monitor-note").textContent = m.note;
      tweenTo(targets);
      drawChart();
      updateWater(m.cpu);
      updateMood(m.cpu);
    } catch (error) {
      $("monitor-note").textContent = `Não foi possível ler os sensores agora: ${error}`;
    } finally {
      busy = false;
    }
  }

  function togglePause() {
    paused = !paused;
    $("pause-btn").innerHTML = paused ? `${icon("play", 16)}Retomar` : `${icon("pause", 16)}Pausar`;
    $("live-text").textContent = paused ? "PAUSADO" : "AO VIVO · 1 S";
    $("live-dot").classList.toggle("live", !paused);
    $("live-dot").style.background = paused ? "var(--muted)" : "var(--acc-text)";
    ["water", "rip1", "rip2", "mascot"].forEach((id) => { $(id).style.animationPlayState = paused ? "paused" : "running"; });
    updateMood(last ? last.cpu : 0);
  }

  return {
    init() { skeleton(); },
    show() {
      active = true;
      history = [];
      tick();
      clearInterval(timer);
      timer = setInterval(tick, 1000);
    },
    hide() {
      active = false;
      clearInterval(timer);
      timer = null;
    },
  };
})());
