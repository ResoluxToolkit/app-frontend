// ------------------------------------------------------------
// Leitor do QR de pareamento dentro da página. Serve para o PWA (e
// qualquer janela com armazenamento próprio) parear a si mesmo: o
// celular fotografa o QR do Mac pelo <input capture>, que funciona em
// HTTP na LAN — getUserMedia exige contexto seguro e não abre lá.
// O jsQR só é carregado quando alguém de fato lê um QR.
// ------------------------------------------------------------

import { lerCodigoPareamento } from './remoto.js';

// Na foto da tela do Mac o QR ocupa pouco do quadro e vem com moiré e
// reflexo; o jsQR não acha na foto inteira, mas acha num recorte em
// volta do QR reduzido (conferido com fotos reais do iPhone). Por isso
// tenta, em ordem: o centro, depois uma grade de recortes, cada um em
// dois tamanhos. `fracao` é o lado do recorte sobre o lado da foto.
export function recortesCandidatos(largura, altura) {
  const recortes = [];
  const adicionar = (fracao, cx, cy) => {
    const w = largura * fracao;
    const h = altura * fracao;
    const x = Math.min(Math.max(0, cx * largura - w / 2), largura - w);
    const y = Math.min(Math.max(0, cy * altura - h / 2), altura - h);
    for (const lado of [800, 500]) recortes.push({ x, y, w, h, lado });
  };
  adicionar(1, 0.5, 0.5);
  adicionar(0.6, 0.5, 0.5);
  adicionar(0.4, 0.5, 0.5);
  for (const cy of [0.3, 0.5, 0.7]) {
    for (const cx of [0.3, 0.5, 0.7]) {
      if (cx !== 0.5 || cy !== 0.5) adicionar(0.45, cx, cy);
    }
  }
  return recortes;
}

// Código de pareamento contido no texto do QR (a URL do painel com
// `?p=`), ou vazio se o QR não for do Resolux.
export function extrairCodigo(texto) {
  if (!texto) return '';
  try {
    return lerCodigoPareamento(new URL(texto));
  } catch (_) {
    return '';
  }
}

function pixels(imagem, { x, y, w, h, lado }) {
  const escala = Math.min(1, lado / Math.max(w, h));
  const largura = Math.max(1, Math.round(w * escala));
  const altura = Math.max(1, Math.round(h * escala));
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext('2d', { willReadFrequently: true });
  contexto.drawImage(imagem, x, y, w, h, 0, 0, largura, altura);
  return contexto.getImageData(0, 0, largura, altura);
}

// Texto do QR na foto, ou '' se não achar. O QR do painel é laranja
// sobre fundo escuro (invertido), por isso tenta as duas polaridades.
export async function lerQrDaImagem(arquivo) {
  const [{ default: jsQR }, imagem] = await Promise.all([import('jsqr'), createImageBitmap(arquivo)]);
  try {
    for (const recorte of recortesCandidatos(imagem.width, imagem.height)) {
      const { data, width, height } = pixels(imagem, recorte);
      const achado = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
      if (achado?.data) return achado.data;
    }
    return '';
  } finally {
    imagem.close?.();
  }
}

// Aberto como app instalado (tela de início), não numa aba do navegador.
export function abertoComoApp(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return false;
  return Boolean(win.navigator?.standalone) || Boolean(win.matchMedia?.('(display-mode: standalone)').matches);
}
