import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estadoSistema,
  contratoSistema,
  erroSistema,
  historicoCpu,
  historicoMemoria,
  historicoGpu,
  aplicarContratoSistema,
  assinarSistema,
  formatarBytes,
  formatarTaxa,
} from '../imports/api/monitorSistema.js';
import {
  graficoCpuHtml,
  graficoMemoriaHtml,
  graficoGpuHtml,
  processosSistemaHtml,
} from '../imports/ui/dashboard.js';

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

test('histórico de CPU alimenta o gráfico com amostras recentes', () => {
  historicoCpu.set([]);

  aplicarContratoSistema(JSON.stringify({
    contractVersion: 1,
    capturedAt: '2026-10-10T12:00:00Z',
    cpu: { usagePercent: 12.4 },
  }));
  aplicarContratoSistema(JSON.stringify({
    contractVersion: 1,
    capturedAt: '2026-10-10T12:00:01Z',
    cpu: { usagePercent: 88.6 },
  }));
  aplicarContratoSistema(JSON.stringify({
    contractVersion: 1,
    capturedAt: '2026-10-10T12:00:02Z',
    cpu: { usagePercent: 88.6, userPercent: 70, systemPercent: 18 },
  }));

  const historico = historicoCpu.get();
  assert.equal(historico.length, 3);
  assert.deepEqual(historico.map((amostra) => amostra.valor), [12.4, 88.6, 88.6]);
  assert.match(graficoCpuHtml(historico), /<polyline[^>]+points="[\d.,\s]+"/);
  assert.match(graficoCpuHtml(historico), /88\.6%/);
  assert.match(graficoCpuHtml(historico, contratoSistema.get()), /user 70% · sys 18%/);
});

test('histórico de RAM e GPU alimenta os gráficos', () => {
  historicoMemoria.set([]);
  historicoGpu.set([]);

  aplicarContratoSistema(JSON.stringify({
    contractVersion: 1,
    capturedAt: '2026-10-10T12:00:00Z',
    memory: { totalBytes: 1000, usedBytes: 250 },
    gpu: { devicePercent: 10, rendererPercent: 4, tilerPercent: 3 },
  }));
  aplicarContratoSistema(JSON.stringify({
    contractVersion: 1,
    capturedAt: '2026-10-10T12:00:01Z',
    memory: { totalBytes: 1000, usedBytes: 750 },
    gpu: { devicePercent: 80, rendererPercent: 61, tilerPercent: 22 },
  }));

  const memoria = historicoMemoria.get();
  const gpu = historicoGpu.get();
  assert.deepEqual(memoria.map((amostra) => amostra.valor), [25, 75]);
  assert.deepEqual(gpu.map((amostra) => amostra.valor), [10, 80]);

  const contrato = contratoSistema.get();
  assert.match(graficoMemoriaHtml(memoria, contrato), /Uso de RAM/);
  assert.match(graficoMemoriaHtml(memoria, contrato), /75%/);
  assert.match(graficoMemoriaHtml(memoria, contrato), /750 B de 1000 B/);
  assert.match(graficoGpuHtml(gpu, contrato), /Uso de GPU/);
  assert.match(graficoGpuHtml(gpu, contrato), /80%/);
  assert.match(graficoGpuHtml(gpu, contrato), /renderer 61% · tiler 22%/);
});

test('monitor de processos mostra externos com botão de encerrar', () => {
  const contrato = {
    processes: [
      {
        pid: 100,
        processName: '/Applications/Obsidian.app/Contents/MacOS/Obsidian',
        cpuPercent: 3.2,
        memoryBytes: 8388608,
        isArena: false,
      },
      {
        pid: 200,
        processName: '/Applications/Resolume Arena/Arena.app/Contents/MacOS/Arena',
        cpuPercent: 49.3,
        memoryBytes: 87_672_832,
        isArena: true,
      },
    ],
  };

  const html = processosSistemaHtml(contrato);
  assert.match(html, /Processos fora do Arena/);
  assert.match(html, /Obsidian/);
  assert.match(html, /PID 100/);
  assert.match(html, /CPU 3\.2%/);
  assert.match(html, /RAM 8\.0 MB/);
  assert.match(html, /data-pid="100"/);
  assert.ok(!html.includes('PID 200'));
  assert.match(processosSistemaHtml(contrato, { encerrando: new Set([100]) }), /Encerrando…/);
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
  assert.equal(capturado, 'http://127.0.0.1:1980/monitor');
});
