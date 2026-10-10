// ------------------------------------------------------------
// Preloader de abertura: cena de ~10s que apresenta o Resolux
// enquanto o shell hidrata e a sondagem do motor acontece por
// baixo. A saída acontece no fim da cena OU no teto da sondagem,
// o que chegar depois; um toque (ou tecla) pula a introdução.
// ------------------------------------------------------------

import { backendAtivo } from '../api/index.js';

// Rótulos honestos de boot — espelham o estado do motor na tela
// desde o primeiro segundo; nunca fingimos capacidade.
export const ROTULOS_STATUS = {
  sondando: 'Sondando motor…',
  daemon: 'Motor conectado · ResoluxServer',
  mock: 'Modo demonstração · sem motor',
};

export const DURACAO_INTRO_MS = 10000;
export const TETO_SONDAGEM_MS = 3000;
export const SAIDA_MS = 600;
const DURACAO_REDUZIDA_MS = 1200;

// Espera a sondagem decidir o motor (daemon/mock) com um teto
// curto — nunca bloqueia a saída do preloader indefinidamente.
export function aguardarSondagem(tetoMs = TETO_SONDAGEM_MS) {
  return new Promise((resolve) => {
    if (backendAtivo.get() !== 'sondando') {
      resolve();
      return;
    }
    const cancelar = backendAtivo.assinar((valor) => {
      if (valor === 'sondando') return;
      clearTimeout(teto);
      cancelar();
      resolve();
    });
    const teto = setTimeout(() => {
      cancelar();
      resolve();
    }, tetoMs);
  });
}

export function iniciarPreloader() {
  const folha = document.getElementById('preloader');
  if (!folha) return;

  const status = folha.querySelector('[data-status]');
  if (status) status.textContent = ROTULOS_STATUS[backendAtivo.get()] || ROTULOS_STATUS.sondando;
  const pararStatus = backendAtivo.assinar((valor) => {
    if (status) status.textContent = ROTULOS_STATUS[valor] || ROTULOS_STATUS.sondando;
  });

  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inicio = performance.now();

  const cena = new Promise((resolve) => {
    const timer = setTimeout(resolve, reduzido ? DURACAO_REDUZIDA_MS : DURACAO_INTRO_MS);
    const pular = () => {
      // Guarda curta: evita pular por uma tecla carregada no refresh.
      if (performance.now() - inicio < 300) return;
      clearTimeout(timer);
      window.removeEventListener('keydown', pular);
      resolve();
    };
    folha.addEventListener('click', pular);
    window.addEventListener('keydown', pular);
  });

  Promise.all([cena, aguardarSondagem()]).then(() => {
    pararStatus();
    folha.classList.add('saindo');
    setTimeout(() => folha.remove(), SAIDA_MS);
  });
}
