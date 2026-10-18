import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { avaliarSaude, LIMITES } from '../imports/ui/saude.js';

const amostras = (valor, quantidade = LIMITES.janela) =>
  Array.from({ length: quantidade }, (_, i) => ({ hora: `12:00:${String(i).padStart(2, '0')}`, valor }));

const GB = 1024 ** 3;
const memoria = (usadaGb, comprimidaGb = 0) => ({
  totalBytes: 8 * GB,
  usedBytes: usadaGb * GB,
  compressorBytes: comprimidaGb * GB,
});

const sano = () => ({
  contrato: { memory: memoria(3), ndi: { isAvailable: true }, midi: { isAvailable: true }, artNet: {} },
  historicoCpu: amostras(30),
  historicoGpu: amostras(40),
});

describe('veredito da aba Status', () => {
  it('sem contrato avisa que aguarda o motor, sem inventar veredito', () => {
    const saude = avaliarSaude({});
    assert.equal(saude.nivel, 'desconhecido');
    assert.match(saude.frase, /Aguardando/);
  });

  it('máquina folgada e dispositivos de pé: tudo certo', () => {
    const saude = avaliarSaude(sano());
    assert.equal(saude.nivel, 'ok');
    assert.equal(saude.titulo, 'Tudo certo');
    assert.deepEqual(saude.motivos, []);
  });

  it('GPU acima de 85% sustentada vira Atenção, em linguagem de operador', () => {
    const saude = avaliarSaude({ ...sano(), historicoGpu: amostras(90) });
    assert.equal(saude.nivel, 'atencao');
    assert.match(saude.frase, /GPU em 90%: risco de travar o vídeo/);
  });

  it('um pico isolado não derruba o veredito', () => {
    const historicoGpu = [...amostras(10, LIMITES.janela - 1), { hora: '12:01:00', valor: 100 }];
    assert.equal(avaliarSaude({ ...sano(), historicoGpu }).nivel, 'ok');
  });

  it('sem amostras suficientes não julga a carga', () => {
    const saude = avaliarSaude({ ...sano(), historicoCpu: amostras(99, LIMITES.minimoAmostras - 1) });
    assert.equal(saude.nivel, 'ok');
  });

  it('CPU acima de 95% sustentada vira Problema e passa na frente da Atenção', () => {
    const saude = avaliarSaude({ ...sano(), historicoCpu: amostras(97), historicoGpu: amostras(90) });
    assert.equal(saude.nivel, 'problema');
    assert.equal(saude.motivos[0].nivel, 'problema');
    assert.match(saude.frase, /^CPU em 97%/);
  });

  it('memória sob pressão por compressão alta vira Atenção mesmo com pouca memória livre', () => {
    const saude = avaliarSaude({ ...sano(), contrato: { ...sano().contrato, memory: memoria(5, 2.5) } });
    assert.equal(saude.nivel, 'atencao');
    assert.match(saude.frase, /Memória sob pressão: 31% comprimida/);
  });

  it('memória acima de 95% em uso é Problema', () => {
    const saude = avaliarSaude({ ...sano(), contrato: { ...sano().contrato, memory: memoria(7.8) } });
    assert.equal(saude.nivel, 'problema');
    assert.match(saude.frase, /quase esgotada/);
  });

  it('NDI, Art-Net e MIDI com problema aparecem como Atenção', () => {
    const contrato = {
      ...sano().contrato,
      ndi: { isAvailable: false },
      artNet: { error: 'timeout' },
      midi: { isAvailable: false },
    };
    const saude = avaliarSaude({ ...sano(), contrato });
    assert.equal(saude.nivel, 'atencao');
    assert.equal(saude.motivos.length, 3);
    assert.match(saude.motivos.map((m) => m.texto).join(' '), /NDI.*Art-Net.*MIDI/);
  });

  it('a frase resume só os dois motivos mais importantes', () => {
    const contrato = { ...sano().contrato, memory: memoria(7, 3), ndi: { isAvailable: false } };
    const saude = avaliarSaude({ ...sano(), contrato, historicoGpu: amostras(90) });
    assert.ok(saude.motivos.length >= 4);
    assert.equal(saude.frase, saude.motivos.slice(0, 2).map((motivo) => motivo.texto).join(' '));
  });
});
