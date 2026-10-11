import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estadoSistema,
  contratoSistema,
  erroSistema,
  aplicarContratoSistema,
  assinarSistema,
  formatarBytes,
  formatarTaxa,
} from '../imports/api/monitorSistema.js';

const contratoV1 = JSON.stringify({
  contractVersion: 1,
  capturedAt: '2026-10-10T12:00:00Z',
  cpu: { usagePercent: 42.4, userPercent: 30, systemPercent: 12, idlePercent: 57 },
  memory: { totalBytes: 17179869184, usedBytes: 8589934592 },
  ndi: { isAvailable: true, version: '6.1.1', sources: [{ name: 'Composition', address: '127.0.0.1:5962' }] },
});

test('aplicarContratoSistema aceita contrato v1 e liga os sinais', () => {
  const contrato = aplicarContratoSistema(contratoV1);
  assert.equal(contrato?.contractVersion, 1);
  assert.equal(contratoSistema.get()?.cpu.usagePercent, 42.4);
  assert.equal(estadoSistema.get(), 'ok');
  assert.equal(erroSistema.get(), null);
});

test('contrato fora da v1 vira erro visível e não apaga o último dado bom', () => {
  aplicarContratoSistema('{"contractVersion":2}');
  assert.match(erroSistema.get(), /contractVersion inesperado/);
  assert.equal(contratoSistema.get()?.contractVersion, 1);

  aplicarContratoSistema('não é json');
  assert.match(erroSistema.get(), /JSON/i);
});

test('formatarBytes e formatarTaxa usam escala binária legível', () => {
  assert.equal(formatarBytes(0), '0 B');
  assert.equal(formatarBytes(2048), '2.0 KB');
  assert.equal(formatarBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatarBytes(17179869184), '16 GB');
  assert.equal(formatarTaxa(3 * 1024 * 1024), '3.0 MB/s');
  assert.equal(formatarBytes(Number.NaN), '—');
});

test('assinarSistema conecta, recebe contrato, marca offline e cancela', () => {
  const fontes = [];
  class FonteFake {
    constructor(url) {
      this.url = url;
      fontes.push(this);
    }
    close() {
      this.fechado = true;
    }
  }

  const inscricao = assinarSistema(FonteFake, '/monitor');
  assert.equal(fontes.length, 1);
  assert.equal(fontes[0].url, '/monitor');
  assert.equal(estadoSistema.get(), 'conectando');

  fontes[0].onopen();
  assert.equal(estadoSistema.get(), 'ok');

  fontes[0].onmessage({ data: contratoV1 });
  assert.equal(contratoSistema.get()?.ndi.version, '6.1.1');

  fontes[0].onerror();
  assert.equal(estadoSistema.get(), 'offline');
  // O último contrato bom continua na tela — offline não apaga o que vimos.
  assert.equal(contratoSistema.get()?.contractVersion, 1);

  inscricao.cancelar();
  assert.equal(fontes[0].fechado, true);
  assert.equal(estadoSistema.get(), 'parado');
});

test('assinarSistema sem origem http cai no endereço local do motor', () => {
  let capturado;
  class FonteGruda {
    constructor(url) {
      capturado = url;
    }
    close() {}
  }
  const inscricao = assinarSistema(FonteGruda);
  inscricao.cancelar();
  assert.equal(capturado, 'http://127.0.0.1:8091/monitor');
});
