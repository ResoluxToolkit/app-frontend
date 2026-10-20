import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  carregarConversa,
  instalacaoVista,
  marcarInstalacaoVista,
  salvarConversa,
} from '../imports/ui/persistencia.js';

// Shim mínimo de localStorage pra rodar a lógica fora do navegador.
class ArmazenamentoFalso {
  constructor() { this.mapa = new Map(); }
  getItem(chave) { return this.mapa.has(chave) ? this.mapa.get(chave) : null; }
  setItem(chave, valor) { this.mapa.set(chave, String(valor)); }
  removeItem(chave) { this.mapa.delete(chave); }
}

describe('persistência local da conversa', () => {
  beforeEach(() => { globalThis.localStorage = new ArmazenamentoFalso(); });

  it('salva e recarrega a conversa sem estados transitórios', () => {
    salvarConversa([
      { id: 7, papel: 'usuario', texto: 'Oi', hora: '10:00' },
      {
        id: 8,
        papel: 'agente',
        texto: 'Tudo certo.',
        hora: '10:00',
        tokens: 12,
        streaming: true,
        estadoOrb: 'composing',
      },
    ]);
    const carregada = carregarConversa();
    assert.equal(carregada.length, 2);
    assert.deepEqual(carregada[1], {
      id: 8,
      papel: 'agente',
      texto: 'Tudo certo.',
      hora: '10:00',
      tokens: 12,
    });
  });

  it('descarta conversa corrompida ou vazia', () => {
    localStorage.setItem('resolux-conversa-v1', '{"nao":"sou lista"}');
    assert.equal(carregarConversa(), null);
    localStorage.setItem(
      'resolux-conversa-v1',
      '[{"papel":"fantasma","texto":"x","hora":"01:00"}]',
    );
    assert.equal(carregarConversa(), null);
  });

  it('sem armazenamento a leitura cai no padrão', () => {
    delete globalThis.localStorage;
    assert.equal(carregarConversa(), null);
    salvarConversa([{ id: 1, papel: 'usuario', texto: 'Oi', hora: '10:00' }]);
  });

  it('guarda o visto da instrução de instalar', () => {
    assert.equal(instalacaoVista(), false);
    marcarInstalacaoVista();
    assert.equal(instalacaoVista(), true);
  });
});
