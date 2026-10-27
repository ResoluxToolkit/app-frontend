import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LIMIAR_RECARGA_PX,
  MAX_DESLOCAMENTO_PX,
  calcularPuxada,
  estadoPuxada,
} from '../imports/ui/puxarRecarregar.js';

describe('puxar para recarregar (pull-to-refresh)', () => {
  it('ignora movimento para cima ou dentro da zona morta', () => {
    assert.deepEqual(calcularPuxada(-30), {
      ativo: false,
      progresso: 0,
      deslocamento: 0,
      pronto: false,
    });
    assert.deepEqual(calcularPuxada(8), {
      ativo: false,
      progresso: 0,
      deslocamento: 0,
      pronto: false,
    });
  });

  it('cresce com amortecimento elástico e só dispara a partir do limiar', () => {
    const metade = calcularPuxada(10 + LIMIAR_RECARGA_PX / 2);
    assert.equal(metade.ativo, true);
    assert.equal(metade.pronto, false);
    assert.equal(metade.progresso, 0.5);
    assert.ok(metade.deslocamento > 0 && metade.deslocamento < MAX_DESLOCAMENTO_PX);

    const gatilho = calcularPuxada(10 + LIMIAR_RECARGA_PX);
    assert.equal(gatilho.ativo, true);
    assert.equal(gatilho.pronto, true);
    assert.equal(gatilho.progresso, 1);

    const muitoAlem = calcularPuxada(600);
    assert.ok(muitoAlem.deslocamento <= MAX_DESLOCAMENTO_PX);
  });

  it('mapeia cada fase do gesto para um estado válido do ThinkingOrb', () => {
    assert.deepEqual(estadoPuxada({ pronto: false, recarregando: false }), {
      orb: 'breathing',
      rotulo: 'Puxe para recarregar',
    });
    assert.deepEqual(estadoPuxada({ pronto: true, recarregando: false }), {
      orb: 'composing',
      rotulo: 'Solte para recarregar',
    });
    assert.deepEqual(estadoPuxada({ pronto: true, recarregando: true }), {
      orb: 'working',
      rotulo: 'Recarregando…',
    });
  });
});
