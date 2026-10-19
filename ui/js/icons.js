/* Ícones (traço) e as ilustrações do pato usadas na interface. */
const ICONS = {
  "pad": "<rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"5\"></rect><path d=\"M6.5 12h4M8.5 10v4M15 11h.01M18 13h.01\"></path>",
  "case": "<rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"2\"></rect><path d=\"M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18\"></path>",
  "home": "<path d=\"M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z\"></path>",
  "trash": "<path d=\"M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3\"></path>",
  "printer": "<path d=\"M6 9V3h12v6\"></path><rect x=\"3\" y=\"9\" width=\"18\" height=\"8\" rx=\"1.5\"></rect><path d=\"M7 14h10v7H7z\"></path>",
  "monitor": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"2\"></rect><path d=\"M8 20h8M12 16v4\"></path>",
  "activity": "<path d=\"M3 12h4l3-7 4 14 3-7h4\"></path>",
  "spark": "<path d=\"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z\"></path><path d=\"M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z\"></path>",
  "gear": "<circle cx=\"12\" cy=\"12\" r=\"3\"></circle><path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\"></path>",
  "refresh": "<path d=\"M21 12a9 9 0 1 1-2.64-6.36\"></path><path d=\"M21 4v5h-5\"></path>",
  "warn": "<path d=\"M12 3l10 18H2z\"></path><path d=\"M12 10v5M12 18h.01\"></path>",
  "check": "<path d=\"M5 12l5 5 9-10\"></path>",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M12 11v5M12 8h.01\"></path>",
  "cpu": "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1.5\"></rect><rect x=\"9.5\" y=\"9.5\" width=\"5\" height=\"5\"></rect><path d=\"M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4\"></path>",
  "gpu": "<rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"1.5\"></rect><circle cx=\"9\" cy=\"12\" r=\"3\"></circle><circle cx=\"16.5\" cy=\"12\" r=\"2\"></circle><path d=\"M5 18v2M9 18v2\"></path>",
  "gpuoff": "<rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"1.5\"></rect><circle cx=\"9\" cy=\"12\" r=\"3\"></circle><path d=\"M3 3l18 18\"></path>",
  "ram": "<rect x=\"2\" y=\"7\" width=\"20\" height=\"10\" rx=\"1.5\"></rect><path d=\"M6 10v4M10 10v4M14 10v4M18 10v4M5 17v3M19 17v3\"></path>",
  "mb": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"1.5\"></rect><rect x=\"7\" y=\"7\" width=\"5\" height=\"5\"></rect><path d=\"M15 7h2M15 11h2M7 16h10\"></path>",
  "disk": "<rect x=\"2\" y=\"8\" width=\"20\" height=\"8\" rx=\"1.5\"></rect><path d=\"M6 12h6M17 12h.01\"></path>",
  "pause": "<path d=\"M9 5v14M15 5v14\"></path>",
  "play": "<path d=\"M7 5l12 7-12 7z\"></path>",
  "arrow": "<path d=\"M5 12h14M13 6l6 6-6 6\"></path>",
  "back": "<path d=\"M19 12H5M11 6l-6 6 6 6\"></path>",
  "ext": "<path d=\"M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5\"></path>",
  "chev": "<path d=\"M6 9l6 6 6-6\"></path>",
  "eye": "<path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>",
  "copy": "<rect x=\"9\" y=\"9\" width=\"12\" height=\"12\" rx=\"1.5\"></rect><path d=\"M5 15V5a2 2 0 0 1 2-2h10\"></path>",
  "edit": "<path d=\"M4 20h4L19 9l-4-4L4 16z\"></path>",
  "key": "<circle cx=\"8\" cy=\"15\" r=\"4\"></circle><path d=\"M11 12l9-9M17 6l3 3\"></path>",
  "book": "<path d=\"M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z\"></path><path d=\"M4 19V5M8 7h7M8 11h5\"></path>",
  "plug": "<path d=\"M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0z\"></path><path d=\"M12 18v4\"></path>",
  "thermo": "<path d=\"M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z\"></path>",
  "x": "<path d=\"M6 6l12 12M18 6L6 18\"></path>",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M12 7v5l3 2\"></path>",
  "broom": "<path d=\"M19 3l-7 7\"></path><path d=\"M9.5 9.5l5 5-2.5 6.5L3 12z\"></path><path d=\"M6 15l-2 2M9 18l-2 2\"></path>",
  "bell": "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"></path>",
  "download": "<path d=\"M12 3v12M7 10l5 5 5-5\"></path><path d=\"M5 21h14\"></path>",
  "trophy": "<path d=\"M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z\"></path><path d=\"M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4\"></path>"
};

function icon(name, size = 20, stroke = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${ICONS[name] || ""}</svg>`;
}

/* Logo: cabeça do pato-real com olho de pixel. As cores vêm do tema (--l-*). */
function logoSymbol(size = 40, radius = 10) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" style="display:block;flex-shrink:0">
    <rect width="64" height="64" rx="${radius * 64 / size}" fill="var(--l-tile)"/>
    <path d="M17 33 C16.5 44 13.5 51 9 58 L41 58 C37.5 51 36 44 37.5 35 Z" fill="var(--l-head)"/>
    <circle cx="28" cy="24" r="14.5" fill="var(--l-head)"/>
    <path d="M18.2 16.8 A12 12 0 0 1 28.5 11.8" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M40.5 19.5 L56 23.2 Q57.6 28.6 53.6 29.8 L40.6 29.4 Z" fill="var(--l-beak)"/>
    <rect x="31.5" y="17.5" width="4.5" height="4.5" rx="0.6" fill="var(--l-eye)"/>
    <path d="M16.2 43.2 Q26.5 47.4 36.4 43.2" fill="none" stroke="var(--l-ring)" stroke-width="3.4" stroke-linecap="round"/>
  </svg>`;
}

/* Pato inteiro de lado, boiando. As cores vêm do tema (--d-*). */
function duckSide(width = "100%", height = 100) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 140 90" aria-hidden="true" style="display:block">
    <path d="M2 82 Q20 76 38 82 T74 82 T110 82 T146 82" fill="none" stroke="var(--acc-text)" stroke-width="2" opacity="0.45"/>
    <path d="M18 52 L3 41 L13 63 Z" fill="var(--d-body)" stroke="var(--d-line)" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="58" cy="60" rx="44" ry="20" fill="var(--d-body)" stroke="var(--d-line)" stroke-width="1.5"/>
    <path d="M34 54 Q60 38 90 52 Q70 68 40 64 Z" fill="var(--d-wing)" stroke="var(--d-line)" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M60 51 L80 50 L80 57 L62 59 Z" fill="var(--d-spec)"/>
    <path d="M88 54 Q86 38 92 28 L106 30 Q102 42 104 56 Z" fill="var(--d-head)" stroke="var(--d-line)" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="100" cy="24" r="13" fill="var(--d-head)" stroke="var(--d-line)" stroke-width="1.5"/>
    <path d="M89 46 Q96 49 104 46" fill="none" stroke="var(--d-ring)" stroke-width="3" stroke-linecap="round"/>
    <path d="M111 21 Q128 20 130 26 Q124 31 110 30 Z" fill="var(--d-beak)" stroke="var(--d-line)" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="104" cy="20" r="2" fill="var(--d-eye)"/>
  </svg>`;
}

/* Pato pequeno (o que boia no gráfico). Aceita cores fixas para os ícones de nível. */
function duckMini(w = 40, h = 30, c = null) {
  const k = c || { body: "var(--d-body)", head: "var(--d-head)", beak: "var(--d-beak)", wing: "var(--d-wing)", spec: "var(--d-spec)", ring: "var(--d-ring)", line: "var(--d-line)", eye: "var(--d-eye)" };
  return `<svg width="${w}" height="${h}" viewBox="0 0 40 30" aria-hidden="true" style="display:block">
    <path d="M5 17 L1 12 L4 20 Z" fill="${k.body}" stroke="${k.line}" stroke-width="1.2" stroke-linejoin="round"/>
    <ellipse cx="17" cy="20" rx="13" ry="7.5" fill="${k.body}" stroke="${k.line}" stroke-width="1.2"/>
    <path d="M10 18 Q18 13 26 18 Q19 23 11 21 Z" fill="${k.wing}"/>
    <path d="M17 17 L23 17 L23 19.5 L17.5 20 Z" fill="${k.spec}"/>
    <path d="M25 20 Q24 13 27 9 L32 10 Q30 15 31 20 Z" fill="${k.head}" stroke="${k.line}" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="30" cy="8" r="5" fill="${k.head}" stroke="${k.line}" stroke-width="1.2"/>
    <path d="M34 6.6 L39.5 8 Q39.5 10.2 38 10.4 L34 10 Z" fill="${k.beak}" stroke="${k.line}" stroke-width="1"/>
    <circle cx="31.2" cy="6.8" r="0.9" fill="${k.eye}"/>
    <path d="M25.6 14.6 Q28.5 15.8 31.2 14.6" fill="none" stroke="${k.ring}" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;
}

/* Patinho. "lit" = colorido; sem cor fica só o contorno (usado no passo a passo do Consultor). */
function duckling(w = 44, h = 36, lit = true) {
  const fill = lit ? "#F5CF4F" : "transparent", stroke = lit ? "#B8922A" : "var(--line2)";
  const beak = lit ? "#F08A24" : "var(--line2)", eye = lit ? "#2A2017" : "var(--line2)";
  return `<svg width="${w}" height="${h}" viewBox="0 0 44 36" aria-hidden="true" style="display:block">
    <path d="M8 21 L2 16 L6 26 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>
    <ellipse cx="20" cy="24" rx="13" ry="9" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
    <circle cx="31" cy="13" r="8" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>
    <path d="M38 11.5 L43.5 13.8 L38 16.2 Z" fill="${beak}"/>
    <circle cx="33.2" cy="11" r="1.4" fill="${eye}"/>
    <path d="M14 23 Q20 18.5 26 23.5" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}

/* O cisne que aparece quando todos os upgrades foram feitos. */
function swanSymbol(size = 40, radius = 10) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" style="display:block;flex-shrink:0">
    <rect width="64" height="64" rx="${radius * 64 / size}" fill="var(--l-tile)"/>
    <path d="M10 58 C14 50 22 47 29 50 C37 45 50 47 56 58 Z" fill="#FFFFFF"/>
    <path d="M26 52 C17 43 30 38 33 30 C36 22 27 19 29 13" fill="none" stroke="#FFFFFF" stroke-width="7.5" stroke-linecap="round"/>
    <circle cx="32" cy="12" r="6.5" fill="#FFFFFF"/>
    <path d="M37.5 10.4 L50 14.2 L37.5 16.9 Z" fill="#F28A2E"/>
    <path d="M36.4 9.6 L39.2 10.6 L39 16.5 L36.2 16.9 Z" fill="#1C1B18"/>
    <rect x="30.8" y="9.4" width="3" height="3" rx="0.5" fill="#1C1B18"/>
  </svg>`;
}

/* Pegada palmada, usada na trilha do Histórico. */
function footprint(size = 26) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="display:block">
    <path d="M12 22c-2.2 0-6.9-4.6-8.2-11.6-.2-1 .8-1.6 1.6-1 1.3 1 2.6 1.4 3.6.8C9.6 6.3 10.6 2.5 12 2.5s2.4 3.8 3 7.7c1 .6 2.3.2 3.6-.8.8-.6 1.8 0 1.6 1C18.9 17.4 14.2 22 12 22z" fill="currentColor"/>
    <path d="M12 20.5V7M12 19.5L6.2 11.2M12 19.5l5.8-8.3" fill="none" stroke="var(--bg)" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`;
}

function eggIcon(w = 40, h = 32) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 40 32" aria-hidden="true" style="display:block">
    <ellipse cx="20" cy="17" rx="10" ry="13.5" fill="#F3EBDD" stroke="#BFAF92" stroke-width="1.5"/>
    <circle cx="16" cy="13" r="1.3" fill="#D8CBB2"/><circle cx="23" cy="20" r="1.6" fill="#D8CBB2"/><circle cx="18" cy="23" r="1" fill="#D8CBB2"/>
  </svg>`;
}

function swanIcon(w = 40, h = 32) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 40 32" aria-hidden="true" style="display:block">
    <path d="M4 27 C8 21 16 20 21 22 C27 19 35 21 38 28 Z" fill="#FFFFFF" stroke="#BDB5A2" stroke-width="1.2"/>
    <path d="M17 23 C11 17 20 14 22 10 C23 7 19 5 20 4" fill="none" stroke="#BDB5A2" stroke-width="5.2" stroke-linecap="round"/>
    <path d="M17 23 C11 17 20 14 22 10 C23 7 19 5 20 4" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="21" cy="4.5" r="3" fill="#FFFFFF" stroke="#BDB5A2" stroke-width="1"/>
    <path d="M23.6 3.4 L29.5 5 L23.6 6.3 Z" fill="#F28A2E"/>
    <circle cx="21.6" cy="3.8" r="0.8" fill="#1C1B18"/>
  </svg>`;
}

/* Os 5 níveis do PC, do Ovo ao Cisne. */
const LEVEL_NAMES = ["Ovo", "Patinho", "Pato", "Pato-real", "Cisne"];
function levelIcon(index, w = 40, h = 32) {
  if (index === 0) return eggIcon(w, h);
  if (index === 1) return duckling(w, h);
  if (index === 2) return duckMini(w, h, { body: "#FFFFFF", head: "#FFFFFF", beak: "#F28A2E", wing: "#EFEBE2", spec: "#E4DFD3", ring: "#FFFFFF", line: "#BDB5A2", eye: "#1C1B18" });
  if (index === 3) return duckMini(w, h, { body: "#B3AEA4", head: "#1F8A57", beak: "#E9C23A", wing: "#7A756C", spec: "#4C5BE0", ring: "#FFFFFF", line: "transparent", eye: "#0B0F0D" });
  return swanIcon(w, h);
}

/* Onda que se repete sem emenda quando desliza 50% para o lado. */
function waves(height = 22, fillOpacity = 0.14) {
  let d = "M0 7 Q12.5 1 25 7";
  for (let x = 50; x <= 1200; x += 25) d += ` T${x} 7`;
  return `<svg width="100%" height="${height}" viewBox="0 0 1200 22" preserveAspectRatio="none" aria-hidden="true" style="display:block">
    <path d="${d} L1200 22 L0 22 Z" fill="var(--acc-text)" opacity="${fillOpacity}"/>
    <path d="${d}" fill="none" stroke="var(--acc-text)" stroke-width="1.5" opacity="0.55" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
