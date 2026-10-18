// ------------------------------------------------------------
// Kit de widgets da aba Status. Cada widget é uma função pura que recebe
// dados já prontos e devolve HTML (sem framework, sem DOM), então dá para
// testar em Node. A cor de cada tile vem de `--acento`, definido por quem usa.
// ------------------------------------------------------------

function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ALTURA_SPARK = 40;

const ICONES = {
  cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect><rect x="9.5" y="9.5" width="5" height="5" rx="1"></rect><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"></path></svg>',
  ram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="9" rx="1.5"></rect><path d="M7 7v9M11 7v9M15 7v9M6 19v-3M10 19v-3M14 19v-3M18 19v-3"></path></svg>',
  gpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2"></rect><path d="M8 21h8M12 17v4"></path><path d="M7 13l3-3 2 2 4-4"></path></svg>',
  rede: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"></path><circle cx="12" cy="19" r="1" fill="currentColor"></circle></svg>',
};

export function iconeWidget(nome) {
  return ICONES[nome] ?? '';
}

function pontoSpark(valores, indice) {
  const x = valores.length === 1 ? 100 : (indice / (valores.length - 1)) * 100;
  const limitado = Math.min(100, Math.max(0, valores[indice]));
  const y = ALTURA_SPARK - (limitado / 100) * ALTURA_SPARK;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

// Linha de tendência de uma série em % (0 a 100). Com menos de duas amostras
// não há tendência para desenhar: devolve o espaço vazio, sem inventar linha.
export function sparkline(valores) {
  const serie = (valores ?? []).filter((valor) => Number.isFinite(valor));
  if (serie.length < 2) return '<svg class="spark" viewBox="0 0 100 40" aria-hidden="true"></svg>';
  const pontos = serie.map((_, indice) => pontoSpark(serie, indice));
  const linha = pontos.join(' ');
  return `<svg class="spark" viewBox="0 0 100 ${ALTURA_SPARK}" preserveAspectRatio="none" aria-hidden="true"><polygon class="spark-area" points="0,${ALTURA_SPARK} ${linha} 100,${ALTURA_SPARK}"></polygon><polyline class="spark-linha" points="${linha}"></polyline></svg>`;
}

// Tile de métrica: ícone, rótulo, número grande, tendência e barra de uso.
// `percentual` (0-100) liga a barra; sem ele, o tile mostra só o número.
export function tileMetrica({ rotulo, valor, detalhe, icone, acento, serie, percentual }) {
  const barra = Number.isFinite(percentual)
    ? `<div class="tile-barra" aria-hidden="true"><span style="width: ${Math.min(100, Math.max(0, percentual)).toFixed(1)}%"></span></div>`
    : '';
  return `<article class="tile-metrica vidro" style="--acento: ${esc(acento)}" aria-label="${esc(rotulo)} ${esc(valor)}">
      <header class="tile-topo">
        <span class="tile-icone">${iconeWidget(icone)}</span>
        <div class="tile-titulo"><h3>${esc(rotulo)}</h3><p>${esc(detalhe)}</p></div>
      </header>
      <div class="tile-corpo">
        <span class="tile-valor">${esc(valor)}</span>
        ${serie ? sparkline(serie) : ''}
      </div>
      ${barra}
    </article>`;
}

const GLIFO_VEREDITO = {
  ok: '<path d="M7.5 12.5l3 3 6-7"></path>',
  atencao: '<path d="M12 7.5v5.5"></path><circle cx="12" cy="16.5" r="0.6" fill="currentColor"></circle>',
  problema: '<path d="M8.5 8.5l7 7M15.5 8.5l-7 7"></path>',
  desconhecido: '<path d="M9 12h6"></path>',
};

// Quantos motivos já cabem na frase do veredito (ver `avaliarSaude`).
const MOTIVOS_NA_FRASE = 2;

// Cartão de veredito: anel colorido pelo nível, título e uma frase. A lista só
// traz o que não coube na frase, para não repetir a mesma coisa duas vezes.
export function veredito(saude) {
  const nivel = GLIFO_VEREDITO[saude.nivel] ? saude.nivel : 'desconhecido';
  const restantes = (saude.motivos ?? []).slice(MOTIVOS_NA_FRASE);
  const motivos = restantes.length
    ? `<ul class="veredito-motivos">${restantes.map((motivo) => `<li class="motivo-${esc(motivo.nivel)}">${esc(motivo.texto)}</li>`).join('')}</ul>`
    : '';
  return `<section class="veredito vidro nivel-${nivel}" role="status" aria-live="polite">
      <div class="veredito-anel" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle class="anel-trilho" cx="12" cy="12" r="10.2"></circle>${GLIFO_VEREDITO[nivel]}</svg></div>
      <div class="veredito-texto">
        <h2>${esc(saude.titulo)}</h2>
        <p>${esc(saude.frase)}</p>
        ${motivos}
      </div>
    </section>`;
}

// Bloco recolhível para o que é técnico demais para ficar na frente.
export function grupoRecolhivel(titulo, corpo, { aberto = false } = {}) {
  return `<details class="status-detalhes"${aberto ? ' open' : ''}><summary>${esc(titulo)}</summary><div class="status-detalhes-corpo">${corpo}</div></details>`;
}
