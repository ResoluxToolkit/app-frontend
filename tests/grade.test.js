import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { montarGrade } from '../imports/ui/grade.js';
import { MockDaemon } from '../imports/api/mock.js';

const composicao = {
  layers: [
    {
      active_clip: { id: 11 },
      clips: [
        {
          id: 11,
          name: { value: 'Spike' },
          video: { fileinfo: { path: { value: '/media/Spike.mov' } } },
          transport: { controls: {} },
          thumbnail: { id: 5, last_update: '1696000000', is_default: false },
        },
        { id: 12, name: { value: '' } },
        { id: 13, name: { value: 'Sólido' }, transport: { controls: {} } },
        {
          id: 14,
          name: { value: 'SemThumb' },
          transport: { controls: {} },
          thumbnail: { id: 6, last_update: '1696000000', is_default: true },
        },
        {
          id: 15,
          name: { value: 'StampZero' },
          transport: { controls: {} },
          thumbnail: { id: 7, last_update: '0', is_default: false },
        },
      ],
    },
    { clips: [] },
  ],
};

describe('grade de clips', () => {
  it('monta endereços camada.coluna na ordem do Arena', () => {
    const grade = montarGrade(composicao);
    assert.equal(grade.camadas.length, 2);
    assert.deepEqual(
      grade.camadas[0].celulas.map((celula) => celula.id),
      ['1.1', '1.2', '1.3', '1.4', '1.5'],
    );
    assert.equal(grade.camadas[1].celulas.length, 0);
  });

  it('classifica preenchido, vazio e generator como a engine', () => {
    const celulas = montarGrade(composicao).camadas[0].celulas;
    assert.equal(celulas[0].preenchido, true);
    assert.equal(celulas[1].preenchido, false);
    assert.equal(celulas[2].preenchido, true);
  });

  it('marca só o clip do active_clip como tocando', () => {
    const celulas = montarGrade(composicao).camadas[0].celulas;
    assert.equal(celulas[0].ativo, true);
    assert.ok(celulas.slice(1).every((celula) => !celula.ativo));
    assert.deepEqual(montarGrade(composicao).ativo, { nome: 'Spike', endereco: '1.1' });
  });

  it('só aceita thumbnail com id e last_update válidos', () => {
    const celulas = montarGrade(composicao).camadas[0].celulas;
    assert.deepEqual(celulas[0].thumb, { id: 5, stamp: '1696000000' });
    assert.equal(celulas[2].thumb, null);
    assert.equal(celulas[3].thumb, null);
    assert.equal(celulas[4].thumb, null);
  });
});

describe('MockDaemon', () => {
  it('empurra a composição de exemplo via assinatura', async () => {
    const backend = new MockDaemon();
    const composicaoMock = await new Promise((resolve) => {
      const inscricao = backend.assinarMonitor({ onDados: resolve });
      inscricao.cancelar();
    });
    const grade = montarGrade(composicaoMock);
    assert.equal(grade.camadas.length, 3);
    assert.ok(grade.camadas.every((camada) => camada.celulas.length === 9));
    assert.equal(backend.urlThumbnail(1, 'x'), null);
  });

  it('cancela a assinatura após o poll inicial', async () => {
    const backend = new MockDaemon();
    let chamadas = 0;
    const inscricao = backend.assinarMonitor({ onDados: () => { chamadas += 1; } });
    inscricao.cancelar();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(chamadas, 1);
  });
});
