import { resolvePreset, MODE_FRAMES, paintFrame } from 'thinking-orbs/engine';

// ------------------------------------------------------------
// OrbManager — renderer vanilla para os ThinkingOrbs (engine
// puro do pacote thinking-orbs, sem React). Varre o DOM por
// <canvas data-orb="estado"> e pinta cada frame.
// ------------------------------------------------------------

// Tint por estado, seguindo os tokens da spec Resolux.
const TINTS = {
  breathing: null, // grayscale neutro (ink padrão)
  listening: { r: 184, g: 187, b: 38 }, // sucesso #b8bb26
  searching: { r: 131, g: 165, b: 152 }, // info #83a598
  composing: { r: 254, g: 128, b: 25 }, // marca #fe8019
  working: { r: 211, g: 134, b: 155 }, // violeta #d3869b
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

      // O re-render do app recria canvases — observar o DOM.
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
      try {
        const estado = ESTADOS_VALIDOS.has(canvas.dataset.orb)
          ? canvas.dataset.orb
          : 'breathing';
        const tamanho = parseInt(canvas.dataset.orbTamanho || '20', 10);
        const display =
          parseInt(canvas.dataset.orbDisplay || String(tamanho), 10) || tamanho;
        const atual = this.orbs.get(canvas);

        if (
          atual &&
          atual.estado === estado &&
          atual.tamanho === tamanho &&
          atual.display === display
        ) {
          return;
        }

        const preset = resolvePreset(estado, tamanho);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const escala = (display / tamanho) * dpr;
        canvas.width = Math.round(display * dpr);
        canvas.height = Math.round(display * dpr);
        canvas.style.width = `${display}px`;
        canvas.style.height = `${display}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(escala, 0, 0, escala, 0, 0);

        this.orbs.set(canvas, { estado, tamanho, display, preset, ctx });
        this.pintar(canvas, performance.now());
      } catch (erro) {
        // Um canvas com tamanho sem preset não pode derrubar o boot.
        console.warn('orb ignorado:', canvas.dataset.orb, erro?.message);
      }
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
