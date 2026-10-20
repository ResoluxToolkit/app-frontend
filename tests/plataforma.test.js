import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { secaoDaPlataforma } from '../imports/ui/plataforma.js';

describe('seção equivalente por plataforma', () => {
  it('no mobile a Composição vira Atalhos', () => {
    assert.equal(secaoDaPlataforma('monitor', true), 'atalhos');
    assert.equal(secaoDaPlataforma('atalhos', true), 'atalhos');
  });

  it('no desktop os Atalhos viram Composição', () => {
    assert.equal(secaoDaPlataforma('atalhos', false), 'monitor');
    assert.equal(secaoDaPlataforma('monitor', false), 'monitor');
  });

  it('as outras seções não mudam em nenhuma plataforma', () => {
    for (const secao of ['assistente', 'status', 'ajustes']) {
      assert.equal(secaoDaPlataforma(secao, true), secao);
      assert.equal(secaoDaPlataforma(secao, false), secao);
    }
  });
});
