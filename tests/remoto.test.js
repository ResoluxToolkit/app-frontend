import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gerarMatrizQr, restoReedSolomon, urlRemota } from '../imports/ui/remoto.js';

const paraHex = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

describe('QR do painel remoto', () => {
  it('Reed-Solomon bate com o vetor de referência (dados v1-M)', () => {
    const dados = [
      0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11,
      0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11,
    ];
    assert.equal(paraHex(restoReedSolomon(dados, 10)), 'a524d4c1ed36c7872c55');
  });

  it('gera matriz 25x25 com finders, timing e módulo escuro', () => {
    const matriz = gerarMatrizQr('http://mac:3003');
    assert.equal(matriz.length, 25);
    for (const linha of matriz) assert.equal(linha.length, 25);

    assert.equal(matriz[0][3], true);
    assert.equal(matriz[3][0], true);
    assert.equal(matriz[3][3], true);
    assert.equal(matriz[1][3], false);
    assert.equal(matriz[3][7], false);

    assert.equal(matriz[6][8], true);
    assert.equal(matriz[6][9], false);
    assert.equal(matriz[6][10], true);

    assert.equal(matriz[17][8], true);
  });

  it('determinístico e sensível ao conteúdo', () => {
    const a = gerarMatrizQr('http://mac:3003');
    const b = gerarMatrizQr('http://mac:3003');
    const c = gerarMatrizQr('http://192.168.0.109:3003');
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
  });

  it('recusa texto acima da capacidade das versões 1-4', () => {
    assert.throws(() => gerarMatrizQr('a'.repeat(63)), /capacidade/);
  });

  it('urlRemota devolve a origem de rede e recusa localhost/arquivo', () => {
    assert.equal(urlRemota({ protocol: 'http:', hostname: 'mac', origin: 'http://mac:3003' }), 'http://mac:3003');
    assert.equal(urlRemota({ protocol: 'http:', hostname: '192.168.0.109', origin: 'http://192.168.0.109:3003' }), 'http://192.168.0.109:3003');
    assert.equal(urlRemota({ protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:3003' }), '');
    assert.equal(urlRemota({ protocol: 'file:', hostname: '', origin: 'null' }), '');
    assert.equal(urlRemota(undefined), '');
  });
});
