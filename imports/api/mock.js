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

// ------------------------------------------------------------
// Composição de exemplo (shape do GET /composition do Arena):
// parâmetros embrulhados em {value: ...}, campos diretos crus.
// Slots vazios têm nome vazio e nenhum trilho — o parser marca
// `preenchido: false` e a célula exibe "—".
// ------------------------------------------------------------

const NOMES_POR_CAMADA = [
  ['FogAndDust', 'NeonRoom2', 'IntoTheGlow', 'NoHopeJustF…', 'IntoTheGlow'],
  ['Trinity', 'Enter5', 'Cyberspace', 'Ethnik2', 'Galactucity'],
  ['SpaceUniverse', 'Ethnik2', 'Tank', 'OrganicMotions', 'Metalive'],
];

const TEMPOS_TIME_GRID = [240, 180, 120, 60];

function slotPreenchido(id, nome) {
  return {
    id,
    name: { value: nome },
    video: {
      fileinfo: { path: { value: `/clips/${nome}.mov` } },
    },
    transport: { controls: { duration: { value: 4.2 } } },
  };
}

function slotVazio(id) {
  return { id, name: { value: '' } };
}

function slotTimeGrid(id, segundos) {
  return {
    id,
    name: { value: `Bloco ${formatarTempoExemplo(segundos)}` },
    video: {
      fileinfo: { path: { value: `/clips/time-grid-${segundos}.mov` } },
    },
    transport: {
      controls: {
        duration: { value: segundos },
        speed: { value: 1 },
      },
    },
  };
}

function formatarTempoExemplo(segundos) {
  const minutos = Math.floor(segundos / 60);
  return minutos > 0 ? `${minutos}m` : `${Math.round(segundos)}s`;
}

function composicaoExemplo() {
  const camadas = NOMES_POR_CAMADA.map((nomes, camada) => ({
      name: { value: 'Layer #' },
      active_clip: null,
      clips: Array.from({ length: 9 }, (_, coluna) => {
        const id = camada * 100 + coluna + 1;
        const nome = nomes[coluna];
        return nome ? slotPreenchido(id, nome) : slotVazio(id);
      }),
    }));
  camadas.push(camadaTimeGridExemplo());
  const composicao = { layers: camadas };
  // Demo acelerada: 30s de show por tick, pra transitar entre clipes
  // e mostrar a barra movendo sem esperar minutos no mock.
  relogioTimeGrid += 30;
  return composicao;
}

// A TimeGrid do mock toca de verdade: um clipe ativo por vez, posição
// avançando dentro do range do transporte (mesmo shape do Arena:
// ParamRange com in/out em ms). O parser lê isso sem saber que é demo.
let relogioTimeGrid = 0;

function camadaTimeGridExemplo() {
  const total = TEMPOS_TIME_GRID.reduce((soma, segundos) => soma + segundos, 0);
  let restante = relogioTimeGrid % total;
  let ativoCol = -1;
  let decorrido = 0;
  for (const [coluna, segundos] of TEMPOS_TIME_GRID.entries()) {
    if (restante < segundos) {
      ativoCol = coluna;
      decorrido = restante;
      break;
    }
    restante -= segundos;
  }
  return {
    name: { value: 'TimeGrid' },
    active_clip: ativoCol >= 0 ? { id: 4000 + ativoCol + 1 } : null,
    clips: TEMPOS_TIME_GRID.map((segundos, coluna) => {
      const clip = slotTimeGrid(4000 + coluna + 1, segundos);
      if (coluna === ativoCol) {
        clip.transport.position = { value: decorrido * 1000, in: 0, out: segundos * 1000 };
      }
      return clip;
    }),
  };
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
  assinarConversa(callbacks = {}) {
    return { cancelar() {} };
  }

  // Mesma interface do daemon real: a UI assina o monitor e recebe os
  // dados empurrados; o mock empurra a composição de exemplo num
  // intervalo local. Sem clips tocando e sem thumbnails — o mock não
  // tem Arena de verdade e não finge ter.
  assinarMonitor(callbacks = {}) {
    const poll = () => callbacks.onDados?.(composicaoExemplo());
    poll();
    const timer = setInterval(poll, 3000);
    return {
      cancelar() {
        clearInterval(timer);
      },
    };
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
