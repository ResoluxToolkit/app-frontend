// ------------------------------------------------------------
// Ditado por voz: Web Speech API do navegador (Safari e Chrome).
// Só existe em contexto seguro (localhost ou https); no endereço de
// rede em http o botão some em vez de prometer um microfone mudo.
// ------------------------------------------------------------

export function reconhecedorDisponivel(janela = globalThis.window) {
  if (!janela?.isSecureContext) return null;
  return janela.SpeechRecognition || janela.webkitSpeechRecognition || null;
}

// O ditado continua o que já estava digitado, com um espaço no meio.
export function juntarDitado(base, transcrito) {
  const inicio = (base ?? '').trimEnd();
  const fala = (transcrito ?? '').trim();
  if (!inicio) return fala;
  if (!fala) return inicio;
  return `${inicio} ${fala}`;
}
