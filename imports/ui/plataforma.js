// ------------------------------------------------------------
// Composição é do desktop e Atalhos é do mobile: duas seções que leem a mesma
// grade e só mudam a apresentação. A plataforma vem do aparelho (script
// detectar-plataforma do index.html); quando chega um link da outra
// plataforma, a pessoa vai para a seção equivalente em vez de ficar numa tela
// fora do menu.
// ------------------------------------------------------------

export function secaoDaPlataforma(secao, mobile) {
  if (mobile && secao === 'monitor') return 'atalhos';
  if (!mobile && secao === 'atalhos') return 'monitor';
  return secao;
}
