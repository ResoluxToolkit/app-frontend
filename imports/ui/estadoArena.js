// ------------------------------------------------------------
// Estado do Resolume Arena lido do monitor do sistema (SSE /monitor),
// para a aba Composição dizer o que está acontecendo em vez de adivinhar.
//
// Fonte preferida: o bloco `arena` proposto ao motor
// (docs/MONITOR-ARENA.md). Enquanto ele não existe, a única pista do
// contrato atual é a lista `ports`: o Webserver do Arena aparece como uma
// porta TCP do processo do Arena. O motor tira o Arena da lista
// `processes`, então "Arena aberto com o Webserver desligado" ainda não dá
// para distinguir de "Arena fechado".
// ------------------------------------------------------------

const EH_ARENA = /arena|resolume/i;

// Porta de fábrica do Webserver do Arena. A porta configurada no motor
// (ARENA_REST_PORT) ainda não está no contrato; o bloco `arena` proposto
// traz `webserver.portaEsperada`.
export const PORTA_PADRAO_ARENA = 8080;

// Quem ocupa a porta do Webserver sem ser o Arena: é o diagnóstico de
// "o Arena não consegue abrir o servidor dele".
function ocupantes(portas, porta) {
  return portas
    .filter((p) => p && p.transport === 'TCP' && p.localPort === porta && !EH_ARENA.test(String(p.processName || '')))
    .map((p) => ({ processo: String(p.processName || '?'), pid: Number.isInteger(p.processID) ? p.processID : null }))
    .filter((o, i, lista) => lista.findIndex((x) => x.processo === o.processo && x.pid === o.pid) === i);
}

// { executando: true | false | null, webserver: { ativo, porta } | null,
//   respondendo: true | false | null, portaEsperada, conflito: [{ processo, pid }],
//   fonte: 'motor' | 'portas' | 'nenhuma' }
// `null` = o contrato não diz.
export function estadoArena(contrato) {
  if (!contrato) {
    return { executando: null, webserver: null, respondendo: null, portaEsperada: PORTA_PADRAO_ARENA, conflito: [], fonte: 'nenhuma' };
  }
  const portas = Array.isArray(contrato.ports) ? contrato.ports : [];

  const bloco = contrato.arena;
  if (bloco && typeof bloco === 'object') {
    const web = bloco.webserver && typeof bloco.webserver === 'object' ? bloco.webserver : null;
    const portaEsperada = Number.isInteger(web?.portaEsperada) ? web.portaEsperada : PORTA_PADRAO_ARENA;
    return {
      executando: typeof bloco.executando === 'boolean' ? bloco.executando : null,
      webserver: web
        ? { ativo: Boolean(web.ativo), porta: Number.isInteger(web.porta) ? web.porta : null }
        : null,
      respondendo: typeof web?.respondendo === 'boolean' ? web.respondendo : null,
      portaEsperada,
      conflito: ocupantes(portas, portaEsperada),
      fonte: 'motor',
    };
  }

  const doArena = portas.filter(
    (p) => p && p.transport === 'TCP' && EH_ARENA.test(String(p.processName || '')) && Number.isInteger(p.localPort),
  );
  if (doArena.length) {
    const porta = Math.min(...doArena.map((p) => p.localPort));
    // Porta do Arena aberta prova que ele está rodando com o Webserver ligado.
    return {
      executando: true,
      webserver: { ativo: true, porta },
      respondendo: null,
      portaEsperada: PORTA_PADRAO_ARENA,
      conflito: ocupantes(portas, PORTA_PADRAO_ARENA),
      fonte: 'portas',
    };
  }
  return {
    executando: null,
    webserver: { ativo: false, porta: null },
    respondendo: null,
    portaEsperada: PORTA_PADRAO_ARENA,
    conflito: ocupantes(portas, PORTA_PADRAO_ARENA),
    fonte: 'portas',
  };
}

// Título e texto para a aba Composição quando não há grade.
export function mensagemArena(estado) {
  if (estado.fonte === 'nenhuma') {
    return {
      titulo: 'Lendo o sistema…',
      texto: 'Aguardando o monitor do motor para saber se o Arena está aberto.',
    };
  }
  // Porta do Webserver ocupada por outro processo: o Arena não consegue
  // abrir o servidor dele, mesmo com o Webserver ligado nas Preferences.
  if (estado.conflito.length && !(estado.webserver?.ativo && estado.webserver.porta === estado.portaEsperada)) {
    const quem = estado.conflito.map((o) => (o.pid ? `${o.processo} (PID ${o.pid})` : o.processo)).join(', ');
    return {
      titulo: `Porta ${estado.portaEsperada} ocupada`,
      texto: `${quem} está usando a porta ${estado.portaEsperada}, a do Webserver do Arena. Enquanto isso, o Arena não consegue abrir o servidor dele: encerre esse processo ou mude a porta do Webserver no Arena e no motor.`,
    };
  }
  if (estado.executando === false) {
    return { titulo: 'Resolume Arena fechado', texto: 'Abra o Arena no Mac para ver a composição.' };
  }
  if (estado.webserver && !estado.webserver.ativo) {
    return estado.executando
      ? {
          titulo: 'Webserver do Arena desligado',
          texto: 'O Arena está aberto, mas o Webserver está desligado. Ative em Arena › Preferences › Webserver.',
        }
      : {
          titulo: 'Arena sem Webserver',
          texto:
            'Nenhuma porta do Arena aberta: ele está fechado ou com o Webserver desligado (Arena › Preferences › Webserver). O motor ainda não informa qual dos dois.',
        };
  }
  const porta = estado.webserver?.porta ? ` na porta ${estado.webserver.porta}` : '';
  if (estado.respondendo === false) {
    return {
      titulo: 'Webserver do Arena sem resposta',
      texto: `O Webserver está ligado${porta}, mas não responde à leitura da composição.`,
    };
  }
  return {
    titulo: 'Arena aberto, sem composição',
    texto: `O Webserver está ligado${porta}, mas o motor ainda não mandou a composição. Confira se a porta configurada no motor é a mesma.`,
  };
}
