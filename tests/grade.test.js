import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatarTempo, montarGrade, rotuloCamada, mesmaGrade, progressosTimeGrid } from '../imports/ui/grade.js';
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

describe('colunas', () => {
  it('deriva as colunas dos clips quando o Arena não manda columns', () => {
    const { colunas } = montarGrade(composicao);
    assert.equal(colunas.length, 5);
    assert.deepEqual(colunas.map((coluna) => coluna.rotulo), ['Coluna 1', 'Coluna 2', 'Coluna 3', 'Coluna 4', 'Coluna 5']);
    assert.deepEqual(colunas[0], { numero: 1, rotulo: 'Coluna 1', preenchidos: 1, tocando: 1 });
    assert.deepEqual(colunas[1], { numero: 2, rotulo: 'Coluna 2', preenchidos: 0, tocando: 0 });
  });

  it('usa o nome do Arena, preenchendo o # com o número', () => {
    const comNomes = { ...composicao, columns: [{ name: { value: 'Column #' } }, { name: { value: 'Abertura' } }] };
    const { colunas } = montarGrade(comNomes);
    assert.deepEqual(colunas.slice(0, 3).map((coluna) => coluna.rotulo), ['Column 1', 'Abertura', 'Coluna 3']);
  });

  it('soma clips preenchidos e tocando por coluna entre as camadas', () => {
    const duasCamadas = {
      columns: [{ name: { value: 'Column #' } }],
      layers: [
        { name: { value: 'Layer #' }, active_clip: { id: 1 }, clips: [{ id: 1, name: { value: 'A' }, transport: { controls: {} } }] },
        { name: { value: 'Layer #' }, active_clip: { id: 9 }, clips: [{ id: 2, name: { value: 'B' }, transport: { controls: {} } }] },
      ],
    };
    const [coluna] = montarGrade(duasCamadas).colunas;
    assert.equal(coluna.preenchidos, 2);
    assert.equal(coluna.tocando, 1);
  });
});

describe('TimeGrid', () => {
  const composicaoTimeGrid = {
    layers: [
      {
        name: { value: 'timegrid' },
        clips: [
          { id: 21, name: { value: '4m' }, transport: { controls: { duration: { value: 240 }, speed: { value: 1 } } } },
          { id: 22, name: { value: '3m' }, transport: { controls: { duration: { value: 180 }, speed: { value: 1 } } } },
          { id: 23, name: { value: '2m' }, transport: { controls: { duration: { value: 120 }, speed: { value: 1 } } } },
          { id: 24, name: { value: '1m' }, transport: { controls: { duration: { value: 60 }, speed: { value: 1 } } } },
          { id: 25, name: { value: 'sem tempo' }, video: { fileinfo: { path: { value: '/clips/imagem.png' } } } },
        ],
      },
      { name: { value: 'Layer #' }, clips: [{ id: 31, name: { value: 'Normal' }, transport: { controls: { duration: { value: 90 } } } }] },
    ],
  };

  it('distribui larguras só pela camada com nome TimeGrid', () => {
    const grade = montarGrade(composicaoTimeGrid);
    const especial = grade.camadas.find((camada) => camada.numero === 1);
    assert.equal(especial.timeGrid, true);
    assert.equal(especial.celulas[0].largura, 0.4);
    assert.equal(especial.celulas[1].largura, 0.3);
    assert.equal(especial.celulas[2].largura, 0.2);
    assert.equal(especial.celulas[3].largura, 0.1);
    assert.equal(especial.totalTempo, 600);
    assert.equal(grade.camadas.find((camada) => camada.numero === 2).timeGrid, undefined);
  });

  it('usa Clip > Duration dividido por Clip > Speed', () => {
    const composicaoAcelerada = structuredClone(composicaoTimeGrid);
    composicaoAcelerada.layers[0].clips[3].transport.controls.speed = { value: 2 };
    const especial = montarGrade(composicaoAcelerada).camadas.find((camada) => camada.numero === 1);
    assert.deepEqual(especial.celulas.slice(0, 4).map((celula) => celula.tempo), [240, 180, 120, 30]);
    assert.equal(especial.celulas[3].largura, 30 / 570);
  });

  it('mantém slot sem Clip Duration visível, mas fora da soma', () => {
    const especial = montarGrade(composicaoTimeGrid).camadas.find((camada) => camada.numero === 1);
    assert.equal(especial.celulas[4].tempo, null);
    assert.equal(especial.celulas[4].largura, 0);
  });

  it('divide igual quando nenhum clip tem Clip Duration', () => {
    const composicaoVazia = structuredClone(composicaoTimeGrid);
    composicaoVazia.layers[0].clips = composicaoVazia.layers[0].clips.map((clip) => ({
      ...clip,
      transport: undefined,
    }));
    const especial = montarGrade(composicaoVazia).camadas.find((camada) => camada.numero === 1);
    assert.equal(especial.totalTempo, null);
    assert.equal(especial.timeGridSemTempo, true);
    assert.ok(especial.celulas.every((celula) => celula.largura === 0.2));
  });

  it('formata tempos em minutos e segundos', () => {
    assert.deepEqual([formatarTempo(30), formatarTempo(90), formatarTempo(240)], ['30s', '1m30s', '4m']);
  });

  it('lê o progresso do clip ativo do transporte do Arena', () => {
    const composicao = structuredClone(composicaoTimeGrid);
    composicao.layers[0].active_clip = { id: 22 };
    composicao.layers[0].clips[1].transport.position = { value: 90000, in: 0, out: 180000 };
    assert.deepEqual(progressosTimeGrid(composicao), [{ endereco: '1.2', progresso: 0.5 }]);
  });

  it('respeita o trim do transporte (in/out) no progresso', () => {
    const composicao = structuredClone(composicaoTimeGrid);
    composicao.layers[0].active_clip = { id: 23 };
    composicao.layers[0].clips[2].transport.position = { value: 150000, in: 100000, out: 200000 };
    assert.deepEqual(progressosTimeGrid(composicao), [{ endereco: '1.3', progresso: 0.5 }]);
  });

  it('limita o progresso entre 0 e 1', () => {
    const composicao = structuredClone(composicaoTimeGrid);
    composicao.layers[0].active_clip = { id: 21 };
    composicao.layers[0].clips[0].transport.position = { value: 300000, in: 0, out: 240000 };
    assert.equal(progressosTimeGrid(composicao)[0].progresso, 1);
    composicao.layers[0].clips[0].transport.position = { value: -50, in: 0, out: 240000 };
    assert.equal(progressosTimeGrid(composicao)[0].progresso, 0);
  });

  it('não inventa barra sem posição ou sem clip ativo', () => {
    const semPosicao = structuredClone(composicaoTimeGrid);
    semPosicao.layers[0].active_clip = { id: 21 };
    assert.deepEqual(progressosTimeGrid(semPosicao), []);
    const semAtivo = structuredClone(composicaoTimeGrid);
    semAtivo.layers[0].active_clip = null;
    semAtivo.layers[0].clips[0].transport.position = { value: 500, in: 0, out: 1000 };
    assert.deepEqual(progressosTimeGrid(semAtivo), []);
  });

  it('mantém a grade estável quando só a posição do transporte muda', () => {
    const antes = structuredClone(composicaoTimeGrid);
    antes.layers[0].active_clip = { id: 21 };
    antes.layers[0].clips[0].transport.position = { value: 60000, in: 0, out: 240000 };
    const depois = structuredClone(antes);
    depois.layers[0].clips[0].transport.position.value = 120000;
    assert.equal(mesmaGrade(montarGrade(antes), montarGrade(depois)), true);
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
    assert.equal(grade.camadas.length, 4);
    assert.deepEqual(grade.camadas.map((camada) => camada.numero), [4, 3, 2, 1]);
    assert.deepEqual(grade.camadas.map((camada) => camada.rotulo), ['TimeGrid', 'Layer 3', 'Layer 2', 'Layer 1']);
    assert.equal(grade.camadas[0].timeGrid, true);
    assert.ok(grade.camadas.slice(1).every((camada) => camada.celulas.length === 9));
    assert.equal(grade.camadas[0].celulas.length, 4);
    assert.equal(grade.colunas.length, 9);
    assert.equal(grade.camadas[0].totalTempo, 600);
    assert.equal(progressosTimeGrid(composicaoMock).length, 1);
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
