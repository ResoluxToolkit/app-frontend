import { Sinal } from './signal.js';
import {
  carregarAtalhos,
  carregarConversa,
  carregarContexto,
  salvarAtalhos,
  salvarConversa,
  salvarContexto,
} from './persistencia.js';

// ------------------------------------------------------------
// Navegação: seção ativa da topbar
// ------------------------------------------------------------

export const secaoAtiva = new Sinal('assistente');

// Deck de atalhos: cada um é só nome + cor, e vive no aparelho.
export const atalhos = new Sinal(carregarAtalhos());
atalhos.assinar((valor) => salvarAtalhos(valor));

// ------------------------------------------------------------
// Estado global da tela Assistente (mock interativo)
// ------------------------------------------------------------

// Conversa vazia: a lista e a thread nascem reais, sem conteúdo fake.
function conversaPadrao() {
  return [];
}

// A conversa sobrevive ao refresh: carrega o que está no localStorage
// (ou o padrão) e grava a cada mudança da thread.
const baseConversa = carregarConversa() ?? conversaPadrao();
let proximoId = baseConversa.reduce((maior, m) => Math.max(maior, m.id ?? 0), 0) + 1;

export const mensagens = new Sinal(baseConversa);
mensagens.assinar((valor) => salvarConversa(valor));

export const processando = new Sinal(false);
export const ouvindo = new Sinal(false);
export const focado = new Sinal(false);
export const rascunho = new Sinal('');
export const contextoPct = new Sinal(carregarContexto(9));
contextoPct.assinar((valor) => salvarContexto(valor));

// Estado do agente: breathing | listening | searching | composing | working
export const estadoAgente = new Sinal('breathing');

export const rotuloTrabalho = new Sinal('Analisando o monitor do Arena…');
export const rotuloProcessando = new Sinal('Processando ação no Monitor…');

// ------------------------------------------------------------
// Monitor — zoom da grade de clips ("lupa"): arrastar o mouse
// pra direita amplia, pra esquerda reduz. Duplo clique reseta.
// ------------------------------------------------------------

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 3;
export const zoomGrade = new Sinal(1);

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
  proximoId = 1;
  mensagens.set(conversaPadrao());
  contextoPct.set(9);
  processando.set(false);
  ouvindo.set(false);
  estadoAgente.set('breathing');
}

// Turnos vindos do daemon (GET /api/v1/conversa): mapeia pro formato da
// thread, renumera ids e aceita lista vazia pra refletir o motor.
export function definirConversa(turnos) {
  if (!Array.isArray(turnos)) return;
  const mapeadas = turnos
    .filter(
      (turno) =>
        ['usuario', 'agente'].includes(turno?.papel) &&
        typeof turno?.texto === 'string' &&
        turno.texto.trim(),
    )
    .map((turno) => ({
      papel: turno.papel,
      texto: turno.texto,
      hora: typeof turno.hora === 'string' ? turno.hora : '',
      turnoId: turno.id ?? null,
      ...(turno.papel === 'agente'
        ? {
            tokens: Math.max(1, Math.round(turno.texto.length / 4)),
            estadoOrb: 'breathing',
            streaming: false,
          }
        : {}),
    }));
  let id = 1;
  const numeradas = mapeadas.map((mensagem) => ({ id: id++, ...mensagem }));
  proximoId = id;
  mensagens.set(numeradas);
}

// Push do daemon (conversa.update): thread reativa entre os devices.
// Regras: no meio de um turno local, a thread local manda — só vincula
// cópias (mensagem enviada, streaming) ao id do disco; ociosa, thread sem
// vínculo é substituída inteira (era o preenchimento padrão); com vínculo,
// reconcilia em ordem e anexa só o que falta. Extras locais (erro,
// interrompido) ficam — o daemon não os grava.
export function incorporarTurnos(turnos) {
  if (!Array.isArray(turnos)) return;
  const emTurno = processando.get();
  if (!emTurno && turnos.length === 0) {
    resetarConversa();
    return;
  }
  const lista = mensagens.get();
  if (!emTurno && lista.every((mensagem) => mensagem.turnoId == null)) {
    definirConversa(turnos);
    return;
  }

  const presentes = new Set(lista.map((m) => m.turnoId).filter((v) => v != null));
  let cursor = 0;
  const proximoTurno = () => {
    while (
      cursor < turnos.length &&
      (turnos[cursor]?.id == null || presentes.has(turnos[cursor].id))
    ) {
      cursor += 1;
    }
    return turnos[cursor];
  };

  for (const mensagem of lista) {
    if (mensagem.turnoId != null) continue;
    const turno = proximoTurno();
    if (
      turno &&
      turno.papel === mensagem.papel &&
      turno.texto === mensagem.texto
    ) {
      presentes.add(turno.id);
      cursor += 1;
      atualizarMensagem(mensagem.id, { turnoId: turno.id });
    }
  }
  if (emTurno) return;

  for (; cursor < turnos.length; cursor += 1) {
    const turno = turnos[cursor];
    if (turno?.id == null || presentes.has(turno.id)) continue;
    if (!['usuario', 'agente'].includes(turno.papel)) continue;
    if (typeof turno.texto !== 'string' || !turno.texto.trim()) continue;
    presentes.add(turno.id);
    adicionarMensagem({
      papel: turno.papel,
      texto: turno.texto,
      hora: typeof turno.hora === 'string' ? turno.hora : '',
      turnoId: turno.id,
      ...(turno.papel === 'agente'
        ? {
            tokens: Math.max(1, Math.round(turno.texto.length / 4)),
            estadoOrb: 'breathing',
            streaming: false,
          }
        : {}),
    });
  }
}

export function subirContexto(delta) {
  contextoPct.set(Math.min(96, contextoPct.get() + delta));
}
