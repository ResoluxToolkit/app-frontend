// ------------------------------------------------------------
// Cliente do contrato Resolux API v1 (engine/docs/API-CONTRATO.md).
// Fala com o daemon ResoluxServer em 127.0.0.1:1980 — HTTP para
// estado, WebSocket para turnos de chat. O cliente nunca fala
// MCP/Ollama/REST do Arena diretamente.
// ------------------------------------------------------------

// Em produção o bundle estático é servido pelo próprio daemon; em dev,
// o Vite proxy /api/v1 para o daemon. Abrir direto de arquivo volta ao
// endereço local documentado.
const BASE_PADRAO =
  typeof window !== 'undefined' && window.location.protocol.startsWith('http')
    ? ''
    : 'http://127.0.0.1:1980';

// O WS do daemon resolve pelo mesmo origem em dev/prod e cai no endereço
// documentado quando o bundle é aberto direto do arquivo. O contrato é fixo
// em /api/v1/ws; quem muda é só o host da janela.
export function resolverUrlWs(loc) {
  const contexto = loc ?? (typeof window !== 'undefined' ? window.location : undefined);
  if (!contexto || !contexto.protocol?.startsWith('http')) {
    return 'ws://127.0.0.1:1980/api/v1/ws';
  }
  const protocolo = contexto.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocolo}//${contexto.host}/api/v1/ws`;
}

import { cabecalhosAcesso, comToken, esquecerToken, salvarToken } from './acesso.js';

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
  // 401 fora do pareamento = token velho ou ausente: esquece o token e
  // pede o QR de novo, em vez de repetir uma credencial que não vale.
  if (resposta.status === 401) {
    esquecerToken();
    return new ErroApi(
      'unauthorized',
      'Este aparelho não está pareado. Leia o QR do painel no Mac para entrar.',
    );
  }
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
  constructor({ base = BASE_PADRAO, wsUrl = resolverUrlWs() } = {}) {
    this.base = base;
    this.wsUrl = wsUrl;
    this.nome = 'daemon';
  }

  // Toda chamada HTTP ao motor passa aqui para levar o token do aparelho.
  pedir(caminho, opcoes = {}) {
    return fetch(`${this.base}${caminho}`, {
      ...opcoes,
      headers: cabecalhosAcesso(opcoes.headers),
    });
  }

  // URL do WS com o token do aparelho (o navegador não deixa pôr header).
  urlWs() {
    return comToken(this.wsUrl);
  }

  // Pareamento (contrato do motor, resumo em docs/PAREAMENTO.md): o Mac
  // pede o código rotativo que vai no QR; o celular devolve o código e
  // recebe o token do aparelho.
  async obterPareamento() {
    const res = await this.pedir('/api/v1/pareamento');
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  async parear(codigo) {
    const res = await fetch(`${this.base}/api/v1/pareamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    });
    if (res.status === 401) {
      throw new ErroApi('pairing_invalid', 'Código vencido ou inválido. Leia o QR de novo.');
    }
    if (res.status === 429) {
      throw new ErroApi('rate_limited', 'Muitas tentativas. Espere um minuto e leia o QR de novo.');
    }
    if (!res.ok) throw await lerEnvelopeErro(res);
    const corpo = await res.json();
    salvarToken(corpo.token);
    return corpo;
  }

  async sondar() {
    // Sonda curta: decide se o daemon está de pé sem segurar a UI.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_SONDA_MS);
    try {
      const res = await this.pedir('/api/v1/health', {
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
    const res = await this.pedir('/api/v1/session');
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  async patchSession(patch) {
    const res = await this.pedir('/api/v1/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  async getTools() {
    const res = await this.pedir('/api/v1/tools');
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  // Conversa persistida pelo daemon em ~/.resolux — leitura e limpeza
  // pela API v1; o front nunca toca no disco.
  async obterConversa() {
    const res = await this.pedir('/api/v1/conversa');
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  async apagarConversa() {
    const res = await this.pedir('/api/v1/conversa', {
      method: 'DELETE',
    });
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  // Assinatura viva da conversa: WS persistente que nasce com um
  // snapshot do disco e recebe conversa.update a cada turno novo ou
  // limpeza — é o que torna a thread reativa entre desktop e celular.
  assinarConversa(callbacks = {}) {
    let cancelado = false;
    let timer = null;
    let tentativa = 0;
    let socket = null;

    const conectar = () => {
      if (cancelado) return;
      const id = `conv-${Date.now()}-${++tentativa}`;
      socket = new WebSocket(this.urlWs());
      const ws = socket;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'conversa.subscribe', id }));
      };

      ws.onmessage = (evento) => {
        let mensagem;
        try {
          mensagem = JSON.parse(evento.data);
        } catch (_) {
          return;
        }
        if (mensagem.type === 'conversa.update') {
          callbacks.onTurnos?.(mensagem.payload?.turnos || []);
        }
      };

      ws.onclose = () => {
        if (cancelado) return;
        timer = setTimeout(conectar, 2000);
      };
    };

    conectar();

    return {
      cancelar() {
        cancelado = true;
        clearTimeout(timer);
        timer = null;
        socket?.close();
        socket = null;
      },
    };
  }

  // Monitor do Arena — ASSINATURA via WS, não poll da UI. O daemon é quem
  // mantém o poll de 1 s no REST do Arena e empurra só quando muda. O canal
  // do contrato é monitor.subscribe/monitor.update/monitor.error. As thumbs
  // continuam por proxy HTTP nesta tacada.

  assinarMonitor(callbacks = {}) {
    let cancelado = false;
    let timer = null;
    let tentativa = 0;
    let socket = null;

    const conectar = () => {
      if (cancelado) return;
      const id = `mon-${Date.now()}-${++tentativa}`;
      socket = new WebSocket(this.urlWs());
      const ws = socket;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'monitor.subscribe', id }));
        callbacks.onEstado?.('pollando');
      };

      ws.onmessage = (evento) => {
        let mensagem;
        try {
          mensagem = JSON.parse(evento.data);
        } catch (_) {
          return;
        }
        if (mensagem.type === 'monitor.update') {
          callbacks.onDados?.(mensagem.payload?.composition);
          callbacks.onEstado?.('ok');
        } else if (mensagem.type === 'monitor.error' || mensagem.type === 'error') {
          callbacks.onEstado?.('erro');
          callbacks.onErro?.(
            mensagem.payload?.code || 'erro',
            mensagem.payload?.message || 'O daemon não conseguiu ler o Arena.',
          );
        }
      };

      ws.onclose = () => {
        if (cancelado) return;
        callbacks.onEstado?.('pollando');
        timer = setTimeout(conectar, 2000);
      };

      ws.onerror = () => {
        callbacks.onEstado?.('erro');
      };
    };

    conectar();

    return {
      cancelar() {
        cancelado = true;
        clearTimeout(timer);
        timer = null;
        socket?.close();
        socket = null;
      },
    };
  }

  // Proxy read-only do Arena (contrato: GET /api/v1/arena/** repassa o
  // que vem depois de /arena/ para o REST do Arena configurado no
  // daemon). CAMINHO DE TESTE — a assinatura definitiva vem por WS
  // (ver assinarMonitor acima). A UI nunca fala com o Arena diretamente.
  async getComposition() {
    const res = await this.pedir('/api/v1/arena/api/v1/composition');
    if (!res.ok) throw await lerEnvelopeErro(res);
    return res.json();
  }

  // Thumbnail do clip servida pelo proxy com o content type repassado;
  // o <img> da grade aponta direto pra cá. O `stamp` no path invalida
  // o cache (mesmo truque do exemplo oficial da Arena, usado na
  // engine Swift em ArenaREST.thumbnailData). CAMINHO DE TESTE: no
  // canal WS definitivo as thumbs vêm junto com a composição.
  urlThumbnail(clipID, stamp) {
    return comToken(
      `${this.base}/api/v1/arena/api/v1/composition/clips/by-id/` +
      `${clipID}/thumbnail/${stamp}`,
    );
  }

  // Um WS por turno: a v1 garante um turno por conexão, e abrir por
  // turno dispensa gerenciar reconexão nesta tacada. Retorna
  // { cancelar() } — veja a nota honesta em cancelar().
  enviarChat(texto, callbacks = {}) {
    const id = `msg-${Date.now()}-${proximoIdWs++}`;
    let encerrado = false;
    const ws = new WebSocket(this.urlWs());

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
