// ------------------------------------------------------------
// Auto-hide da barra de navegação mobile (#nav-mobile).
// Esconde a cápsula deslizando para baixo após 7s de inatividade e
// faz surgir de baixo para cima ao tocar, mover ou rolar a tela —
// exceto quando o toque é no campo de entrada da conversa, que
// mantém o menu recolhido e coloca o input em foco.
// ------------------------------------------------------------

export const TEMPO_AUTO_HIDE_MS = 7000;

function ehAlvoEntrada(alvo) {
  if (!alvo || typeof alvo.closest !== 'function') return false;
  return Boolean(alvo.closest('#composer-form, .composer, #composer-input'));
}

function ehBotaoComposer(alvo) {
  if (!alvo || typeof alvo.closest !== 'function') return false;
  return Boolean(alvo.closest('button'));
}

export function iniciarAutoHideNav({
  navEl,
  alvo = typeof window !== 'undefined' ? window : null,
  doc = typeof document !== 'undefined' ? document : null,
  tempoMs = TEMPO_AUTO_HIDE_MS,
  agendarTimeout = setTimeout,
  cancelarTimeout = clearTimeout,
} = {}) {
  if (!navEl || !alvo) return { mostrar() {}, ocultar() {}, destruir() {} };

  let timer = null;
  let dedoNaTela = false;
  let interagindoComEntrada = false;

  function obterInput() {
    return doc?.getElementById?.('composer-input') || null;
  }

  function entradaEmFoco() {
    const campo = obterInput();
    return Boolean(campo && doc?.activeElement === campo);
  }

  function definirOculta(oculta) {
    navEl.classList.toggle('oculta', oculta);
    if (navEl.dataset) {
      navEl.dataset.oculta = oculta ? 'true' : 'false';
    }
    doc?.body?.classList?.toggle('nav-mobile-oculta', oculta);
  }

  function limparTimer() {
    if (timer !== null) {
      cancelarTimeout(timer);
      timer = null;
    }
  }

  function agendarOcultacao() {
    limparTimer();
    if (dedoNaTela || entradaEmFoco()) return;
    timer = agendarTimeout(() => {
      timer = null;
      definirOculta(true);
    }, tempoMs);
  }

  function focarEntrada(evento) {
    interagindoComEntrada = true;
    limparTimer();
    definirOculta(true);
    if (!ehBotaoComposer(evento?.target)) {
      const campo = obterInput();
      if (campo && doc?.activeElement !== campo && typeof campo.focus === 'function') {
        campo.focus();
      }
    }
  }

  function despertar(evento) {
    if (ehAlvoEntrada(evento?.target)) {
      focarEntrada(evento);
      return;
    }
    if (interagindoComEntrada || entradaEmFoco()) return;
    definirOculta(false);
    agendarOcultacao();
  }

  function aoToqueInicio(evento) {
    if (ehAlvoEntrada(evento?.target)) {
      dedoNaTela = false;
      focarEntrada(evento);
      return;
    }
    interagindoComEntrada = false;
    if (entradaEmFoco()) {
      obterInput()?.blur?.();
    }
    dedoNaTela = true;
    definirOculta(false);
    limparTimer();
  }

  function aoToqueFim() {
    if (interagindoComEntrada || entradaEmFoco()) {
      interagindoComEntrada = false;
      return;
    }
    dedoNaTela = false;
    agendarOcultacao();
  }

  function aoPonteiroBaixo(evento) {
    if (ehAlvoEntrada(evento?.target)) {
      focarEntrada(evento);
      return;
    }
    interagindoComEntrada = false;
    if (entradaEmFoco()) {
      obterInput()?.blur?.();
    }
    definirOculta(false);
    agendarOcultacao();
  }

  const opcoesPassivas = { passive: true };
  const opcoesScroll = { passive: true, capture: true };

  alvo.addEventListener('touchstart', aoToqueInicio, opcoesPassivas);
  alvo.addEventListener('touchmove', despertar, opcoesPassivas);
  alvo.addEventListener('touchend', aoToqueFim, opcoesPassivas);
  alvo.addEventListener('touchcancel', aoToqueFim, opcoesPassivas);
  alvo.addEventListener('pointerdown', aoPonteiroBaixo, opcoesPassivas);
  alvo.addEventListener('pointermove', despertar, opcoesPassivas);
  alvo.addEventListener('keydown', despertar, opcoesPassivas);
  doc?.addEventListener('scroll', despertar, opcoesScroll);

  despertar();

  return {
    mostrar() {
      interagindoComEntrada = false;
      definirOculta(false);
      agendarOcultacao();
    },
    ocultar() {
      limparTimer();
      definirOculta(true);
    },
    destruir() {
      limparTimer();
      alvo.removeEventListener('touchstart', aoToqueInicio, opcoesPassivas);
      alvo.removeEventListener('touchmove', despertar, opcoesPassivas);
      alvo.removeEventListener('touchend', aoToqueFim, opcoesPassivas);
      alvo.removeEventListener('touchcancel', aoToqueFim, opcoesPassivas);
      alvo.removeEventListener('pointerdown', aoPonteiroBaixo, opcoesPassivas);
      alvo.removeEventListener('pointermove', despertar, opcoesPassivas);
      alvo.removeEventListener('keydown', despertar, opcoesPassivas);
      doc?.removeEventListener('scroll', despertar, opcoesScroll);
    },
  };
}
