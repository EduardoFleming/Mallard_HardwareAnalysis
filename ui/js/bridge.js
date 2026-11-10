/* Ponte estrita para a API Python real fornecida pelo PyWebview. */
const Bridge = (() => {
  let resolveApi;
  let rejectApi;
  let api;
  const apiReady = new Promise((resolve, reject) => { resolveApi = resolve; rejectApi = reject; });
  const timeout = window.setTimeout(() => {
    rejectApi(new Error("O backend Python não respondeu. Abra o Mallard pelo app.py ou pelo atalho instalado."));
  }, 12000);

  function connect() {
    if (!window.pywebview || !window.pywebview.api) return false;
    api = window.pywebview.api;
    window.clearTimeout(timeout);
    resolveApi(api);
    return true;
  }

  window.addEventListener("pywebviewready", connect, { once: true });
  connect();

  async function call(name, ...args) {
    const connected = await apiReady;
    if (typeof connected[name] !== "function") throw new Error(`Função ${name} não existe na ponte Python.`);
    return connected[name](...args);
  }

  return { call, isReady: () => !!api };
})();
