import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarAutoHideNav, TEMPO_AUTO_HIDE_MS } from '../imports/ui/autoHideNav.js';

function criarAlvoMock() {
  const ouvintes = new Map();
  return {
    addEventListener(tipo, fn) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo).add(fn);
    },
    removeEventListener(tipo, fn) {
      ouvintes.get(tipo)?.delete(fn);
    },
    emitir(tipo, evento = {}) {
      for (const fn of ouvintes.get(tipo) || []) fn(evento);
    },
  };
}

function criarClassListMock() {
  const classes = new Set();
  return {
    toggle(nome, forcar) {
      if (forcar) classes.add(nome);
      else classes.delete(nome);
    },
    contains(nome) {
      return classes.has(nome);
    },
  };
}

function criarNavMock() {
  return {
    dataset: {},
    classList: criarClassListMock(),
  };
}

describe('auto-hide da barra de navegação mobile', () => {
  it('nasce visível, esconde após 7s de inatividade e ressurge ao tocar ou mover a tela', () => {
    const navEl = criarNavMock();
    const alvo = criarAlvoMock();
    const doc = criarAlvoMock();
    doc.body = { classList: criarClassListMock() };
    let callbackTimer = null;
    let ultimoPrazo = 0;

    const controle = iniciarAutoHideNav({
      navEl,
      alvo,
      doc,
      agendarTimeout(fn, ms) {
        callbackTimer = () => {
          callbackTimer = null;
          fn();
        };
        ultimoPrazo = ms;
        return 1;
      },
      cancelarTimeout() {
        callbackTimer = null;
      },
    });

    assert.equal(TEMPO_AUTO_HIDE_MS, 7000);
    assert.equal(ultimoPrazo, 7000);
    assert.equal(navEl.classList.contains('oculta'), false);
    assert.equal(doc.body.classList.contains('nav-mobile-oculta'), false);

    // Após os 7s de inatividade, esconde de cima para baixo e desce o composer
    callbackTimer();
    assert.equal(navEl.classList.contains('oculta'), true);
    assert.equal(doc.body.classList.contains('nav-mobile-oculta'), true);

    // Ao tocar ou mover a tela fora da entrada, surge novamente de baixo para cima
    alvo.emitir('pointermove');
    assert.equal(navEl.classList.contains('oculta'), false);
    assert.equal(doc.body.classList.contains('nav-mobile-oculta'), false);

    // Esconde de novo e ressurge ao rolar um container interno
    callbackTimer();
    assert.equal(navEl.classList.contains('oculta'), true);
    doc.emitir('scroll');
    assert.equal(navEl.classList.contains('oculta'), false);

    controle.destruir();
  });

  it('mantém a barra visível enquanto o dedo está na tela e reagenda ao soltar', () => {
    const navEl = criarNavMock();
    const alvo = criarAlvoMock();
    let callbackTimer = null;

    iniciarAutoHideNav({
      navEl,
      alvo,
      doc: null,
      agendarTimeout(fn) {
        callbackTimer = () => {
          callbackTimer = null;
          fn();
        };
        return 1;
      },
      cancelarTimeout() {
        callbackTimer = null;
      },
    });

    callbackTimer();
    assert.equal(navEl.classList.contains('oculta'), true);

    alvo.emitir('touchstart');
    assert.equal(navEl.classList.contains('oculta'), false);
    assert.equal(callbackTimer, null);

    alvo.emitir('touchend');
    assert.equal(typeof callbackTimer, 'function');
    callbackTimer();
    assert.equal(navEl.classList.contains('oculta'), true);
  });

  it('ao tocar no campo de entrada da conversa não exibe o menu e coloca o input em foco', () => {
    const navEl = criarNavMock();
    const alvo = criarAlvoMock();
    const doc = criarAlvoMock();
    doc.body = { classList: criarClassListMock() };

    let focado = false;
    const campoInput = {
      id: 'composer-input',
      focus() {
        focado = true;
        doc.activeElement = campoInput;
      },
      blur() {
        focado = false;
        doc.activeElement = null;
      },
      closest(seletor) {
        return seletor.includes('#composer-input') ? campoInput : null;
      },
    };
    doc.activeElement = null;
    doc.getElementById = (id) => (id === 'composer-input' ? campoInput : null);

    let callbackTimer = null;
    iniciarAutoHideNav({
      navEl,
      alvo,
      doc,
      agendarTimeout(fn) {
        callbackTimer = () => {
          callbackTimer = null;
          fn();
        };
        return 1;
      },
      cancelarTimeout() {
        callbackTimer = null;
      },
    });

    // Menu recolheu após 7s
    callbackTimer();
    assert.equal(navEl.classList.contains('oculta'), true);

    // Toca especificamente na entrada de texto: menu continua oculto e input ganha foco
    alvo.emitir('touchstart', { target: campoInput });
    alvo.emitir('touchend', { target: campoInput });
    assert.equal(navEl.classList.contains('oculta'), true);
    assert.equal(doc.body.classList.contains('nav-mobile-oculta'), true);
    assert.equal(focado, true);

    // Enquanto digita (keydown), o menu permanece oculto
    alvo.emitir('keydown', { target: campoInput });
    assert.equal(navEl.classList.contains('oculta'), true);

    // Ao tocar fora da entrada (ex.: na conversa), tira o foco e traz o menu de volta
    alvo.emitir('touchstart', { target: { closest: () => null } });
    assert.equal(focado, false);
    assert.equal(navEl.classList.contains('oculta'), false);
  });
});
