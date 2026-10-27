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

// No iOS "Adicionar à Tela de Início" (navigator.standalone), o WebKit
// congela 100vh/100dvh/bottom:0 descontando a barra que o Safari tinha
// antes de instalar (~60–72px), deixando uma faixa preta no rodapé.
// Com o teclado fechado, a janela real do WebClip ocupa a dimensão física
// da tela na orientação atual; com o teclado aberto, segue o visualViewport.
export function calcularAlturaStandalone(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win?.navigator?.standalone) return '';
  const tela = win.screen;
  const w = Number(win.innerWidth) || 0;
  const h = Number(win.innerHeight) || 0;
  const sw = Number(tela?.width) || 0;
  const sh = Number(tela?.height) || 0;
  if (!w || !h || !sw || !sh) return '';
  const alturaTela = w > h ? Math.min(sw, sh) : Math.max(sw, sh);
  const alturaVisivel = Number(win.visualViewport?.height) || h;
  if (alturaTela - alturaVisivel > 120) {
    return `${Math.round(alturaVisivel)}px`;
  }
  if (alturaTela > h && alturaTela - h <= 120) {
    return `${alturaTela}px`;
  }
  return `${Math.max(h, Math.round(alturaVisivel))}px`;
}

// Mantém a casca presa ao viewport real no mobile/PWA (sem faixa preta no
// rodapé do WebClip e sem a página subir quando o teclado virtual abre).
export function iniciarShellNativo(
  win = typeof window !== 'undefined' ? window : undefined,
  doc = typeof document !== 'undefined' ? document : undefined,
) {
  if (!win || !doc?.documentElement) return;
  const raiz = doc.documentElement;

  const atualizarAltura = () => {
    const standalone = calcularAlturaStandalone(win);
    if (standalone) {
      raiz.style.setProperty('--altura-app', standalone);
    } else if (raiz.classList.contains('mobile') && win.visualViewport) {
      raiz.style.setProperty('--altura-app', `${Math.round(win.visualViewport.height)}px`);
    } else {
      raiz.style.removeProperty('--altura-app');
    }
    if (raiz.classList.contains('mobile') && (win.scrollY !== 0 || win.scrollX !== 0)) {
      win.scrollTo(0, 0);
    }
  };

  atualizarAltura();
  win.addEventListener('resize', atualizarAltura);
  win.addEventListener('orientationchange', atualizarAltura);
  win.visualViewport?.addEventListener('resize', atualizarAltura);
  win.visualViewport?.addEventListener('scroll', atualizarAltura);
}
