// ------------------------------------------------------------
// MockDaemon — mesma interface do ResoluxDaemon, mas responde
// localmente. É o comportamento que já existia no mock, movido
// pra trás do contrato: a UI não sabe (nem precisa saber) qual
// dos dois está respondendo.
// ------------------------------------------------------------

import { ErroApi } from './client.js';

const ROTULOS_ACAO = [
  [/c[aâ]mera/i, 'Verificando a câmera…', 'Ação na Câmera'],
  [/monitor|arena/i, 'Analisando o monitor do Arena…', 'Ação no Monitor'],
  [/atualiza/i, 'Buscando atualizações…', 'Busca de atualizações'],
  [/quick\s*play/i, 'Preparando o Quick Play…', 'Ação no Quick Play'],
  [/starter/i, 'Acionando o Starter…', 'Ação no Starter'],
];

const RESPOSTAS = [
  [
    /c[aâ]mera/i,
    'Câmera verificada: sinal ativo e estável no iPhone 15 Pro, 1080p a 60 fps. ' +
      'Enquadramento bom — posso iniciar a captura quando quiser.',
  ],
  [
    /monitor|arena/i,
    'Monitor do Arena acompanhando: fonte ativa, sem quedas nas últimas 2 horas. ' +
      'Próxima verificação automática em 15 minutos. Quer que eu deixe o resumo fixado aqui?',
  ],
  [
    /atualiza/i,
    'Você está na versão mais recente do Resolux. Há uma atualização menor do Starter ' +
      'disponível — posso agendar para a próxima pausa.',
  ],
  [
    /quick\s*play/i,
    'Quick Play preparado: sessão pronta para iniciar com a câmera e o monitor atuais. ' +
      'É só dizer "começar" quando quiser.',
  ],
];

function respostaPara(texto) {
  for (const [re, resp] of RESPOSTAS) {
    if (re.test(texto)) return resp;
  }
  return (
    'Entendido! Anotei: "' +
    texto +
    '". Posso verificar a câmera, acompanhar o monitor do Arena ou preparar o Quick Play. ' +
    'Por onde seguimos?'
  );
}

function rotuloPara(texto) {
  for (const [re, rotulo, proc] of ROTULOS_ACAO) {
    if (re.test(texto)) return { trabalho: rotulo, processo: `Processando ${proc.toLowerCase()}…` };
  }
  return { trabalho: 'Pensando na sua solicitação…', processo: 'Processando sua solicitação…' };
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

function composicaoExemplo() {
  return {
    layers: NOMES_POR_CAMADA.map((nomes, camada) => ({
      name: { value: 'Layer #' },
      active_clip: null,
      clips: Array.from({ length: 9 }, (_, coluna) => {
        const id = camada * 100 + coluna + 1;
        const nome = nomes[coluna];
        return nome ? slotPreenchido(id, nome) : slotVazio(id);
      }),
    })),
  };
}

export class MockDaemon {
  constructor() {
    this.nome = 'mock';
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
    if (patch.backend != null && !['ollama', 'applefm'].includes(patch.backend)) {
      throw new ErroApi('valor_invalido', `backend deve ser ollama|applefm`);
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
