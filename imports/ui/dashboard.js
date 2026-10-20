import { formatarBytes, formatarPct, formatarTaxa } from '../api/monitorSistema.js';
import { tileMetrica } from './widgets.js';

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function porcentagemMemoria(memoria) {
  const total = Number(memoria?.totalBytes);
  const usada = Number(memoria?.usedBytes);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(usada)) return null;
  return Math.min(100, Math.max(0, (usada / total) * 100));
}

// Tiles de métrica da aba Status: CPU, RAM e GPU com tendência e barra de uso,
// e a vazão da rede quando o motor manda. Substituem os gráficos grandes.
export function metricasSistemaHtml(contrato = {}, { cpu = [], memoria = [], gpu = [] } = {}) {
  const ultimo = (serie) => serie.at(-1)?.valor;
  const valores = (serie) => serie.map((amostra) => amostra.valor);
  const pct = (preferido, serie) => {
    if (preferido != null) return formatarPct(preferido);
    return ultimo(serie) != null ? `${ultimo(serie).toFixed(1)}%` : '—';
  };

  const cpuAtual = contrato.cpu;
  const gpuAtual = contrato.gpu;
  const percentualMemoria = porcentagemMemoria(contrato.memory);
  const tiles = [
    tileMetrica({
      rotulo: 'CPU',
      icone: 'cpu',
      acento: 'var(--gb-azul)',
      valor: pct(cpuAtual?.usagePercent, cpu),
      detalhe: cpuAtual ? `user ${formatarPct(cpuAtual.userPercent)} · sys ${formatarPct(cpuAtual.systemPercent)}` : 'Últimas amostras',
      serie: valores(cpu),
      percentual: cpuAtual?.usagePercent ?? ultimo(cpu),
    }),
    tileMetrica({
      rotulo: 'RAM',
      icone: 'ram',
      acento: 'var(--gb-roxo)',
      valor: pct(percentualMemoria, memoria),
      detalhe: contrato.memory ? `${formatarBytes(contrato.memory.usedBytes)} de ${formatarBytes(contrato.memory.totalBytes)}` : 'Últimas amostras',
      serie: valores(memoria),
      percentual: percentualMemoria ?? ultimo(memoria),
    }),
    tileMetrica({
      rotulo: 'GPU',
      icone: 'gpu',
      acento: 'var(--gb-aqua)',
      valor: pct(gpuAtual?.devicePercent, gpu),
      detalhe: gpuAtual ? `renderer ${formatarPct(gpuAtual.rendererPercent)} · tiler ${formatarPct(gpuAtual.tilerPercent)}` : 'Últimas amostras',
      serie: valores(gpu),
      percentual: gpuAtual?.devicePercent ?? ultimo(gpu),
    }),
  ];

  const rede = contrato.networkTotals;
  if (rede) {
    tiles.push(tileMetrica({
      rotulo: 'Rede',
      icone: 'rede',
      acento: 'var(--gb-verde)',
      valor: formatarTaxa(rede.bytesInPerSecond + rede.bytesOutPerSecond),
      detalhe: `↓ ${formatarTaxa(rede.bytesInPerSecond)} · ↑ ${formatarTaxa(rede.bytesOutPerSecond)}`,
    }));
  }

  return `<div class="status-metricas">${tiles.join('')}</div>`;
}

function nomeProcesso(caminho) {
  const nome = String(caminho ?? '').split('/').at(-1);
  return nome || 'processo';
}

export function processosSistemaHtml(
  contrato,
  { encerrados = new Set(), encerrando = new Set(), erro = '' } = {},
) {
  const vivos = new Set((contrato.processes || []).map((processo) => processo.pid));
  for (const pid of encerrados) {
    if (!vivos.has(pid)) encerrados.delete(pid);
  }

  const processos = (contrato.processes || []).filter(
    (processo) => !processo.isArena && !encerrados.has(processo.pid),
  );
  const conteudo = erro
    ? `<div class="aviso-erro vidro" role="alert"><strong>Processos:</strong> ${escaparHtml(erro)}</div>`
    : processos.length
      ? `<div class="status-lista">${processos.map((processo) => `
        <div class="processo">
          <div class="processo-topo">
            <div>
              <span class="processo-nome">${escaparHtml(nomeProcesso(processo.processName))}</span>
              <span class="processo-detalhe">PID ${processo.pid ?? '—'} · CPU ${Number(processo.cpuPercent ?? 0).toFixed(1)}% · RAM ${formatarBytes(processo.memoryBytes)}</span>
            </div>
            <button type="button" class="btn-processo" data-pid="${processo.pid ?? ''}"${encerrando.has(processo.pid) ? ' disabled' : ''}>${encerrando.has(processo.pid) ? 'Encerrando…' : 'Encerrar'}</button>
          </div>
        </div>
      `).join('')}</div>`
      : '<p class="status-vazio">nenhum processo externo com uso medido</p>';

  return `
    <section class="processos-topo vidro" aria-label="Processos fora do Arena">
      <header class="processos-cabecalho">
        <div>
          <h2>Processos fora do Arena</h2>
          <p>Top 10 do usuário atual · atualiza a cada 10 s.</p>
        </div>
        <span class="processo-contagem">${processos.length}</span>
      </header>
      ${conteudo}
    </section>
  `;
}
