import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import vm from 'node:vm';

// Roda o script inline do <head> de verdade, com navegador falso.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const codigo = html.match(/<script id="detectar-plataforma">([\s\S]*?)<\/script>/)[1];

function detectar({ userAgent = '', userAgentData, maxTouchPoints = 0, touchSemHover = false, semMatchMedia = false, largura = 1440 }) {
  const classes = new Set();
  const window = {
    navigator: { userAgent, userAgentData, maxTouchPoints },
    innerWidth: largura,
    matchMedia: semMatchMedia ? undefined : (q) => ({ matches: q.includes('hover: none') ? touchSemHover : false }),
  };
  const document = { documentElement: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } } };
  vm.runInNewContext(codigo, { window, document });
  return classes.has('mobile');
}

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';

describe('detecção de plataforma pelo aparelho', () => {
  it('desktop continua desktop mesmo com a janela estreita', () => {
    assert.equal(detectar({ userAgent: MAC, largura: 400 }), false);
  });

  it('celular é mobile pelo user agent, mesmo deitado e largo', () => {
    assert.equal(detectar({ userAgent: IPHONE, largura: 932 }), true);
    assert.equal(detectar({ userAgent: ANDROID }), true);
  });

  it('Client Hints dizendo mobile valem', () => {
    assert.equal(detectar({ userAgent: 'Mozilla/5.0 (Linux; Android 10; K)', userAgentData: { mobile: true } }), true);
  });

  it('iPad (UA de Mac) é mobile por ser touch sem hover', () => {
    assert.equal(detectar({ userAgent: MAC, maxTouchPoints: 5, touchSemHover: true }), true);
  });

  it('notebook com tela touch e mouse continua desktop', () => {
    assert.equal(detectar({ userAgent: MAC, maxTouchPoints: 10, touchSemHover: false }), false);
  });

  it('sem matchMedia cai na largura', () => {
    assert.equal(detectar({ userAgent: 'x', semMatchMedia: true, largura: 400 }), true);
    assert.equal(detectar({ userAgent: 'x', semMatchMedia: true, largura: 1440 }), false);
  });
});
