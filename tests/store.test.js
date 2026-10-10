import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ZOOM_MAX, ZOOM_MIN, ajustarZoom, resetarZoom, zoomGrade } from '../imports/ui/store.js';
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
