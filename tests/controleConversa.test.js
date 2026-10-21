import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizarControle } from '../imports/api/index.js';
import { MockDaemon } from '../imports/api/mock.js';

describe('conversa em um lugar só', () => {
  it('normaliza o controle e cai em escrita sem a mensagem do motor', () => {
    assert.deepEqual(normalizarControle(undefined), { aqui: 'escrita', remotos: [] });
    assert.deepEqual(normalizarControle({ aqui: 'leitura', remotos: [{ id: 7, nome: 'iPhone' }, null, {}] }), {
      aqui: 'leitura',
      remotos: [{ id: '7', nome: 'iPhone' }],
    });
    assert.equal(normalizarControle({ aqui: 'qualquer' }).aqui, 'escrita');
  });

  it('mock simulado: celular com a conversa, retomar e desconectar', async () => {
    const armazenado = { 'resolux-simular-remoto': '1' };
    globalThis.localStorage = { getItem: (k) => armazenado[k] ?? null };
    try {
      const mock = new MockDaemon();
      const vistos = [];
      const inscricao = mock.assinarConversa({ onControle: (c) => vistos.push(c) });
      assert.equal(vistos.at(-1).aqui, 'leitura');
      assert.equal(vistos.at(-1).remotos.length, 1);
      inscricao.assumir();
      assert.equal(vistos.at(-1).aqui, 'escrita');
      await mock.revogarAparelho('simulado');
      assert.deepEqual(vistos.at(-1).remotos, []);
    } finally {
      delete globalThis.localStorage;
    }
  });
});

describe('token velho depois de reiniciar o motor', () => {
  it('canal caiu e o motor responde 401: esquece o token', async () => {
    const { conferirToken, lerToken } = await import('../imports/api/acesso.js');
    const guardado = { 'resolux-token-aparelho': 'velho' };
    globalThis.localStorage = {
      getItem: (k) => guardado[k] ?? null,
      setItem: (k, v) => { guardado[k] = v; },
      removeItem: (k) => { delete guardado[k]; },
    };
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => new Response('{}', { status: 401 });
    try {
      await conferirToken('', 1_000_000);
      assert.equal(lerToken(), '');
    } finally {
      globalThis.fetch = fetchOriginal;
      delete globalThis.localStorage;
    }
  });
});
