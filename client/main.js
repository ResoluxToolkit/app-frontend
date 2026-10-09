import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';

import './main.html';
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
  subirContexto,
} from '/imports/ui/store';
import { iniciarOrbs } from '/imports/ui/orb';
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
  assinarMonitorGrade,
} from '/imports/api';
import {
  zoomGrade,
  ajustarZoom,
  resetarZoom,
} from '/imports/ui/store';

// ------------------------------------------------------------
// Helpers globais
// ------------------------------------------------------------

Template.registerHelper('contextoPct', () => contextoPct.get());
Template.registerHelper('navAtiva', (secao) => secaoAtiva.get() === secao);
Template.registerHelper('estadoOrb', function () {
  // Dentro de uma mensagem de agente, o orb é fixo (breathing);
  // fora, segue o estado vivo do agente.
  return (this && this.estadoOrb) || estadoAgente.get();
});

const ROTULOS_SECAO = {
  quickplay: 'Quick Play',
  camera: 'Câmera',
  monitor: 'Monitor',
  assistente: 'Assistente',
  starter: 'Starter',
  ajustes: 'Ajustes',
};

Template.app.helpers({
  assistenteAtiva: () => secaoAtiva.get() === 'assistente',
  ajustesAtiva: () => secaoAtiva.get() === 'ajustes',
  monitorAtiva: () => secaoAtiva.get() === 'monitor',
});

Template.secaoEmBreve.helpers({
  rotuloSecao: () => ROTULOS_SECAO[secaoAtiva.get()] || secaoAtiva.get(),
});

function escaparHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ------------------------------------------------------------
// Topbar — pílula do motor (daemon real × mock)
// ------------------------------------------------------------

Template.topbar.helpers({
  motorRotulo() {
    const b = backendAtivo.get();
    if (b === 'daemon') return 'Motor Resolux';
    if (b === 'mock') return 'Mock local';
    return 'Sondando motor…';
  },
  motorClasse() {
    const b = backendAtivo.get();
    if (b === 'daemon') return 'sucesso';
    if (b === 'mock') return 'marca';
    return 'neutro';
  },
});

Template.topbar.events({
  'click .nav-pill'(event) {
    const secao = event.currentTarget.dataset.secao;
    if (secao) secaoAtiva.set(secao);
  },
});

// ------------------------------------------------------------
// Sidebar
// ------------------------------------------------------------

Template.sidebar.helpers({
  sessoes: () => [
    { titulo: 'Hello World', meta: 'Assistente · 03:29', ativa: true },
    { titulo: 'Setup da câmera', meta: 'Ontem' },
    { titulo: 'Monitor do Arena', meta: 'Segunda-feira' },
  ],
});

Template.sidebar.events({
  'click .btn-nova'() {
    resetarConversa();
  },
});

// ------------------------------------------------------------
// Thread
// ------------------------------------------------------------

Template.thread.helpers({
  mensagens: () => mensagens.get(),
  isUsuario() {
    return this.papel === 'usuario';
  },
  trabalhando: () => processando.get() || ouvindo.get(),
  rotuloTrabalho: () =>
    ouvindo.get() && !processando.get()
      ? 'Ouvindo o microfone…'
      : rotuloTrabalho.get(),
});

Template.thread.events({
  'click .acao-rapida'(event) {
    const texto = event.currentTarget.dataset.acao;
    if (texto) enviar(texto);
  },
  'click .copiar'(event) {
    const texto = event.currentTarget.dataset.texto || '';
    if (navigator.clipboard) navigator.clipboard.writeText(texto);
  },
});

Template.mensagemAgente.helpers({
  corpoHtml() {
    return escaparHtml(this.texto).replace(/\n/g, '<br>');
  },
});

// ------------------------------------------------------------
// Composer
// ------------------------------------------------------------

Template.composer.helpers({
  processando: () => processando.get(),
  focado: () => focado.get(),
  ouvindo: () => ouvindo.get(),
  rascunho: () => rascunho.get(),
  rotuloProcessando: () => rotuloProcessando.get(),
});

Template.composer.events({
  'focus #composer-input'() {
    focado.set(true);
  },
  'blur #composer-input'() {
    focado.set(false);
  },
  'input #composer-input'(event) {
    rascunho.set(event.currentTarget.value);
  },
  'submit #composer-form'(event) {
    event.preventDefault();
    const input = document.getElementById('composer-input');
    const texto = (input ? input.value : rascunho.get()).trim();
    if (!texto) return;
    rascunho.set('');
    enviar(texto);
  },
  'click #btn-mic'() {
    alternarVoz();
  },
  'click #btn-parar'() {
    parar();
  },
});

// ------------------------------------------------------------
// Monitor Arena — grade de clips (leitura pura, empurrada pelo motor).
// A UI ASSINA o monitor na fachada enquanto a seção está aberta; o
// Blaze recria o template a cada troca de seção, então a assinatura
// morre com a tela. Lupa: arrastar o mouse na grade amplia/reduz.
// ------------------------------------------------------------

Template.monitor.onRendered(function () {
  this.inscricaoMonitor = assinarMonitorGrade();
});

Template.monitor.onDestroyed(function () {
  if (this.inscricaoMonitor) this.inscricaoMonitor.cancelar();
  // Se a tela fechou no meio de um arrasto de zoom, solta os
  // listeners da janela junto.
  if (this.zoomAoSoltar) this.zoomAoSoltar();
});

Template.monitor.helpers({
  grade: () => gradeMonitor.get(),
  ehMock: () => backendAtivo.get() === 'mock',
  erroMonitor: () => erroMonitor.get(),
  monitorOk: () => estadoMonitor.get() === 'ok',
  monitorErro: () => estadoMonitor.get() === 'erro',
  monitorStatus() {
    switch (estadoMonitor.get()) {
      case 'ok':
        return 'conectado';
      case 'pollando':
        return 'pollando…';
      case 'erro':
        return 'offline';
      default:
        return 'parado';
    }
  },
  horaUltimoPoll() {
    const d = ultimoPollMonitor.get();
    if (!d) return '—';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  },
  contagemClips() {
    const grade = gradeMonitor.get();
    if (!grade) return '0 clips';
    const total = grade.camadas.reduce(
      (n, c) => n + c.celulas.filter((cel) => cel.preenchido).length,
      0,
    );
    return `${total} clips`;
  },
  zoomGrade: () => zoomGrade.get(),
  zoomPct: () => `${Math.round(zoomGrade.get() * 100)}%`,
});

// Quanto o zoom ganha por pixel de arrasto: 0,5%/px a partir do
// zoom onde o gesto começou. Duplo clique volta ao 100%.
const FATOR_ZOOM_POR_PX = 0.005;

Template.monitor.events({
  'mousedown .grade-card'(evento, instancia) {
    if (evento.button !== 0) return;
    evento.preventDefault();
    const cartao = evento.currentTarget;
    const x0 = evento.clientX;
    const zoom0 = zoomGrade.get();
    cartao.classList.add('arrastando');

    const aoMover = (e) => {
      ajustarZoom(zoom0 * (1 + (e.clientX - x0) * FATOR_ZOOM_POR_PX));
    };
    const aoSoltar = () => {
      window.removeEventListener('mousemove', aoMover);
      window.removeEventListener('mouseup', aoSoltar);
      cartao.classList.remove('arrastando');
      instancia.zoomAoSoltar = null;
    };
    instancia.zoomAoSoltar = aoSoltar;
    window.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);
  },
  'dblclick .grade-card'() {
    resetarZoom();
  },
});

// ------------------------------------------------------------
// Ajustes — sessão do motor (GET/PATCH /api/v1/session)
// ------------------------------------------------------------

// A v1 não devolve a allowlist no GET /session — só aceita no PATCH.
// Então a visão da lista é local desta aba (null = todas); a tela
// avisa disso em vez de fingir que leu o estado do motor.
const allowlistVisao = new ReactiveVar(null);

Template.ajustes.helpers({
  sessao: () => sessaoMotor.get(),
  erroSessao: () => erroSessao.get(),
  salvando: () => salvandoSessao.get(),
  motorEhMock: () => backendAtivo.get() === 'mock',
  ferramentas: () => ferramentasMotor.get(),
  todasFerramentas: () => allowlistVisao.get() === null,
  // Mustache sozinho em posição de atributo precisa devolver um
  // dicionário nome→valor (ou {} para nenhum); string solta quebra.
  attrTodas: () => (allowlistVisao.get() === null ? { checked: true } : {}),
  modoEh: (modo) => (sessaoMotor.get() || {}).mode === modo,
  backendEh: (b) => (sessaoMotor.get() || {}).backend === b,
  attrFerramentaMarcada(nome) {
    const lista = allowlistVisao.get();
    return lista !== null && lista.includes(nome) ? { checked: true } : {};
  },
  contagemFerramentas() {
    const total = ferramentasMotor.get().length;
    const lista = allowlistVisao.get();
    if (lista === null) return `${total} de ${total}`;
    return `${lista.length} de ${total}`;
  },
});

Template.ajustes.events({
  'click .seg[data-modo]'(event) {
    atualizarSessao({ mode: event.currentTarget.dataset.modo });
  },
  'click .seg[data-backend]'(event) {
    atualizarSessao({ backend: event.currentTarget.dataset.backend });
  },
  'change #campo-modelo'(event) {
    const model = event.currentTarget.value.trim();
    if (model) atualizarSessao({ model });
  },
  'change #chk-todas'(event) {
    if (event.currentTarget.checked) {
      allowlistVisao.set(null);
      atualizarSessao({ toolAllowlist: null });
    } else {
      // Sai de "todas" começando da lista completa anunciada pelo motor.
      const lista = ferramentasMotor.get().map((t) => t.name);
      allowlistVisao.set(lista);
      atualizarSessao({ toolAllowlist: lista });
    }
  },
  'change .chk-ferramenta'() {
    const marcadas = Array.from(
      document.querySelectorAll('.chk-ferramenta:checked'),
    ).map((el) => el.value);
    allowlistVisao.set(marcadas);
    atualizarSessao({ toolAllowlist: marcadas });
  },
});

// ------------------------------------------------------------
// Fluxo do agente via fachada de backend (daemon real ou mock).
// A UI só conhece callbacks; quem responde é decisão da sonda.
// ------------------------------------------------------------

let turnoAtual = null;

function rolarThread() {
  Tracker.afterFlush(() => {
    const el = document.getElementById('thread-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  });
}

function enviar(texto) {
  if (processando.get()) return;
  if (turnoAtual) {
    turnoAtual.cancelar();
    turnoAtual = null;
  }

  adicionarMensagem({ papel: 'usuario', texto, hora: horaAgora() });
  rolarThread();

  processando.set(true);
  estadoAgente.set('working');
  rotuloTrabalho.set('Enviando ao motor…');
  rotuloProcessando.set('Processando sua solicitação…');
  rolarThread();

  let msgId = null;

  const garantirMensagem = () => {
    if (msgId != null) return msgId;
    adicionarMensagem({
      papel: 'agente',
      texto: '',
      hora: horaAgora(),
      tokens: 0,
      estadoOrb: 'breathing',
      streaming: true,
    });
    rolarThread();
    msgId = mensagens.get()[mensagens.get().length - 1].id;
    return msgId;
  };

  const encerrar = () => {
    processando.set(false);
    estadoAgente.set('breathing');
    turnoAtual = null;
    subirContexto(4);
    rolarThread();
  };

  turnoAtual = obterBackend().enviarChat(texto, {
    onStarted(info) {
      // O mock informa os rótulos por ação; o daemon real não tem
      // eventos intermediários na v1, então fica o rótulo neutro.
      if (info) {
        rotuloTrabalho.set(info.trabalho);
        rotuloProcessando.set(info.processo);
      } else {
        rotuloTrabalho.set('Turno com o motor — isso leva minutos, não segundos…');
      }
      rolarThread();
    },
    onComposing() {
      estadoAgente.set('composing');
      rotuloTrabalho.set('Escrevendo a resposta…');
    },
    onChunk(parcial, tokens) {
      const id = garantirMensagem();
      estadoAgente.set('composing');
      atualizarMensagem(id, { texto: parcial, tokens });
      rolarThread();
    },
    onFinal(texto) {
      const id = garantirMensagem();
      atualizarMensagem(id, {
        texto,
        tokens: Math.max(1, Math.round(texto.length / 4)),
        streaming: false,
      });
      encerrar();
    },
    onError(codigo, mensagem) {
      const id = garantirMensagem();
      atualizarMensagem(id, {
        texto: `Erro do motor (${codigo}): ${mensagem}`,
        streaming: false,
      });
      encerrar();
    },
  });
}

function parar() {
  if (turnoAtual) {
    turnoAtual.cancelar();
    turnoAtual = null;
  }
  // Se havia uma resposta em streaming, congela o texto parcial
  const lista = mensagens.get();
  const ultima = lista[lista.length - 1];
  if (ultima && ultima.streaming) {
    atualizarMensagem(ultima.id, {
      streaming: false,
      texto: ultima.texto ? ultima.texto + ' …(interrompido)' : '(resposta interrompida)',
    });
  }
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
// Boot
// ------------------------------------------------------------

Meteor.startup(() => {
  sondarBackend();
  iniciarOrbs();
  // Rescaneia os canvases após qualquer re-render do Blaze
  Tracker.autorun(() => {
    mensagens.get();
    processando.get();
    ouvindo.get();
    estadoAgente.get();
    Tracker.afterFlush(() => iniciarOrbs());
  });
});
