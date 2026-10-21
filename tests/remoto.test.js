import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  gerarMatrizQr,
  lerCodigoPareamento,
  restoReedSolomon,
  segundosRestantes,
  urlPareamento,
  urlRemota,
} from '../imports/ui/remoto.js';
import { aoEsquecerToken, comToken, esquecerToken } from '../imports/api/acesso.js';
import { ResoluxDaemon } from '../imports/api/client.js';
import { MockDaemon, VALIDADE_PAREAMENTO_S } from '../imports/api/mock.js';

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

  it('cresce até a v6 (41x41) para caber URL com código e recusa acima disso', () => {
    assert.equal(gerarMatrizQr('a'.repeat(14)).length, 21);
    assert.equal(gerarMatrizQr('a'.repeat(62)).length, 33);
    assert.equal(gerarMatrizQr('a'.repeat(106)).length, 41);
    assert.throws(() => gerarMatrizQr('a'.repeat(107)), /capacidade/);
  });

  it('v1 não ganha padrão de alinhamento no meio dos dados', () => {
    // Na v1 não existe alinhamento; o anel 5x5 em (14,14) seria lixo
    // por cima dos dados. Comparar dois textos: a região tem de variar.
    const a = gerarMatrizQr('a');
    const b = gerarMatrizQr('b');
    const regiao = (m) => m.slice(12, 17).map((linha) => linha.slice(12, 17).join());
    assert.notDeepEqual(regiao(a), regiao(b));
  });

  it('urlRemota devolve a origem de rede e recusa localhost/arquivo', () => {
    assert.equal(urlRemota({ protocol: 'http:', hostname: 'mac', origin: 'http://mac:3003' }), 'http://mac:3003');
    assert.equal(urlRemota({ protocol: 'http:', hostname: '192.168.0.109', origin: 'http://192.168.0.109:3003' }), 'http://192.168.0.109:3003');
    assert.equal(urlRemota({ protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:3003' }), '');
    assert.equal(urlRemota({ protocol: 'file:', hostname: '', origin: 'null' }), '');
    assert.equal(urlRemota(undefined), '');
  });
});

describe('pareamento do celular', () => {
  it('URL do QR leva o código e o celular lê de volta', () => {
    const url = urlPareamento('http://192.168.0.10:1980', 'abc-_9');
    assert.equal(url, 'http://192.168.0.10:1980/?p=abc-_9');
    assert.equal(lerCodigoPareamento(new URL(url)), 'abc-_9');
    assert.equal(lerCodigoPareamento({ search: '' }), '');
    assert.equal(urlPareamento('', 'x'), '');
  });

  it('contagem regressiva em epoch segundos, nunca negativa', () => {
    assert.equal(segundosRestantes(1000, 900_000), 100);
    assert.equal(segundosRestantes(1000, 2_000_000), 0);
  });

  it('token vai na query só quando existe', () => {
    assert.equal(comToken('/api/v1/ws', ''), '/api/v1/ws');
    assert.equal(comToken('/monitor', 'a b'), '/monitor?token=a%20b');
    assert.equal(comToken('/x?y=1', 't'), '/x?y=1&token=t');
  });

  it('mock gira o código no máximo a cada 5 min e aceita só o código atual, uma vez', async () => {
    const mock = new MockDaemon();
    const t0 = 1_700_000_000_000;
    const primeiro = await mock.obterPareamento(t0);
    assert.ok(primeiro.codigo.length >= 16);
    assert.equal(primeiro.expiraEm - Math.floor(t0 / 1000), VALIDADE_PAREAMENTO_S);
    assert.ok(VALIDADE_PAREAMENTO_S <= 300);
    assert.deepEqual(await mock.obterPareamento(t0 + 60_000), primeiro);

    const depois = await mock.obterPareamento(t0 + VALIDADE_PAREAMENTO_S * 1000);
    assert.notEqual(depois.codigo, primeiro.codigo);

    await assert.rejects(mock.parear(primeiro.codigo, t0), { codigo: 'pairing_invalid' });
    const { token } = await mock.parear(depois.codigo, t0 + VALIDADE_PAREAMENTO_S * 1000);
    assert.ok(token);
    await assert.rejects(mock.parear(depois.codigo, t0), { codigo: 'pairing_invalid' });
  });
});

describe('follow-ups do pareamento', () => {
  it('POST de pareamento sem resposta vira sem_resposta, sem travar o boot', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('rede caiu'));
    try {
      const daemon = new ResoluxDaemon({ base: 'http://x', wsUrl: 'ws://x' });
      await assert.rejects(daemon.parear('abc'), { codigo: 'sem_resposta' });
    } finally {
      globalThis.fetch = original;
    }
  });

  it('apagar o token avisa quem ouve (a UI volta para "nenhum")', () => {
    let avisos = 0;
    const parar = aoEsquecerToken(() => { avisos += 1; });
    esquecerToken();
    parar();
    esquecerToken();
    assert.equal(avisos, 1);
  });
});
