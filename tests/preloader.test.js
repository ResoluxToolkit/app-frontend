import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { backendAtivo } from '../imports/api/index.js';
import {
  ROTULOS_STATUS,
  aguardarSondagem,
} from '../imports/ui/preloader.js';

function estadoReal(valor) {
  // Reinicia o sinal de verdade: set com o mesmo valor é no-op.
  if (backendAtivo.get() === valor) {
    backendAtivo.set(valor === 'sondando' ? 'mock' : 'sondando');
  }
  backendAtivo.set(valor);
}

describe('preloader de abertura', () => {
  it('rótulos de status cobrem os três estados do motor', () => {
    assert.ok(ROTULOS_STATUS.sondando.length > 0);
    assert.ok(ROTULOS_STATUS.daemon.length > 0);
    assert.ok(ROTULOS_STATUS.mock.length > 0);
  });

  it('aguardarSondagem resolve na hora quando o motor já foi decidido', async () => {
    estadoReal('daemon');
    const inicio = Date.now();
    await aguardarSondagem(1000);
    assert.ok(Date.now() - inicio < 100);
  });

  it('aguardarSondagem resolve quando a sondagem termina antes do teto', async () => {
    estadoReal('sondando');
    const promessa = aguardarSondagem(5000);
    setTimeout(() => backendAtivo.set('mock'), 20);
    const inicio = Date.now();
    await promessa;
    assert.ok(Date.now() - inicio < 1000);
    estadoReal('daemon');
  });

  it('aguardarSondagem resolve pelo teto quando nada muda', async () => {
    estadoReal('sondando');
    const inicio = Date.now();
    await aguardarSondagem(80);
    const decorrido = Date.now() - inicio;
    assert.ok(decorrido >= 60 && decorrido < 1000);
    estadoReal('daemon');
  });
});
