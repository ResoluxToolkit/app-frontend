function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarInline(texto) {
  let saida = escaparHtml(texto);

  saida = saida.replace(/`([^`]+)`/g, (_, conteudo) => `<code>${conteudo}</code>`);
  saida = saida.replace(
    /(\*\*|__)(?=\S)([\s\S]*?\S)\1/g,
    (_, __, conteudo) => `<strong>${conteudo}</strong>`,
  );
  saida = saida.replace(
    /(?<![\w*])\*(?=\S)([^*\n]+?\S)\*(?![\w*])/g,
    (_, conteudo) => `<em>${conteudo}</em>`,
  );
  saida = saida.replace(/~~(?=\S)([^~\n]+?\S)~~/g, (_, conteudo) => `<s>${conteudo}</s>`);
  saida = saida.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g,
    (_, conteudo, destino) =>
      `<a href="${destino}" target="_blank" rel="noopener noreferrer">${conteudo}</a>`,
  );

  return saida;
}

function eItemLista(linha) {
  return /^(?:[-*+]|\d+[.)])\s+/.test(linha);
}

function eInicioBloco(linha) {
  return (
    /^#{1,6}\s+/.test(linha) ||
    /^```/.test(linha) ||
    /^>/.test(linha) ||
    /^(?:[-*_]\s*){3,}$/.test(linha) ||
    eItemLista(linha)
  );
}

function renderLista(itens, marcada) {
  const conteudo = itens
    .map((linha) => `<li>${formatarInline(linha.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''))}</li>`)
    .join('');
  return marcada ? `<ul>${conteudo}</ul>` : `<ol>${conteudo}</ol>`;
}

export function markdownParaHtml(fonte) {
  if (!fonte) return '';
  const linhas = String(fonte).replace(/\r\n?/g, '\n').split('\n');
  const blocos = [];
  let paragrafo = [];
  let itens = [];
  let listaMarcada = false;
  let linhaAtual = 0;

  const fecharLista = () => {
    if (itens.length) {
      blocos.push(renderLista(itens, listaMarcada));
      itens = [];
    }
  };
  const fecharParagrafo = () => {
    if (paragrafo.length) {
      blocos.push(`<p>${paragrafo.map(formatarInline).join('<br>')}</p>`);
      paragrafo = [];
    }
  };

  while (linhaAtual < linhas.length) {
    const linha = linhas[linhaAtual];

    if (!linha.trim()) {
      fecharLista();
      fecharParagrafo();
      linhaAtual += 1;
      continue;
    }

    const cerca = linha.match(/^```\s*([\w-]*)\s*$/);
    if (cerca) {
      fecharLista();
      fecharParagrafo();
      linhaAtual += 1;
      const codigo = [];
      while (linhaAtual < linhas.length && !/^```\s*$/.test(linhas[linhaAtual])) {
        codigo.push(linhas[linhaAtual]);
        linhaAtual += 1;
      }
      if (linhaAtual < linhas.length) linhaAtual += 1;
      const rotulo = cerca[1] ? ` data-linguagem="${escaparHtml(cerca[1])}"` : '';
      blocos.push(`<pre${rotulo}><code>${escaparHtml(codigo.join('\n'))}</code></pre>`);
      continue;
    }

    if (eItemLista(linha)) {
      fecharParagrafo();
      const marcada = /^[-*+]\s+/.test(linha);
      if (itens.length && marcada !== listaMarcada) fecharLista();
      listaMarcada = marcada;
      itens.push(linha);
      linhaAtual += 1;
      continue;
    }
    fecharLista();

    const titulo = linha.match(/^(#{1,6})\s+(.*)$/);
    if (titulo) {
      fecharParagrafo();
      const nivel = titulo[1].length;
      blocos.push(`<h${nivel}>${formatarInline(titulo[2])}</h${nivel}>`);
      linhaAtual += 1;
      continue;
    }

    if (/^(?:[-*_]\s*){3,}$/.test(linha)) {
      fecharParagrafo();
      blocos.push('<hr>');
      linhaAtual += 1;
      continue;
    }

    if (/^>/.test(linha)) {
      fecharParagrafo();
      const citacao = [];
      while (linhaAtual < linhas.length && /^>/.test(linhas[linhaAtual])) {
        citacao.push(linhas[linhaAtual].replace(/^>\s?/, ''));
        linhaAtual += 1;
      }
      blocos.push(`<blockquote>${markdownParaHtml(citacao.join('\n'))}</blockquote>`);
      continue;
    }

    paragrafo.push(linha);
    linhaAtual += 1;
  }

  fecharLista();
  fecharParagrafo();
  return blocos.join('');
}
