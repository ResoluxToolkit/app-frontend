// ------------------------------------------------------------
// MockDaemon — mesma interface do ResoluxDaemon, mas responde
// localmente. É o comportamento que já existia no mock, movido
// pra trás do contrato: a UI não sabe (nem precisa saber) qual
// dos dois está respondendo.
// ------------------------------------------------------------

import { ErroApi } from './client.js';

const ROTULOS_ACAO = [
  [/clipe|camada|coluna|composi/i, 'Lendo a composição do Arena…', 'Leitura da composição'],
  [/monitor|arena/i, 'Analisando o monitor do Arena…', 'Leitura do monitor'],
];

const RESPOSTAS = [
  [
    /clipe|camada|coluna|composi/i,
    'A composição tem 3 camadas e 8 colunas; 2 clipes estão tocando agora, ' +
      'na camada 1 e na camada 3. (resposta do mock local)',
  ],
  [
    /monitor|arena/i,
    'Monitor do Arena acompanhando: composição aberta e respondendo pelo REST. ' +
      '(resposta do mock local)',
  ],
];

function respostaPara(texto) {
  for (const [re, resp] of RESPOSTAS) {
    if (re.test(texto)) return resp;
  }
  return (
    'Anotei: "' +
    texto +
    '". Consigo ler a composição do Arena: camadas, colunas e clipes tocando. ' +
    '(resposta do mock local)'
  );
}

function rotuloPara(texto) {
  for (const [re, rotulo, proc] of ROTULOS_ACAO) {
    if (re.test(texto)) return { trabalho: rotulo, processo: `Processando ${proc.toLowerCase()}…` };
  }
  return { trabalho: 'Pensando na sua solicitação…', processo: 'Processando sua solicitação…' };
}

function horaAgora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}


// Validade do código do QR — o mesmo teto pedido ao motor real.
export const VALIDADE_PAREAMENTO_S = 300;

function codigoAleatorio(bytes = 16) {
  const valores = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(valores);
  return btoa(String.fromCharCode(...valores))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export class MockDaemon {
  constructor() {
    this.nome = 'mock';
    // Conversa do mock vive só em memória: recarregar a aba zera.
    this.conversa = [];
    // Sessão vive só em memória: recarregar a aba zera os ajustes.
    this.sessao = {
      protocol: 'resolux-api/1',
      mode: 'timeline',
      backend: 'mock',
      model: 'mock-local',
      toolPolicy: 'readOnly',
      toolsAllowed: 0,
      journalEnabled: false,
    };
  }

  async sondar() {
    return true; // o mock está sempre "de pé"
  }

  // Mesmo formato do motor: código rotativo com `expiraEm` em epoch
  // segundos. No mock ele só exercita a UI — nenhum celular alcança o
  // mock, que vive dentro da aba.
  async obterPareamento(agoraMs = Date.now()) {
    const agora = agoraMs / 1000;
    if (!this.pareamento || this.pareamento.expiraEm <= agora) {
      this.pareamento = {
        codigo: codigoAleatorio(),
        expiraEm: Math.floor(agora) + VALIDADE_PAREAMENTO_S,
      };
    }
    return { ...this.pareamento };
  }

  // Compara e gira o código (uso único), como o motor deve fazer.
  async parear(codigo, agoraMs = Date.now()) {
    const atual = this.pareamento;
    if (!atual || !codigo || codigo !== atual.codigo || atual.expiraEm <= agoraMs / 1000) {
      throw new ErroApi('pairing_invalid', 'Código vencido ou inválido. Leia o QR de novo.');
    }
    this.pareamento = null;
    return { token: `mock-${codigoAleatorio()}` };
  }

  async getSession() {
    // Envelope da v1, marcado como mock pra ninguém confundir com motor real.
    return { ...this.sessao };
  }

  async getTools() {
    // O mock não tem ferramentas do Arena: lista vazia, sem fingir.
    return { tools: [] };
  }

  // Mesma interface do daemon real: envelope {"turnos":[...]}, com
  // turnos {papel, texto, hora}. Memória só — o mock não tem disco.
  async obterConversa() {
    return { turnos: [...this.conversa] };
  }

  async apagarConversa() {
    this.conversa = [];
    return { turnos: [] };
  }

  // Mesma interface do daemon: sem WS de conversa no mock — o mock é
  // local, não há outro device para espelhar. Thread segue no localStorage.
  // Para ver a trava sem o motor novo: `localStorage['resolux-simular-remoto'] = '1'`
  // faz o mock agir como se um celular estivesse com a conversa.
  assinarConversa(callbacks = {}) {
    let simular = false;
    try {
      simular = globalThis.localStorage?.getItem('resolux-simular-remoto') === '1';
    } catch (_) {
      simular = false;
    }
    if (!simular) return { cancelar() {}, assumir() {} };
    this.controleSimulado = { aqui: 'leitura', remotos: [{ id: 'simulado', nome: 'iPhone (simulado)' }] };
    this.aoControleSimulado = callbacks.onControle;
    callbacks.onControle?.({ ...this.controleSimulado });
    return {
      cancelar: () => {
        this.aoControleSimulado = null;
      },
      assumir: () => {
        this.controleSimulado = { ...this.controleSimulado, aqui: 'escrita' };
        this.aoControleSimulado?.({ ...this.controleSimulado });
      },
    };
  }

  async revogarAparelho(id) {
    if (!this.controleSimulado) return;
    this.controleSimulado = {
      ...this.controleSimulado,
      remotos: this.controleSimulado.remotos.filter((r) => r.id !== id),
    };
    this.aoControleSimulado?.({ ...this.controleSimulado });
  }

  // Sem o motor não existe composição: o mock não inventa uma grade de
  // exemplo (parecia conectado a um Arena que não existe). A tela mostra
  // que o motor está fora.
  assinarMonitor(callbacks = {}) {
    callbacks.onErro?.('motor_indisponivel', 'Motor Resolux fora do ar: sem composição do Arena.');
    return { cancelar() {} };
  }

  // Mock não serve thumbnail: a célula cai pra exibir só o nome.
  urlThumbnail() {
    return null;
  }

  // Espelha a validação do contrato: campo desconhecido é recusado,
  // pra UI exercitar o caminho de erro antes do daemon existir.
  async patchSession(patch) {
    const CAMPOS = new Set(['mode', 'backend', 'model', 'toolAllowlist']);
    for (const campo of Object.keys(patch || {})) {
      if (!CAMPOS.has(campo)) {
        throw new ErroApi('campo_desconhecido', `Campo não aceito na v1: ${campo}`);
      }
    }
    if (patch.mode != null && !['timeline', 'performance'].includes(patch.mode)) {
      throw new ErroApi('valor_invalido', `mode deve ser timeline|performance`);
    }
    if (patch.backend != null && !['ollama', 'applefm', 'spike'].includes(patch.backend)) {
      throw new ErroApi('valor_invalido', `backend deve ser ollama|applefm|spike`);
    }
    this.sessao = { ...this.sessao, ...patch };
    return { ...this.sessao };
  }

  // Mesma assinatura do daemon real: callbacks
  // { onStarted(info), onChunk(parcial, tokens), onFinal(texto), onError(codigo, msg) }.
  enviarChat(texto, callbacks = {}) {
    const timers = [];
    let streamingTimer = null;
    let cancelado = false;

    const rotulos = rotuloPara(texto);
    callbacks.onStarted?.(rotulos);
    this.conversa.push({
      id: this.conversa.length + 1,
      papel: 'usuario',
      texto,
      hora: horaAgora(),
    });

    // Fase 2: composing
    timers.push(
      setTimeout(() => {
        if (!cancelado) callbacks.onComposing?.();
      }, 2200),
    );

    // Fase 3: resposta com streaming de palavras
    timers.push(
      setTimeout(() => {
        if (cancelado) return;
        const resposta = respostaPara(texto);
        const palavras = resposta.split(' ');
        let i = 0;
        streamingTimer = setInterval(() => {
          if (cancelado) return;
          i += 1;
          const parcial = palavras.slice(0, i).join(' ');
          callbacks.onChunk?.(parcial, Math.max(1, Math.round(parcial.length / 4)));
          if (i >= palavras.length) {
            clearInterval(streamingTimer);
            streamingTimer = null;
            callbacks.onFinal?.(resposta);
            this.conversa.push({
              id: this.conversa.length + 1,
              papel: 'agente',
              texto: resposta,
              hora: horaAgora(),
            });
          }
        }, 70);
      }, 3400),
    );

    return {
      cancelar() {
        cancelado = true;
        timers.forEach(clearTimeout);
        if (streamingTimer) {
          clearInterval(streamingTimer);
          streamingTimer = null;
        }
      },
    };
  }
}
