import './main.css';

import {
  mensagens,
  processando,
  ouvindo,
  focado,
  rascunho,
  contextoPct,
  estadoAgente,
  rotuloTrabalho,
  rotuloProcessando,
  secaoAtiva,
  horaAgora,
  adicionarMensagem,
  atualizarMensagem,
  resetarConversa,
  incorporarTurnos,
  subirContexto,
  zoomGrade,
  ajustarZoom,
  resetarZoom,
} from '../imports/ui/store';
import { Sinal } from '../imports/ui/signal';
import { iniciarOrbs } from '../imports/ui/orb';
import { aplicarMetalNoTexto } from '../imports/ui/logoMetal';
import { markdownParaHtml } from '../imports/ui/markdown';
import { formatarTempo, blocosQuickPlay, resumoQuickPlay } from '../imports/ui/grade';
import { desenharQr, gerarMatrizQr, urlRemota } from '../imports/ui/remoto';
import { precisaInstrucaoInstalacao } from '../imports/ui/pwa';
import { instalacaoVista, marcarInstalacaoVista } from '../imports/ui/persistencia';
import { iniciarPreloader } from '../imports/ui/preloader';
import { iniciarControlesJanela } from '../imports/ui/wco';
import {
  obterBackend,
  sondarBackend,
  backendAtivo,
  sessaoMotor,
  ferramentasMotor,
  salvandoSessao,
  erroSessao,
  atualizarSessao,
  estadoMonitor,
  gradeMonitor,
  ultimoPollMonitor,
  erroMonitor,
  progressoGrade,
  assinarMonitorGrade,
  estadoSistema,
  contratoSistema,
  erroSistema,
  historicoCpu,
  historicoMemoria,
  historicoGpu,
  assinarSistema,
  formatarBytes,
  formatarTaxa,
} from '../imports/api';
import {
  graficoCpuHtml,
  graficoMemoriaHtml,
  graficoGpuHtml,
  processosSistemaHtml,
} from '../imports/ui/dashboard';

const ROTULOS_SECAO = {
  quickplay: 'Quick Play',
  monitor: 'Composição',
  assistente: 'Assistente',
  status: 'Status',
  ajustes: 'Ajustes',
};

const FATOR_ZOOM_POR_PX = 0.005;

const el = (id) => document.getElementById(id);

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function horaFormatada(data) {
  if (!data) return '—';
  const partes = (n) => String(n).padStart(2, '0');
  return `${partes(data.getHours())}:${partes(data.getMinutes())}:${partes(data.getSeconds())}`;
}

// ------------------------------------------------------------
// Topbar e navegação
// ------------------------------------------------------------

function atualizarTopbar() {
  const backend = backendAtivo.get();
  const descricoes = {
    daemon: 'Motor Resolux conectado',
    mock: 'Mock local conectado',
  };
  const classe =
    backend === 'daemon' ? 'sucesso' : backend === 'mock' ? 'marca' : 'perigo';
  const indicador = el('motor-indicador');
  indicador.className = `motor-indicador ${classe}`;
  indicador.title = descricoes[backend] || 'Sondando motor…';
  indicador.setAttribute(
    'aria-label',
    `Motor: ${descricoes[backend] ? descricoes[backend].toLowerCase() : 'sondando'}`
  );
  document.querySelectorAll('.nav-pill').forEach((botao) => {
    botao.classList.toggle('ativa', botao.dataset.secao === secaoAtiva.get());
  });
}

function atualizarVisao() {
  const secao = secaoAtiva.get();
  el('view-assistente').hidden = secao !== 'assistente';
  el('view-monitor').hidden = secao !== 'monitor';
  el('view-ajustes').hidden = secao !== 'ajustes';
  el('view-status').hidden = secao !== 'status';
  el('view-quickplay').hidden = secao !== 'quickplay';
  el('view-em-breve').hidden = SECOES_VALIDAS.has(secao);
  if (!el('view-em-breve').hidden) {
    el('rotulo-em-breve').textContent = ROTULOS_SECAO[secao] || secao;
  }
  el('app-body').classList.toggle('app-body-simples', secao !== 'assistente');

  if (SECOES_GRADE.has(secao)) iniciarMonitor();
  if (secao === 'status') iniciarStatus();
  if (secao === 'ajustes') renderAjustes();
}

// ------------------------------------------------------------
// Remote: QR cosmético para pareamento do celular
// ------------------------------------------------------------

const CHAVE_REMOTO = 'resolux-remote-vinculado';

function remotoVinculado() {
  return localStorage.getItem(CHAVE_REMOTO) === '1';
}

function atualizarRemoto() {
  const url = urlRemota();
  const estado = el('remoto-estado');
  const canvas = el('remoto-qr');
  const link = el('remoto-url');
  const botao = el('btn-remoto');
  if (!estado || !canvas || !link || !botao) return;

  if (!url) {
    estado.textContent = 'Abra pelo endereço de rede para gerar o QR.';
    canvas.hidden = true;
    link.hidden = true;
    botao.hidden = true;
    return;
  }

  const vinculado = remotoVinculado();
  estado.textContent = vinculado ? 'Painel pareado' : 'Leia para abrir no celular';
  canvas.hidden = vinculado;
  link.hidden = vinculado;
  botao.hidden = false;
  botao.textContent = vinculado ? 'Desvincular' : 'Autorizar pareamento';

  if (!vinculado) {
    link.href = url;
    link.textContent = url;
    desenharQr(canvas, gerarMatrizQr(url));
  }
}

function aoClicarRemoto() {
  if (remotoVinculado()) localStorage.removeItem(CHAVE_REMOTO);
  else localStorage.setItem(CHAVE_REMOTO, '1');
  atualizarRemoto();
}

function registrarRemoto() {
  el('btn-remoto')?.addEventListener('click', aoClicarRemoto);
  atualizarRemoto();
}

// ------------------------------------------------------------
// Assistente
// ------------------------------------------------------------

function metaConversa() {
  const lista = mensagens.get();
  const primeira = lista.find((mensagem) => mensagem.papel === 'usuario');
  const ultima = lista.at(-1);
  const motor = backendAtivo.get() === 'daemon' ? 'Motor Resolux' : 'Mock local';

  return {
    titulo: primeira?.texto.split('\n')[0].trim() || 'Nova conversa',
    meta: ultima?.hora ? `${motor} · ${ultima.hora}` : motor,
  };
}

function renderConversas() {
  const container = el('lista-conversas');
  if (!container) return;
  const conversa = metaConversa();

  container.innerHTML = `
    <button class="sessao ativa" aria-current="true">
      <div class="titulo">${escaparHtml(conversa.titulo)}</div>
      <div class="meta">${escaparHtml(conversa.meta)}</div>
    </button>
  `;
}

function htmlMensagem(mensagem) {
  if (mensagem.papel === 'usuario') {
    return `
      <div class="msg-usuario">
        <span class="autor">LUIZINHO</span>
        <div class="bolha">${escaparHtml(mensagem.texto)}</div>
        <span class="hora">${escaparHtml(mensagem.hora)}</span>
      </div>
    `;
  }

  const estadoOrb = mensagem.estadoOrb || 'breathing';
  return `
    <article class="msg-agente vidro">
      <header class="cabecalho">
        <canvas class="orb-canvas" data-orb="${estadoOrb}" data-orb-tamanho="20" width="20" height="20" role="img" aria-label="Resolux ${estadoOrb}"></canvas>
        <span class="nome">RESOLUX</span>
        <span class="badge-pro">Pro</span>
      </header>
      <div class="corpo markdown">${markdownParaHtml(mensagem.texto)}</div>
      <footer class="rodape">
        <span class="meta">${escaparHtml(mensagem.hora)} · ${mensagem.tokens ?? 0} tokens</span>
        <div class="acoes">
          <button class="acao-circ" aria-label="Ramificar conversa" title="Ramificar"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4" cy="4" r="1.8"/><circle cx="4" cy="12" r="1.8"/><circle cx="12" cy="6" r="1.8"/><path d="M4 5.8v4.4M4 10c0-2.5 4-1.5 6.2-2.6"/></svg></button>
          <button class="acao-circ" aria-label="Buscar na conversa" title="Buscar"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg></button>
          <button class="acao-circ" aria-label="Ouvir resposta" title="Ouvir"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.5v3h2.5L9 13V3L5 6.5H2.5z"/><path d="M11.5 5.5a3.5 3.5 0 010 5M13.2 4a6 6 0 010 8"/></svg></button>
          <button class="acao-circ copiar" data-texto="${escaparHtml(mensagem.texto)}" aria-label="Copiar resposta" title="Copiar"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.5A1.5 1.5 0 009 1.5H4A1.5 1.5 0 002.5 3v5A1.5 1.5 0 004 9.5h.5"/></svg></button>
        </div>
      </footer>
    </article>
  `;
}

function renderMensagens() {
  const lista = mensagens.get();
  const container = el('lista-mensagens');
  const ultima = lista.at(-1);
  if (container.childElementCount === lista.length && lista.length > 0 && ultima.papel === 'agente') {
    atualizarUltimoCartao(container.lastElementChild, ultima);
    rolarThread();
    return;
  }
  container.innerHTML = lista.map(htmlMensagem).join('');
  rolarThread();
}

function atualizarUltimoCartao(cartao, msg) {
  const estadoOrb = msg.estadoOrb || 'breathing';
  const canvas = cartao.querySelector('.orb-canvas');
  if (canvas && canvas.dataset.orb !== estadoOrb) {
    // Estado do orb mudou: recria o cartão inteiro — o OrbManager
    // reescaneia o DOM pelo MutationObserver.
    const modelo = document.createElement('template');
    modelo.innerHTML = htmlMensagem(msg);
    cartao.replaceWith(modelo.content.firstElementChild);
    return;
  }
  const corpo = cartao.querySelector('.corpo');
  if (corpo) corpo.innerHTML = markdownParaHtml(msg.texto);
  const meta = cartao.querySelector('.meta');
  if (meta) meta.textContent = `${msg.hora} · ${msg.tokens ?? 0} tokens`;
  const copiar = cartao.querySelector('.copiar');
  if (copiar) copiar.dataset.texto = msg.texto;
}

function atualizarTrabalho() {
  const trabalhando = processando.get() || ouvindo.get();
  const status = el('status-trabalho');
  status.hidden = !trabalhando;
  if (!trabalhando) return;

  const estado = estadoAgente.get();
  const rotulo = ouvindo.get() && !processando.get()
    ? 'Ouvindo o microfone…'
    : rotuloTrabalho.get();
  const canvas = el('orb-status');
  canvas.dataset.orb = estado;
  canvas.setAttribute('aria-label', `Resolux ${estado}`);
  el('rotulo-trabalho').textContent = rotulo;
  el('rotulo-estado').textContent = estado;
  el('rotulo-estado').className = `rotulo-estado ${estado}`;
  iniciarOrbs();
}

function atualizarComposer() {
  const ativo = processando.get();
  el('beam-wrap').classList.toggle('beam-ativo', ativo);
  el('composer-form').classList.toggle('focado', focado.get());
  el('composer-espera').hidden = !ativo;
  el('composer-ativo').hidden = ativo;
  el('rotulo-processando').textContent = rotuloProcessando.get();
  const mic = el('btn-mic');
  mic.classList.toggle('ouvindo', ouvindo.get());
  mic.setAttribute('aria-pressed', String(ouvindo.get()));
  mic.setAttribute('aria-label', ouvindo.get() ? 'Parar ditado' : 'Ditar por voz');
}

function atualizarContexto() {
  const pct = contextoPct.get();
  el('preenchimento-contexto').style.width = `${pct}%`;
  el('preenchimento-painel').style.width = `${pct}%`;
  el('pct-contexto').textContent = `${pct}%`;
  el('meta-contexto').textContent = `${pct}% usado · 18 mil tokens`;
}

function rolarThread() {
  requestAnimationFrame(() => {
    const area = el('thread-scroll');
    if (area) area.scrollTop = area.scrollHeight;
  });
}

let turnoAtual = null;
let msgIdTurno = null;

function garantirMensagemTurno() {
  if (msgIdTurno != null) return msgIdTurno;
  adicionarMensagem({
    papel: 'agente',
    texto: '',
    hora: horaAgora(),
    tokens: 0,
    estadoOrb: 'breathing',
    streaming: true,
  });
  msgIdTurno = mensagens.get().at(-1).id;
  return msgIdTurno;
}

function enviar(texto) {
  if (processando.get()) return;
  if (turnoAtual) {
    turnoAtual.cancelar();
    turnoAtual = null;
  }

  adicionarMensagem({ papel: 'usuario', texto, hora: horaAgora() });
  processando.set(true);
  estadoAgente.set('working');
  rotuloTrabalho.set('Enviando ao motor…');
  rotuloProcessando.set('Processando sua solicitação…');
  rolarThread();

  msgIdTurno = null;

  const encerrar = () => {
    processando.set(false);
    estadoAgente.set('breathing');
    turnoAtual = null;
    msgIdTurno = null;
    subirContexto(4);
    rolarThread();
  };

  turnoAtual = obterBackend().enviarChat(texto, {
    onStarted(info) {
      if (info) {
        rotuloTrabalho.set(info.trabalho);
        rotuloProcessando.set(info.processo);
      } else {
        rotuloTrabalho.set('Turno com o motor — isso leva minutos, não segundos…');
      }
    },
    onComposing() {
      estadoAgente.set('composing');
      rotuloTrabalho.set('Escrevendo a resposta…');
    },
    onChunk(parcial, tokens) {
      const id = garantirMensagemTurno();
      estadoAgente.set('composing');
      atualizarMensagem(id, { texto: parcial, tokens });
    },
    onFinal(texto) {
      const id = garantirMensagemTurno();
      atualizarMensagem(id, {
        texto,
        tokens: Math.max(1, Math.round(texto.length / 4)),
        streaming: false,
      });
      el('composer-input').value = '';
      rascunho.set('');
      encerrar();
    },
    onError(codigo, mensagem) {
      const id = garantirMensagemTurno();
      atualizarMensagem(id, {
        texto: `Erro do motor (${codigo}): ${mensagem}`,
        streaming: false,
      });
      encerrar();
    },
  });
}

function parar() {
  const emTurno = Boolean(turnoAtual) || processando.get();
  if (turnoAtual) {
    turnoAtual.cancelar();
    turnoAtual = null;
  }
  if (!emTurno) return;
  const id = garantirMensagemTurno();
  const msg = mensagens.get().find((m) => m.id === id);
  atualizarMensagem(id, {
    streaming: false,
    texto: msg && msg.texto ? `${msg.texto} …(interrompido)` : '(resposta interrompida)',
  });
  msgIdTurno = null;
  processando.set(false);
  estadoAgente.set('breathing');
}

function alternarVoz() {
  if (ouvindo.get()) {
    ouvindo.set(false);
    if (!processando.get()) estadoAgente.set('breathing');
  } else {
    ouvindo.set(true);
    estadoAgente.set('listening');
  }
}

// ------------------------------------------------------------
// Monitor
// ------------------------------------------------------------

let inscricaoMonitor = null;

// Composição e Quick Play leem a mesma grade: uma assinatura só, viva
// enquanto uma das duas estiver na tela.
const SECOES_GRADE = new Set(['monitor', 'quickplay']);

function iniciarMonitor() {
  if (!inscricaoMonitor) inscricaoMonitor = assinarMonitorGrade();
  renderMonitor();
  renderQuickPlay();
}

function pararMonitor() {
  if (inscricaoMonitor) {
    inscricaoMonitor.cancelar();
    inscricaoMonitor = null;
  }
}

// A barra só existe no clip ativo da TimeGrid; o valor nasce do último
// tick conhecido para o render não abrir desincronizado.
function barraTimeGrid(camada, celula) {
  if (!camada.timeGrid || !celula.ativo) return '';
  const valor = progressoGrade.get().find((p) => p.endereco === celula.id)?.progresso ?? 0;
  return `<div class="clip-progresso" data-endereco="${escaparHtml(celula.id)}" style="--progresso: ${valor}"></div>`;
}

function renderMonitor() {
  const grade = gradeMonitor.get();
  const erro = erroMonitor.get();
  const status = estadoMonitor.get();
  const backend = backendAtivo.get();
  const pill = el('monitor-status');
  pill.textContent = status === 'ok' ? 'conectado' : status === 'pollando' ? 'pollando…' : status === 'erro' ? 'offline' : 'parado';
  pill.className = `pill-status ${status === 'ok' ? 'pill-sucesso' : status === 'erro' ? 'pill-alerta' : ''}`;

  if (!grade) {
    el('monitor-conteudo').innerHTML = erro
      ? `<div class="em-breve vidro"><div class="secao-titulo">Monitor indisponível</div><p><strong>${escaparHtml(erro)}</strong> Sem uma grade boa em memória para mostrar.</p></div>`
      : `<div class="em-breve vidro"><div class="secao-titulo">Sondando o Arena…</div><p>Primeiro poll da grade ainda não voltou.</p></div>`;
    return;
  }

  const totalClips = grade.camadas.reduce((total, camada) => total + camada.celulas.filter((celula) => celula.preenchido).length, 0);
  const linhas = grade.camadas.map((camada) => {
    const celulas = camada.celulas.map((celula) => {
      const classes = ['clip-celula'];
      if (celula.ativo) classes.push('ativo');
      if (!celula.preenchido) classes.push('vazio');
      if (celula.thumbUrl) classes.push('com-thumb');
      if (camada.timeGrid) classes.push(celula.tempo == null ? 'sem-tempo' : 'com-tempo');
      const rotuloTempo = camada.timeGrid && celula.tempo != null
        ? ` · ${formatarTempo(celula.tempo)}`
        : '';
      const titulo = celula.preenchido
        ? `${celula.id} · ${celula.nome}${rotuloTempo}`
        : `${celula.id} · slot vazio`;
      const conteudo = celula.thumbUrl
        ? `<img class="clip-thumb" src="${escaparHtml(celula.thumbUrl)}" alt="" loading="lazy" draggable="false" onerror="this.classList.add('thumb-falha')">`
        : '';
      const nome = celula.preenchido
        ? `<span class="clip-nome">${escaparHtml(celula.nome)}</span>`
        : '<span class="clip-vazio" aria-hidden="true">—</span>';
      const estilo = camada.timeGrid ? ` style="--largura: ${celula.largura}"` : '';
      const badge = camada.timeGrid && celula.tempo != null
        ? `<span class="clip-tempo">${escaparHtml(formatarTempo(celula.tempo))}</span>`
        : '';
      return `<div class="${classes.join(' ')}"${estilo} title="${escaparHtml(titulo)}">${conteudo}${barraTimeGrid(camada, celula)}${nome}${badge}</div>`;
    }).join('');
    const linha = camada.timeGrid
      ? `camada-linha time-grid${camada.timeGridSemTempo ? ' tudo-sem-tempo' : ''}`
      : 'camada-linha';
    return `<div class="camada"><div class="camada-rotulo">${escaparHtml(camada.rotulo)}</div><div class="${linha}" style="--zoom: ${zoomGrade.get()}">${celulas}</div></div>`;
  }).join('');

  el('monitor-conteudo').innerHTML = `
    <div class="monitor-live">
      ${grade.ativo ? `<span class="clip-ativo-nome">${escaparHtml(grade.ativo.nome)}</span><span class="clip-ativo-endereco">tocando em ${escaparHtml(grade.ativo.endereco)}</span>` : '<span class="clip-ativo-nome neutro">nenhum clip tocando</span>'}
      <span class="ultimo-poll">último poll ${horaFormatada(ultimoPollMonitor.get())}</span>
    </div>
    ${backend === 'mock' ? '<p class="nota-mock">Mock local: grade de exemplo, sem Arena de verdade — por isso não há thumbnails. Com o daemon de pé, a grade e as thumbs vêm do proxy read-only <code>/api/v1/arena/**</code>.</p>' : ''}
    ${erro ? `<div class="aviso-erro vidro" role="alert"><strong>Monitor falhou:</strong> ${escaparHtml(erro)}</div>` : ''}
    <section class="grade-card vidro${status === 'pollando' ? ' border-beam' : ''}">
      <div class="card-titulo-linha">
        <h2>Grade de clips</h2>
        <div class="grade-pills">
          <span id="zoom-pill" class="pill-status" title="Zoom da grade (arraste com o mouse)">${Math.round(zoomGrade.get() * 100)}%</span>
          <span class="pill-status">${totalClips} clips</span>
        </div>
      </div>
  ${linhas}
  <div class="grade-rodape">Lupa: segure e arraste na grade — pra direita amplia, pra esquerda reduz. Duplo clique volta ao 100%.</div>
    </section>
  `;
  if (arrastandoZoom) {
    const cartao = document.querySelector('.grade-card');
    if (cartao) cartao.classList.add('arrastando');
  }
  iniciarOrbs();
}

// ------------------------------------------------------------
// Quick Play — port da QuickPlayView nativa: blocos da grade em
// camada crescente, thumbnail, camada e nome; ativo em violeta.
// Leitura pura, sem disparo de clipe (igual ao nativo nesta tacada).
// ------------------------------------------------------------

const ICONE_BLOCO_CHEIO = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="3.5" width="10" height="8" rx="1.5"/><path d="M4 1.5h9a1.5 1.5 0 0 1 1.5 1.5v6.5"/><circle cx="5" cy="6.5" r="1"/><path d="M11.5 10l-3-3-5 4.5"/></svg>';
const ICONE_BLOCO_VAZIO = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="2"/></svg>';
const ICONE_TOCANDO = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z"/></svg>';

function htmlBlocoQuickPlay(bloco) {
  const classes = ['qp-bloco', 'vidro'];
  if (bloco.ativo) classes.push('ativo');
  if (!bloco.preenchido) classes.push('vazio');
  const midia = bloco.thumbUrl
    ? `<img class="qp-thumb" src="${escaparHtml(bloco.thumbUrl)}" alt="" loading="lazy" draggable="false" onerror="this.classList.add('thumb-falha')">`
    : `<span class="qp-placeholder">${bloco.preenchido ? ICONE_BLOCO_CHEIO : ICONE_BLOCO_VAZIO}</span>`;
  const nome = bloco.preenchido ? bloco.nome : 'slot vazio';
  const titulo = `${bloco.id} · ${nome}${bloco.ativo ? ' · tocando' : ''}`;
  return `
    <div class="${classes.join(' ')}" title="${escaparHtml(titulo)}">
      <div class="qp-midia">${midia}</div>
      <div class="qp-camada">${bloco.ativo ? `<span class="qp-tocando">${ICONE_TOCANDO}</span>` : ''}camada ${bloco.camada}</div>
      <div class="qp-nome">${escaparHtml(nome)}</div>
    </div>
  `;
}

function renderQuickPlay() {
  const grade = gradeMonitor.get();
  const erro = erroMonitor.get();
  const status = estadoMonitor.get();
  const conectado = status === 'ok';
  const pill = el('quickplay-status');
  pill.textContent = conectado ? 'conectado' : status === 'pollando' ? 'pollando…' : status === 'erro' ? 'offline' : 'parado';
  pill.className = `pill-status ${conectado ? 'pill-sucesso' : status === 'erro' ? 'pill-alerta' : ''}`;
  const origem = backendAtivo.get() === 'mock' ? 'Mock local' : 'Arena REST';
  el('quickplay-subtitulo').textContent = conectado ? `${origem} · leitura pura` : 'aguardando Arena…';

  const blocos = blocosQuickPlay(grade);
  const { clips, thumbnails } = resumoQuickPlay(blocos);
  const resumo = !grade
    ? (erro ? 'Arena indisponível' : 'aguardando Arena…')
    : blocos.length === 0 ? 'grade vazia' : `clips ${clips} · thumbnails ${thumbnails}`;

  el('quickplay-conteudo').innerHTML = `
    ${backendAtivo.get() === 'mock' ? '<p class="nota-mock">Mock local: grade de exemplo, sem Arena de verdade — por isso não há thumbnails.</p>' : ''}
    ${erro ? `<div class="aviso-erro vidro" role="alert"><strong>Arena falhou:</strong> ${escaparHtml(erro)}</div>` : ''}
    <section class="qp-info vidro">
      <h2>Grade de clips</h2>
      <p>${escaparHtml(resumo)}</p>
    </section>
    ${blocos.length ? `<div class="qp-grade">${blocos.map(htmlBlocoQuickPlay).join('')}</div>` : ''}
  `;
}

// A barra vive fora do re-render: position muda a cada tick e mexer no
// modelo recriaria as thumbnails. Só movemos o preenchimento da barra
// cujo endereço ainda é o clip ativo do render atual.
function atualizarBarrasTimeGrid() {
  const barras = document.querySelectorAll('.time-grid .clip-celula.ativo .clip-progresso');
  const valores = new Map(progressoGrade.get().map((p) => [p.endereco, p.progresso]));
  barras.forEach((barra) => {
    const valor = valores.get(barra.dataset.endereco);
    if (valor != null) barra.style.setProperty('--progresso', String(valor));
  });
}

let arrastandoZoom = false;

function aoSoltarZoom() {
  window.removeEventListener('mousemove', aoMoverZoom);
  window.removeEventListener('mouseup', aoSoltarZoom);
  arrastandoZoom = false;
  const cartao = document.querySelector('.grade-card');
  if (cartao) cartao.classList.remove('arrastando');
}

function aoMoverZoom(evento) {
  ajustarZoom(zoomGrade.get() * (1 + evento.movementX * FATOR_ZOOM_POR_PX));
}

// ------------------------------------------------------------
// Status — monitor do sistema via SSE do motor (`/monitor`, leitura pura)
// ------------------------------------------------------------

let inscricaoSistema = null;
let processosEncerrados = new Set();
let processosEncerrando = new Set();
let erroProcessos = '';
let statusRenderPendente = null;

function agendarRenderStatus() {
  if (statusRenderPendente != null) return;
  statusRenderPendente = requestAnimationFrame(() => {
    statusRenderPendente = null;
    renderStatus();
  });
}

function definirStatusConteudo(html) {
  const tela = el('view-status');
  const conteudo = el('status-conteudo');
  const posicao = tela?.scrollTop ?? 0;
  conteudo.innerHTML = html;
  if (tela) tela.scrollTop = posicao;
}

function iniciarStatus() {
  if (!inscricaoSistema) inscricaoSistema = assinarSistema();
  renderStatus();
}

function pararStatus() {
  if (statusRenderPendente != null) {
    cancelAnimationFrame(statusRenderPendente);
    statusRenderPendente = null;
  }
  if (inscricaoSistema) {
    inscricaoSistema.cancelar();
    inscricaoSistema = null;
  }
}

function linhaStatus(rotulo, valorHtml) {
  return `<div class="status-linha"><span class="status-rotulo">${escaparHtml(rotulo)}</span><span class="status-valor">${valorHtml}</span></div>`;
}

function cardStatus(titulo, corpo, classeExtra = '') {
  return `<section class="status-card vidro${classeExtra ? ` ${classeExtra}` : ''}"><div class="status-card-titulo">${escaparHtml(titulo)}</div>${corpo}</section>`;
}

function horaIso(iso) {
  if (!iso) return '—';
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '—' : horaFormatada(data);
}

function renderStatus() {
  const estado = estadoSistema.get();
  const contrato = contratoSistema.get();
  const erro = erroSistema.get();
  const pill = el('status-pill');
  pill.textContent = estado === 'ok' ? 'conectado' : estado === 'conectando' ? 'conectando…' : estado === 'offline' ? 'offline' : 'parado';
  pill.className = `pill-status ${estado === 'ok' ? 'pill-sucesso' : estado === 'offline' ? 'pill-alerta' : ''}`;

  if (!contrato) {
    definirStatusConteudo(erro
      ? `<div class="aviso-erro vidro" role="alert"><strong>Feed do motor:</strong> ${escaparHtml(erro)}</div>`
      : '<div class="em-breve vidro"><div class="secao-titulo">Sondando o motor…</div><p>Primeiro sample ainda não voltou. O motor só coleta com alguém olhando.</p></div>');
    return;
  }

  const cartoes = [];
  const conectando = estado === 'conectando';

  const rede = contrato.networkTotals;
  const interfaces = (contrato.throughputs || [])
    .map((t) => ({ ...t, total: t.bytesInPerSecond + t.bytesOutPerSecond }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
  if (rede || interfaces.length) {
    cartoes.push(cardStatus('Rede', [
      rede ? linhaStatus('Total', `↓ ${formatarTaxa(rede.bytesInPerSecond)} · ↑ ${formatarTaxa(rede.bytesOutPerSecond)}`) : '',
      rede ? linhaStatus('Pacotes', `↓ ${rede.packetsInPerSecond.toFixed(0)}/s · ↑ ${rede.packetsOutPerSecond.toFixed(0)}/s`) : '',
      interfaces.map((t) => linhaStatus(escaparHtml(t.name), `↓ ${formatarTaxa(t.bytesInPerSecond)} · ↑ ${formatarTaxa(t.bytesOutPerSecond)}`)).join(''),
    ].filter(Boolean).join(''), conectando ? 'border-beam' : ''));
  }

  const portas = contrato.ports || [];
  if (portas.length) {
    cartoes.push(cardStatus(`Portas (${portas.length})`, `<div class="status-lista">${portas.slice(0, 12).map((p) => linhaStatus(`${escaparHtml(p.processName)}:${p.localPort}`, `${escaparHtml(p.transport)} · ${escaparHtml(p.service)}`)).join('')}</div>`, conectando ? 'border-beam' : ''));
  }

  const ndi = contrato.ndi;
  if (ndi) {
    cartoes.push(cardStatus('NDI', [
      linhaStatus('Estado', ndi.isAvailable ? '<span class="status-badge sucesso">disponível</span>' : '<span class="status-badge alerta">indisponível</span>'),
      ndi.version ? linhaStatus('Versão', escaparHtml(ndi.version)) : '',
      `<div class="status-lista">${ndi.sources.map((s) => linhaStatus(escaparHtml(s.name), escaparHtml(s.address))).join('')}</div>`,
    ].join(''), ndi.isAvailable ? (conectando ? 'border-beam' : '') : 'border-beam border-beam--alerta'));
  }

  const midi = contrato.midi;
  if (midi) {
    cartoes.push(cardStatus(`MIDI (${midi.sources.length})`, `<div class="status-lista">${midi.sources.map((s) => linhaStatus(escaparHtml(s.name), `${s.packetCount} pacotes · última ${horaIso(s.lastMessageAt)}`)).join('') || '<p class="status-vazio">nenhuma fonte conectada</p>'}</div>`, conectando ? 'border-beam' : ''));
  }

  const artNet = contrato.artNet;
  if (artNet) {
    cartoes.push(cardStatus(`Art-Net (${artNet.nodes.length})`, [
      linhaStatus('Respostas ao ArtPoll', String(artNet.replyCount)),
      artNet.error ? linhaStatus('Erro', escaparHtml(artNet.error)) : '',
      `<div class="status-lista">${artNet.nodes.map((n) => linhaStatus(escaparHtml(n.shortName), escaparHtml(n.ipAddress))).join('')}</div>`,
    ].filter(Boolean).join('')));
  }

  const captura = contrato.captureDevices || [];
  if (captura.length) {
    cartoes.push(cardStatus(`Captura (${captura.length})`, `<div class="status-lista">${captura.map((d) => linhaStatus(escaparHtml(d.name), `${escaparHtml(d.deviceType)} · ${d.isConnected ? 'conectado' : 'desconectado'}`)).join('')}</div>`));
  }

  const audio = contrato.audioDevices || [];
  if (audio.length) {
    cartoes.push(cardStatus(`Áudio (${audio.length})`, `<div class="status-lista">${audio.map((d) => linhaStatus(escaparHtml(d.name), [d.isDefaultInput ? 'entrada padrão' : '', d.isDefaultOutput ? 'saída padrão' : '', `canais ${d.inputStreams}↑/${d.outputStreams}↓`].filter(Boolean).join(' · '))).join('')}</div>`));
  }

  const displays = contrato.displays || [];
  if (displays.length) {
    cartoes.push(cardStatus(`Displays (${displays.length})`, `<div class="status-lista">${displays.map((d) => linhaStatus(d.isMain ? 'Principal' : `Display ${d.id}`, `${d.pixelWidth}×${d.pixelHeight} · ${d.refreshRate.toFixed(0)} Hz`)).join('')}</div>`));
  }

  definirStatusConteudo(`
    <p class="status-amostra">Amostra de ${horaIso(contrato.capturedAt)} · contrato v${contrato.contractVersion}${estado === 'offline' ? ' — feed offline, mostrando o último sample' : ''}</p>
    ${processosSistemaHtml(contrato, {
      encerrados: processosEncerrados,
      encerrando: processosEncerrando,
      erro: erroProcessos,
    })}
    <div class="status-graficos">
      ${graficoCpuHtml(historicoCpu.get(), contrato)}
      ${graficoMemoriaHtml(historicoMemoria.get(), contrato)}
      ${graficoGpuHtml(historicoGpu.get(), contrato)}
    </div>
    ${cartoes.length ? `<div class="status-grid">${cartoes.join('')}</div>` : '<div class="em-breve vidro"><div class="secao-titulo">Sem cartões</div><p>O motor não enviou nenhum bloco neste sample.</p></div>'}
    ${erro ? `<div class="aviso-erro vidro" role="alert"><strong>Último problema no feed:</strong> ${escaparHtml(erro)}</div>` : ''}
  `);
}

async function encerrarProcesso(pid) {
  if (!Number.isInteger(pid) || processosEncerrando.has(pid)) return;
  processosEncerrando.add(pid);
  renderStatus();

  try {
    const resposta = await fetch(`/monitor/processes/${pid}/terminate`, { method: 'POST' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    processosEncerrados.add(pid);
    erroProcessos = '';
  } catch (e) {
    erroProcessos = e.message || 'não foi possível encerrar';
  } finally {
    processosEncerrando.delete(pid);
    renderStatus();
  }
}

// ------------------------------------------------------------
// Ajustes
// ------------------------------------------------------------

const allowlistVisao = new Sinal(null);

function renderAjustes() {
  const sessao = sessaoMotor.get();
  const erro = erroSessao.get();
  const salvando = salvandoSessao.get();
  const mock = backendAtivo.get() === 'mock';
  const ferramentas = ferramentasMotor.get();
  const lista = allowlistVisao.get();
  const contagem = lista === null ? `${ferramentas.length} de ${ferramentas.length}` : `${lista.length} de ${ferramentas.length}`;

  let conteudo = erro ? `<div class="aviso-erro vidro" role="alert"><strong>Motor recusou:</strong> ${escaparHtml(erro)}</div>` : '';
  if (!sessao) {
    conteudo += `<div class="aviso-erro vidro"><strong>Sessão indisponível.</strong> O motor não respondeu ao <code>GET /api/v1/session</code>.${erro ? '' : ' Tente recarregar a página para sondar de novo.'}</div>`;
    el('ajustes-conteudo').innerHTML = conteudo;
    return;
  }

  const linhasFerramentas = ferramentas.map((ferramenta) => {
    const marcada = lista !== null && lista.includes(ferramenta.name);
    return `<label class="linha-check ferramenta"><input type="checkbox" class="chk-ferramenta" value="${escaparHtml(ferramenta.name)}"${marcada ? ' checked' : ''}><span class="nome-ferramenta">${escaparHtml(ferramenta.name)}</span><span class="desc-ferramenta">${escaparHtml(ferramenta.description)}</span></label>`;
  }).join('');

  conteudo += `
    <section class="card-ajuste vidro">
      <div class="card-titulo-linha">
        <h2>Motor</h2>
        <span class="pill-status ${mock ? 'pill-alerta' : ''}">${salvando ? 'Salvando…' : `${escaparHtml(sessao.backend)} · ${escaparHtml(sessao.model)}`}</span>
      </div>
      ${mock ? '<p class="nota-mock">Mock local: estas mudanças vivem só nesta aba e somem ao recarregar. Com o daemon de pé, valem na sessão real.</p>' : ''}
      <div class="campo">
        <label>Modo de operação</label>
        <div class="segmented" role="group" aria-label="Modo de operação">
          <button class="seg ${sessao.mode === 'timeline' ? 'seg-ativo' : ''}" data-modo="timeline">Timeline <span class="seg-sub">Calcula</span></button>
          <button class="seg ${sessao.mode === 'performance' ? 'seg-ativo' : ''}" data-modo="performance">Performance <span class="seg-sub">Mede</span></button>
        </div>
      </div>
      <div class="campo">
        <label>Backend do assistente</label>
        <div class="segmented" role="group" aria-label="Backend do assistente">
          <button class="seg ${sessao.backend === 'ollama' ? 'seg-ativo' : ''}" data-backend="ollama">Ollama</button>
          <button class="seg ${sessao.backend === 'spike' ? 'seg-ativo' : ''}" data-backend="spike">Spike</button>
          <button class="seg ${sessao.backend === 'applefm' ? 'seg-ativo' : ''}" data-backend="applefm">Apple FM</button>
        </div>
      </div>
      <div class="campo"><label for="campo-modelo">Modelo</label><input id="campo-modelo" class="campo-texto" type="text" value="${escaparHtml(sessao.model)}" spellcheck="false" autocomplete="off"></div>
      <div class="campo"><label>Política de escrita</label><div class="politica-leitura"><span class="dot marca" aria-hidden="true"></span>Somente leitura — fixo na v1 do contrato. Escrita só aparece aqui quando o operador mudar esse voto.</div></div>
      <div class="card-meta-linha">${sessao.toolsAllowed} ferramentas visíveis ao modelo · journal ${sessao.journalEnabled ? 'ligado' : 'desligado'}</div>
    </section>
    <section class="card-ajuste vidro">
      <div class="card-titulo-linha"><h2>Ferramentas do Arena</h2><span class="pill-status">${contagem}</span></div>
      <label class="linha-check"><input type="checkbox" id="chk-todas"${lista === null ? ' checked' : ''}>Todas as ferramentas visíveis</label>
      ${lista !== null ? (ferramentas.length ? `<div class="lista-ferramentas">${linhasFerramentas}</div>` : `<p class="nota-mock">Nenhuma ferramenta anunciada pelo motor${mock ? ' (o mock não tem ferramentas do Arena)' : ''}.</p>`) : ''}
    </section>
  `;
  el('ajustes-conteudo').innerHTML = conteudo;
}

// ------------------------------------------------------------
// Eventos e boot
// ------------------------------------------------------------

// Thread reativa: um WS por cliente (conversa.subscribe) — nasce com o
// snapshot do disco e recebe conversa.update a cada turno/limpeza, em
// qualquer device. No mock não há outro device: assinatura no-op.
let inscricaoConversa = null;

async function sincronizarConversaRemota() {
  if (backendAtivo.get() === 'daemon') {
    inscricaoConversa ||= obterBackend().assinarConversa({
      onTurnos: (turnos) => incorporarTurnos(turnos),
    });

    try {
      const { turnos } = await obterBackend().obterConversa();
      if (!processando.get()) definirConversa(turnos);
    } catch (_) {
      // A assinatura WebSocket segue tentando mesmo sem leitura inicial.
    }
  } else {
    inscricaoConversa?.cancelar();
    inscricaoConversa = null;
  }
}

function configurarInstalacaoPwa() {
  if (!precisaInstrucaoInstalacao() || instalacaoVista()) return;
  const folha = el('pwa-instalar');
  if (folha) folha.hidden = false;
}

function registrarEventos() {
  document.addEventListener('click', (evento) => {
    const nav = evento.target.closest('[data-secao]');
    if (nav?.dataset.secao) {
      evento.preventDefault();
      secaoAtiva.set(nav.dataset.secao);
    }
    if (evento.target.closest('#btn-nova')) {
      resetarConversa();
      obterBackend()
        .apagarConversa()
        .then(({ turnos }) => {
          if (!processando.get()) definirConversa(turnos);
        })
        .catch(() => {});
    }

    if (evento.target.closest('#btn-pwa-fechar')) {
      el('pwa-instalar').hidden = true;
      marcarInstalacaoVista();
    }

    const copiar = evento.target.closest('.copiar');
    if (copiar?.dataset.texto && navigator.clipboard) navigator.clipboard.writeText(copiar.dataset.texto);

    const modo = evento.target.closest('.seg[data-modo]');
    if (modo) atualizarSessao({ mode: modo.dataset.modo });

    const backend = evento.target.closest('.seg[data-backend]');
    if (backend) atualizarSessao({ backend: backend.dataset.backend });

    const processo = evento.target.closest('.btn-processo[data-pid]');
    if (processo) encerrarProcesso(Number(processo.dataset.pid));
  });

  el('composer-form').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const texto = el('composer-input').value.trim();
    if (!texto) return;
    rascunho.set('');
    enviar(texto);
  });
  el('composer-input').addEventListener('input', (evento) => rascunho.set(evento.target.value));
  el('composer-input').addEventListener('focus', () => focado.set(true));
  el('composer-input').addEventListener('blur', () => focado.set(false));
  el('btn-mic').addEventListener('click', alternarVoz);
  el('btn-parar').addEventListener('click', parar);

  const viewMonitor = el('view-monitor');
  viewMonitor.addEventListener('mousedown', (evento) => {
    const cartao = evento.target.closest('.grade-card');
    if (!cartao || evento.button !== 0) return;
    evento.preventDefault();
    arrastandoZoom = true;
    cartao.classList.add('arrastando');
    window.addEventListener('mousemove', aoMoverZoom);
    window.addEventListener('mouseup', aoSoltarZoom);
  });
  viewMonitor.addEventListener('dblclick', (evento) => {
    if (evento.target.closest('.grade-card')) resetarZoom();
  });

  el('view-ajustes').addEventListener('change', async (evento) => {
    if (evento.target.id === 'campo-modelo') {
      const model = evento.target.value.trim();
      if (model) atualizarSessao({ model });
      return;
    }
    if (evento.target.id === 'chk-todas') {
      if (evento.target.checked) {
        if (await atualizarSessao({ toolAllowlist: null })) allowlistVisao.set(null);
      } else {
        const lista = ferramentasMotor.get().map((ferramenta) => ferramenta.name);
        if (await atualizarSessao({ toolAllowlist: lista })) allowlistVisao.set(lista);
      }
      return;
    }
    if (evento.target.classList.contains('chk-ferramenta')) {
      const marcadas = [...document.querySelectorAll('.chk-ferramenta:checked')].map((campo) => campo.value);
      if (await atualizarSessao({ toolAllowlist: marcadas })) allowlistVisao.set(marcadas);
    }
  });
}

// Deep link por hash (#quickplay, #status, #monitor, #ajustes) — útil pra abrir a aba
// certa num link externo ou no QR do celular.
const SECOES_VALIDAS = new Set(['quickplay', 'monitor', 'assistente', 'status', 'ajustes']);
function aplicarHashInicial() {
  const hash = window.location.hash.replace('#', '');
  if (SECOES_VALIDAS.has(hash)) secaoAtiva.set(hash);
}

function registrarAssinaturas() {
  secaoAtiva.assinar(() => {
    const secao = secaoAtiva.get();
    if (SECOES_VALIDAS.has(secao)) {
      history.replaceState(null, '', `#${secao}`);
    }
    atualizarTopbar();
    atualizarVisao();
    if (!SECOES_GRADE.has(secaoAtiva.get())) pararMonitor();
    if (secaoAtiva.get() !== 'status') pararStatus();
  });
  backendAtivo.assinar(atualizarTopbar);
  backendAtivo.assinar(sincronizarConversaRemota);
  mensagens.assinar(renderMensagens);
  mensagens.assinar(renderConversas);
  backendAtivo.assinar(renderConversas);
  processando.assinar(() => {
    atualizarTrabalho();
    atualizarComposer();
  });
  ouvindo.assinar(() => {
    atualizarTrabalho();
    atualizarComposer();
  });
  focado.assinar(atualizarComposer);
  estadoAgente.assinar(atualizarTrabalho);
  rotuloTrabalho.assinar(atualizarTrabalho);
  rotuloProcessando.assinar(atualizarComposer);
  contextoPct.assinar(atualizarContexto);

  estadoMonitor.assinar(renderMonitor);
  gradeMonitor.assinar(renderMonitor);
  erroMonitor.assinar(renderMonitor);
  progressoGrade.assinar(atualizarBarrasTimeGrid);
  backendAtivo.assinar(renderMonitor);
  gradeMonitor.assinar(renderQuickPlay);
  estadoMonitor.assinar(renderQuickPlay);
  erroMonitor.assinar(renderQuickPlay);
  backendAtivo.assinar(renderQuickPlay);

  estadoSistema.assinar(agendarRenderStatus);
  contratoSistema.assinar(agendarRenderStatus);
  historicoCpu.assinar(agendarRenderStatus);
  historicoMemoria.assinar(agendarRenderStatus);
  historicoGpu.assinar(agendarRenderStatus);
  erroSistema.assinar(agendarRenderStatus);
  zoomGrade.assinar((valor) => {
    document.querySelectorAll('.camada-linha').forEach((linha) => linha.style.setProperty('--zoom', String(valor)));
    const pill = el('zoom-pill');
    if (pill) pill.textContent = `${Math.round(valor * 100)}%`;
  });

  sessaoMotor.assinar(renderAjustes);
  ferramentasMotor.assinar(renderAjustes);
  salvandoSessao.assinar(renderAjustes);
  erroSessao.assinar(renderAjustes);
  backendAtivo.assinar(renderAjustes);
  allowlistVisao.assinar(renderAjustes);
}

registrarEventos();
aplicarHashInicial();
registrarAssinaturas();
registrarRemoto();
iniciarControlesJanela();
atualizarTopbar();
atualizarVisao();
renderMensagens();
atualizarTrabalho();
atualizarComposer();
atualizarContexto();
iniciarOrbs();
aplicarMetalNoTexto(el('logo-metal'));
configurarInstalacaoPwa();
sondarBackend();
iniciarPreloader();
