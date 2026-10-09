import { resolvePreset, MODE_FRAMES, paintFrame } from 'thinking-orbs/engine';

// ------------------------------------------------------------
// OrbManager — renderer vanilla para os ThinkingOrbs (engine
// puro do pacote thinking-orbs, sem React). Varre o DOM por
// <canvas data-orb="estado"> e pinta cada frame.
// ------------------------------------------------------------

// Tint por estado, seguindo os tokens da spec Resolux.
const TINTS = {
  breathing: null, // grayscale neutro (ink padrão)
  listening: { r: 48, g: 209, b: 88 }, // sucesso #30D158
  searching: { r: 100, g: 210, b: 255 }, // info #64D2FF
  composing: { r: 242, g: 107, b: 51 }, // marca #F26B33
  working: { r: 191, g: 90, b: 242 }, // violeta #BF5AF2
};

const ESTADOS_VALIDOS = new Set(Object.keys(TINTS));

class OrbManager {
  constructor() {
    this.orbs = new Map(); // canvas -> { estado, tamanho, preset }
    this.raf = null;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof window !== 'undefined') {
      window
        .matchMedia('(prefers-reduced-motion: reduce)')
        .addEventListener('change', (e) => {
          this.reducedMotion = e.matches;
          this.pintarTudo();
        });

      // Blaze recria canvases a cada render — observar o DOM.
      this.observer = new MutationObserver(() => this.scan());
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-orb'],
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.pararLoop();
        else this.garantirLoop();
      });
    }
  }

  scan() {
    if (typeof document === 'undefined') return;
    const canvases = document.querySelectorAll('canvas[data-orb]');
    const vivos = new Set();

    canvases.forEach((canvas) => {
      vivos.add(canvas);
      const estado = ESTADOS_VALIDOS.has(canvas.dataset.orb)
        ? canvas.dataset.orb
        : 'breathing';
      const tamanho = parseInt(canvas.dataset.orbTamanho || '20', 10);
      const atual = this.orbs.get(canvas);

      if (atual && atual.estado === estado && atual.tamanho === tamanho) return;

      const preset = resolvePreset(estado, tamanho);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = tamanho * dpr;
      canvas.height = tamanho * dpr;
      canvas.style.width = `${tamanho}px`;
      canvas.style.height = `${tamanho}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.orbs.set(canvas, { estado, tamanho, preset, ctx });
      this.pintar(canvas, performance.now());
    });

    // Remover canvases que saíram do DOM
    for (const canvas of this.orbs.keys()) {
      if (!vivos.has(canvas)) this.orbs.delete(canvas);
    }

    this.garantirLoop();
  }

  pintar(canvas, agora) {
    const orb = this.orbs.get(canvas);
    if (!orb) return;
    const { preset, tamanho, ctx, estado } = orb;
    // Movimento reduzido: um único frame estático em t = 0.6 (contrato da lib)
    const t = this.reducedMotion ? 0.6 : (agora / 1000) * preset.speed;
    const frame = MODE_FRAMES[preset.mode](tamanho, t, preset.opts);
    ctx.clearRect(0, 0, tamanho, tamanho);
    paintFrame(ctx, frame, /* dark */ true, TINTS[estado] || undefined);
  }

  pintarTudo() {
    const agora = performance.now();
    for (const canvas of this.orbs.keys()) this.pintar(canvas, agora);
  }

  garantirLoop() {
    if (this.reducedMotion || document.hidden || this.orbs.size === 0) {
      this.pararLoop();
      return;
    }
    if (this.raf !== null) return;
    const tick = (agora) => {
      this.raf = null;
      if (this.orbs.size === 0 || document.hidden) return;
      for (const canvas of this.orbs.keys()) {
        if (canvas.isConnected) this.pintar(canvas, agora);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pararLoop() {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }
}

let manager = null;

export function iniciarOrbs() {
  if (!manager) {
    manager = new OrbManager();
    manager.scan();
  } else {
    manager.scan();
  }
  return manager;
}
