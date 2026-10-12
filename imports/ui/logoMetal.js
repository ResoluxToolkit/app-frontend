// Metal líquido (metal-fx v2) no texto "Toolkit" da topbar.
// Replica o componente MetalText do pacote sem React: createInstance +
// paintTextRun como máscara dos glifos, rim interno (borda de luz
// superior) e o mesmo par âmetro-chave do MetalText:
// força = strength × metalOpacity, shaderScale 2.8, material chromatic dark.
import {
  createInstance,
  destroyInstance,
  isMetalFxSupported,
  METAL_TEXT_DEFAULTS,
  paintTextRun,
  setSharedPreset,
  updateInstance,
} from 'metal-fx';

const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

// Lâmina de luz na borda superior dos glifos — o rim padrão do MetalText
// ({ offsetY: 1, blur: 0.5, alpha: 0.9 }).
function pintarRim(span, rim) {
  const dpr = window.devicePixelRatio || 1;
  const caixa = span.getBoundingClientRect();
  const largura = Math.max(1, Math.round(caixa.width * dpr));
  const altura = Math.max(1, Math.round(caixa.height * dpr));
  rim.width = largura;
  rim.height = altura;
  rim.style.width = `${caixa.width}px`;
  rim.style.height = `${caixa.height}px`;
  const ctx = rim.getContext('2d');
  if (!ctx) return;

  const glifo = (deslocamento) => {
    const tmp = document.createElement('canvas');
    tmp.width = largura;
    tmp.height = altura;
    const tctx = tmp.getContext('2d');
    if (!tctx) return null;
    tctx.fillStyle = '#fff';
    tctx.save();
    tctx.translate(0, deslocamento);
    paintTextRun(tctx, span, span, dpr);
    tctx.restore();
    return tmp;
  };

  const completo = glifo(0);
  const deslocado = glifo(1);
  const lamina = glifo(0);
  if (!completo || !deslocado || !lamina) return;
  const laminaCtx = lamina.getContext('2d');
  if (!laminaCtx) return;
  // Lâmina = máscara menos ela mesma deslocada 1px para baixo.
  laminaCtx.globalCompositeOperation = 'destination-out';
  laminaCtx.drawImage(deslocado, 0, 0);
  laminaCtx.globalCompositeOperation = 'source-over';

  ctx.clearRect(0, 0, largura, altura);
  ctx.filter = 'blur(0.5px)';
  ctx.drawImage(lamina, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(completo, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

export function aplicarMetalNoTexto(span) {
  if (!span || !isMetalFxSupported()) return;

  try {
    // Toda a página compartilha um material; o app é dark-only e o
    // MetalText força o preset chromatic.
    setSharedPreset('chromatic', 'dark');
  } catch {
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'metal-fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const rim = document.createElement('canvas');
  rim.className = 'metal-fx-rim';
  rim.setAttribute('aria-hidden', 'true');
  span.append(canvas, rim);

  let instancia = null;

  const dimensionar = () => {
    const caixa = span.getBoundingClientRect();
    if (caixa.width < 1 || caixa.height < 1) return;
    if (instancia) {
      updateInstance(instancia, { cssWidth: caixa.width, cssHeight: caixa.height });
      pintarRim(span, rim);
      return;
    }
    instancia = createInstance({
      hostCanvas: canvas,
      cssWidth: caixa.width,
      cssHeight: caixa.height,
      cornerRadius: 0,
      kind: 'pill',
      shaderScale: METAL_TEXT_DEFAULTS.shaderScale,
      opacityMul: METAL_TEXT_DEFAULTS.metalOpacity,
      paused: reduzMovimento.matches,
      mask: (ctx, _w, _h, dpr) => {
        ctx.fillStyle = '#fff';
        paintTextRun(ctx, span, span, dpr);
      },
    });
    pintarRim(span, rim);
  };

  dimensionar();

  const observador = new ResizeObserver(() => dimensionar());
  observador.observe(span);
  document.fonts?.ready.then(() => dimensionar());

  // Mudança de DPR (zoom, troca de monitor): dpr não é atualizável na
  // instância — recria. MetalText reage do mesmo jeito.
  let resolucao = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  const aoMudarResolucao = () => {
    resolucao.removeEventListener('change', aoMudarResolucao);
    if (instancia) {
      destroyInstance(instancia);
      instancia = null;
    }
    dimensionar();
    resolucao = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    resolucao.addEventListener('change', aoMudarResolucao);
  };
  resolucao.addEventListener('change', aoMudarResolucao);

  reduzMovimento.addEventListener?.('change', () => {
    if (instancia) updateInstance(instancia, { paused: reduzMovimento.matches });
  });
}
