import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import jsQR from 'jsqr';

import { abertoComoApp, aplicarCanal, extrairCodigo, lerQrAoVivo, podeLerAoVivo, recortesCandidatos } from '../imports/ui/leitorQr.js';
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
    assert.deepEqual(recortes[0], { x: 0, y: 0, w: 3024, h: 4032, lado: 800, canal: 'laranja' });
    assert.ok(recortes.length >= 20);
    for (const r of recortes) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 3024 + 1e-6 && r.y + r.h <= 4032 + 1e-6);
    }
  });
});

describe('canal laranja', () => {
  it('apaga reflexo branco e fundo escuro, e acende o laranja', () => {
    const px = new Uint8ClampedArray([255, 120, 60, 255, 250, 250, 250, 255, 20, 20, 25, 255]);
    aplicarCanal(px, 'laranja');
    assert.equal(px[0], 255); // laranja
    assert.equal(px[4], 0); // reflexo
    assert.equal(px[8], 0); // fundo
  });
});

describe('leitura ao vivo', () => {
  it('só em contexto seguro com câmera disponível', () => {
    const camera = { mediaDevices: { getUserMedia() {} } };
    assert.equal(podeLerAoVivo({ isSecureContext: true, navigator: camera }), true);
    assert.equal(podeLerAoVivo({ isSecureContext: false, navigator: camera }), false);
    assert.equal(podeLerAoVivo({ isSecureContext: true, navigator: {} }), false);
  });

  it('desliga as trilhas da câmera se for cancelado enquanto getUserMedia ainda abre', async () => {
    const navOriginal = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let trilhaParada = false;
    const ctrl = new AbortController();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: async () => {
            // Usuário cancela enquanto a câmera está abrindo.
            ctrl.abort();
            return {
              getTracks: () => [{ stop: () => { trilhaParada = true; } }],
            };
          },
        },
      },
    });
    try {
      const video = { srcObject: 'anterior' };
      await lerQrAoVivo(video, () => {}, { signal: ctrl.signal });
      assert.equal(trilhaParada, true);
      assert.equal(video.srcObject, null);
    } finally {
      if (navOriginal) Object.defineProperty(globalThis, 'navigator', navOriginal);
    }
  });
});
