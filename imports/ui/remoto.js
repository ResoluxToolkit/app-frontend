// ------------------------------------------------------------
// Acesso remoto: gerador de QR Code do painel (modo byte, ECC nível
// M, versões 1–6 — URL de LAN/Tailscale com o código de pareamento
// cabe de sobra), a URL que o celular abre e o código rotativo que
// ela carrega. Porta fiel ao algoritmo de referência (ISO 18004),
// sem dependências.
// ------------------------------------------------------------

// Nível M por versão: `blocos` de `porBloco` codewords de dados, cada
// um com `ecc` codewords de correção (tabela 9 da ISO 18004). Da v4 em
// diante há mais de um bloco e os codewords saem intercalados.
const FAIXA_M = [
  { versao: 1, blocos: 1, porBloco: 16, ecc: 10 },
  { versao: 2, blocos: 1, porBloco: 28, ecc: 16 },
  { versao: 3, blocos: 1, porBloco: 44, ecc: 26 },
  { versao: 4, blocos: 2, porBloco: 32, ecc: 18 },
  { versao: 5, blocos: 2, porBloco: 43, ecc: 24 },
  { versao: 6, blocos: 4, porBloco: 27, ecc: 16 },
].map((faixa) => ({ ...faixa, dados: faixa.blocos * faixa.porBloco }));

const CAPACIDADE_MAXIMA = FAIXA_M.at(-1).dados - 2;

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function popularGalois() {
  let valor = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = valor;
    LOG[valor] = i;
    valor <<= 1;
    if (valor & 0x100) valor ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

function multiplicarGalois(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

// Polinômio gerador do Reed-Solomon, coeficientes decrescentes (líder = 1).
function polinomioGerador(grau) {
  let poli = [1];
  for (let i = 0; i < grau; i += 1) {
    const proximo = new Array(poli.length + 1).fill(0);
    for (let j = 0; j < poli.length; j += 1) {
      proximo[j] ^= poli[j];
      proximo[j + 1] ^= multiplicarGalois(poli[j], EXP[i]);
    }
    poli = proximo;
  }
  return poli;
}

export function restoReedSolomon(dados, grau) {
  const gerador = polinomioGerador(grau);
  const resto = new Uint8Array(grau);
  for (const byte of dados) {
    const fator = byte ^ resto[0];
    for (let i = 0; i < grau - 1; i += 1) resto[i] = resto[i + 1];
    resto[grau - 1] = 0;
    for (let i = 0; i < grau; i += 1) {
      resto[i] ^= multiplicarGalois(gerador[i + 1], fator);
    }
  }
  return resto;
}

function escolherFaixa(quantidadeBytes) {
  const faixa = FAIXA_M.find((item) => item.dados - 2 >= quantidadeBytes);
  if (!faixa) throw new Error(`Texto maior que a capacidade do QR (${CAPACIDADE_MAXIMA} bytes).`);
  return faixa;
}

function montarCodewordsDados(bytes, capacidadeCodewords) {
  const bits = [];
  const empurrar = (valor, comprimento) => {
    for (let i = comprimento - 1; i >= 0; i -= 1) bits.push((valor >>> i) & 1);
  };
  empurrar(0b0100, 4);
  empurrar(bytes.length, 8);
  for (const byte of bytes) empurrar(byte, 8);
  empurrar(0, Math.min(4, capacidadeCodewords * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const padroes = [0xec, 0x11];
  for (let i = 0; codewords.length < capacidadeCodewords; i += 1) {
    codewords.push(padroes[i % 2]);
  }
  return codewords;
}

function bitsFormato(mascara) {
  const dados = mascara;
  let resto = dados;
  for (let i = 0; i < 10; i += 1) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  return ((dados << 10) | resto) ^ 0x5412;
}

const mascaraEscurece = [
  (linha, coluna) => (linha + coluna) % 2 === 0,
  (linha) => linha % 2 === 0,
  (_, coluna) => coluna % 3 === 0,
  (linha, coluna) => (linha + coluna) % 3 === 0,
  (linha, coluna) => (Math.floor(linha / 2) + Math.floor(coluna / 3)) % 2 === 0,
  (linha, coluna) => ((linha * coluna) % 2) + ((linha * coluna) % 3) === 0,
  (linha, coluna) => (((linha * coluna) % 2) + ((linha * coluna) % 3)) % 2 === 0,
  (linha, coluna) => (((linha + coluna) % 2) + ((linha * coluna) % 3)) % 2 === 0,
];

function desenharPadroesFuncao(matriz, funcao, versao) {
  const tamanho = matriz.length;
  const pintar = (linha, coluna, escuro) => {
    matriz[linha][coluna] = escuro;
    funcao[linha][coluna] = true;
  };
  for (let i = 8; i < tamanho - 8; i += 1) {
    const escuro = i % 2 === 0;
    pintar(6, i, escuro);
    pintar(i, 6, escuro);
  }
  const desenharFinder = (linha, coluna) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const alvoLinha = linha + r;
        const alvoColuna = coluna + c;
        if (alvoLinha < 0 || alvoColuna < 0 || alvoLinha >= tamanho || alvoColuna >= tamanho) continue;
        const dentro = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const borda = dentro && (r === 0 || r === 6 || c === 0 || c === 6);
        const nucleo = dentro && r >= 2 && r <= 4 && c >= 2 && c <= 4;
        pintar(alvoLinha, alvoColuna, borda || nucleo);
      }
    }
  };
  desenharFinder(0, 0);
  desenharFinder(0, tamanho - 7);
  desenharFinder(tamanho - 7, 0);
  desenharBitsFormato(matriz, 0, funcao);
  // A v1 não tem padrão de alinhamento; da v2 à v6 há um só, no canto
  // oposto ao finder de cima à esquerda.
  const centros = versao === 1 ? [] : [6, 4 * versao + 10];
  for (let i = 0; i < centros.length; i += 1) {
    for (let j = 0; j < centros.length; j += 1) {
      const canto = (i === 0 && j === 0) ||
        (i === 0 && j === centros.length - 1) ||
        (i === centros.length - 1 && j === 0);
      if (canto) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          pintar(
            centros[j] + dy,
            centros[i] + dx,
            dy === -2 || dy === 2 || dx === -2 || dx === 2 || (dx === 0 && dy === 0));
        }
      }
    }
  }
}

function desenharBitsFormato(matriz, mascara, funcao = null) {
  const tamanho = matriz.length;
  const bits = bitsFormato(mascara);
  const bit = (i) => ((bits >>> i) & 1) === 1;
  const pintar = (linha, coluna, escuro) => {
    matriz[linha][coluna] = escuro;
    if (funcao) funcao[linha][coluna] = true;
  };
  for (let i = 0; i < 15; i += 1) {
    if (i < 6) pintar(i, 8, bit(i));
    else if (i < 8) pintar(i + 1, 8, bit(i));
    else pintar(tamanho - 15 + i, 8, bit(i));

    if (i < 8) pintar(8, tamanho - 1 - i, bit(i));
    else if (i < 9) pintar(8, 7, bit(i));
    else pintar(8, 14 - i, bit(i));
  }
  pintar(tamanho - 8, 8, true);
}

function pontuacao(matriz) {
  const tamanho = matriz.length;
  let pontos = 0;
  for (let linha = 0; linha < tamanho; linha += 1) {
    let cor = matriz[linha][0];
    let corrida = 1;
    for (let coluna = 1; coluna < tamanho; coluna += 1) {
      if (matriz[linha][coluna] === cor) {
        corrida += 1;
      } else {
        if (corrida >= 5) pontos += 3 + corrida - 5;
        cor = matriz[linha][coluna];
        corrida = 1;
      }
    }
    if (corrida >= 5) pontos += 3 + corrida - 5;
  }
  for (let coluna = 0; coluna < tamanho; coluna += 1) {
    let cor = matriz[0][coluna];
    let corrida = 1;
    for (let linha = 1; linha < tamanho; linha += 1) {
      if (matriz[linha][coluna] === cor) {
        corrida += 1;
      } else {
        if (corrida >= 5) pontos += 3 + corrida - 5;
        cor = matriz[linha][coluna];
        corrida = 1;
      }
    }
    if (corrida >= 5) pontos += 3 + corrida - 5;
  }
  for (let linha = 0; linha < tamanho - 1; linha += 1) {
    for (let coluna = 0; coluna < tamanho - 1; coluna += 1) {
      const cor = matriz[linha][coluna];
      if (
        matriz[linha][coluna + 1] === cor &&
        matriz[linha + 1][coluna] === cor &&
        matriz[linha + 1][coluna + 1] === cor) {
        pontos += 3;
      }
    }
  }
  let escuros = 0;
  for (const linhaMatriz of matriz) {
    for (const modulo of linhaMatriz) {
      if (modulo) escuros += 1;
    }
  }
  const desvio = Math.abs((escuros * 100) / (tamanho * tamanho) - 50);
  pontos += Math.floor(desvio / 5) * 10;
  return pontos;
}

// Divide os dados em blocos, calcula o ECC de cada um e intercala:
// primeiro o 1º codeword de cada bloco, depois o 2º, e assim por diante.
function intercalarBlocos(dadosCodewords, faixa) {
  const blocos = [];
  for (let i = 0; i < faixa.blocos; i += 1) {
    const dados = dadosCodewords.slice(i * faixa.porBloco, (i + 1) * faixa.porBloco);
    blocos.push({ dados, ecc: restoReedSolomon(dados, faixa.ecc) });
  }
  const saida = new Uint8Array(faixa.blocos * (faixa.porBloco + faixa.ecc));
  let pos = 0;
  for (let i = 0; i < faixa.porBloco; i += 1) {
    for (const bloco of blocos) saida[pos++] = bloco.dados[i];
  }
  for (let i = 0; i < faixa.ecc; i += 1) {
    for (const bloco of blocos) saida[pos++] = bloco.ecc[i];
  }
  return saida;
}

export function montarBaseQr(texto) {
  const bytes = new TextEncoder().encode(texto);
  const faixa = escolherFaixa(bytes.length);
  const bits = intercalarBlocos(montarCodewordsDados(bytes, faixa.dados), faixa);

  const tamanho = 17 + 4 * faixa.versao;
  const base = Array.from({ length: tamanho }, () => new Array(tamanho).fill(false));
  const funcao = Array.from({ length: tamanho }, () => new Array(tamanho).fill(false));
  desenharPadroesFuncao(base, funcao, faixa.versao);

  let indice = 0;
  for (let direita = tamanho - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5;
    for (let vert = 0; vert < tamanho; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const coluna = direita - j;
        const subir = ((direita + 1) & 2) === 0;
        const linha = subir ? tamanho - 1 - vert : vert;
        if (!funcao[linha][coluna] && indice < bits.length * 8) {
          base[linha][coluna] = ((bits[indice >>> 3] >>> (7 - (indice & 7))) & 1) === 1;
          indice += 1;
        }
      }
    }
  }

  return { base, funcao, faixa };
}

export function gerarMatrizQr(texto) {
  const { base, funcao, faixa } = montarBaseQr(texto);
  const tamanho = base.length;

  let melhor = null;
  let melhorPontos = Number.POSITIVE_INFINITY;
  for (let mascara = 0; mascara < 8; mascara += 1) {
    const candidato = base.map((linha) => linha.slice());
    const formula = mascaraEscurece[mascara];
    for (let linha = 0; linha < tamanho; linha += 1) {
      for (let coluna = 0; coluna < tamanho; coluna += 1) {
        if (!funcao[linha][coluna] && formula(linha, coluna)) candidato[linha][coluna] = !candidato[linha][coluna];
      }
    }
    desenharBitsFormato(candidato, mascara);
    const pontos = pontuacao(candidato);
    if (pontos < melhorPontos) {
      melhorPontos = pontos;
      melhor = candidato;
    }
  }
  return melhor;
}

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// URL que o celular consegue abrir (mesma rede/Tailscale). Aberto por
// localhost não dá pra saber o endereço de rede da máquina — devolve
// vazio e a UI mostra a dica honesta.
export function urlRemota(loc = typeof window !== 'undefined' ? window.location : undefined) {
  if (!loc || !loc.protocol?.startsWith?.('http')) return '';
  if (HOSTS_LOCAIS.has((loc.hostname ?? '').toLowerCase())) return '';
  return loc.origin;
}

// Parâmetro da URL do QR que leva o código de pareamento.
export const PARAM_PAREAMENTO = 'p';

// URL que vai no QR: a origem de rede com o código rotativo. Quem lê
// abre o painel e devolve o código ao motor para ganhar acesso.
export function urlPareamento(origem, codigo) {
  if (!origem) return '';
  if (!codigo) return origem;
  return `${origem}/?${PARAM_PAREAMENTO}=${encodeURIComponent(codigo)}`;
}

// Código que veio na URL aberta pelo celular (ou vazio).
export function lerCodigoPareamento(loc = typeof window !== 'undefined' ? window.location : undefined) {
  if (!loc?.search) return '';
  return new URLSearchParams(loc.search).get(PARAM_PAREAMENTO) || '';
}

// Tira o código da barra de endereço depois de usado: ele não serve
// mais e não deve ficar em histórico, favorito ou print de tela.
export function limparCodigoDaUrl(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win?.history?.replaceState || !win.location) return;
  const url = new URL(win.location.href);
  if (!url.searchParams.has(PARAM_PAREAMENTO)) return;
  url.searchParams.delete(PARAM_PAREAMENTO);
  win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash);
}

// Segundos até o código expirar, nunca negativo. `expiraEm` é epoch em
// segundos, como tudo que o motor escreve.
export function segundosRestantes(expiraEm, agoraMs = Date.now()) {
  return Math.max(0, Math.ceil(expiraEm - agoraMs / 1000));
}

// Desenha o QR. Sem `fundo`, o canvas fica transparente e os módulos
// saem na cor `modulo` sobre o fundo da página (QR invertido: leitores
// de celular atuais leem, mas alguns antigos só leem escuro sobre claro).
export function desenharQr(canvas, matriz, { fundo = '#ffffff', modulo = '#101014' } = {}) {
  if (!canvas) return;
  const zona = 4;
  const lado = matriz.length + zona * 2;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const css = canvas.clientWidth || 220;
  canvas.width = Math.round(css * dpr);
  canvas.height = canvas.width;
  const contexto = canvas.getContext('2d');
  const escala = Math.max(1, Math.floor(canvas.width / lado));
  const margem = Math.floor((canvas.width - escala * lado) / 2);
  contexto.clearRect(0, 0, canvas.width, canvas.height);
  if (fundo) {
    contexto.fillStyle = fundo;
    contexto.fillRect(0, 0, canvas.width, canvas.height);
  }
  contexto.fillStyle = modulo;
  for (let linha = 0; linha < matriz.length; linha += 1) {
    for (let coluna = 0; coluna < matriz[linha].length; coluna += 1) {
      if (matriz[linha][coluna]) {
        contexto.fillRect(
          margem + (coluna + zona) * escala,
          margem + (linha + zona) * escala,
          escala,
          escala);
      }
    }
  }
}
