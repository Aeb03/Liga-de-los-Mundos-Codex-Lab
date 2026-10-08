const install = document.querySelector('#install-live');
const full = document.querySelector('#fullscreen-live');
const help = document.querySelector('#install-help');
let prompt;
const installed = () => ['standalone', 'fullscreen'].some(mode => matchMedia(`(display-mode: ${mode})`).matches) || navigator.standalone;
const message = text => { help.textContent = text; help.hidden = false; };
const refresh = () => {
  install.hidden = Boolean(installed());
  full.hidden = !document.fullscreenEnabled || Boolean(installed());
  full.textContent = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa';
};
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; refresh(); });
window.addEventListener('appinstalled', () => { prompt = null; install.hidden = true; message('Juego instalado. Abrilo desde su icono.'); });
install.addEventListener('click', async () => {
  if (!prompt) { message('En Chrome: menú ⋮ → Instalar aplicación o Agregar a pantalla principal. En iPhone: Compartir → Agregar a inicio.'); return; }
  const current = prompt; prompt = null;
  try { await current.prompt(); await current.userChoice; } catch { message('Podés instalarlo desde el menú del navegador.'); }
});
full.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen();
      try { await screen.orientation?.lock?.('landscape'); } catch { /* Rotate manually where locking is unsupported. */ }
    }
  } catch { message('El navegador no permitió pantalla completa. Probá abrir el juego desde su icono instalado.'); }
  refresh();
});
document.addEventListener('fullscreenchange', refresh);
refresh();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(() => {});
