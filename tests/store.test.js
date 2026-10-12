import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ZOOM_MAX,
  ZOOM_MIN,
  adicionarMensagem,
  ajustarZoom,
  definirConversa,
  mensagens,
  incorporarTurnos,
  resetarConversa,
  resetarZoom,
  zoomGrade,
} from '../imports/ui/store.js';
import { Sinal } from '../imports/ui/signal.js';

describe('sinal reativo', () => {
  it('notifica assinantes somente ao mudar o valor', () => {
    const sinal = new Sinal(1);
    let chamadas = 0;
    const cancelar = sinal.assinar(() => { chamadas += 1; });
    sinal.set(1);
    sinal.set(2);
    cancelar();
    sinal.set(3);
    assert.equal(chamadas, 1);
  });
});

describe('zoom da grade', () => {
  it('limita o valor entre piso e teto', () => {
    ajustarZoom(99);
    assert.equal(zoomGrade.get(), ZOOM_MAX);
    ajustarZoom(0.01);
    assert.equal(zoomGrade.get(), ZOOM_MIN);
    resetarZoom();
    assert.equal(zoomGrade.get(), 1);
  });
});

describe('conversa do daemon', () => {
  it('definirConversa mapeia turnos válidos, renumera ids e segue a numeração', () => {
    definirConversa([
      { papel: 'sistema', texto: 'ruído fora do contrato', hora: '10:00' },
      { papel: 'usuario', texto: 'Olá', hora: '10:01' },
      { papel: 'agente', texto: 'Oi!', hora: '10:01' },
      { papel: 'agente', texto: '   ', hora: '10:02' },
    ]);
    const lista = mensagens.get();
    assert.equal(lista.length, 2);
    assert.deepEqual(
      lista.map((m) => [m.id, m.papel]),
      [
        [1, 'usuario'],
        [2, 'agente'],
      ],
    );
    assert.equal(lista[1].estadoOrb, 'breathing');
    assert.equal(lista[1].streaming, false);
    assert.ok(lista[1].tokens >= 1);

    adicionarMensagem({ papel: 'usuario', texto: 'continua daqui', hora: '10:03' });
    assert.equal(mensagens.get().at(-1).id, 3);

    definirConversa([]);
    assert.equal(mensagens.get().length, 0);
  });
});

describe('sincronização da conversa (push)', () => {
  it('vincula cópias locais ao id do disco e anexa só o turno novo', () => {
    definirConversa([
      { id: 1, papel: 'usuario', texto: 'um', hora: '10:00' },
      { id: 2, papel: 'agente', texto: 'dois', hora: '10:01' },
    ]);
    adicionarMensagem({ papel: 'usuario', texto: 'três', hora: '10:02' });
    adicionarMensagem({
      papel: 'agente',
      texto: 'Erro do motor (x): y',
      hora: '10:02',
    });

    incorporarTurnos([
      { id: 1, papel: 'usuario', texto: 'um', hora: '10:00' },
      { id: 2, papel: 'agente', texto: 'dois', hora: '10:01' },
      { id: 3, papel: 'usuario', texto: 'três', hora: '10:02' },
      { id: 4, papel: 'agente', texto: 'quatro', hora: '10:03' },
    ]);

    assert.deepEqual(
      mensagens.get().map((m) => [m.turnoId ?? null, m.texto]),
      [
        [1, 'um'],
        [2, 'dois'],
        [3, 'três'],
        [null, 'Erro do motor (x): y'],
        [4, 'quatro'],
      ],
    );
  });

  it('push em thread sem vínculo substitui o preenchimento padrão', () => {
    resetarConversa();
    incorporarTurnos([
      { id: 1, papel: 'usuario', texto: 'Olá de outro device', hora: '10:05' },
    ]);
    const lista = mensagens.get();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].turnoId, 1);
    assert.equal(lista[0].texto, 'Olá de outro device');
  });

  it('lista vazia com thread ociosa volta ao padrão', () => {
    definirConversa([{ id: 1, papel: 'usuario', texto: 'algo', hora: '10:06' }]);
    incorporarTurnos([]);
    const lista = mensagens.get();
    assert.equal(lista.length, 0);
    assert.ok(lista.every((m) => m.turnoId == null));
  });
});
