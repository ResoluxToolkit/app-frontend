import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { montarGrade, rotuloCamada, mesmaGrade } from '../imports/ui/grade.js';
import { MockDaemon } from '../imports/api/mock.js';

const composicao = {
  layers: [
    {
      name: { value: 'Layer #' },
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
    { name: { value: 'TimeGrid' }, clips: [] },
  ],
};

describe('grade de clips', () => {
  it('monta endereços crescentes e exibe camadas na ordem visual do Arena', () => {
    const grade = montarGrade(composicao);
    assert.equal(grade.camadas.length, 2);
    assert.deepEqual(grade.camadas.map((camada) => camada.numero), [2, 1]);
    assert.deepEqual(
      grade.camadas[1].celulas.map((celula) => celula.id),
      ['1.1', '1.2', '1.3', '1.4', '1.5'],
    );
    assert.equal(grade.camadas[0].celulas.length, 0);
  });

  it('classifica preenchido, vazio e generator como a engine', () => {
    const camadaUm = montarGrade(composicao).camadas.find((camada) => camada.numero === 1);
    const celulas = camadaUm.celulas;
    assert.equal(celulas[0].preenchido, true);
    assert.equal(celulas[1].preenchido, false);
    assert.equal(celulas[2].preenchido, true);
  });

  it('marca só o clip do active_clip como tocando', () => {
    const camadaUm = montarGrade(composicao).camadas.find((camada) => camada.numero === 1);
    const celulas = camadaUm.celulas;
    assert.equal(celulas[0].ativo, true);
    assert.ok(celulas.slice(1).every((celula) => !celula.ativo));
    assert.deepEqual(montarGrade(composicao).ativo, { nome: 'Spike', endereco: '1.1' });
  });

  it('só aceita thumbnail com id e last_update válidos', () => {
    const camadaUm = montarGrade(composicao).camadas.find((camada) => camada.numero === 1);
    const celulas = camadaUm.celulas;
    assert.deepEqual(celulas[0].thumb, { id: 5, stamp: '1696000000' });
    assert.equal(celulas[2].thumb, null);
    assert.equal(celulas[3].thumb, null);
    assert.equal(celulas[4].thumb, null);
  });

  it('rotula camadas pelo nome do Arena, preenchendo o # com o número', () => {
    const grade = montarGrade(composicao);
    assert.deepEqual(grade.camadas.map((camada) => camada.rotulo), ['TimeGrid', 'Layer 1']);
    assert.equal(rotuloCamada({ value: 'Camada especial' }, 2), 'Camada especial');
    assert.equal(rotuloCamada({ value: 'Layer #' }, 3), 'Layer 3');
    assert.equal(rotuloCamada(null, 4), 'Camada 4');
  });

  it('ignora mudança invisível do transporte e só marca mudança de grade', () => {
    const grade = montarGrade(composicao);
    const mesmoPoll = montarGrade(composicao);
    assert.equal(mesmaGrade(grade, mesmoPoll), true);

    const comTransporteDiferente = structuredClone(composicao);
    comTransporteDiferente.layers[0].clips[0].transport.controls.duration = { value: 999 };
    assert.equal(mesmaGrade(grade, montarGrade(comTransporteDiferente)), true);

    const comNomeDiferente = structuredClone(composicao);
    comNomeDiferente.layers[0].clips[0].name = { value: 'Outro clip' };
    assert.equal(mesmaGrade(grade, montarGrade(comNomeDiferente)), false);
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
    assert.deepEqual(grade.camadas.map((camada) => camada.numero), [3, 2, 1]);
    assert.deepEqual(grade.camadas.map((camada) => camada.rotulo), ['Layer 3', 'Layer 2', 'Layer 1']);
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
