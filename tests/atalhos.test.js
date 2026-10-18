import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  CORES_ATALHO,
  aplicarOrdem,
  normalizarNome,
  proximoTamanho,
  resolverAtalho,
  sanitizarAtalho,
} from '../imports/ui/atalhos.js';
import { carregarAtalhos, salvarAtalhos } from '../imports/ui/persistencia.js';

class ArmazenamentoFalso {
  constructor() { this.mapa = new Map(); }
  getItem(chave) { return this.mapa.has(chave) ? this.mapa.get(chave) : null; }
  setItem(chave, valor) { this.mapa.set(chave, String(valor)); }
  removeItem(chave) { this.mapa.delete(chave); }
}

const colunas = [
  { numero: 1, rotulo: 'Introdução', preenchidos: 3, tocando: 2 },
  { numero: 2, rotulo: 'Abrir PIP', preenchidos: 1, tocando: 0 },
  { numero: 3, rotulo: 'Fechar PIP', preenchidos: 1, tocando: 0 },
  { numero: 4, rotulo: 'Palestra', preenchidos: 2, tocando: 0 },
  { numero: 5, rotulo: 'palestra', preenchidos: 0, tocando: 0 },
];

describe('nome do atalho', () => {
  it('ignora acento, caixa e espaço sobrando', () => {
    assert.equal(normalizarNome('  INTRODUÇÃO '), 'introducao');
    assert.equal(normalizarNome('Abrir   PIP'), 'abrir pip');
    assert.equal(normalizarNome(null), '');
  });

  it('só existe com nome; cor inválida cai na primeira e o nome é aparado', () => {
    assert.equal(sanitizarAtalho(null), null);
    assert.equal(sanitizarAtalho({ rotulo: '   ' }), null);
    assert.equal(sanitizarAtalho({ rotulo: 42 }), null);
    const atalho = sanitizarAtalho({ id: 'x1', rotulo: '  Introdução  ', cor: 'rosa' });
    assert.deepEqual(atalho, { id: 'x1', rotulo: 'Introdução', cor: CORES_ATALHO[0], tamanho: 'p' });
    assert.equal(sanitizarAtalho({ rotulo: 'a'.repeat(60) }).rotulo.length, 24);
    assert.match(sanitizarAtalho({ rotulo: 'Sem id' }).id, /^a[a-z0-9]+$/);
  });
});

describe('tamanho da tecla no bento', () => {
  it('aceita p, m e g; qualquer outro valor cai em pequeno', () => {
    assert.equal(sanitizarAtalho({ rotulo: 'A', tamanho: 'm' }).tamanho, 'm');
    assert.equal(sanitizarAtalho({ rotulo: 'A', tamanho: 'g' }).tamanho, 'g');
    assert.equal(sanitizarAtalho({ rotulo: 'A', tamanho: 'enorme' }).tamanho, 'p');
    assert.equal(sanitizarAtalho({ rotulo: 'A' }).tamanho, 'p');
  });
});

describe('edição do deck', () => {
  it('o botão de tamanho cicla p, m, g e volta ao p', () => {
    assert.deepEqual(['p', 'm', 'g', 'p'].map(proximoTamanho), ['m', 'g', 'p', 'm']);
    assert.equal(proximoTamanho('invalido'), 'p');
  });

  it('reordena pela sequência de ids vista na tela', () => {
    const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.deepEqual(aplicarOrdem(lista, ['c', 'a', 'b']).map((a) => a.id), ['c', 'a', 'b']);
  });

  it('ignora id desconhecido ou repetido e não perde nenhum atalho', () => {
    const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.deepEqual(aplicarOrdem(lista, ['b', 'x', 'b']).map((a) => a.id), ['b', 'a', 'c']);
    assert.deepEqual(aplicarOrdem(lista, []).map((a) => a.id), ['a', 'b', 'c']);
  });
});

describe('vínculo do atalho com a coluna pelo nome', () => {
  it('acha a coluna e traz o estado ao vivo, sem depender de acento ou caixa', () => {
    const resultado = resolverAtalho({ rotulo: 'introducao' }, colunas);
    assert.deepEqual(resultado, { estado: 'ok', numeros: [1], tocando: 2, preenchidos: 3 });
  });

  it('avisa quando duas colunas têm o mesmo nome, sem escolher uma', () => {
    const resultado = resolverAtalho({ rotulo: 'Palestra' }, colunas);
    assert.equal(resultado.estado, 'ambiguo');
    assert.deepEqual(resultado.numeros, [4, 5]);
  });

  it('avisa quando nenhuma coluna tem o nome', () => {
    assert.equal(resolverAtalho({ rotulo: 'Encerramento' }, colunas).estado, 'sem-coluna');
    assert.equal(resolverAtalho({ rotulo: 'Qualquer' }, undefined).estado, 'sem-coluna');
  });
});

describe('persistência dos atalhos', () => {
  beforeEach(() => { globalThis.localStorage = new ArmazenamentoFalso(); });

  it('salva e recarrega o deck, descartando entradas inválidas', () => {
    salvarAtalhos([
      { id: 'a1', rotulo: 'Introdução', cor: 'verde', tamanho: 'g' },
      { id: 'a2', rotulo: '   ', cor: 'azul' },
      null,
    ]);
    assert.deepEqual(carregarAtalhos(), [{ id: 'a1', rotulo: 'Introdução', cor: 'verde', tamanho: 'g' }]);
  });

  it('sem armazenamento ou com JSON quebrado volta ao deck vazio', () => {
    assert.deepEqual(carregarAtalhos(), []);
    globalThis.localStorage.setItem('resolux-atalhos-v1', '{quebrado');
    assert.deepEqual(carregarAtalhos(), []);
    globalThis.localStorage.setItem('resolux-atalhos-v1', '{"nao":"lista"}');
    assert.deepEqual(carregarAtalhos(), []);
  });
});
