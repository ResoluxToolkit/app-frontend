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
    return { numero, rotulo: rotuloCamada(layer.name, numero), celulas };
  });
  // A UI do Arena lista a última camada no topo; endereços continuam
  // sendo o índice crescente do REST (`camada.coluna` 1-based).
  camadas.reverse();
  return { camadas, ativo };
}
