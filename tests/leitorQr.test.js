import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import jsQR from 'jsqr';

import { abertoComoApp, extrairCodigo, recortesCandidatos } from '../imports/ui/leitorQr.js';
import { gerarMatrizQr, urlPareamento } from '../imports/ui/remoto.js';

// Desenha a matriz como o painel: módulos laranja sobre fundo escuro.
function rgbaDoQr(matriz, escala = 6, margem = 4) {
  const lado = (matriz.length + margem * 2) * escala;
  const dados = new Uint8ClampedArray(lado * lado * 4);
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const linha = Math.floor(y / escala) - margem;
      const coluna = Math.floor(x / escala) - margem;
      const ligado = matriz[linha]?.[coluna];
      const i = (y * lado + x) * 4;
      const [r, g, b] = ligado ? [255, 120, 60] : [24, 24, 28];
      dados.set([r, g, b, 255], i);
    }
  }
  return { dados, lado };
}

describe('leitor de QR do PWA', () => {
  it('extrai o código só de URL do painel com ?p=', () => {
    assert.equal(extrairCodigo('http://192.168.0.100:1980/?p=abc-_9'), 'abc-_9');
    assert.equal(extrairCodigo('http://mac:3003/'), '');
    assert.equal(extrairCodigo('não é url'), '');
    assert.equal(extrairCodigo(''), '');
  });

  it('jsQR lê o QR invertido (laranja sobre escuro) que o painel desenha', () => {
    const url = urlPareamento('http://192.168.0.100:1980', 'tndmY0-eaexPPL1Dxv7U-g');
    const { dados, lado } = rgbaDoQr(gerarMatrizQr(url));
    assert.equal(jsQR(dados, lado, lado, { inversionAttempts: 'dontInvert' }), null);
    const achado = jsQR(dados, lado, lado, { inversionAttempts: 'attemptBoth' });
    assert.equal(extrairCodigo(achado?.data), 'tndmY0-eaexPPL1Dxv7U-g');
  });

  it('reconhece o app instalado', () => {
    assert.equal(abertoComoApp({ navigator: { standalone: true } }), true);
    assert.equal(abertoComoApp({ navigator: {}, matchMedia: () => ({ matches: true }) }), true);
    assert.equal(abertoComoApp({ navigator: {}, matchMedia: () => ({ matches: false }) }), false);
  });
});

describe('recortes do leitor', () => {
  it('começa pela foto inteira e pelo centro, e todo recorte cabe na foto', () => {
    const recortes = recortesCandidatos(3024, 4032);
    assert.deepEqual(recortes[0], { x: 0, y: 0, w: 3024, h: 4032, lado: 800 });
    assert.ok(recortes.length >= 20);
    for (const r of recortes) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 3024 + 1e-6 && r.y + r.h <= 4032 + 1e-6);
    }
  });
});
