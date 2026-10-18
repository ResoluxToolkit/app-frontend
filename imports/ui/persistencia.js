// ------------------------------------------------------------
// Persistência local da conversa (localStorage): a thread sobrevive
// ao refresh. Degradável — sem armazenamento
// (Safari privado, Node nos testes) tudo vive só em memória.
// ------------------------------------------------------------

import { sanitizarAtalho } from './atalhos.js';

const CHAVE_ATALHOS = 'resolux-atalhos-v1';
const CHAVE_MENSAGENS = 'resolux-conversa-v1';
const CHAVE_INSTALAR_VISTO = 'resolux-instalar-visto-v1';

const PAPEIS_VALIDOS = new Set(['usuario', 'agente']);

function lerJson(chave, padrao) {
  try {
    const bruto = globalThis.localStorage?.getItem(chave);
    return bruto == null ? padrao : JSON.parse(bruto);
  } catch {
    return padrao;
  }
}

function gravarJson(chave, valor) {
  try {
    globalThis.localStorage?.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem espaço/armazenamento: a conversa segue só em memória.
  }
}

// Só o que a render sabe exibir; estados transitórios (streaming,
// estadoOrb) não vão pro disco — no retorno tudo nasce breathing.
function sanitizarMensagem(bruta) {
  if (!bruta || !PAPEIS_VALIDOS.has(bruta.papel)) return null;
  if (typeof bruta.texto !== 'string' || !bruta.texto.trim()) return null;
  const limpa = {
    papel: bruta.papel,
    texto: bruta.texto,
    hora: typeof bruta.hora === 'string' ? bruta.hora : '',
  };
  if (Number.isInteger(bruta.id) && bruta.id > 0) limpa.id = bruta.id;
  if (Number.isInteger(bruta.tokens)) limpa.tokens = bruta.tokens;
  return limpa;
}

export function carregarConversa() {
  const brutas = lerJson(CHAVE_MENSAGENS, null);
  if (!Array.isArray(brutas)) return null;
  const limpas = brutas.map(sanitizarMensagem).filter(Boolean);
  return limpas.length > 0 ? limpas : null;
}

export function salvarConversa(mensagens) {
  gravarJson(CHAVE_MENSAGENS, (mensagens ?? []).map(sanitizarMensagem).filter(Boolean));
}

export function carregarAtalhos() {
  const brutos = lerJson(CHAVE_ATALHOS, []);
  return Array.isArray(brutos) ? brutos.map(sanitizarAtalho).filter(Boolean) : [];
}

export function salvarAtalhos(atalhos) {
  gravarJson(CHAVE_ATALHOS, (atalhos ?? []).map(sanitizarAtalho).filter(Boolean));
}

export function instalacaoVista() {
  return lerJson(CHAVE_INSTALAR_VISTO, false) === true;
}

export function marcarInstalacaoVista() {
  gravarJson(CHAVE_INSTALAR_VISTO, true);
}
