// ------------------------------------------------------------
// Cliente do contrato Resolux API v1 (engine/docs/API-CONTRATO.md).
// Fala com o daemon ResoluxServer em 127.0.0.1:1980 — HTTP para
// estado, WebSocket para turnos de chat. O cliente nunca fala
// MCP/Ollama/REST do Arena diretamente.
// ------------------------------------------------------------

const BASE_PADRAO = 'http://127.0.0.1:1980';
const WS_PADRAO = 'ws://127.0.0.1:1980/api/v1/ws';

// Turnos locais levam minutos (medido no engine: 34 s a 3 min+).
const TIMEOUT_SONDA_MS = 2000;
const TIMEOUT_TURNO_MS = 5 * 60 * 1000;

export class ErroApi extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.name = 'ErroApi';
    this.codigo = codigo;
  }
}

let proximoIdWs = 1;

async function lerEnvelopeErro(resposta) {
  let codigo = `http_${resposta.status}`;
  let mensagem = resposta.statusText || 'Erro HTTP';
  try {
    const corpo = await resposta.json();
    if (corpo && corpo.error) {
      codigo = corpo.error.code || codigo;
      mensagem = corpo.error.message || mensagem;
    }
  } catch (_) {
    // Corpo não-JSON: fica o envelope HTTP.
  }
  return new ErroApi(codigo, mensagem);
}

export class ResoluxDaemon {
  constructor({ base = BASE_PADRAO, wsUrl = WS_PADRAO } = {}) {
    this.base = base;
    this.wsUrl = wsUrl;
    this.nome = 'daemon';
  }

  async sondar() {
    // Sonda curta: decide se o daemon está de pé sem segurar a UI.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_SONDA_MS);
    try {
      const res = await fetch(`${this.base}/api/v1/health`, {
        signal: ctrl.signal,
      });
      if (!res.ok) throw await lerEnvelopeErro(res);
      const corpo = await res.json();
      return corpo && corpo.status === 'online';
    } catch (_) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async getSession() {
    const res = await fetch(`${this.base}/api/v1/session`);
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  async patchSession(patch) {
    const res = await fetch(`${this.base}/api/v1/session`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  async getTools() {
    const res = await fetch(`${this.base}/api/v1/tools`);
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  // ------------------------------------------------------------
  // Monitor do Arena — ASSINATURA, não poll da UI.
  //
  // IMPORTANTE (regra do projeto): a UI nunca fala com o Arena
  // diretamente; o motor é a fonte de verdade e o canal definitivo
  // desta assinatura é o WebSocket do daemon (o daemon já é dono do
  // poll de 1 s no Arena no app nativo). Enquanto o canal WS não é
  // definido pela engine, este método emula a assinatura em cima do
  // proxy HTTP read-only — CAMINHO DE TESTE, a trocar pelo WS sem
  // tocar na UI.
  //
  // Definição futura (proposta pro contrato, a engine fecha a versão):
  //   cliente → {"type":"monitor.subscribe","id":"mon-1"}
  //   engine  → {"type":"monitor.update","id":"mon-1","payload":{"composition":{...}}}
  //   engine  → {"type":"monitor.error","id":"mon-1","payload":{"code","message"}}
  //   thumbnails viajando junto (base64) ou por URL de sessão no canal.
  // ------------------------------------------------------------

  assinarMonitor(callbacks = {}) {
    const poll = async () => {
      try {
        callbacks.onDados?.(await this.getComposition());
      } catch (e) {
        callbacks.onErro?.(e.codigo || 'erro', e.message);
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return {
      cancelar() {
        clearInterval(timer);
      },
    };
  }

  // Proxy read-only do Arena (contrato: GET /api/v1/arena/** repassa o
  // que vem depois de /arena/ para o REST do Arena configurado no
  // daemon). CAMINHO DE TESTE — a assinatura definitiva vem por WS
  // (ver assinarMonitor acima). A UI nunca fala com o Arena diretamente.
  async getComposition() {
    const res = await fetch(`${this.base}/api/v1/arena/api/v1/composition`);
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  // Thumbnail do clip servida pelo proxy com o content type repassado;
  // o <img> da grade aponta direto pra cá. O `stamp` no path invalida
  // o cache (mesmo truque do exemplo oficial da Arena, usado na
  // engine Swift em ArenaREST.thumbnailData). CAMINHO DE TESTE: no
  // canal WS definitivo as thumbs vêm junto com a composição.
  urlThumbnail(clipID, stamp) {
    return (
      `${this.base}/api/v1/arena/api/v1/composition/clips/by-id/` +
      `${clipID}/thumbnail/${stamp}`
    );
  }

  // Um WS por turno: a v1 garante um turno por conexão, e abrir por
  // turno dispensa gerenciar reconexão nesta tacada. Retorna
  // { cancelar() } — veja a nota honesta em cancelar().
  enviarChat(texto, callbacks = {}) {
    const id = `msg-${Date.now()}-${proximoIdWs++}`;
    let encerrado = false;
    const ws = new WebSocket(this.wsUrl);

    const timer = setTimeout(() => {
      finalizar();
      callbacks.onError?.(
        'timeout',
        'O motor não respondeu em 5 minutos. Turnos locais são longos, mas isso passou do teto.',
      );
    }, TIMEOUT_TURNO_MS);

    function finalizar() {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch (_) {
        // socket já morto
      }
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'chat.send', id, payload: { text: texto } }));
    };

    ws.onmessage = (evento) => {
      let msg;
      try {
        msg = JSON.parse(evento.data);
      } catch (_) {
        return; // invalid_message: ignora ruído fora do contrato
      }
      switch (msg.type) {
        case 'hello':
          break; // sessão chega por getSession() quando a UI quiser
        case 'chat.started':
          if (msg.id === id) callbacks.onStarted?.();
          break;
        case 'chat.result':
          if (msg.id === id) {
            finalizar();
            const conteudo = msg.payload?.message?.content ?? '';
            callbacks.onFinal?.(conteudo);
          }
          break;
        case 'chat.error':
        case 'error':
          if (!msg.id || msg.id === id) {
            finalizar();
            callbacks.onError?.(
              msg.payload?.code || 'erro_desconhecido',
              msg.payload?.message || 'Erro sem mensagem do motor.',
            );
          }
          break;
        default:
          break; // pong e futuros tipos: fora desta tacada
      }
    };

    ws.onerror = () => {
      finalizar();
      callbacks.onError?.(
        'backend_unavailable',
        'A conexão com o motor caiu no meio do turno.',
      );
    };

    ws.onclose = () => {
      if (!encerrado) {
        finalizar();
        callbacks.onError?.(
          'backend_unavailable',
          'O motor fechou a conexão antes de responder.',
        );
      }
    };

    return {
      // v1 não tem cancelamento de turno: fechar o socket é o máximo
      // que o cliente pode fazer. O motor pode concluir o turno sem
      // ninguém ouvindo — o WriteJournal registra do lado dele.
      cancelar() {
        finalizar();
      },
    };
  }
}
