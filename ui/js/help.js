/* Ajuda do "?": 3 passos curtos por tela. Abre sozinha na primeira visita às telas novas. */
const Help = (() => {
  const AUTO = ["simulator", "gamecheck", "journal", "startup", "battery", "cleanup", "temperature"];
  const TEXTS = {
    computer: ["Ficha do seu PC", [["Veja as peças", "Cada cartão mostra uma peça que o Mallard leu do seu computador."], ["Leia os pontos de atenção", "O que merece cuidado aparece com um aviso e um atalho."], ["Informe o que faltou", "Se uma peça não foi identificada, escreva o modelo para o consultor acertar."]]],
    guide: ["Entender o PC", [["Escolha uma peça", "Clique na peça do gabinete para ver o que ela faz."], ["Leia a analogia", "Cada peça é explicada como uma cozinha, sem jargão."], ["Compare com o seu", "As réguas mostram onde o seu PC está."]]],
    simulator: ["Simulador de upgrade", [["Escolha a peça", "Marque quanta memória, qual SSD ou placa de vídeo você pensa em colocar."], ["Veja o antes e o depois", "O nível do PC e os três números mudam na hora."], ["Confira os avisos", "Embaixo aparecem o que checar antes de comprar. É uma estimativa, não gasta a IA."]]],
    monitor: ["Monitor", [["Acompanhe ao vivo", "Processador, memória, disco e vídeo atualizam sozinhos."], ["Pause quando quiser", "O botão de pausa congela os gráficos."], ["Observe os picos", "Memória sempre cheia costuma ser a causa de travadas."]]],
    journal: ["Diário do PC", [["Escolha o dia", "Cada dia mostra como o PC se comportou, em cores."], ["Leia a história", "Os eventos marcam a hora em que a memória encheu ou o PC travou."], ["Siga a dica", "Os padrões da semana viram um conselho com atalho."]]],
    gamecheck: ["Vai rodar?", [["Digite o nome", "Um jogo ou programa, como Valorant ou Photoshop."], ["Veja o veredito", "Comparamos com as peças do seu PC, uma por uma."], ["Não achou?", "Se o título não está na lista, o Gemini pode buscar os requisitos (usa a chave)."]]],
    advisor: ["Consultor", [["Responda em 3 passos", "Uso, detalhes e orçamento. Tudo é opcional."], ["Informe a chave", "No Windows, fica salva com criptografia na sua conta."], ["Analise", "Cada clique faz uma única solicitação ao Gemini."]]],
    history: ["Histórico", [["Reabra uma análise", "Todas as análises ficam guardadas aqui."], ["Marque o que fez", "Ao concluir os upgrades, você ganha conquistas."], ["Veja o antes e o depois", "Na aba Antes e depois, a semana antes da peça é comparada com a semana depois."]]],
    cleanup: ["Limpeza", [["Procure", "O Mallard mede o que dá para jogar fora, sem apagar nada ainda."], ["Marque o que limpar", "Downloads antigos vão para a Lixeira, onde dá para recuperar."], ["Limpe", "Arquivos em uso e recentes ficam de fora, por segurança."]]],
    startup: ["Inicialização", [["Veja quem abre junto", "Os programas que iniciam com o Windows e o quanto atrasam o ligar."], ["Desligue o que não precisa", "Desativar não desinstala: dá para reativar a qualquer hora."], ["Reinicie para sentir", "A mudança vale na próxima vez que o PC ligar."]]],
    temperature: ["Temperatura", [["Escolha o sensor", "Clique em Processador, Disco ou Placa de vídeo para ver o termômetro dele."], ["Leia o estado", "Normal, Alto ou Crítico, sempre escrito e com símbolo, não só cor."], ["Siga a dica", "Em Alto ou Crítico aparecem os passos para esfriar o PC. Sem sensor, o Mallard não inventa números."]]],
    battery: ["Bateria", [["Veja a saúde", "A capacidade de hoje comparada com a de fábrica."], ["Acompanhe o histórico", "O gráfico mostra quanto ela perdeu mês a mês."], ["Quem gasta mais", "Os programas que mais usam o processador agora."]]],
    settings: ["Configurações", [["Escolha seu pato", "Cada pato é um tema de cores."], ["Ligue os avisos", "O pato avisa na bandeja quando a memória, o disco ou a temperatura passam do ponto. Use Ver o aviso para testar."], ["Abra o mini-modo", "Uma janelinha com o pato que fica por cima dos outros programas."]]],
  };

  const layer = () => document.getElementById("help-layer");
  const button = () => document.getElementById("help-btn");
  let current = null;

  function close() {
    layer().hidden = true;
    button().classList.remove("active", "pulse");
    current = null;
  }

  function markSeen(page) {
    const settings = App.state.settings;
    if (!settings || !AUTO.includes(page)) return;
    const seen = { ...(settings.help_seen || {}), [page]: true };
    settings.help_seen = seen;
    Bridge.call("save_settings", { help_seen: seen }).catch(() => {});
  }

  function positionLayer() {
    const topbar = document.getElementById("topbar");
    if (topbar) layer().style.setProperty("--help-top", `${Math.ceil(topbar.getBoundingClientRect().bottom)}px`);
  }

  function open(page) {
    const entry = TEXTS[page || App.state.page];
    if (!entry) return;
    current = page || App.state.page;
    const [title, steps] = entry;
    positionLayer();
    layer().innerHTML = `<div class="help-card in" role="dialog" aria-label="Ajuda: ${esc(title)}">
      <div class="row" style="justify-content:space-between"><span class="label">Como usar · ${esc(title)}</span>
        <button type="button" class="round-btn" id="help-close" aria-label="Fechar ajuda" style="width:30px;height:30px">${icon("x", 15)}</button></div>
      ${steps.map(([head, text], index) => `<div class="help-step"><span class="help-num">${index + 1}</span><div><b>${esc(head)}</b><span>${esc(text)}</span></div></div>`).join("")}
      <button type="button" class="pill-btn" id="help-ok" style="align-self:flex-end">Entendi</button></div>`;
    layer().hidden = false;
    button().classList.add("active");
    markSeen(current);
    const done = () => close();
    document.getElementById("help-close").addEventListener("click", done);
    document.getElementById("help-ok").addEventListener("click", done);
    layer().onclick = (event) => { if (event.target === layer()) done(); };
  }

  /* Na primeira visita a uma tela nova a ajuda abre sozinha; depois o "?" fica com um brilho até ser aberto. */
  function onPage(page) {
    const settings = App.state.settings;
    if (!settings || !settings.onboarded || !AUTO.includes(page)) return;
    if (!(settings.help_seen || {})[page]) setTimeout(() => { if (App.state.page === page) open(page); }, 450);
  }

  document.addEventListener("DOMContentLoaded", () => {
    button().addEventListener("click", () => { if (layer().hidden) open(); else close(); });
    window.addEventListener("resize", () => { if (!layer().hidden) positionLayer(); });
  });

  return { open, close, onPage };
})();
