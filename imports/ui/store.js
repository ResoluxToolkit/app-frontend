import { ReactiveVar } from 'meteor/reactive-var';

// ------------------------------------------------------------
// Navegação: seção ativa da topbar
// ------------------------------------------------------------

export const secaoAtiva = new ReactiveVar('assistente');

// ------------------------------------------------------------
// Estado global da tela Assistente (mock interativo)
// ------------------------------------------------------------

let proximoId = 3;

export const mensagens = new ReactiveVar([
  {
    id: 1,
    papel: 'usuario',
    texto: 'Hello World!',
    hora: '03:29',
  },
  {
    id: 2,
    papel: 'agente',
    texto:
      'Olá, Luizinho! Hello World de volta. Estou pronto quando você estiver: ' +
      'posso verificar a câmera, acompanhar o monitor do Arena ou preparar o Quick Play.\n\n' +
      'Por onde começamos?',
    hora: '03:29',
    tokens: 54,
    estadoOrb: 'breathing',
    streaming: false,
  },
]);

export const processando = new ReactiveVar(false);
export const ouvindo = new ReactiveVar(false);
export const focado = new ReactiveVar(false);
export const rascunho = new ReactiveVar('');
export const contextoPct = new ReactiveVar(9);

// Estado do agente: breathing | listening | searching | composing | working
export const estadoAgente = new ReactiveVar('breathing');

export const rotuloTrabalho = new ReactiveVar('Analisando o monitor do Arena…');
export const rotuloProcessando = new ReactiveVar('Processando ação no Monitor…');

// ------------------------------------------------------------
// Monitor — zoom da grade de clips ("lupa"): arrastar o mouse
// pra direita amplia, pra esquerda reduz. Duplo clique reseta.
// ------------------------------------------------------------

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 3;
export const zoomGrade = new ReactiveVar(1);

export function ajustarZoom(z) {
  zoomGrade.set(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)));
}

export function resetarZoom() {
  zoomGrade.set(1);
}

export function horaAgora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function adicionarMensagem(msg) {
  mensagens.set([...mensagens.get(), { id: proximoId++, ...msg }]);
}

export function atualizarMensagem(id, patch) {
  mensagens.set(
    mensagens.get().map((m) => (m.id === id ? { ...m, ...patch } : m)),
  );
}

export function resetarConversa() {
  proximoId = 3;
  mensagens.set(mensagens.get().slice(0, 2));
  contextoPct.set(9);
  processando.set(false);
  ouvindo.set(false);
  estadoAgente.set('breathing');
}

export function subirContexto(delta) {
  contextoPct.set(Math.min(96, contextoPct.get() + delta));
}
