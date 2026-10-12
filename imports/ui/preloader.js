// ------------------------------------------------------------
// Preloader de abertura: apresenta o Resolux enquanto o shell
// hidrata e a sondagem do motor acontece por baixo. A saída
// acontece assim que a sondagem decide o motor (com teto curto
// para nunca bloquear indefinidamente), após uma batida mínima
// para a introdução não piscar; um toque (ou tecla) pula antes.
// ------------------------------------------------------------

import { backendAtivo } from '../api/index.js';

// Rótulos honestos de boot — espelham o estado do motor na tela
// desde o primeiro segundo; nunca fingimos capacidade.
export const ROTULOS_STATUS = {
  sondando: 'Sondando motor…',
  daemon: 'Motor conectado · ResoluxServer',
  mock: 'Modo demonstração · sem motor',
};

export const DURACAO_MINIMA_MS = 800;
export const TETO_SONDAGEM_MS = 3000;
export const SAIDA_MS = 600;

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

  // Deep link/retorno de reload não precisa refazer a introdução:
  // "#status" já significa “o app sabe onde abrir”.
  if (window.location.hash) {
    folha.remove();
    return;
  }

  const status = folha.querySelector('[data-status]');
  if (status) status.textContent = ROTULOS_STATUS[backendAtivo.get()] || ROTULOS_STATUS.sondando;
  const pararStatus = backendAtivo.assinar((valor) => {
    if (status) status.textContent = ROTULOS_STATUS[valor] || ROTULOS_STATUS.sondando;
  });

  const inicio = performance.now();

  const cena = new Promise((resolve) => {
    // Batida mínima: o preloader some assim que o motor é decidido,
    // sem esperar uma cena fixa — e sem piscar na cara de quem abre.
    const timer = setTimeout(resolve, DURACAO_MINIMA_MS);
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
