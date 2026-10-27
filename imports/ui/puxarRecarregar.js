// ------------------------------------------------------------
// Puxar para baixo para recarregar (pull-to-refresh) no mobile:
// quando a área ativa está no topo (scrollTop <= 0) e o operador
// puxa para baixo, desce uma cápsula de vidro com um ThinkingOrb
// (breathing → composing no gatilho → working ao recarregar).
// ------------------------------------------------------------

export const LIMIAR_RECARGA_PX = 76;
export const MAX_DESLOCAMENTO_PX = 96;
const ZONA_MORTA_PX = 10;

// Converte a distância puxada pelo dedo (px) em progresso (0..1),
// deslocamento amortecido (px) e se já passou do ponto de disparo.
export function calcularPuxada(deltaY, limiar = LIMIAR_RECARGA_PX) {
  const bruto = Math.max(0, Number(deltaY) || 0) - ZONA_MORTA_PX;
  if (bruto <= 0) {
    return { ativo: false, progresso: 0, deslocamento: 0, pronto: false };
  }
  const progresso = Math.min(1, bruto / limiar);
  // Amortecimento elástico: desacelera depois do limiar.
  const deslocamento = Math.min(
    MAX_DESLOCAMENTO_PX,
    Math.round(MAX_DESLOCAMENTO_PX * (1 - Math.exp(-bruto / (limiar * 1.15)))),
  );
  return {
    ativo: true,
    progresso: Math.round(progresso * 100) / 100,
    deslocamento,
    pronto: bruto >= limiar,
  };
}

// Estado do ThinkingOrb (enum fechado de imports/ui/orb.js) e rótulo
// em português conforme a fase do gesto.
export function estadoPuxada({ pronto = false, recarregando = false } = {}) {
  if (recarregando) {
    return { orb: 'working', rotulo: 'Recarregando…' };
  }
  if (pronto) {
    return { orb: 'composing', rotulo: 'Solte para recarregar' };
  }
  return { orb: 'breathing', rotulo: 'Puxe para recarregar' };
}

function rolavelNoTopo(alvo) {
  let no = alvo instanceof Element ? alvo : null;
  while (no && no !== document.body && no !== document.documentElement) {
    if (no.scrollTop > 0) return false;
    no = no.parentElement;
  }
  return (window.scrollY || 0) <= 0;
}

function deveIgnorarAlvo(alvo) {
  if (!(alvo instanceof Element)) return false;
  return Boolean(
    alvo.closest('input, textarea, select, .atalho-alca, .arrastando-atalho, #preloader, #bloqueio-video'),
  );
}

export function iniciarPuxarRecarregar({
  indicador,
  orbCanvas,
  rotuloEl,
  aoRecarregar = () => window.location.reload(),
} = {}) {
  if (typeof window === 'undefined' || !indicador || !orbCanvas || !rotuloEl) {
    return { cancelar() {} };
  }

  let inicioX = 0;
  let inicioY = 0;
  let rastreando = false;
  let puxando = false;
  let recarregando = false;
  let ultimoEstado = { ativo: false, progresso: 0, deslocamento: 0, pronto: false };

  const aplicarVisual = (puxada) => {
    const mostrar = puxada.ativo || recarregando;
    indicador.hidden = !mostrar;
    indicador.classList.toggle('visivel', mostrar);
    indicador.classList.toggle('pronto', puxada.pronto || recarregando);
    indicador.classList.toggle('recarregando', recarregando);
    if (!mostrar) {
      indicador.style.removeProperty('--puxar-y');
      indicador.style.removeProperty('--puxar-progresso');
      return;
    }
    const y = recarregando ? 56 : puxada.deslocamento;
    const prog = recarregando ? 1 : puxada.progresso;
    indicador.style.setProperty('--puxar-y', `${y}px`);
    indicador.style.setProperty('--puxar-progresso', String(prog));
    const { orb, rotulo } = estadoPuxada({ pronto: puxada.pronto, recarregando });
    if (orbCanvas.dataset.orb !== orb) orbCanvas.dataset.orb = orb;
    if (rotuloEl.textContent !== rotulo) rotuloEl.textContent = rotulo;
  };

  const aoToqueInicio = (evento) => {
    if (recarregando || evento.touches.length !== 1) return;
    if (deveIgnorarAlvo(evento.target) || !rolavelNoTopo(evento.target)) return;
    inicioX = evento.touches[0].clientX;
    inicioY = evento.touches[0].clientY;
    rastreando = true;
    puxando = false;
    ultimoEstado = { ativo: false, progresso: 0, deslocamento: 0, pronto: false };
  };

  const aoToqueMover = (evento) => {
    if (!rastreando || recarregando || evento.touches.length !== 1) return;
    const dx = evento.touches[0].clientX - inicioX;
    const dy = evento.touches[0].clientY - inicioY;

    // Se o gesto começou para cima ou na horizontal, entrega para o scroll normal.
    if (!puxando && (dy < 0 || Math.abs(dx) > Math.abs(dy))) {
      rastreando = false;
      return;
    }
    if (!rolavelNoTopo(evento.target)) {
      rastreando = false;
      aplicarVisual({ ativo: false, progresso: 0, deslocamento: 0, pronto: false });
      return;
    }

    const puxada = calcularPuxada(dy);
    if (puxada.ativo) {
      puxando = true;
      if (evento.cancelable) evento.preventDefault();
    }
    ultimoEstado = puxada;
    aplicarVisual(puxada);
  };

  const finalizarToque = () => {
    if (!rastreando) return;
    rastreando = false;
    if (!puxando) return;
    puxando = false;

    if (ultimoEstado.pronto && !recarregando) {
      recarregando = true;
      aplicarVisual(ultimoEstado);
      setTimeout(() => aoRecarregar(), 420);
      return;
    }
    ultimoEstado = { ativo: false, progresso: 0, deslocamento: 0, pronto: false };
    aplicarVisual(ultimoEstado);
  };

  window.addEventListener('touchstart', aoToqueInicio, { passive: true });
  window.addEventListener('touchmove', aoToqueMover, { passive: false });
  window.addEventListener('touchend', finalizarToque, { passive: true });
  window.addEventListener('touchcancel', finalizarToque, { passive: true });

  return {
    cancelar() {
      window.removeEventListener('touchstart', aoToqueInicio);
      window.removeEventListener('touchmove', aoToqueMover);
      window.removeEventListener('touchend', finalizarToque);
      window.removeEventListener('touchcancel', finalizarToque);
    },
  };
}
