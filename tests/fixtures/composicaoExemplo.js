// Fixture de teste: a composição de exemplo que o mock mostrava antes.
// Fica só nos testes do parser da grade; a UI não mostra mais grade falsa.

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

const TEMPOS_TIME_GRID = [240, 180, 120, 60];

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

function slotTimeGrid(id, segundos) {
  return {
    id,
    name: { value: `Bloco ${formatarTempoExemplo(segundos)}` },
    video: {
      fileinfo: { path: { value: `/clips/time-grid-${segundos}.mov` } },
    },
    transport: {
      controls: {
        duration: { value: segundos },
        speed: { value: 1 },
      },
    },
  };
}

function formatarTempoExemplo(segundos) {
  const minutos = Math.floor(segundos / 60);
  return minutos > 0 ? `${minutos}m` : `${Math.round(segundos)}s`;
}

function composicaoExemplo() {
  const camadas = NOMES_POR_CAMADA.map((nomes, camada) => ({
      name: { value: 'Layer #' },
      active_clip: null,
      clips: Array.from({ length: 9 }, (_, coluna) => {
        const id = camada * 100 + coluna + 1;
        const nome = nomes[coluna];
        return nome ? slotPreenchido(id, nome) : slotVazio(id);
      }),
    }));
  camadas.push(camadaTimeGridExemplo());
  const composicao = { layers: camadas };
  // Demo acelerada: 30s de show por tick, pra transitar entre clipes
  // e mostrar a barra movendo sem esperar minutos no mock.
  relogioTimeGrid += 30;
  return composicao;
}

// A TimeGrid do mock toca de verdade: um clipe ativo por vez, posição
// avançando dentro do range do transporte (mesmo shape do Arena:
// ParamRange com in/out em ms). O parser lê isso sem saber que é demo.
let relogioTimeGrid = 0;

function camadaTimeGridExemplo() {
  const total = TEMPOS_TIME_GRID.reduce((soma, segundos) => soma + segundos, 0);
  let restante = relogioTimeGrid % total;
  let ativoCol = -1;
  let decorrido = 0;
  for (const [coluna, segundos] of TEMPOS_TIME_GRID.entries()) {
    if (restante < segundos) {
      ativoCol = coluna;
      decorrido = restante;
      break;
    }
    restante -= segundos;
  }
  return {
    name: { value: 'TimeGrid' },
    active_clip: ativoCol >= 0 ? { id: 4000 + ativoCol + 1 } : null,
    clips: TEMPOS_TIME_GRID.map((segundos, coluna) => {
      const clip = slotTimeGrid(4000 + coluna + 1, segundos);
      if (coluna === ativoCol) {
        clip.transport.position = { value: decorrido * 1000, in: 0, out: segundos * 1000 };
      }
      return clip;
    }),
  };
}

export { composicaoExemplo };
