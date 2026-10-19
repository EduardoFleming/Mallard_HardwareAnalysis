/* Ponte estrita para a API Python real fornecida pelo PyWebview. */
const Bridge = (() => {
  let resolveApi;
  let rejectApi;
  let api;
  const apiReady = new Promise((resolve, reject) => {
    resolveApi = resolve;
    rejectApi = reject;
  });

  const timeout = window.setTimeout(() => {
    rejectApi(new Error("O backend Python não respondeu. Feche o Mallard e inicie-o com python app.py."));
  }, 12000);

  window.addEventListener("pywebviewready", () => {
    if (!window.pywebview || !window.pywebview.api) {
      rejectApi(new Error("A ponte Python do aplicativo não ficou disponível."));
      return;
    }
    api = window.pywebview.api;
    window.clearTimeout(timeout);
    resolveApi(api);
  }, { once: true });

  if (window.pywebview && window.pywebview.api) {
    api = window.pywebview.api;
    window.clearTimeout(timeout);
    resolveApi(api);
  }

  async function call(name, ...args) {
    const connected = await apiReady;
    if (typeof connected[name] !== "function") {
      throw new Error(`A função '${name}' não está disponível no backend.`);
    }
    return connected[name](...args);
  }

  return { call, isReady: () => !!api };
})();
