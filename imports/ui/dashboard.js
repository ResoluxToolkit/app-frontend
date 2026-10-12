import { formatarBytes, formatarPct } from '../api/monitorSistema.js';

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pontoGrafico(pontos, indice) {
  const altura = 40;
  const x = pontos.length === 1 ? 100 : (indice / (pontos.length - 1)) * 100;
  const y = altura - (Math.min(100, Math.max(0, pontos[indice].valor)) / 100) * altura;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

function graficoLinhaHtml({ titulo, descricao, valorAtual, pontos, ariaLabel }) {
  const atual = pontos.at(-1);
  const valores = pontos.map((_, indice) => pontoGrafico(pontos, indice));
  const linha = valores.join(' ');
  const area = valores.length ? `0,40 ${linha} 100,40` : '';

  return `
    <section class="grafico vidro" aria-label="${escaparHtml(ariaLabel)}">
      <header class="grafico-topo">
        <div>
          <h2>${escaparHtml(titulo)}</h2>
          <p>${escaparHtml(descricao)}</p>
        </div>
        <span class="grafico-atual">${escaparHtml(valorAtual)}</span>
      </header>
      <div class="grafico-corpo">
        <div class="grafico-eixo" aria-hidden="true">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div class="grafico-area">
          <div class="grafico-grade" aria-hidden="true"></div>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="${escaparHtml(ariaLabel)}">
            <polygon class="grafico-preenchimento" points="${area}"></polygon>
            <polyline class="grafico-linha" points="${linha}"></polyline>
          </svg>
        </div>
      </div>
      <footer class="grafico-rotulos">
        <span>${pontos.at(0)?.hora ?? 'aguardando'}</span>
        <span>${atual ? `${pontos.length} amostras · ${atual.hora}` : 'sem amostra'}</span>
      </footer>
    </section>
  `;
}

function porcentagemMemoria(memoria) {
  const total = Number(memoria?.totalBytes);
  const usada = Number(memoria?.usedBytes);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(usada)) return null;
  return Math.min(100, Math.max(0, (usada / total) * 100));
}

export function graficoCpuHtml(pontos, contrato = {}) {
  const cpu = contrato.cpu;
  const valor = cpu?.usagePercent != null ? formatarPct(cpu.usagePercent) : (pontos.at(-1)?.valor != null ? `${pontos.at(-1).valor.toFixed(1)}%` : '—');
  return graficoLinhaHtml({
    titulo: 'Uso de CPU',
    descricao: cpu ? `user ${formatarPct(cpu.userPercent)} · sys ${formatarPct(cpu.systemPercent)}` : 'Histórico recente do feed SSE do motor.',
    valorAtual: valor,
    pontos,
    ariaLabel: 'Uso de CPU por amostra',
  });
}

export function graficoMemoriaHtml(pontos, contrato = {}) {
  const memoria = contrato.memory;
  const percentual = porcentagemMemoria(memoria);
  const valor = percentual != null ? formatarPct(percentual) : (pontos.at(-1)?.valor != null ? `${pontos.at(-1).valor.toFixed(1)}%` : '—');
  const descricao = memoria
    ? `${formatarBytes(memoria.usedBytes)} de ${formatarBytes(memoria.totalBytes)}`
    : 'Histórico recente do feed SSE do motor.';
  return graficoLinhaHtml({
    titulo: 'Uso de RAM',
    descricao,
    valorAtual: valor,
    pontos,
    ariaLabel: 'Uso de RAM por amostra',
  });
}

export function graficoGpuHtml(pontos, contrato = {}) {
  const gpu = contrato.gpu;
  const valor = gpu?.devicePercent != null ? formatarPct(gpu.devicePercent) : (pontos.at(-1)?.valor != null ? `${pontos.at(-1).valor.toFixed(1)}%` : '—');
  const descricao = gpu
    ? `renderer ${formatarPct(gpu.rendererPercent)} · tiler ${formatarPct(gpu.tilerPercent)}`
    : 'Histórico recente do feed SSE do motor.';
  return graficoLinhaHtml({
    titulo: 'Uso de GPU',
    descricao,
    valorAtual: valor,
    pontos,
    ariaLabel: 'Uso de GPU por amostra',
  });
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
