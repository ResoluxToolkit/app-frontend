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
