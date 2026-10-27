import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { esquecerToken } from '../imports/api/acesso.js';
import {
  acessoPainel,
  concluirPareamentoDaUrl,
  estadoPareamento,
  hostLocal,
  sondarBackend,
} from '../imports/api/index.js';

const fetchOriginal = globalThis.fetch;

function responder(rotas) {
  globalThis.fetch = async (url) => {
    const caminho = String(url).replace(/^https?:\/\/[^/]+/, '');
    const rota = rotas[caminho];
    if (!rota) throw new Error(`sem rota ${caminho}`);
    return new Response(JSON.stringify(rota.corpo ?? {}), {
      status: rota.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

describe('trava do painel', () => {
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it('mock só vale no próprio Mac', () => {
    assert.ok(hostLocal({ hostname: 'localhost' }));
    assert.ok(hostLocal({ hostname: '127.0.0.1' }));
    assert.ok(!hostLocal({ hostname: '192.168.0.100' }));
    assert.ok(!hostLocal({ hostname: 'mac' }));
  });

  it('motor de pé mas /session 401: aparelho fica travado', async () => {
    responder({
      '/api/v1/health': { corpo: { status: 'online' } },
      '/api/v1/session': { status: 401, corpo: { error: { code: 'unauthorized' } } },
    });
    await sondarBackend({ hostname: '192.168.0.100' });
    assert.equal(acessoPainel.get(), 'sem_pareamento');
  });

  it('motor fora, aberto pela rede: não cai no mock', async () => {
    globalThis.fetch = () => Promise.reject(new Error('fora'));
    await sondarBackend({ hostname: '192.168.0.100' });
    assert.equal(acessoPainel.get(), 'motor_fora');
  });

  it('motor de pé e sessão ok: libera', async () => {
    responder({
      '/api/v1/health': { corpo: { status: 'online' } },
      '/api/v1/session': { corpo: { mode: 'timeline' } },
      '/api/v1/tools': { corpo: { tools: [] } },
    });
    await sondarBackend({ hostname: 'localhost' });
    assert.equal(acessoPainel.get(), 'liberado');
  });

  it('celular abre URL com ?p=, pareia e libera o painel; 401 posterior trava de novo', async () => {
    responder({
      '/api/v1/pareamento': { corpo: { token: 'tok-123' } },
      '/api/v1/health': { corpo: { status: 'online' } },
      '/api/v1/session': { corpo: { mode: 'timeline' } },
      '/api/v1/tools': { corpo: { tools: [] } },
    });
    await concluirPareamentoDaUrl({ search: '?p=codigo-valido' });
    assert.equal(estadoPareamento.get(), 'pareado');
    await sondarBackend({ hostname: '192.168.0.100' });
    assert.equal(acessoPainel.get(), 'liberado');

    esquecerToken();
    assert.equal(estadoPareamento.get(), 'nenhum');
    assert.equal(acessoPainel.get(), 'sem_pareamento');
  });
});
