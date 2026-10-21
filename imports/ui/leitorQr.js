// ------------------------------------------------------------
// Leitor do QR de pareamento dentro da página. Serve para o PWA (e
// qualquer janela com armazenamento próprio) parear a si mesmo: o
// celular fotografa o QR do Mac pelo <input capture>, que funciona em
// HTTP na LAN — getUserMedia exige contexto seguro e não abre lá.
// O jsQR só é carregado quando alguém de fato lê um QR.
// ------------------------------------------------------------

import { lerCodigoPareamento } from './remoto.js';

// Lados máximos tentados: foto inteira reduzida e, se falhar, menor
// (o jsQR acha QR pequeno melhor em imagem menos ruidosa).
const LADOS = [1280, 800];

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

function pixels(imagem, lado) {
  const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
  const largura = Math.max(1, Math.round(imagem.width * escala));
  const altura = Math.max(1, Math.round(imagem.height * escala));
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext('2d', { willReadFrequently: true });
  contexto.drawImage(imagem, 0, 0, largura, altura);
  return contexto.getImageData(0, 0, largura, altura);
}

// Texto do QR na foto, ou '' se não achar. O QR do painel é laranja
// sobre fundo escuro (invertido), por isso tenta as duas polaridades.
export async function lerQrDaImagem(arquivo) {
  const [{ default: jsQR }, imagem] = await Promise.all([import('jsqr'), createImageBitmap(arquivo)]);
  try {
    for (const lado of LADOS) {
      const { data, width, height } = pixels(imagem, lado);
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
