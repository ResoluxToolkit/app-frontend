// ------------------------------------------------------------
// Grade de clips — parser do GET /composition do Arena REST
// (leitura pura). Espelha o que a engine Swift já mede e usa:
// - TimelineCalculator.slots (Features/Resolume/Sources/Resolume/
//   TimelineCalculator.swift): endereço `camada.coluna` 1-based e
//   "preenchido" = mídia em disco OU (transporte + nome);
// - ArenaMonitorView.thumbnailSources: thumbnail só vale com
//   `is_default == false` e `last_update` válido (!= "0") — o fetch
//   usa `/composition/clips/by-id/{id}/thumbnail/{last_update}`.
// Aqui não entra duração/BPM: a grade do Monitor só mostra o que
// está na tela (nome, slot, ativo, thumb).
// ------------------------------------------------------------

// Parâmetros do Arena vêm embrulhados em {"value": ...}; campos
// diretos (id, active_clip.id, thumbnail.id/last_update) vêm crus.
// Aceita os dois formatos, como o `parameterValue` do MCPValue.
export function valorDe(campo) {
  if (campo && typeof campo === 'object' && 'value' in campo) {
    return campo.value;
  }
  return campo;
}

export function textoDe(campo) {
  const v = valorDe(campo);
  return typeof v === 'string' ? v : '';
}

function numeroDe(campo) {
  const v = valorDe(campo);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function temTransporte(clip) {
  return clip.transport != null && typeof clip.transport === 'object';
}

function temMidiaEmDisco(clip) {
  const caminho = (bloco) => {
    const info = clip[bloco] && clip[bloco].fileinfo;
    const p = info && valorDe(info.path);
    return typeof p === 'string' ? p : '';
  };
  return caminho('video') !== '' || caminho('audio') !== '';
}

// Mesma regra do `conteudo` do TimelineCalculator: caminho em disco
// manda; sem ele, generator preenche (transporte + nome) e slot com
// nome vazio e sem trilho é vazio.
function estaPreenchido(clip) {
  if (temMidiaEmDisco(clip)) return true;
  return temTransporte(clip) && textoDe(clip.name) !== '';
}

// Fonte da thumbnail, quando o Arena anunciou uma de verdade.
// `is_default` ou stamp "0" = sem thumbnail gerada (medido na engine).
export function fonteThumb(clip) {
  const t = clip.thumbnail;
  if (!t || typeof t !== 'object') return null;
  if (valorDe(t.is_default) === true) return null;
  const id = numeroDe(t.id);
  const stamp = textoDe(t.last_update);
  if (id == null || !stamp || stamp === '0') return null;
  return { id, stamp };
}

// O Arena guarda nomes com `#` e exibe o `#` como número da camada
// (comportamento medido: "Layer #" vira "Layer 3"). Nome renomeado
// pelo usuário já vem pronto no mesmo campo; slot sem nome cai no
// rótulo interno.
export function rotuloCamada(nome, numero) {
  const texto = textoDe(nome).trim();
  if (!texto) return `Camada ${numero}`;
  return texto.replace(/#/g, String(numero));
}

// A camada especial existe pelo nome declarado pelo operador: exatamente
// "TimeGrid" (sem caso e sem espaços de borda). Só ela vira linha de tempo.
export function ehTimeGrid(nome) {
  return textoDe(nome).trim().toLowerCase() === 'timegrid';
}

// Só Clip > Duration entra: o operador decide o tempo de tela ali, e não
// confiamos na duração do arquivo nem no autopilot nesta tacada.
function tempoSegundos(clip) {
  const segundos = numeroDe(clip.transport && clip.transport.controls && clip.transport.controls.duration);
  return segundos != null && segundos > 0 ? segundos : null;
}

// Clip > Speed encurta o tempo de tela real: duration / speed.
function velocidade(clip) {
  const valor = numeroDe(clip.transport && clip.transport.controls && clip.transport.controls.speed);
  return valor != null && valor > 0 ? valor : 1;
}

export function tempoClip(clip) {
  const segundos = tempoSegundos(clip);
  if (segundos == null) return null;
  return segundos / velocidade(clip);
}

export function formatarTempo(segundos) {
  if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos <= 0) return '';
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = Math.round(segundos % 60);
  if (horas > 0) return `${horas}h${String(minutos).padStart(2, '0')}m`;
  if (minutos > 0) return resto > 0 ? `${minutos}m${resto}s` : `${minutos}m`;
  return `${resto}s`;
}

// Barra de progresso da TimeGrid. O transporte do Arena já embute a
// matemática: `position` percorre 0 → out ao longo do tempo de tela do
// clipe (Clip > Duration e Speed entram no avanço do transporte —
// medido no REST: BRAINSTORM percorre 253.678s em max 253678ms; um clipe
// de 4s com Duration 120s avança ~33.6ms/s e leva exatamente 120s). A
// razão in/out é o progresso da tela, sem recalcular speed aqui.
export function progressosTimeGrid(composicao) {
  const layers = (composicao && composicao.layers) || [];
  const barras = [];
  for (const [i, layer] of layers.entries()) {
    if (!ehTimeGrid(layer.name)) continue;
    const ativoID = numeroDe(layer.active_clip && layer.active_clip.id);
    const clips = layer.clips || [];
    for (const [j, clip] of clips.entries()) {
      const clipID = numeroDe(clip.id);
      if (clipID == null || clipID !== ativoID || !temTransporte(clip)) continue;
      const position = clip.transport.position;
      const valor = numeroDe(position && position.value);
      const inicio = numeroDe(position && position.in) ?? 0;
      const fim = numeroDe(position && position.out);
      if (valor == null || fim == null || fim <= inicio) continue;
      const progresso = Math.min(1, Math.max(0, (valor - inicio) / (fim - inicio)));
      barras.push({ endereco: `${i + 1}.${j + 1}`, progresso });
    }
  }
  return barras;
}

// O Arena devolve posição/parâmetros vivos a cada tick, mas o Monitor
// só mostra grade: comparamos o modelo já interpretado pra evitar
// re-render (e recriação de <img>) quando nada visível mudou.
export function mesmaGrade(anterior, proxima) {
  if (!anterior || !proxima) return false;
  return JSON.stringify(anterior) === JSON.stringify(proxima);
}

// Converte o corpo de GET /composition em camadas de células.
// `ativo` é o primeiro clip reproduzindo (active_clip da camada,
// igual ao REST — pausado não existe na API dele, não inventamos).
export function montarGrade(composicao) {
  const layers = (composicao && composicao.layers) || [];
  let ativo = null;
  const camadas = layers.map((layer, i) => {
    const numero = i + 1;
    const timeGrid = ehTimeGrid(layer.name);
    const ativoID = numeroDe(layer.active_clip && layer.active_clip.id);
    const clips = layer.clips || [];
    const celulas = clips.map((clip, j) => {
      const id = `${numero}.${j + 1}`;
      const clipID = numeroDe(clip.id);
      const tocando =
        temTransporte(clip) && clipID != null && clipID === ativoID;
      if (tocando && !ativo) {
        ativo = { nome: textoDe(clip.name) || id, endereco: id };
      }
      return {
        id,
        nome: textoDe(clip.name),
        preenchido: estaPreenchido(clip),
        ativo: tocando,
        thumb: fonteThumb(clip),
      };
    });
    const camada = { numero, rotulo: rotuloCamada(layer.name, numero), celulas };
    if (timeGrid) {
      const tempos = clips.map(tempoClip);
      celulas.forEach((celula, j) => { celula.tempo = tempos[j]; });
      const total = tempos.reduce((soma, tempo) => soma + (tempo || 0), 0);
      camada.timeGrid = true;
      camada.totalTempo = total > 0 ? total : null;
      camada.timeGridSemTempo = total <= 0;
      for (const [j, celula] of celulas.entries()) {
        celula.largura = total > 0
          ? (celula.tempo == null ? 0 : celula.tempo / total)
          : 1 / Math.max(celulas.length, 1);
      }
    }
    return camada;
  });
  // A UI do Arena lista a última camada no topo; endereços continuam
  // sendo o índice crescente do REST (`camada.coluna` 1-based).
  camadas.reverse();
  return { camadas, ativo };
}

// Quick Play: a mesma grade do monitor, em blocos na ordem do app nativo
// (QuickPlayView.layerGroups: camada crescente, depois coluna). A grade
// do monitor vem invertida (última camada no topo, como o Arena); aqui
// não. Leitura pura, sem disparo de clipe — igual ao nativo.
export function blocosQuickPlay(grade) {
  if (!grade || !Array.isArray(grade.camadas)) return [];
  return [...grade.camadas]
    .sort((a, b) => a.numero - b.numero)
    .flatMap((camada) => camada.celulas.map((celula) => ({ ...celula, camada: camada.numero })));
}

// Linha de resumo do card "Grade de clips": clips preenchidos e quantos
// têm thumbnail de verdade (o mock nunca tem).
export function resumoQuickPlay(blocos) {
  return {
    clips: blocos.filter((bloco) => bloco.preenchido).length,
    thumbnails: blocos.filter((bloco) => bloco.thumbUrl).length,
  };
}
