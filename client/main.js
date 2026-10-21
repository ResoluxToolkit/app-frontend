import './main.css';

import {
  mensagens,
  processando,
  ouvindo,
  focado,
  rascunho,
  estadoAgente,
  rotuloTrabalho,
  rotuloProcessando,
  secaoAtiva,
  atalhos,
  horaAgora,
  adicionarMensagem,
  atualizarMensagem,
  resetarConversa,
  incorporarTurnos,
  zoomGrade,
  ajustarZoom,
  resetarZoom,
} from '../imports/ui/store';
import { Sinal } from '../imports/ui/signal';
import { iniciarOrbs } from '../imports/ui/orb';
import { aplicarMetalNoTexto } from '../imports/ui/logoMetal';
import { markdownParaHtml } from '../imports/ui/markdown';
import { formatarTempo } from '../imports/ui/grade';
import { aplicarOrdem, proximoTamanho, resolverAtalho, sanitizarAtalho } from '../imports/ui/atalhos';
import { secaoDaPlataforma } from '../imports/ui/plataforma';
import { desenharQr, gerarMatrizQr, segundosRestantes, urlPareamento, urlRemota } from '../imports/ui/remoto';
import { juntarDitado, reconhecedorDisponivel } from '../imports/ui/ditado';
import { precisaInstrucaoInstalacao } from '../imports/ui/pwa';
import { instalacaoVista, marcarInstalacaoVista } from '../imports/ui/persistencia';
import { iniciarPreloader } from '../imports/ui/preloader';
import { abertoComoApp, extrairCodigo, lerQrDaImagem } from '../imports/ui/leitorQr';
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
  cabecalhosAcesso,
  obterPareamento,
  estadoPareamento,
  acessoPainel,
  parearComCodigo,
  concluirPareamentoDaUrl,
} from '../imports/api';
import {
  metricasSistemaHtml,
  processosSistemaHtml,
} from '../imports/ui/dashboard';
import { avaliarSaude } from '../imports/ui/saude';
import { veredito, grupoRecolhivel } from '../imports/ui/widgets';

const ROTULOS_SECAO = {
  quickplay: 'Quick Play',
  monitor: 'Composição',
  atalhos: 'Atalhos',
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
  posicionarIndicadorMobile();
}

// O indicador da barra do celular desliza até o item ativo. A transição só
// liga depois de fixar a posição inicial (o reflow forçado abaixo), para ele
// não "viajar" a partir do zero quando o app abre.
function posicionarIndicadorMobile() {
  const capsula = document.querySelector('#nav-mobile .nav-capsula');
  if (!capsula) return;
  const botoes = [...capsula.querySelectorAll('.nav-pill')];
  const indice = botoes.findIndex((botao) => botao.dataset.secao === secaoAtiva.get());
  capsula.style.setProperty('--ativo', String(Math.max(indice, 0)));
  capsula.classList.toggle('sem-ativo', indice < 0);
  if (!capsula.classList.contains('animavel')) {
    void capsula.offsetWidth;
    capsula.classList.add('animavel');
  }
}

function atualizarVisao() {
  const secao = secaoAtiva.get();
  el('view-assistente').hidden = secao !== 'assistente';
  el('view-monitor').hidden = secao !== 'monitor';
  el('view-atalhos').hidden = secao !== 'atalhos';
  el('view-ajustes').hidden = secao !== 'ajustes';
  el('view-status').hidden = secao !== 'status';
  el('view-em-breve').hidden = secao !== 'quickplay';
  if (!el('view-em-breve').hidden) {
    el('rotulo-em-breve').textContent = ROTULOS_SECAO[secao] || secao;
  }
  el('app-body').classList.toggle('app-body-simples', secao !== 'assistente');

  // Composição e Atalhos leem o mesmo poll da grade.
  if (SECOES_GRADE.has(secao)) iniciarMonitor();
  if (secao === 'atalhos') renderAtalhosDeck();
  if (secao === 'status') iniciarStatus();
  if (secao === 'ajustes') renderAjustes();
}

// ------------------------------------------------------------
// Remote: QR com o endereço de rede e um código que gira a cada 5 min.
// Quem lê abre o painel com o código; o motor compara e só então
// entrega o token do aparelho. Sem código válido, o celular não entra.
// ------------------------------------------------------------

let pareamentoAtual = null; // { codigo, expiraEm, base? }
let buscandoPareamento = false;

function mmss(segundos) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

function mensagemAparelho() {
  const estado = estadoPareamento.get();
  if (estado === 'pareado') return 'Este aparelho está pareado.';
  if (estado === 'recusado') return 'Código vencido ou inválido. Leia o QR de novo no Mac.';
  if (estado === 'limitado') return 'Muitas tentativas. Espere um minuto e leia o QR de novo.';
  if (estado === 'sem_resposta') return 'O Mac não respondeu. Leia o QR de novo.';
  if (estado === 'pareando') return 'Pareando com o Mac…';
  return '';
}

function renderRemoto(estadoTexto, url = '') {
  const estado = el('remoto-estado');
  const canvas = el('remoto-qr');
  const link = el('remoto-url');
  if (!estado || !canvas || !link) return;
  estado.textContent = estadoTexto;
  canvas.hidden = !url;
  link.hidden = !url;
  if (!url) return;
  link.href = url;
  link.textContent = url;
  // Fundo transparente e módulos no laranja da marca, como pedido.
  const laranja = getComputedStyle(document.documentElement).getPropertyValue('--marca').trim() || '#ff9f0a';
  desenharQr(canvas, gerarMatrizQr(url), { fundo: null, modulo: laranja });
}

async function atualizarRemoto() {
  if (buscandoPareamento) return;
  buscandoPareamento = true;
  try {
    pareamentoAtual = await obterPareamento();
  } catch (e) {
    pareamentoAtual = null;
    // Nunca desenhar QR sem código: sem a rota, sem motor ou fora do Mac,
    // o bloco só explica onde o QR aparece.
    if (e.codigo === 'forbidden') {
      renderRemoto(mensagemAparelho() || 'O QR de pareamento aparece no painel do Mac.');
    } else if (e.codigo === 'not_found') {
      renderRemoto('Este motor não tem pareamento: qualquer aparelho na rede entra. Atualize a engine.');
    } else {
      renderRemoto('Sem o motor no ar, não há código de pareamento.');
    }
    return;
  } finally {
    buscandoPareamento = false;
  }
  tickRemoto();
}

// A cada segundo: contagem regressiva; código vencido busca outro.
function tickRemoto() {
  if (!pareamentoAtual) return;
  const restantes = segundosRestantes(pareamentoAtual.expiraEm);
  if (restantes === 0) {
    atualizarRemoto();
    return;
  }
  const origem = pareamentoAtual.base || urlRemota();
  if (!origem) {
    renderRemoto('Abra pelo endereço de rede para gerar o QR.');
    return;
  }
  const url = urlPareamento(origem, pareamentoAtual.codigo);
  if (el('remoto-url')?.href !== url) {
    renderRemoto(`Leia com a Câmera do celular · novo código em ${mmss(restantes)}`, url);
  } else {
    el('remoto-estado').textContent = `Leia com a Câmera do celular · novo código em ${mmss(restantes)}`;
  }
}

// O código é de uso único: quando um celular pareia, o motor gira o
// código no próximo GET. Sem evento para isso no contrato, o Mac
// confere a cada poucos segundos (só com a aba visível) e troca o QR.
const CONFERIR_CODIGO_MS = 5000;

function conferirCodigo() {
  if (!pareamentoAtual || document.hidden) return;
  atualizarRemoto();
}

// Trava do painel inteiro, acima de tudo menos o preloader.
function renderBloqueio() {
  const caixa = el('bloqueio');
  if (!caixa) return;
  const acesso = acessoPainel.get();
  caixa.hidden = acesso === 'liberado' || acesso === 'verificando';
  if (caixa.hidden) return;
  if (acesso === 'motor_fora') {
    el('bloqueio-titulo').textContent = 'O Mac não está respondendo';
    el('bloqueio-texto').textContent = 'Confira se o Resolux está aberto no Mac e recarregue esta página.';
    return;
  }
  el('bloqueio-titulo').textContent = 'Este aparelho não está pareado';
  const motivo = estadoPareamento.get();
  // No app instalado o caminho é fotografar o QR daqui mesmo: ler pela
  // Câmera abriria o Safari, que guarda o token num lugar à parte.
  const comoChegar = abertoComoApp()
    ? 'Toque em "Ler QR com a câmera" e fotografe o QR do bloco Remote, no Mac.'
    : 'Leia o QR do bloco Remote, no Mac, com o app Câmera (abre direto no navegador) ou toque em "Ler QR com a câmera".';
  el('bloqueio-texto').textContent = lendoQr
    ? 'Procurando o QR na foto…'
    : leituraFalhou
    ? leituraFalhou
    : motivo === 'recusado' || motivo === 'limitado' || motivo === 'sem_resposta' || motivo === 'pareando'
      ? mensagemAparelho()
      : comoChegar;
  el('bloqueio-ler').hidden = motivo === 'pareando' || lendoQr;
}

// Foto do QR tirada pelo botão da trava: decodifica, pareia e, se der
// certo, refaz a sonda para o painel nascer com o token novo.
let leituraFalhou = '';
let lendoQr = false;

async function lerQrDaTrava(evento) {
  const arquivo = evento.target.files?.[0];
  evento.target.value = '';
  if (!arquivo) return;
  leituraFalhou = '';
  lendoQr = true;
  renderBloqueio();
  let codigo = '';
  try {
    codigo = extrairCodigo(await lerQrDaImagem(arquivo));
  } catch (_) {
    codigo = '';
  } finally {
    lendoQr = false;
  }
  if (!codigo) {
    leituraFalhou = 'Não achei o QR do Resolux na foto. Chegue mais perto da tela do Mac e tente de novo.';
    renderBloqueio();
    return;
  }
  if (await parearComCodigo(codigo)) sondarBackend();
}

function iniciarRemoto() {
  el('bloqueio-camera')?.addEventListener('change', lerQrDaTrava);
  acessoPainel.assinar(renderBloqueio);
  estadoPareamento.assinar(renderBloqueio);
  backendAtivo.assinar((valor) => {
    if (valor !== 'sondando') atualizarRemoto();
  });
  estadoPareamento.assinar(() => atualizarRemoto());
  setInterval(tickRemoto, 1000);
  setInterval(conferirCodigo, CONFERIR_CODIGO_MS);
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
      </header>
      <div class="corpo markdown">${markdownParaHtml(mensagem.texto)}</div>
      <footer class="rodape">
        <span class="meta">${escaparHtml(mensagem.hora)}</span>
        <div class="acoes">
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
  if (meta) meta.textContent = msg.hora;
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

let reconhecimento = null;

function alternarVoz() {
  if (reconhecimento) {
    reconhecimento.stop();
    return;
  }
  const Reconhecedor = reconhecedorDisponivel();
  if (!Reconhecedor) return;

  const campo = el('composer-input');
  const base = campo.value;
  reconhecimento = new Reconhecedor();
  reconhecimento.lang = 'pt-BR';
  reconhecimento.interimResults = true;
  reconhecimento.onresult = (evento) => {
    const fala = Array.from(evento.results, (resultado) => resultado[0].transcript).join('');
    campo.value = juntarDitado(base, fala);
    rascunho.set(campo.value);
  };
  // Erro (permissão negada, silêncio) sempre termina em onend.
  reconhecimento.onend = () => {
    reconhecimento = null;
    ouvindo.set(false);
    if (!processando.get()) estadoAgente.set('breathing');
  };

  try {
    reconhecimento.start();
  } catch (_) {
    reconhecimento = null;
    return;
  }
  ouvindo.set(true);
  estadoAgente.set('listening');
}

// ------------------------------------------------------------
// Monitor
// ------------------------------------------------------------

let inscricaoMonitor = null;

function iniciarMonitor() {
  if (!inscricaoMonitor) inscricaoMonitor = assinarMonitorGrade();
  renderMonitor();
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

// Composição (grade de clipes) é do desktop; Atalhos (o deck de teclas ligadas
// às colunas pelo nome) é do mobile: quem opera o evento fica no desktop. As
// duas seções leem a mesma grade e a mesma assinatura (uma só, viva enquanto
// uma delas estiver na tela).
const SECOES_GRADE = new Set(['monitor', 'atalhos']);

// Decidido pelo aparelho no <head> (script detectar-plataforma do index.html),
// não pela largura: desktop com a janela estreita continua desktop.
function ehMobile() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('mobile');
}

const ICONE_CENA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"></rect><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"></rect><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"></rect></svg>';

const NOTA_MOCK_GRADE = '<p class="nota-mock">Mock local: grade de exemplo, sem Arena de verdade — por isso não há thumbnails. Com o daemon de pé, a grade e as thumbs vêm do proxy read-only <code>/api/v1/arena/**</code>.</p>';

function gradeCardHtml(grade, status) {
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

  return `<section class="grade-card vidro${status === 'pollando' ? ' border-beam' : ''}">
      <div class="card-titulo-linha">
        <h2>Grade de clips</h2>
        <div class="grade-pills">
          <span id="zoom-pill" class="pill-status" title="Zoom da grade (arraste com o mouse)">${Math.round(zoomGrade.get() * 100)}%</span>
          <span class="pill-status">${totalClips} clips</span>
        </div>
      </div>
  ${linhas}
  <div class="grade-rodape">Lupa: segure e arraste na grade — pra direita amplia, pra esquerda reduz. Duplo clique volta ao 100%.</div>
    </section>`;
}

function renderMonitor() {
  if (secaoAtiva.get() !== 'monitor') return;
  const grade = gradeMonitor.get();
  const erro = erroMonitor.get();
  const status = estadoMonitor.get();
  const pill = el('monitor-status');
  pill.textContent = status === 'ok' ? 'conectado' : status === 'pollando' ? 'pollando…' : status === 'erro' ? 'offline' : 'parado';
  pill.className = `pill-status ${status === 'ok' ? 'pill-sucesso' : status === 'erro' ? 'pill-alerta' : ''}`;

  if (!grade) {
    el('monitor-conteudo').innerHTML = erro
      ? `<div class="em-breve vidro"><div class="secao-titulo">Monitor indisponível</div><p><strong>${escaparHtml(erro)}</strong> Sem uma grade boa em memória para mostrar.</p></div>`
      : `<div class="em-breve vidro"><div class="secao-titulo">Sondando o Arena…</div><p>Primeiro poll da grade ainda não voltou.</p></div>`;
    return;
  }

  el('monitor-conteudo').innerHTML = `
    <div class="monitor-live">
      ${grade.ativo ? `<span class="clip-ativo-nome">${escaparHtml(grade.ativo.nome)}</span><span class="clip-ativo-endereco">tocando em ${escaparHtml(grade.ativo.endereco)}</span>` : '<span class="clip-ativo-nome neutro">nenhum clip tocando</span>'}
      <span class="ultimo-poll">último poll ${horaFormatada(ultimoPollMonitor.get())}</span>
    </div>
    ${backendAtivo.get() === 'mock' ? NOTA_MOCK_GRADE : ''}
    ${erro ? `<div class="aviso-erro vidro" role="alert"><strong>Monitor falhou:</strong> ${escaparHtml(erro)}</div>` : ''}
    ${gradeCardHtml(grade, status)}
  `;
  if (arrastandoZoom) {
    const cartao = document.querySelector('.grade-card');
    if (cartao) cartao.classList.add('arrastando');
  }
  iniciarOrbs();
}

// ------------------------------------------------------------
// Atalhos — teclas ligadas às colunas do Resolume pelo nome
// ------------------------------------------------------------

const COR_ATALHO = {
  azul: 'var(--gb-azul)',
  roxo: 'var(--gb-roxo)',
  verde: 'var(--gb-verde)',
  laranja: 'var(--gb-laranja)',
  vermelho: 'var(--gb-vermelho)',
  aqua: 'var(--gb-aqua)',
  amarelo: 'var(--gb-amarelo)',
};

const ICONE_MAIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';

const ICONE_ALCA = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3.5" r="1.3"></circle><circle cx="11" cy="3.5" r="1.3"></circle><circle cx="5" cy="8" r="1.3"></circle><circle cx="11" cy="8" r="1.3"></circle><circle cx="5" cy="12.5" r="1.3"></circle><circle cx="11" cy="12.5" r="1.3"></circle></svg>';
const SIGLA_TAMANHO = { p: 'P', m: 'M', g: 'G' };
const NOME_TAMANHO = { p: 'pequeno', m: 'largo', g: 'grande' };

let modoEdicaoAtalhos = false;
let avisoAtalho = '';
let arrasto = null;

function numerosPorExtenso(numeros) {
  if (numeros.length < 2) return String(numeros[0] ?? '');
  return `${numeros.slice(0, -1).join(', ')} e ${numeros.at(-1)}`;
}

// Disparar ainda não existe no contrato v1 (somente leitura); o que a tecla
// consegue dizer hoje é se o nome achou uma coluna só, várias ou nenhuma.
function avisoDoAtalho(atalho, vinculo) {
  if (vinculo.estado === 'ambiguo') {
    return `Mais de uma coluna se chama “${atalho.rotulo}” (colunas ${numerosPorExtenso(vinculo.numeros)}). Renomeie uma delas no Resolume.`;
  }
  if (vinculo.estado === 'sem-coluna') {
    return `Nenhuma coluna se chama “${atalho.rotulo}” no Resolume. Confira o nome.`;
  }
  return 'Disparar pelo celular ainda não está disponível: o contrato com o motor é só leitura (v1).';
}

function colunasAtuais() {
  return gradeMonitor.get()?.colunas ?? [];
}

// Reflow animado (FLIP): guarda onde cada tecla estava, redesenha e anima
// da posição antiga para a nova. Respeita prefers-reduced-motion.
function coletarRects(ul) {
  const mapa = new Map();
  ul.querySelectorAll('li[data-ordem]').forEach((li) => mapa.set(li.dataset.ordem, li.getBoundingClientRect()));
  return mapa;
}

function animarReflow(ul, antes, ignorar = null) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  ul.querySelectorAll('li[data-ordem]').forEach((li) => {
    const anterior = antes.get(li.dataset.ordem);
    if (!anterior || li === ignorar) return;
    const atual = li.getBoundingClientRect();
    const dx = anterior.left - atual.left;
    const dy = anterior.top - atual.top;
    if (!dx && !dy) return;
    li.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  });
}

function renderAtalhosDeck() {
  const deck = el('atalhos-deck');
  // Um poll da composição no meio do arrasto não pode recriar a tecla segurada.
  if (!deck || arrasto) return;
  const gradeAntes = deck.querySelector('.cenas-grade');
  const antes = gradeAntes ? coletarRects(gradeAntes) : null;
  const colunas = colunasAtuais();
  const teclas = atalhos.get().map((atalho) => {
    const vinculo = resolverAtalho(atalho, colunas);
    const classes = ['cena-tecla', 'atalho'];
    if (vinculo.estado === 'ok' && vinculo.tocando > 0) classes.push('tocando');
    if (vinculo.estado !== 'ok') classes.push('aviso');
    const selo = vinculo.estado === 'ambiguo'
      ? '<span class="cena-no-ar" title="Nome repetido">?</span>'
      : vinculo.estado === 'sem-coluna'
        ? '<span class="cena-no-ar" title="Nenhuma coluna com esse nome">!</span>'
        : vinculo.tocando > 0 ? '<span class="cena-no-ar">no ar</span>' : '';
    const rotulo = escaparHtml(atalho.rotulo);
    const acao = modoEdicaoAtalhos ? 'editar' : 'apertar';
    const id = escaparHtml(atalho.id);
    const controles = modoEdicaoAtalhos
      ? `<button type="button" class="atalho-alca" aria-label="Arrastar ${rotulo}">${ICONE_ALCA}</button><button type="button" class="atalho-ciclo" data-atalho-acao="tamanho" data-atalho-id="${id}" aria-label="Tamanho de ${rotulo}: ${NOME_TAMANHO[atalho.tamanho]}">${SIGLA_TAMANHO[atalho.tamanho]}</button>`
      : '';
    return `<li class="tam-${atalho.tamanho}" data-ordem="${id}"><button type="button" class="${classes.join(' ')}" style="--cena: ${COR_ATALHO[atalho.cor]}" data-atalho-id="${id}" data-atalho-acao="${acao}" aria-label="${rotulo}">${selo}<span class="cena-icone">${ICONE_CENA}</span><span class="cena-nome">${rotulo}</span></button>${controles}</li>`;
  }).join('');
  const novo = `<li><button type="button" class="cena-tecla atalho-novo" data-atalho-acao="novo" aria-label="Novo atalho"><span class="cena-icone">${ICONE_MAIS}</span><span class="cena-nome">Novo</span></button></li>`;
  deck.innerHTML = `
    <section class="atalhos-solto">
      <div class="atalhos-barra">
        <button type="button" class="pill-status atalho-editar" data-atalho-acao="alternar-edicao">${modoEdicaoAtalhos ? 'Concluir' : 'Editar'}</button>
      </div>
      <ul class="cenas-grade bento${modoEdicaoAtalhos ? ' editando' : ''}">${teclas}${novo}</ul>
      ${atalhos.get().length === 0 ? '<p class="atalhos-aviso">Nenhum atalho ainda. Toque em Novo e digite o nome de uma coluna do Resolume.</p>' : ''}
      ${avisoAtalho ? `<p class="atalhos-aviso" role="status">${escaparHtml(avisoAtalho)}</p>` : ''}
    </section>`;
  const gradeDepois = deck.querySelector('.cenas-grade');
  if (antes && gradeDepois) animarReflow(gradeDepois, antes);
}

function abrirFormAtalho(id) {
  const atual = id ? atalhos.get().find((atalho) => atalho.id === id) : null;
  const nomes = new Set(
    colunasAtuais()
      .map((coluna) => coluna.rotulo)
      .filter((nome) => !/^(column|coluna) \d+$/i.test(nome)),
  );
  const sugestoes = [...nomes].map((nome) => `<option value="${escaparHtml(nome)}"></option>`).join('');
  const cores = Object.keys(COR_ATALHO).map((cor, i) => `<label class="atalho-cor" style="--cena: ${COR_ATALHO[cor]}"><input type="radio" name="cor" value="${cor}"${(atual ? atual.cor === cor : i === 0) ? ' checked' : ''}><span></span></label>`).join('');
  const tamanhos = [['p', 'Pequeno'], ['m', 'Largo'], ['g', 'Grande']].map(([valor, rotulo]) => `<label class="atalho-tam"><input type="radio" name="tamanho" value="${valor}"${(atual ? atual.tamanho === valor : valor === 'p') ? ' checked' : ''}><span>${rotulo}</span></label>`).join('');
  el('atalhos-form-area').innerHTML = `
    <form id="atalho-form" class="atalho-form vidro" data-atalho-id="${escaparHtml(atual?.id ?? '')}" autocomplete="off">
      <h3>${atual ? 'Editar atalho' : 'Novo atalho'}</h3>
      <label class="atalho-campo">Nome da coluna no Resolume
        <input name="rotulo" maxlength="24" required list="atalho-sugestoes" value="${escaparHtml(atual?.rotulo ?? '')}" placeholder="Ex.: Introdução">
      </label>
      <datalist id="atalho-sugestoes">${sugestoes}</datalist>
      <div class="atalho-cores" role="radiogroup" aria-label="Cor">${cores}</div>
      <div class="atalho-tamanhos" role="radiogroup" aria-label="Tamanho">${tamanhos}</div>
      <div class="atalho-form-acoes">
        <button type="submit" class="atalho-botao principal">Salvar</button>
        <button type="button" class="atalho-botao" data-atalho-acao="cancelar">Cancelar</button>
        ${atual ? `<button type="button" class="atalho-botao perigo" data-atalho-acao="excluir" data-atalho-id="${escaparHtml(atual.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
  el('atalho-form').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  el('atalho-form').elements.rotulo.focus({ preventScroll: true });
}

function fecharFormAtalho() {
  el('atalhos-form-area').innerHTML = '';
}

function aoClicarAtalhos(evento) {
  const alvo = evento.target.closest('[data-atalho-acao]');
  if (!alvo) return;
  const acao = alvo.dataset.atalhoAcao;
  const id = alvo.dataset.atalhoId;
  if (acao === 'alternar-edicao') {
    modoEdicaoAtalhos = !modoEdicaoAtalhos;
    avisoAtalho = '';
    fecharFormAtalho();
    renderAtalhosDeck();
  } else if (acao === 'novo') {
    abrirFormAtalho(null);
  } else if (acao === 'editar') {
    abrirFormAtalho(id);
  } else if (acao === 'apertar') {
    const atalho = atalhos.get().find((item) => item.id === id);
    if (!atalho) return;
    avisoAtalho = avisoDoAtalho(atalho, resolverAtalho(atalho, colunasAtuais()));
    renderAtalhosDeck();
  } else if (acao === 'tamanho') {
    atalhos.set(atalhos.get().map((item) => (item.id === id ? { ...item, tamanho: proximoTamanho(item.tamanho) } : item)));
  } else if (acao === 'cancelar') {
    fecharFormAtalho();
  } else if (acao === 'excluir') {
    atalhos.set(atalhos.get().filter((item) => item.id !== id));
    fecharFormAtalho();
  }
}

// Arrastar para reordenar (só no modo de edição): a tecla segue o dedo, as
// outras se acomodam na hora (o grid refaz o layout pela ordem do DOM) e a
// ordem final só vai para o `atalhos` ao soltar.
function posicionarArrasto() {
  const { li, grabX, grabY, x, y } = arrasto;
  li.style.transform = 'none';
  const caixa = li.getBoundingClientRect();
  li.style.transform = `translate(${x - grabX - caixa.left}px, ${y - grabY - caixa.top}px) scale(1.05)`;
}

function aoPressionarAlca(evento) {
  const alca = evento.target.closest('.atalho-alca');
  const li = alca?.closest('li[data-ordem]');
  if (!li || arrasto) return;
  evento.preventDefault();
  const caixa = li.getBoundingClientRect();
  arrasto = {
    li,
    ul: li.parentElement,
    pointerId: evento.pointerId,
    grabX: evento.clientX - caixa.left,
    grabY: evento.clientY - caixa.top,
    x: evento.clientX,
    y: evento.clientY,
  };
  li.classList.add('arrastando-atalho');
  try { alca.setPointerCapture(evento.pointerId); } catch { /* sem captura, o window ainda recebe */ }
  posicionarArrasto();
  window.addEventListener('pointermove', aoMoverArrasto);
  window.addEventListener('pointerup', aoSoltarArrasto);
  window.addEventListener('pointercancel', aoSoltarArrasto);
}

function aoMoverArrasto(evento) {
  if (!arrasto || evento.pointerId !== arrasto.pointerId) return;
  arrasto.x = evento.clientX;
  arrasto.y = evento.clientY;
  const { li, ul } = arrasto;
  // A tecla segurada ignora o ponteiro (CSS), então o hit-test enxerga o que está embaixo.
  const alvo = document.elementFromPoint(arrasto.x, arrasto.y)?.closest('li[data-ordem]');
  if (alvo && alvo !== li && alvo.parentElement === ul) {
    const antes = coletarRects(ul);
    const liVemAntes = alvo.compareDocumentPosition(li) & Node.DOCUMENT_POSITION_PRECEDING;
    ul.insertBefore(li, liVemAntes ? alvo.nextSibling : alvo);
    animarReflow(ul, antes, li);
  }
  posicionarArrasto();
}

function aoSoltarArrasto(evento) {
  if (!arrasto || evento.pointerId !== arrasto.pointerId) return;
  window.removeEventListener('pointermove', aoMoverArrasto);
  window.removeEventListener('pointerup', aoSoltarArrasto);
  window.removeEventListener('pointercancel', aoSoltarArrasto);
  const { li, ul } = arrasto;
  const ids = [...ul.querySelectorAll('li[data-ordem]')].map((item) => item.dataset.ordem);
  li.classList.remove('arrastando-atalho');
  li.style.transform = '';
  arrasto = null;
  atalhos.set(aplicarOrdem(atalhos.get(), ids));
}

function aoEnviarAtalho(evento) {
  const form = evento.target.closest('#atalho-form');
  if (!form) return;
  evento.preventDefault();
  const dados = new FormData(form);
  const idExistente = form.dataset.atalhoId || undefined;
  const atalho = sanitizarAtalho({ id: idExistente, rotulo: dados.get('rotulo'), cor: dados.get('cor'), tamanho: dados.get('tamanho') });
  if (!atalho) return;
  const lista = atalhos.get();
  atalhos.set(idExistente ? lista.map((item) => (item.id === atalho.id ? atalho : item)) : [...lista, atalho]);
  fecharFormAtalho();
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

// O re-render da Status reescreve o HTML a cada amostra; sem lembrar se o
// bloco técnico estava aberto, ele fecharia sozinho na cara de quem lê.
let detalhesTecnicosAbertos = false;

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
    ${veredito(avaliarSaude({ contrato, historicoCpu: historicoCpu.get(), historicoGpu: historicoGpu.get() }))}
    ${metricasSistemaHtml(contrato, { cpu: historicoCpu.get(), memoria: historicoMemoria.get(), gpu: historicoGpu.get() })}
    ${processosSistemaHtml(contrato, {
      encerrados: processosEncerrados,
      encerrando: processosEncerrando,
      erro: erroProcessos,
    })}
    ${cartoes.length ? grupoRecolhivel('Detalhes técnicos', `<div class="status-grid">${cartoes.join('')}</div>`, { aberto: detalhesTecnicosAbertos }) : '<div class="em-breve vidro"><div class="secao-titulo">Sem cartões</div><p>O motor não enviou nenhum bloco neste sample.</p></div>'}
    ${erro ? `<div class="aviso-erro vidro" role="alert"><strong>Último problema no feed:</strong> ${escaparHtml(erro)}</div>` : ''}
  `);
}

async function encerrarProcesso(pid) {
  if (!Number.isInteger(pid) || processosEncerrando.has(pid)) return;
  processosEncerrando.add(pid);
  renderStatus();

  try {
    const resposta = await fetch(`/monitor/processes/${pid}/terminate`, {
      method: 'POST',
      headers: cabecalhosAcesso(),
    });
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
  // `toggle` não borbulha: captura na fase de captura para guardar o estado.
  document.addEventListener('toggle', (evento) => {
    if (evento.target.matches?.('.status-detalhes')) detalhesTecnicosAbertos = evento.target.open;
  }, true);
  document.addEventListener('click', aoClicarAtalhos);
  document.addEventListener('pointerdown', aoPressionarAlca);
  document.addEventListener('submit', aoEnviarAtalho);
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
  el('btn-mic').hidden = !reconhecedorDisponivel();
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

// Deep link por hash (#status, #monitor, #ajustes) — útil pra abrir a aba
// certa num link externo ou no QR do celular.
const SECOES_VALIDAS = new Set(['monitor', 'atalhos', 'assistente', 'status', 'ajustes']);
function aplicarHashInicial() {
  const hash = window.location.hash.replace('#', '');
  if (SECOES_VALIDAS.has(hash)) secaoAtiva.set(secaoDaPlataforma(hash, ehMobile()));
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

  estadoMonitor.assinar(renderMonitor);
  gradeMonitor.assinar(renderMonitor);
  erroMonitor.assinar(renderMonitor);
  progressoGrade.assinar(atualizarBarrasTimeGrid);
  backendAtivo.assinar(renderMonitor);
  atalhos.assinar(renderAtalhosDeck);
  gradeMonitor.assinar(renderAtalhosDeck);

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
iniciarRemoto();
iniciarControlesJanela();
atualizarTopbar();
atualizarVisao();
renderMensagens();
atualizarTrabalho();
atualizarComposer();
iniciarOrbs();
aplicarMetalNoTexto(el('logo-metal'));
configurarInstalacaoPwa();
// Celular que chegou pelo QR devolve o código antes da sonda.
concluirPareamentoDaUrl().finally(sondarBackend);
iniciarPreloader();
