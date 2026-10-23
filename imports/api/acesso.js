// ------------------------------------------------------------
// Acesso do aparelho: o token que o motor devolve quando o celular
// apresenta o código do QR. Fica no localStorage deste aparelho e vai
// em toda chamada ao motor — header nas requisições HTTP, query nas
// URLs que o navegador abre sozinho (WebSocket, EventSource, <img>),
// porque essas não aceitam header.
// No Mac (loopback) o motor não exige token; sem token salvo nada muda.
// ------------------------------------------------------------

const CHAVE_TOKEN = 'resolux-token-aparelho';

function armazenamento() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null; // aba privada ou storage bloqueado
  }
}

export function lerToken() {
  return armazenamento()?.getItem(CHAVE_TOKEN) || '';
}

export function salvarToken(token) {
  if (token) armazenamento()?.setItem(CHAVE_TOKEN, token);
}

const aoEsquecer = new Set();

// Avisa a UI quando o motor recusou o token (401) e ele foi apagado.
export function aoEsquecerToken(callback) {
  aoEsquecer.add(callback);
  return () => aoEsquecer.delete(callback);
}

export function esquecerToken() {
  armazenamento()?.removeItem(CHAVE_TOKEN);
  for (const callback of [...aoEsquecer]) callback();
}

export function cabecalhosAcesso(extra = {}) {
  const token = lerToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

// Acrescenta `token=` à URL (absoluta ou relativa) quando há token salvo.
export function comToken(url, token = lerToken()) {
  if (!token || !url) return url;
  const separador = url.includes('?') ? '&' : '?';
  return `${url}${separador}token=${encodeURIComponent(token)}`;
}

// WebSocket e EventSource não mostram o status do handshake: um 401
// (token velho, motor reiniciado) parece só uma queda e o aparelho
// ficaria reconectando para sempre com a tela antiga. Quando um desses
// canais cai, uma chamada HTTP curta confere o token; se o motor
// responder 401, o token é esquecido e a UI volta para a trava.
let ultimaConferencia = 0;
const INTERVALO_CONFERENCIA_MS = 5000;

export async function conferirToken(base = '', agora = Date.now()) {
  if (!lerToken() || agora - ultimaConferencia < INTERVALO_CONFERENCIA_MS) return;
  ultimaConferencia = agora;
  try {
    const resposta = await fetch(`${base}/api/v1/session`, { headers: cabecalhosAcesso() });
    if (resposta.status === 401) esquecerToken();
  } catch (_) {
    // Motor fora: nada a concluir; o canal segue tentando.
  }
}
