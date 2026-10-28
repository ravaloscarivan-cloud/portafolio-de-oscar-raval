// Puente entre la app (localhost:3000) y la extensión.
// La app habla con window.postMessage; este script reenvía a background.js y devuelve respuestas.

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.origen !== 'dsers-app') return;
  const { id, mensaje } = e.data;

  if (mensaje.tipo === 'ping') {
    window.postMessage({ origen: 'dsers-ext', tipo: 'listo', id }, '*');
    return;
  }

  try {
    chrome.runtime.sendMessage(mensaje, (resp) => {
      const error = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
      window.postMessage({ origen: 'dsers-ext', tipo: 'respuesta', id, resp: error ? { error } : resp }, '*');
    });
  } catch (err) {
    // La extensión se recargó: hay que recargar esta pestaña.
    window.postMessage({ origen: 'dsers-ext', tipo: 'respuesta', id, resp: { error: 'Recarga la página (la extensión se actualizó).' } }, '*');
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  window.postMessage({ origen: 'dsers-ext', ...msg }, '*');
});
