// ------------------------------------------------------------
// PWA: detecção de iOS e do modo standalone — usada pra instruir a
// instalação na Tela de Início e deixar o Resolux em full-screen.
// ------------------------------------------------------------

export function ehIos() {
  const ua = String(navigator.userAgent ?? '');
  return /iPhone|iPad|iPod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function comoAppInstalado() {
  return globalThis.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true;
}

export function precisaInstrucaoInstalacao() {
  return ehIos() && !comoAppInstalado();
}
