// ------------------------------------------------------------
// Atalhos do deck: o operador cria uma tecla só com um nome e a cor, e a
// tecla acha a coluna do Resolume que tem esse nome. Sem MIDI, DMX, OSC ou
// REST na mão do usuário: o vínculo é o nome. Nome repetido (ambíguo) ou
// inexistente aparece na própria tecla, em vez de adivinhar.
// ------------------------------------------------------------

export const CORES_ATALHO = ['azul', 'roxo', 'verde', 'laranja', 'vermelho', 'aqua', 'amarelo'];

// Tamanho da tecla no bento: p = 1x1, m = 2x1 (largo), g = 2x2 (grande).
export const TAMANHOS_ATALHO = ['p', 'm', 'g'];

const LIMITE_ROTULO = 24;

// "Introdução", " introducao " e "INTRODUÇÃO" são o mesmo nome.
export function normalizarNome(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function novoIdAtalho() {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Só o que a tela sabe exibir; sem nome não existe atalho.
export function sanitizarAtalho(bruto) {
  if (!bruto || typeof bruto !== 'object') return null;
  const rotulo = typeof bruto.rotulo === 'string'
    ? bruto.rotulo.replace(/\s+/g, ' ').trim().slice(0, LIMITE_ROTULO)
    : '';
  if (!rotulo) return null;
  return {
    id: typeof bruto.id === 'string' && bruto.id ? bruto.id : novoIdAtalho(),
    rotulo,
    cor: CORES_ATALHO.includes(bruto.cor) ? bruto.cor : CORES_ATALHO[0],
    tamanho: TAMANHOS_ATALHO.includes(bruto.tamanho) ? bruto.tamanho : 'p',
  };
}

// Ciclo do botão de tamanho do modo de edição: p -> m -> g -> p.
export function proximoTamanho(tamanho) {
  const indice = TAMANHOS_ATALHO.indexOf(tamanho);
  return TAMANHOS_ATALHO[(indice + 1) % TAMANHOS_ATALHO.length];
}

// O layout do deck é a ordem da lista (o grid monta de cima para baixo).
// Reordena pela sequência de ids vista na tela: id desconhecido ou repetido
// é ignorado e quem ficou de fora vai ao fim, sem perder nenhum atalho.
export function aplicarOrdem(lista, ids) {
  const restantes = new Map(lista.map((atalho) => [atalho.id, atalho]));
  const ordenados = [];
  for (const id of ids) {
    const atalho = restantes.get(id);
    if (atalho) {
      ordenados.push(atalho);
      restantes.delete(id);
    }
  }
  return [...ordenados, ...restantes.values()];
}

// Procura a coluna pelo nome. `colunas` vem de montarGrade().colunas.
//  - ok:         uma única coluna com esse nome (traz o estado ao vivo)
//  - ambiguo:    mais de uma; devolve os números para o aviso
//  - sem-coluna: nenhuma coluna com esse nome
export function resolverAtalho(atalho, colunas) {
  const alvo = normalizarNome(atalho.rotulo);
  const achadas = (colunas ?? []).filter((coluna) => normalizarNome(coluna.rotulo) === alvo);
  if (achadas.length === 0) return { estado: 'sem-coluna', numeros: [], tocando: 0, preenchidos: 0 };
  const numeros = achadas.map((coluna) => coluna.numero);
  if (achadas.length > 1) return { estado: 'ambiguo', numeros, tocando: 0, preenchidos: 0 };
  const [coluna] = achadas;
  return { estado: 'ok', numeros, tocando: coluna.tocando, preenchidos: coluna.preenchidos };
}
