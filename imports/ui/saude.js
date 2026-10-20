// ------------------------------------------------------------
// Veredito da aba Status: uma resposta para "está tudo bem?" calculada por
// regras simples e explicáveis sobre o contrato do motor e o histórico
// recente. Sem IA no caminho: regra é rápida, previsível e funciona offline.
// Fala a língua do operador (máquina, vídeo, controle), não a do protocolo.
// ------------------------------------------------------------

export const LIMITES = {
  cargaAtencao: 85, // % de CPU/GPU sustentado
  cargaProblema: 95,
  memoriaAtencao: 85, // % de memória em uso
  memoriaProblema: 95,
  compressaoAtencao: 25, // % da memória comprimida (pressão real no macOS)
  janela: 20, // amostras recentes que contam como "sustentado" (~30 s)
  minimoAmostras: 5, // antes disso não há histórico para julgar carga
};

const GRAVIDADE = { ok: 0, atencao: 1, problema: 2 };

const TITULOS = {
  ok: 'Tudo certo',
  atencao: 'Atenção',
  problema: 'Problema',
  desconhecido: 'Sem dados',
};

function mediaRecente(historico, janela) {
  const ultimas = (historico ?? []).slice(-janela).map((amostra) => amostra.valor);
  if (ultimas.length < LIMITES.minimoAmostras) return null;
  return ultimas.reduce((soma, valor) => soma + valor, 0) / ultimas.length;
}

function arredondar(valor) {
  return Math.round(valor);
}

// CPU e GPU contam pela média das amostras recentes: um pico de um segundo
// não derruba o veredito, uma carga que não sai do teto sim.
function regraCarga({ nome, historico, atencao, problema }) {
  const media = mediaRecente(historico, LIMITES.janela);
  if (media == null) return null;
  if (media >= LIMITES.cargaProblema) return { nivel: 'problema', texto: problema(arredondar(media)) };
  if (media >= LIMITES.cargaAtencao) return { nivel: 'atencao', texto: atencao(arredondar(media)) };
  return null;
}

function regraMemoria(memoria) {
  const total = Number(memoria?.totalBytes);
  const usada = Number(memoria?.usedBytes);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(usada)) return [];
  const emUso = (usada / total) * 100;
  const comprimida = Number.isFinite(Number(memoria.compressorBytes))
    ? (Number(memoria.compressorBytes) / total) * 100
    : 0;
  // No macOS a memória "livre" fica baixa por projeto (vira cache), então o
  // que pesa é a parte em uso e a compressão, que mostra pressão de verdade.
  if (emUso >= LIMITES.memoriaProblema) {
    return [{ nivel: 'problema', texto: `Memória quase esgotada: ${arredondar(emUso)}% em uso.` }];
  }
  const motivos = [];
  if (emUso >= LIMITES.memoriaAtencao) {
    motivos.push({ nivel: 'atencao', texto: `Memória em ${arredondar(emUso)}% de uso.` });
  }
  if (comprimida >= LIMITES.compressaoAtencao) {
    motivos.push({
      nivel: 'atencao',
      texto: `Memória sob pressão: ${arredondar(comprimida)}% comprimida.`,
    });
  }
  return motivos;
}

function regrasDeDispositivos(contrato) {
  const motivos = [];
  if (contrato.ndi && contrato.ndi.isAvailable === false) {
    motivos.push({ nivel: 'atencao', texto: 'Vídeo pela rede (NDI) indisponível.' });
  }
  if (contrato.artNet && contrato.artNet.error) {
    motivos.push({ nivel: 'atencao', texto: 'Controle de luz (Art-Net) com erro.' });
  }
  if (contrato.midi && contrato.midi.isAvailable === false) {
    motivos.push({ nivel: 'atencao', texto: 'MIDI indisponível.' });
  }
  return motivos;
}

export function avaliarSaude({ contrato, historicoCpu, historicoGpu } = {}) {
  if (!contrato) {
    return {
      nivel: 'desconhecido',
      titulo: TITULOS.desconhecido,
      frase: 'Aguardando o primeiro sample do motor.',
      motivos: [],
    };
  }

  const motivos = [
    regraCarga({
      historico: historicoGpu,
      atencao: (n) => `GPU em ${n}%: risco de travar o vídeo.`,
      problema: (n) => `GPU em ${n}%: o vídeo pode travar a qualquer momento.`,
    }),
    regraCarga({
      historico: historicoCpu,
      atencao: (n) => `CPU em ${n}%: a máquina está no limite.`,
      problema: (n) => `CPU em ${n}%: a máquina não está dando conta.`,
    }),
    ...regraMemoria(contrato.memory),
    ...regrasDeDispositivos(contrato),
  ].filter(Boolean);

  // Os mais graves primeiro; entre iguais, a ordem das regras (máquina antes de dispositivos).
  motivos.sort((a, b) => GRAVIDADE[b.nivel] - GRAVIDADE[a.nivel]);

  const nivel = motivos.reduce(
    (pior, motivo) => (GRAVIDADE[motivo.nivel] > GRAVIDADE[pior] ? motivo.nivel : pior),
    'ok',
  );

  return {
    nivel,
    titulo: TITULOS[nivel],
    frase: motivos.length
      ? motivos.slice(0, 2).map((motivo) => motivo.texto).join(' ')
      : 'Máquina, vídeo e controle sem alertas.',
    motivos,
  };
}
