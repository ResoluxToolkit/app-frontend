# Voice — Pro

The full reference for `voice-glow` (component `VoiceBeam`): every Studio knob with its range, the palettes, the type and theme presets, the Studio's snippet export, and rebuilding the effect's stylesheet through the `css` core.

## When to use

### Where it goes

The author's placement rules. Follow them before the general list below.

- **Anything voice or recording related**: mic buttons, dictation, voice mode, recording chips, call UIs, and the processing step right after speech.

More situations it fits:

- Voice mode in an AI chat composer: the input glows while the user speaks (`type="default"`, tuned for a ~350px input).
- A recording chip or "Recording 0:07" pill next to a send button (`type="pill"`, tuned for ~150x44).
- The bottom of a full-screen voice assistant on a phone (`type="mobile"`).
- The step after speech ("Transcribing…", "Thinking…"): the Pro processing state (`useVoiceProcessing`, see Processing) gathers the glow into one beam that sweeps the range.
- The assistant's own speech (TTS) or a remote caller's voice: any `MediaStream`, or a level getter.
- Brand surfaces: custom lobe and band colours, light theme tuning, a calmer or hotter response.

### When not to use

- Generic loading with no voice in the flow. Use a border beam or thinking indicator.
- As the only sign the mic is live. It is decorative; keep text status and a clear mic button state.
- Many simultaneous instances (lists, grids). Each runs blurred layers, a canvas and, with `distortion`, an SVG filter.
- Accurate metering (dB, peak hold, clipping). The level is gated, soft-saturated and smoothed.

## Install

```bash
npm install voice-glow
pnpm add voice-glow
yarn add voice-glow
```

```tsx
import { VoiceBeam, useMicrophone } from 'voice-glow';
```

- React only (no vanilla or custom-element build). Peer deps `react` and `react-dom` >= 18. ESM + CJS + types, no runtime dependencies.
- No `"use client"` directive in the package; it uses hooks. In the Next.js App Router import it from a `'use client'` file.
- The mic path needs a secure context (`https` / `localhost`) and `mic.start()` from a user gesture.
- CSS `@property` powers the fade in / out (Chrome 85+, Safari 15.4+, Firefox 128+). Without it the fade steps.

Other exports: `useMicrophone`, `getAudioContext`, `isAudioSupported`, `parseRgb`, `voiceDefaults`, `voiceTypePresets`, `voiceTypeStyle`, `resolveVoiceDefaults(type, theme)`, `resolveVoiceStyle(type, theme)`, `themePresets`, `voicePalettes`, `voiceLobes`, `LOBE_SPACING` (36), `LOBE_SPAN` (252), and the types `VoiceBeamProps`, `VoiceBeamType`, `VoiceBeamTheme`, `VoiceBeamColorVariant`, `VoiceBeamLevel`, `VoiceThemeColors`, `VoiceGeometry`, `VoiceTypeStyle`, `VoiceLobe`, `UseMicrophoneOptions`, `UseMicrophoneResult`, `MicrophoneState`.

## Basic usage

The detail page's Install & Usage snippet:

```tsx
import { VoiceBeam, useMicrophone } from 'voice-glow';

const mic = useMicrophone();

<VoiceBeam stream={mic.stream}>
  <ChatInput />
</VoiceBeam>

<button onClick={mic.start}>Listen</button>
```

As a complete component:

```tsx
'use client';
import { VoiceBeam, useMicrophone } from 'voice-glow';
import { useVoiceProcessing } from './voice-processing'; // Pro — see Processing

export function VoiceComposer({ thinking }: { thinking: boolean }) {
  const mic = useMicrophone();
  const live = mic.state === 'live';
  const processing = useVoiceProcessing(thinking);
  return (
    <>
      <VoiceBeam stream={mic.stream} motion={processing}>
        <div style={{ borderRadius: 20, padding: 24, background: '#1d1d1d' }}>
          <textarea placeholder="Ask anything" />
        </div>
      </VoiceBeam>
      <button onClick={live ? mic.stop : mic.start} aria-pressed={live}>
        {live ? 'Stop' : 'Listen'}
      </button>
    </>
  );
}
```

### How audio input is wired

Two inputs; `stream` wins when it is usable.

**`stream` (MediaStream).** When the instance registers with the driver:

1. `getAudioContext()` returns the page's single shared `AudioContext` (created on first use, `webkitAudioContext` fallback) and calls `resume()` if suspended.
2. One `MediaStreamAudioSourceNode` per stream, kept in a `WeakMap` and reference-counted, so several beams can share one mic.
3. One `AnalyserNode` per instance: `fftSize = 1024`, `smoothingTimeConstant = 0.5`. The source connects to it; nothing connects to `destination`, so audio is never played back.
4. If there is no Web Audio or the stream has no audio track, no analyser is made and the instance falls back to `level`.
5. The analyser is released when the instance unregisters: on unmount, on a stream change, after `active={false}` fades out, or when it scrolls offscreen.

Per frame, from the analyser:

- Level = RMS of `getFloatTimeDomainData` x 5 (base gain) x `sensitivity`.
- Three bands from `getByteFrequencyData`: 80-300 Hz (lows), 300-2000 Hz (mids), 2000-6000 Hz (highs), each the mean bin value / 255 x 1.7 x `sensitivity`.

**`level` (number or `() => number`).** Used when no analyser exists. Clamped to 0-1. A number is read through a ref (changing it does not re-register the driver, but it does re-render your tree). A getter is called once per frame without re-rendering. `sensitivity` does not apply to `level`. The three bands are synthesised from it: `raw`, `raw x (0.72 + 0.28 sin 9.1t)`, `raw x (0.6 + 0.4 sin(13.7t + 2))`.

**Shaping, both paths.** Noise gate at `threshold` (bands gate at 0.6 x threshold), then soft saturation `(1 - e^(-3t)) / (1 - e^-3)`, then a one-pole attack / release follower (bands release 1.15x slower). The idle breath is folded under it: `voiced = level + (1 - level) x idle x breathe`, where `breathe` is a sine over `breatheDuration`. While gathered (`motion`), the effective level is at least `motion.heldLevel`.

**Output.** `onLevel(level)` is called every frame with the smoothed level (before idle). The same value is written to `--vb-level-{id}` on the wrapper.

**`useMicrophone(options?)`**

| Field | Type | Notes |
|---|---|---|
| `stream` | `MediaStream \| null` | Hand to `<VoiceBeam stream>`. |
| `state` | `'idle' \| 'requesting' \| 'live' \| 'denied' \| 'unsupported' \| 'error'` | `denied` on `NotAllowedError` / `SecurityError`. Back to `idle` when the track ends. |
| `error` | `Error \| null` | |
| `supported` | `boolean` | `getUserMedia` exists. |
| `start()` | `() => Promise<MediaStream \| null>` | Call from a click. Creates / resumes the shared `AudioContext` inside the gesture. Returns the existing stream if already live. |
| `stop()` | `() => void` | Stops every track, drops the stream. |
| `options.constraints` | `MediaTrackConstraints` | Merged over the defaults `{ echoCancellation: false, noiseSuppression: false, autoGainControl: false }`. `{}` keeps the browser's processing. Pass `{ deviceId }` to pick a mic. |
| `options.autoStart` | `boolean` | Request on mount. Default `false`. |

If you build your own stream (not through the hook), call `getAudioContext()` in the click handler so Safari lets the context start.

## Full option reference

Grouped like the Studio bench (`Manual control` tab), top to bottom. "(free)" marks what the public detail page's playground also exposes. Defaults are for `type="default"` on the dark theme unless a column says otherwise. The type and theme preset tables below give the rest.

### Type

| Prop | Type | Values | Default | Effect |
|---|---|---|---|---|
| `type` (free: `default`, `mobile`) | enum | `"default"` (Chat input), `"pill"` (Pill), `"mobile"` (Mobile) | `"default"` | Host preset. Sets the defaults of every geometry prop and some styling; explicit props still win. In the Studio, switching type resets geometry, strength, radius, brightness and saturation to that type's defaults. |

### Source

| Studio source | Code | Notes |
|---|---|---|
| Demo voice (free) | `level={() => yourLevel}` | Studio plays a synthetic speech envelope. |
| Microphone (free) | `stream={mic.stream}` + `useMicrophone()` | Choosing it calls `mic.start()` in the click. |
| Manual | `level={0.6}` | Level slider 0-100 %, step 1, default 60 %; exported as `level / 100`. |
| Processing (Pro) | `motion={processing}` + `useVoiceProcessing(thinking, {...})` | Reveals the processing knobs below. Since voice-glow 0.3.0 processing is not in the package: add `voice-processing.ts` (see Processing) to the project. |

Processing knobs (visible with the Processing source) — the hook's tuning; the agent spec still names them `processingDuration` … `cornerFollow`:

| Studio label | Hook option | Agent key | Range / step | Default | Effect |
|---|---|---|---|---|---|
| Pass duration | `duration` | `processingDuration` | 0.3-3 s / 0.05 | 1.1 (mobile 1.05) | Seconds per pass of the beam. |
| Held level | `level` | `processingLevel` | 0-1 / 0.01 (shown %) | 0.55 (mobile 0.35) | How lit the glow is held while processing. |
| Travel | `travel` | `processingTravel` | 0-2 / 0.05 | 1.55 (pill 2, mobile 1) | Sweep distance to each side, x half the lobe ring. |
| Turn ease | `curve` | `processingCurve` | 1-4 / 0.05 | 2.1 | 1 constant speed with sharp turns, 2 smooth, higher dwells at the ends. |
| Corner follow | `cornerFollow` | `cornerFollow` | 0-1 / 0.05 (shown %) | 0.45 (pill 0, mobile 0.4) | How much the glow rides the corner arcs while processing. |
| Morph | `ease` | — | 0.1-2 s / 0.05 | 0.6 | Seconds for the morph into and out of processing. |

### Processing (Pro)

voice-glow 0.3.0 dropped the `processing*` props; the package now takes a generic `motion` (a `VoiceBeamMotion` or a per-frame getter: `gather` 0-1, `offset` in half lobe-rings, `stretch`, `heldLevel`, `cornerFollow`). The processing sweep is this hook — add it to the project as `voice-processing.ts` (it is the Studio's own code) and pass its getter as `motion`:

```tsx
const processing = useVoiceProcessing(thinking, { type: 'mobile' }); // + any tuning: duration, level, travel, curve, cornerFollow, ease
<VoiceBeam type="mobile" stream={mic.stream} motion={processing}>…</VoiceBeam>
```

Projects still on voice-glow 0.2.x use the old props (`processing`, `processingDuration`, …); on 0.3.0 those props do nothing, so replace them with the hook.

```ts
import { useCallback, useRef } from "react";
import type { VoiceBeamMotion, VoiceBeamType } from "voice-glow";

/* The Voice processing state — Libraries Pro. Once the voice is captured
   and something is working on it (transcribing, thinking), the glow's
   lobes gather into one compact beam that travels its range left to right
   and back, eased at each end and looped — border-beam's traveling line,
   confined to the voice glow. It morphs in and out smoothly, so listening →
   processing → idle needs no choreography. It drives the free package's
   `motion` prop:

     const processing = useVoiceProcessing(thinking, { type: "mobile" });
     <VoiceBeam type="mobile" stream={mic.stream} motion={processing}>…

   The same code ships to Pro users through the Pro skill (libraries-pro
   content/libraries/voice-glow), and the SwiftUI port has it as
   VoiceGlowProcessing. */

export interface ProcessingTuning {
  /* Seconds per pass (left to right, or back). */
  duration: number;
  /* How lit the glow is held while processing, 0–1. */
  level: number;
  /* How far the beam travels to each side, × half the lobe ring. */
  travel: number;
  /* How it eases into each turn: 1 constant speed, 2 smooth, higher dwells. */
  curve: number;
  /* How much the beam rides the element's corner arcs, 0–1. */
  cornerFollow: number;
  /* Seconds the morph in and out takes. */
  ease: number;
}

/* The tuning per host type (what voice-glow 0.2 shipped as props). */
export const PROCESSING_DEFAULTS: Record<VoiceBeamType, ProcessingTuning> = {
  default: { duration: 1.1, level: 0.55, travel: 1.55, curve: 2.1, cornerFollow: 0.45, ease: 0.6 },
  pill: { duration: 1.1, level: 0.55, travel: 2, curve: 2.1, cornerFollow: 0, ease: 0.6 },
  mobile: { duration: 1.05, level: 0.35, travel: 1, curve: 2.1, cornerFollow: 0.4, ease: 0.6 },
};

function follow(prev: number, target: number, dt: number, attack: number, release: number): number {
  const tau = target > prev ? attack : release;
  return prev + (target - prev) * (1 - Math.exp(-dt / Math.max(0.001, tau)));
}

/* A processing driver outside React: call the returned function every
   frame (the `motion` getter does) with whether processing is on. */
export function createVoiceProcessing() {
  let blend = 0;
  let clock = 0;
  let last: number | null = null;
  return (active: boolean, tuning: ProcessingTuning, reducedMotion = false, now = performance.now()): VoiceBeamMotion => {
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const duration = Math.max(0.05, tuning.duration);
    // A fresh start begins the pass at the centre, heading right, so the
    // beam grows out of the voice glow instead of jumping to one end.
    if (active && blend < 0.001 && clock === 0) clock = duration / 2;
    const ease = Math.max(0.05, tuning.ease);
    blend = follow(blend, active ? 1 : 0, dt, ease * 0.9, ease * 0.8);
    if (active) clock += dt;
    else if (blend < 0.001) clock = 0;

    // The morph runs on an eased copy of the blend — slow to start, slow to
    // settle — so the gather, the narrowing and the travel read as one.
    const morph = blend * blend * (3 - 2 * blend);
    const passes = clock / duration;
    const index = Math.floor(passes);
    const u = passes - index;
    const k = Math.max(1, tuning.curve);
    const eased = u < 0.5 ? 0.5 * Math.pow(2 * u, k) : 1 - 0.5 * Math.pow(2 - 2 * u, k);
    const pass = reducedMotion ? 0 : index % 2 === 0 ? 2 * eased - 1 : 1 - 2 * eased;
    return {
      gather: morph,
      offset: morph * tuning.travel * pass,
      // A little wider mid-pass than at the turns.
      stretch: 1 - pass * pass,
      heldLevel: tuning.level,
      cornerFollow: tuning.cornerFollow,
    };
  };
}

/* The hook: a stable `motion` getter for <VoiceBeam>, sampled every frame,
   so turning processing on or off never re-renders the beam. */
export function useVoiceProcessing(
  active: boolean,
  tuning: Partial<ProcessingTuning> & { type?: VoiceBeamType; reducedMotion?: boolean } = {}
): () => VoiceBeamMotion {
  const driver = useRef(createVoiceProcessing());
  const activeRef = useRef(active);
  activeRef.current = active;
  const { type = "default", reducedMotion = false, ...overrides } = tuning;
  const tuningRef = useRef<ProcessingTuning>(PROCESSING_DEFAULTS[type]);
  tuningRef.current = { ...PROCESSING_DEFAULTS[type], ...overrides };
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  return useCallback(() => driver.current(activeRef.current, tuningRef.current, reducedRef.current), []);
}
```

### Color theme

| Prop | Values | Default |
|---|---|---|
| `colorVariant` | `"colorful"`, `"mono"`, `"ocean"`, `"sunset"`, `"forest"`, `"candy"`, `"ice"`, `"gold"` | `"colorful"` |

`mono` forces static colours (no hue drift) and multiplies the stroke, inner and bloom opacity by 0.6.

Palettes, lobe order Centre, Inner left, Inner right, Outer left, Outer right, Far left, Far right:

| Variant | Dark | Light |
|---|---|---|
| colorful | `#ff4678 #3cbeff #af46ff #3cdc82 #ff9628 #5a64ff #28c8be` | `#ffc915 #7ec4ff #b428e6 #eb64a0 #ffb07a #9aa0ff #7fd9ee` |
| mono | `#d7d7d7 #b4b4b4 #bebebe #a0a0a0 #aaaaaa #969696 #9b9b9b` | `#3c3c3c #5a5a5a #555555 #6e6e6e #696969 #7d7d7d #787878` |
| ocean | `#508cff #28c8e6 #785aff #1eaad2 #a050f0 #3c6eff #28beb4` | `#2864f0 #14a0c8 #5a3ce6 #1482b4 #8232dc #2850e6 #149696` |
| sunset | `#ff6e3c #ffb428 #ff3c5a #ffd250 #f0468c #ff8c32 #e6326e` | `#eb501e #e6960a #e61e46 #e1af1e #d7286e #eb6e14 #cd1e5a` |
| forest | `#46dc78 #28c8b4 #8ce650 #1eaa8c #beeb46 #32be6e #1e9678` | `#1eaa50 #149682 #5ab41e #148264 #82b414 #1e9650 #14785a` |
| candy | `#ff5aaa #ff78dc #d250ff #ff96be #b46eff #ff468c #e664f0` | `#eb288c #e646be #b428e6 #eb64a0 #9646e6 #e61e6e #c83cd2` |
| ice | `#96e6ff #5ac8ff #bef0ff #78beff #a0dcfa #50aaff #c8ebff` | `#1ea0dc #1482d2 #3cb4e6 #2878dc #32a0dc #146edc #46aae6` |
| gold | `#ffc846 #ffaa28 #ffdc6e #f0961e #ffeb8c #e6a028 #fad25a` | `#c88c0a #be7800 #d2a01e #b46e00 #cdaa28 #af7305 #c39614` |

### Colors

| Studio control | Prop | Values | Default | Effect |
|---|---|---|---|---|
| Centre ... Far right (7 swatch rows) | `colors` | `string[]`, up to 7, any `#rgb`, `#rrggbb`, `rgb()`, `rgba()` | the variant's palette for the theme | Per-lobe colour, centre first then pairs outward. Missing or unparseable slots keep the variant's colour. Each row offers the 8 variants' colour for that slot, or a picker. |
| Band core, Fringe above, Fringe between, Fringe below | `bandColors` | `{ core?, above?, mid?, below? }` | dark `core #ffffff, above #ff4650, mid #5aff96, below #508cff`; light `core #c58bff, above #ff7ab6, mid #7ec4ff, below #2dffab` | The band's ridge and chromatic fringes. Each row offers the dark default, the light default, the current variant's first four lobe colours, or a picker. |

The Studio resets both to the variant's and theme's defaults whenever the variant or theme changes, so choose the variant first.

### Response

| Studio label | Prop | Range / step | Default | Effect |
|---|---|---|---|---|
| Sensitivity | `sensitivity` | 0.2-4 / 0.05 | 3.1 | Input gain on the analysed audio (stream only). Raise for quiet sources. |
| Threshold | `threshold` | 0-0.3 / 0.005 | 0.015 | Noise gate. Below it reads as silence. |
| Attack | `attack` | 0-0.5 s / 0.005 (shown ms) | 0.325 | Seconds to rise toward a louder level. |
| Release | `release` | 0.02-1.5 s / 0.01 (shown ms) | 0.86 | Seconds to settle after the sound drops. |

### Shape

| Studio label | Prop | Range / step | Default | Effect |
|---|---|---|---|---|
| Scale | `scale` | 0.3-3 / 0.05 | 1 (pill 0.45, mobile 1.25) | Multiplies every px dimension at once: lobes, spacing, range, bend, band, core, blur, flow. |
| Reach | `reach` | 0-3 / 0.05 | 1.2 (light 1.8, pill 1.35, mobile 3) | Height gain at full level. |
| Spread | `spread` | 0-1.5 / 0.05 | 1.05 (light 0.8, pill 1.1, mobile 0.45) | Width gain at full level; side lobes drift outward. |
| Flow | `flow` | -200 to 200 px/s / 4 | 48 (pill 0, mobile 60) | Sideways travel of the spectrum at full level. Negative flows right to left; 0 holds. |
| Idle presence | `idle` | 0-1 / 0.01 (shown %) | 0.18 | Resting breath while silent. 0 goes dark between words. |
| Breathe | `breatheDuration` | 1-8 s / 0.1 | 5.2 | Period of the idle breath. |
| Options: Bands | `bands` | boolean | `true` | Lows move the centre lobe, mids the inner and far pairs, highs the outer pair (each lobe 0.6-1.3x). Off, all follow one level. |
| Options: Static colors | `staticColors` | boolean | `false` | Stops the hue drift. |

### Bend & band

| Studio label | Prop | Range / step | Default | Effect |
|---|---|---|---|---|
| Bend | `bend` | 0-80 px / 1 | 60 (pill 23, mobile 70) | Px the glow's ceiling humps up at the centre at full level. 0 is a plain ellipse. |
| Curve | `bandCurve` | 0.6-4 / 0.05 | 1.75 (pill 1.95, mobile 1.55) | Bell exponent: < 2 cusp-like, 2 gaussian, > 2 flat top. |
| Spread | `bandSpread` | 0.15-1.2 / 0.01 | 0.87 (pill 0.38, mobile 0.9) | Bell width vs the half-range. |
| Skew | `bandSkew` | -0.6 to 0.6 / 0.02 | 0.12 | Positive widens the right side. |
| Band strength | `bandStrength` | 0-3 / 0.05 | 1.55 (mobile 1.8; light 1.7, light pill 2) | Band opacity; 0 hides it. |
| Band width | `bandWidth` | 0.3-3 / 0.05 | 2.15 (pill 1.85, mobile 2.4) | Band thickness. |
| Band height | `bandPosition` | 0.1-1.3 / 0.01 (shown %) | 0.35 | Peak height as a fraction of the ceiling. |
| Tail lift | `bandTail` | 0-1 / 0.01 (shown %) | 0.59 (pill 0, mobile 0.62) | The band's ends rise again toward the corners, x the peak. |
| Tail position | `bandTailPosition` | 0-0.98 / 0.01 (shown %) | 0.67 (mobile 0.42) | Where the rise starts, as a share of centre-to-edge. |
| Tail curve | `bandTailCurve` | 1-6 / 0.1 | 2.4 (mobile 2.7) | 1 a ramp; higher a hook that whips up at the corner. |
| Tail overflow | `bandTailOverflow` | 0-60 px / 1 | 15 (mobile 22) | Px the band runs past each side, cropped by the wrapper. |
| Line offset | `bandOffset` | -40 to 60 px / 1 | -27 (pill -16, mobile -50) | Vertical shift of the band line; negative sinks it. |
| Aberration | `bandAberration` | 0-1 / 0.01 (shown %) | 0.89 | Red / blue fringe split. |
| Distortion | `distortion` | 0-1 / 0.01 (shown %) | 0.62 (pill 0.45) | Sideways warp of the glow under the band (SVG `feDisplacementMap`). 0 removes the filter. |
| Distortion detail | `distortionDetail` | 0.3-3 / 0.05 | 2.3 (pill 3, mobile 2) | Noise grain: < 1 broad waves, > 1 fine ripples. |

### Glow shape

All multipliers on the tuned resting geometry.

| Studio label | Prop | Range / step | Default | Effect |
|---|---|---|---|---|
| Lobe width | `glowWidth` | 0.3-3 / 0.05 | 0.65 (mobile 1.15) | Width of every lobe, all layers. |
| Lobe height | `glowHeight` | 0.3-3 / 0.05 | 1.25 (pill 0.95, mobile 2.1) | Height of every lobe. |
| Lobe spacing | `lobeSpacing` | 0.4-2.2 / 0.05 | 0.85 (pill 0.45, mobile 1.35) | Distance between lobes and the flow ring. |
| Range width | `rangeWidth` | 0.4-2.5 / 0.05 | 0.75 (pill 0.8, mobile 1.25) | Width of the visible ellipse. |
| Range height | `rangeHeight` | 0.4-2.5 / 0.05 | 1 (pill 0.7, mobile 1.2) | Height of the visible ellipse. |
| Softness | `softness` | 0.6-1.35 / 0.01 | 1.07 (pill 0.88, mobile 1.1) | Lobe edge fade. |
| Core | `coreSize` | 0-3 / 0.05 | 1 (pill 0.25) | The hot spot at the centre of the edge. |
| Stroke size | `strokeScale` | 0.3-3 / 0.05 | 1 (pill 1.25) | Colours in the 1px edge stroke. |
| Inner size | `innerScale` | 0.3-3 / 0.05 | 1 (pill 0.95) | The soft light inside the element. |
| Inner height | `innerHeight` | 0.3-3 / 0.05 | 1 | How far the inner light reaches in. |
| Bloom size | `bloomScale` | 0.3-3 / 0.05 | 1 (pill 1.05) | The blurred halo. |
| Bloom height | `bloomHeight` | 0.3-3 / 0.05 | 1 (pill 2.25) | How far the halo climbs. |
| Epicentre | `coreLight` | 0-3 / 0.05 (shown %) | 0 (light 1.8) | White wash under the band line at the centre. Up to 1 is opacity; past 1 the solid core widens. |
| Epicentre width | `coreLightWidth` | 0.3-3 / 0.05 | 1 | |
| Epicentre height | `coreLightHeight` | 0.3-3 / 0.05 | 1 | |

### Glow styling

| Studio label | Code | Range / step | Default | Effect |
|---|---|---|---|---|
| Strength | `strength` (Studio 0-100 %, prop 0-1) | 0-100 / 1 | 100 % (light 80 %, mobile 100 % on both) | Opacity of the beam layers only, never the children. |
| Corner radius | `borderRadius` | 0-120 px / 1 | Studio mocks 20 / 106 / 66; the library auto-detects the first child's radius (16 if none) | Radius the layers clip to. |
| Size | `glowSize` | 0.25-3 / 0.05 | 1 (pill 0.95) | Bloom blur radius multiplier. |
| Brightness | `brightness` | 0.5-2.2 / 0.05 | 1.15 (pill 1.35, mobile 1.2; light 0.95) | Glow brightness. |
| Saturation | `saturation` | 0.4-2.2 / 0.05 | 1.2 (pill and mobile 1.5; light 1.6) | Glow saturation. |
| Stroke | `--voice-stroke-opacity` (or prop `strokeOpacity`) | 0-2 / 0.05 | 1 | Edge stroke opacity multiplier. |
| Inner glow | `--voice-inner-opacity` (or prop `innerOpacity`) | 0-2 / 0.05 | 1 | Inner light opacity multiplier. |
| Bloom | `--voice-bloom-opacity` (or prop `bloomOpacity`) | 0-2 / 0.05 | 1 | Halo opacity multiplier. |
| Hue range | `hueRange` | 0-120 deg / 1 | 24 (light 40) | Drift ± this far. Hidden when Static colors is on. |
| Hue speed | `hueDuration` | 2-40 s / 0.5 | 12 (light 8.5) | Period of the drift. |
| Hue shift | `--voice-hue-base` | -180 to 180 deg / 5 | 0 (the light theme's own base is 5deg) | Rotates the whole palette. |

### Theme, pause, presets

| Control | Code | Notes |
|---|---|---|
| Studio's global dark / light switch | `theme` = `"dark"` (default, omitted) or `"light"` | The package also takes `"auto"` (follows `prefers-color-scheme`); the Studio does not expose it. Switching theme in the Studio resets geometry and styling to that theme's defaults. |
| Play / Pause (free) | `paused` | Holds the frame. Knob changes still repaint the held frame. |
| Presets | none built in | "Presets" saves your own named sets, one value set per theme (signed in: on the account; signed out: localStorage). |

Light theme layer presets (multiplied by the opacity multipliers): stroke 1.2, inner 0.85, bloom 0.5, inner shadow `rgba(0, 0, 0, 0.08)`, hue base 5deg. Dark: stroke 1.16, inner 0.47, bloom 0.89, inner shadow `rgba(255, 255, 255, 0.1)`, hue base 0.

### Type and theme presets at a glance

| | default dark | default light | pill dark | pill light | mobile dark | mobile light |
|---|---|---|---|---|---|---|
| `scale` | 1 | 1 | 0.45 | 0.45 | 1.25 | 1.25 |
| `reach` | 1.2 | 1.8 | 1.35 | 1.35 | 3 | 3 |
| `spread` | 1.05 | 0.8 | 1.1 | 1.1 | 0.45 | 0.45 |
| `bandStrength` | 1.55 | 1.7 | 1.55 | 2 | 1.8 | 1.7 |
| `coreLight` | 0 | 1.8 | 0 | 1.8 | 0 | 1.8 |
| `brightness` | 1.15 | 0.95 | 1.35 | 0.95 | 1.2 | 0.95 |
| `saturation` | 1.2 | 1.6 | 1.5 | 1.6 | 1.5 | 1.6 |
| `strength` | 1 | 0.8 | 1 | 0.8 | 1 | 1 |
| `strokeOpacity` / `innerOpacity` prop | 1 / 1 | 1 / 1 | 1.2 / 0.85 | 1.2 / 0.85 | 1 / 1 | 1 / 1 |

Read them at runtime with `resolveVoiceDefaults(type, theme)` and `resolveVoiceStyle(type, theme)`.

### Public props with no Studio knob

| Prop | Type | Default | Effect |
|---|---|---|---|
| `stream` (free) | `MediaStream \| null` | `null` | See wiring above. |
| `level` (free) | `number \| () => number` | `0` | See wiring above. |
| `theme` | adds `"auto"` | `"dark"` | Follows `prefers-color-scheme` live. |
| `active` | `boolean` | `true` | `false` fades out (0.5 s) and stops the analysis; `true` fades in (0.6 s). |
| `onActivate` / `onDeactivate` | `() => void` | | Fade-in / fade-out finished. |
| `onLevel` | `(level: number) => void` | | Every frame, smoothed level 0-1. Do not set React state from it each call. |
| `css` | `string` | | Extra CSS after the generated stylesheet; `{id}` is substituted. This is the Studio's core. |
| `className`, `style`, other `div` attributes | | | On the wrapper. |

Wrapper attributes for styling the host: `data-voice-beam="{id}"`, `data-voice-type`, `data-active`, `data-fading`, `data-paused` (also set while offscreen), `data-listening` (a stream is attached), `data-voice-warp="off"` (distortion dropped while the glow is gathered).

## Studio → code mapping

The Studio's Usage snippet lists only non-default props, in this order: the source prop, `type`, `sensitivity`, `threshold`, `attack`, `release`, `breatheDuration`, `motion={processing}` (with the hook's import and `const processing = useVoiceProcessing(isThinking, { … })` above, tuning only where it differs from the type's), `bands={false}`, `colorVariant`, `colors`, `bandColors`, `theme="light"`, `strength`, `borderRadius`, then the geometry props (`scale`, `glowSize`, `idle`, `reach`, `spread`, `flow`, `bend`, `bandStrength`, `bandWidth`, `bandPosition`, `bandCurve`, `bandSpread`, `bandSkew`, `bandOffset`, `bandTail`, `bandTailPosition`, `bandTailCurve`, `bandTailOverflow`, `bandAberration`, `distortion`, `distortionDetail`, `glowWidth`, `glowHeight`, `lobeSpacing`, `rangeWidth`, `rangeHeight`, `softness`, `coreSize`, `coreLight`, `coreLightWidth`, `coreLightHeight`, `strokeScale`, `innerScale`, `innerHeight`, `bloomScale`, `bloomHeight`), `brightness`, `saturation`, `hueRange`, `hueDuration`, `staticColors`, `paused`, `css={voiceCss}`, `style={{ ... }}`. Numbers are rounded to 3 decimals. "Default" means the current type and theme's preset.

Example export (Pill, Microphone, Ocean, tuned):

```tsx
import { VoiceBeam, useMicrophone } from 'voice-glow';

const mic = useMicrophone();

<VoiceBeam
  stream={mic.stream}
  type="pill"
  sensitivity={3.6}
  colorVariant="ocean"
  reach={1.6}
  style={{ '--voice-bloom-opacity': 1.3 }}
>
  <RecordingPill />
</VoiceBeam>

<button onClick={mic.start}>Listen</button>
```

The Studio's Copy prompt wraps that snippet: "Add the Voice effect from Libraries.dev to my React app", the install line, the snippet, "Keep the prop values exactly as given; adapt only the child content to my app", React 18+, and the docs link.

Name differences (Studio label, agent spec param, code):

| Studio label | Agent param | Code |
|---|---|---|
| Color theme | `colorVariant` | `colorVariant` |
| Idle presence | `idle` | `idle` |
| Breathe | `breathe` | `breatheDuration` |
| Size | `glowSize` | `glowSize` |
| Strength (%) | `strength` (0-100) | `strength={value / 100}` |
| Corner radius | `radius` | `borderRadius` |
| Band height | `bandPosition` | `bandPosition` |
| Curve / Spread / Skew (Bend & band) | not in agent spec | `bandCurve` / `bandSpread` / `bandSkew` |
| Tail lift / position / curve / overflow | not in agent spec | `bandTail` / `bandTailPosition` / `bandTailCurve` / `bandTailOverflow` |
| Line offset | not in agent spec | `bandOffset` |
| Aberration | `bandAberration` | `bandAberration` |
| Distortion detail | not in agent spec | `distortionDetail` |
| Core | `coreSize` | `coreSize` |
| Epicentre | `coreLight` | `coreLight` |
| Lobe width / height / spacing, Range width / height, Stroke / Inner / Bloom size, Inner / Bloom height, Epicentre width / height | not in agent spec | `glowWidth` / `glowHeight` / `lobeSpacing` / `rangeWidth` / `rangeHeight` / `strokeScale` / `innerScale` / `bloomScale` / `innerHeight` / `bloomHeight` / `coreLightWidth` / `coreLightHeight` |
| Stroke / Inner glow / Bloom (styling) | `strokeOpacity` / `innerOpacity` / `bloomOpacity` | `style` vars `--voice-stroke-opacity` / `--voice-inner-opacity` / `--voice-bloom-opacity` |
| Hue speed | `hueDuration` | `hueDuration` |
| Hue shift | `hueShift` | `style={{ '--voice-hue-base': '20deg' }}` |
| Pass duration / Held level / Travel / Turn ease / Corner follow | `processingDuration` / `processingLevel` / `processingTravel` / `processingCurve` / `cornerFollow` | hook options `duration` / `level` / `travel` / `curve` / `cornerFollow` |
| Morph | not in agent spec | hook option `ease` |
| Bands toggle | not in agent spec | `bands` |
| Colour swatches | not in agent spec | `colors`, `bandColors` |
| Agent core | `core` (CSS) | `css={voiceCss}` |

Mapping notes:

- **Opacity knobs become CSS variables.** They multiply on top of the prop of the same name, which the pill preset sets to 1.2 (stroke) and 0.85 (inner). Studio Stroke 1.5 on a pill equals `strokeOpacity={1.8}`. React's `CSSProperties` type does not accept custom properties, so in TypeScript write `style={{ '--voice-bloom-opacity': 1.3 } as React.CSSProperties}`, or use the prop form.
- **Hue shift replaces the theme's base.** `--voice-hue-base` overrides the light theme's own 5deg rather than adding to it. The Studio omits it at 0 and whenever Static colors is on.
- **Mobile stage crop.** The Studio stage wraps a 0.68 crop of a 402x874 phone and passes `scale x 0.68` and `radius x 0.68` to the live beam. The snippet keeps the full-size values, which are right for a real phone-sized host.
- **`borderRadius`** is emitted only when it differs from the Studio mock's radius (20 / 106 / 66). Without it the library reads the child's radius, which is usually what you want.
- **Agent spec relevance.** The agent only sees `breathe` when `idle > 0`, the hue params when `staticColors` is false, and the processing params while the Processing source is selected.

## Core customization

The agent spec's `core` param (`kind: "code"`, `lang: "css"`) is the `css` prop. It is appended after the library's generated stylesheet for the instance, so it can override any rule or add new ones. An empty string restores the stock effect.

### Contract

- **Placeholder.** Write `{id}` wherever the instance id belongs. The component substitutes it per instance (`extraCss.split('{id}').join(id)`).
- **Root.** `[data-voice-beam="{id}"]`: `position: relative`, `overflow: hidden`, the border radius. It carries `[data-active]` while on and `[data-fading]` while leaving. Stock layer rules are gated on those two, so write overrides with the same selectors (equal specificity, and yours come later).
- **Layers, bottom to top.**
  - `::after`: the 1px edge stroke (z-index 2, full resolution).
  - `::before`: the soft inner light (z-index 1).
  - `[data-voice-beam-bloom]`: the blurred halo (z-index 3).
  - `[data-voice-beam-warp="inner"]` and `[data-voice-beam-warp="bloom"]`: distorted copies below the band line. They only exist when `distortion > 0`.
  - `[data-voice-beam-band]` and `[data-voice-beam-band-halo]`: canvases the driver paints the band on (z-index 4). The halo canvas only exists where the 2D context has no `filter` (WebKit). Style them; do not try to draw them.
  - `[data-voice-beam-core]`: the epicentre wash (z-index 4). Only exists when `coreLight > 0`.
- **Driver variables.** Written on the root every frame, all suffixed `-{id}`. Read them as `var(--vb-level-{id})`.

  | Variable | Meaning |
  |---|---|
  | `--vb-level` | Shaped, smoothed voice level, 0-1 (no idle, no processing hold). |
  | `--vb-glow` | Presence: `0.15 + 0.85 x eff`, where eff includes the idle breath and the processing hold. |
  | `--vb-h`, `--vb-w` | Height and width multipliers: `0.5 + reach x eff` and `0.85 + spread x eff` (wider mid-sweep while processing). |
  | `--vb-x0` ... `--vb-x6` | Each lobe's px offset along the flow. |
  | `--vb-l0` ... `--vb-l6` | Each lobe's amplitude (band lift 0.6-1.3 x edge envelope). |
  | `--vb-y0` ... `--vb-y6` | Each lobe's px lift along the corner arcs while processing (negative is up). |
  | `--vb-bh`, `--vb-bendA` | The bend's extra px height at the centre, and its 0-1 strength. |
  | `--vb-cx`, `--vb-cy`, `--vb-mw` | Beam centre px offset, its corner lift, and the range width multiplier (1 at rest, down to 0.55 processing). |
  | `--vb-hue` | Hue drift in deg. |
  | `--vb-clip-above`, `--vb-clip-below` | Polygons either side of the band line (plus `-z-` variants at half scale). |
  | `--vb-opacity` | The fade, registered with `@property` (0 to 1). |
  | `--vb-z` | 0.5 on the half-resolution layers, 1 elsewhere. |

  Host hooks with fallback 1: `--voice-strength` (set inline from `strength`), `--voice-stroke-opacity`, `--voice-inner-opacity`, `--voice-bloom-opacity`, `--voice-band-opacity`, `--voice-core-light-opacity`, and `--voice-hue-base` (a deg value).
- **Must.** Keep every layer `pointer-events: none`, inside the root, at z-index 1-4 (content that must stay above sits at 5). Keep reading the driver variables, or the glow goes static. Plain CSS only.
- **Must not.** No `url()` (so no references to the inline SVG filter either), no `@import`, `expression(`, `behavior:`, `-moz-binding`, or `<script`. Max 24,000 characters. The Studio parses it with `CSSStyleSheet.replaceSync` (with `{id}` replaced) and rejects it if it does not parse or yields no rules.
- **Cost.** Blur and large filters on a layer that covers the whole box are what make this expensive on a phone. Prefer gradients and transforms.
- **Half-resolution layers.** `::before`, the warp mirrors, the bloom and the core are rendered at 50% width and height with `transform: translateZ(0) scale(2)` and `transform-origin: 0 0` (the wrapper has `data-voice-halfres`). On those layers, do not override `transform`, `inset`, `width` or `height`, and multiply every px length by `var(--vb-z-{id}, 1)`. `::after` is full resolution and safe to restyle freely.
- **Mirrors.** With `distortion > 0` the warp mirrors repeat the `::before` and bloom backgrounds below the band line. Override both, or set `distortion={0}`.

### Stock shape

The generated stylesheet, in order: an `@property --vb-opacity-{id}` registration; the root rule with every driver variable's resting value; fade-in / fade-out animations on `[data-active]` / `[data-fading]`; `::after` (7 radial-gradient lobes plus a white core highlight, masked to the edge ring and a centred ellipse that grows with `--vb-bh`, filtered by `hue-rotate(calc(var(--voice-hue-base) + var(--vb-hue)))`, brightness and saturate); `::before` (the same lobes at 0.46 alpha with corner fades and an inset shadow); the bloom (lobes at 0.9 alpha, `blur(10px x glowSize)`); the warp mirrors; the epicentre; the band canvases; the half-resolution block; the fade keyframes; `animation-play-state: paused` under `[data-paused]`. In the Studio, the Agent tab starts from this live stylesheet with the id swapped for `{id}`. In your app, the stock sheet is the `<style>` element rendered just before the wrapper.

### Example 1: a level bar instead of the edge stroke

Replaces the ringed stroke with a 2px gradient bar that grows from the centre with the glow and follows the processing sweep. Hides the band.

```tsx
const levelBar = `
[data-voice-beam="{id}"][data-active]::after,
[data-voice-beam="{id}"][data-fading]::after {
  inset: auto 0 0 0;
  height: 2px;
  padding: 0;
  border-radius: 1px;
  clip-path: none;
  -webkit-mask: none;
  mask: none;
  background: linear-gradient(90deg, transparent, #7ec4ff 25%, #b428e6 50%, #ff7ab6 75%, transparent);
  transform: translateX(calc(var(--vb-cx-{id}) * var(--vb-w-{id}))) scaleX(var(--vb-glow-{id}));
  transform-origin: 50% 100%;
}
[data-voice-beam="{id}"][data-active] [data-voice-beam-band],
[data-voice-beam="{id}"][data-fading] [data-voice-beam-band],
[data-voice-beam="{id}"][data-active] [data-voice-beam-band-halo],
[data-voice-beam="{id}"][data-fading] [data-voice-beam-band-halo] {
  display: none;
}
`;

<VoiceBeam stream={mic.stream} css={levelBar}>
  <ChatInput />
</VoiceBeam>
```

The stock opacity rule on `::after` still applies (fade, presence, strength), and so does its hue filter.

### Example 2: a single-colour haze for the bloom

Swaps the bloom's seven lobes for one violet-to-cyan haze that grows with the voice. Both the bloom and its warp mirror are overridden, and every px length rides `--vb-z`.

```tsx
const haze = `
[data-voice-beam="{id}"] [data-voice-beam-bloom],
[data-voice-beam="{id}"] [data-voice-beam-warp="bloom"] {
  background: radial-gradient(
    ellipse calc(220px * var(--vb-w-{id}) * var(--vb-z-{id}, 1))
            calc((90px * var(--vb-h-{id}) + var(--vb-bh-{id})) * var(--vb-z-{id}, 1))
      at calc(50% + var(--vb-cx-{id}) * var(--vb-w-{id}) * var(--vb-z-{id}, 1)) 100%,
    rgba(120, 90, 255, 0.9),
    rgba(60, 190, 255, 0.45) 45%,
    transparent 75%
  );
}
`;

<VoiceBeam stream={mic.stream} staticColors css={haze}>
  <ChatInput />
</VoiceBeam>
```

The stock mask (a centred ellipse) and blur still shape it. `staticColors` keeps the hue drift from rotating the haze.

## Recipes

Recording pill in ocean.
Use when: a small recording chip beside a send button.

```tsx
<VoiceBeam type="pill" stream={mic.stream} colorVariant="ocean">
  <RecordingPill />
</VoiceBeam>
```

Brand colours on a light composer.
Use when: the app is light and the glow must match brand tokens.

```tsx
<VoiceBeam
  stream={mic.stream}
  theme="light"
  colors={['#5b5bf7', '#22c3ee', '#a855f7', '#ec4899', '#f59e0b', '#6366f1', '#14b8a6']}
  bandColors={{ core: '#5b5bf7', above: '#ec4899', mid: '#22c3ee', below: '#14b8a6' }}
>
  <ChatInput />
</VoiceBeam>
```

Calm and considered.
Use when: enterprise or health UI where the glow should breathe, not dance.

```tsx
<VoiceBeam
  stream={mic.stream}
  colorVariant="mono"
  attack={0.2}
  release={1.2}
  flow={0}
  bend={30}
  distortion={0}
  idle={0.1}
>
  <ChatInput />
</VoiceBeam>
```

Noisy room or distant mic.
Use when: the glow twitches on background noise, or barely moves for a quiet speaker.

```tsx
<VoiceBeam stream={mic.stream} sensitivity={4} threshold={0.05} release={0.6}>
  <ChatInput />
</VoiceBeam>
```

Phone performance mode.
Use when: a full-screen mobile voice view must hold 60 fps on mid-range phones.

```tsx
<VoiceBeam type="mobile" stream={mic.stream} distortion={0} glowSize={0.8} bandAberration={0.4}>
  <VoiceScreen />
</VoiceBeam>
```

Patient processing sweep.
Use when: transcription or reasoning takes seconds and the sweep should feel unhurried.

```tsx
const processing = useVoiceProcessing(thinking, { duration: 1.6, level: 0.7, travel: 2, curve: 3, ease: 0.9 });

<VoiceBeam stream={listening ? mic.stream : null} motion={processing}>
  <ChatInput />
</VoiceBeam>
```

A big hero card.
Use when: a landing or onboarding card much larger than a chat input.

```tsx
<VoiceBeam level={() => demo.current} scale={1.6} reach={1.6} bend={70} rangeWidth={1.1}>
  <HeroCard />
</VoiceBeam>
```

A "listening" label that follows the voice without re-renders.
Use when: other UI should react to the same level.

```tsx
const labelRef = useRef<HTMLSpanElement>(null);

<>
  <VoiceBeam
    stream={mic.stream}
    onLevel={(l) => {
      if (labelRef.current) labelRef.current.style.opacity = String(0.4 + 0.6 * l);
    }}
  >
    <ChatInput />
  </VoiceBeam>
  <span ref={labelRef} role="status">Listening</span>
</>
```

CSS alternative with no JS: the wrapper carries `--vb-level-{id}`, but the id is generated per instance, so `onLevel` is the portable hook.

## Accessibility & performance

- Layers are `pointer-events: none`; band canvases are `aria-hidden`; the glow sets no roles or labels. Pair it with a labelled mic button (`aria-pressed`) and a text status (`role="status"`) from `mic.state`.
- `prefers-reduced-motion: reduce` (watched live) stops the idle breath, the flow, the hue drift, the distortion and the processing travel (the beam stays centred). The reaction to sound stays.
- One shared `requestAnimationFrame` loop for all instances, capped at about 60 fps. If frame gaps stay above 22 ms for 500 ms it runs every other frame, and probes full rate every 4 s.
- Offscreen (IntersectionObserver, 256px margin) and after `active={false}` fades out, the instance unregisters and its analyser is released. `paused` keeps it registered but reads nothing.
- Soft layers render at half resolution; the band canvas caps its backing store at 2x DPR.
- `distortion` is the costliest setting: an SVG filter that runs in software in Firefox, WebKit and on phones. It is switched off on WebKit for hosts over 60,000 px², and dropped while the glow is gathered (`data-voice-warp="off"`). Set `distortion={0}` for large hosts or low-end targets.
- Large `glowSize`, `bloomScale` and `bloomHeight` grow the blurred area. Several full-screen instances multiply the cost.
- SSR: the markup can differ on the client. Safari renders an extra `[data-voice-beam-band-halo]` canvas, and `theme="auto"` resolves to dark on the server. Mount client-only if hydration warnings appear.

## Common mistakes

- `mic.start()` outside a click, or `autoStart`. Permission and Safari's `AudioContext` both need a gesture. With your own stream, call `getAudioContext()` in the click.
- Driving `level` from React state every frame. Use a getter.
- Expecting `level` or `sensitivity` to interact. `sensitivity` only scales the analysed stream; a stream with an audio track always wins over `level`.
- Wrapping an element without a radius, or several siblings. The wrapper reads the first child's `border-top-left-radius` (16px fallback) and clips with `overflow: hidden`. Menus inside get clipped; portal them.
- Content under the glow. Layers sit at z-index 1-4 above plain children. Put text and controls at `position: relative; z-index: 5`.
- Chat-input geometry on a very different host. Use `type="pill"` or `type="mobile"`, and `scale` for sizes in between. The detail page shrinks the chat input with `scale={Math.min(1, width / 371)}`.
- Setting `colors` before `colorVariant` in the Studio. Changing the variant or theme resets the swatches.
- Pasting the Studio's `style={{ '--voice-...': x }}` into TypeScript without a cast. It fails the `CSSProperties` type check.
- `--voice-hue-base` on light expecting it to add to the theme's 5deg. It replaces it.
- A custom `css` core that overrides `transform` or size on a half-resolution layer, or uses unscaled px there. The layer lands at the wrong size.
- A custom core that ignores the `--vb-*` variables. The effect stops following the voice.
- Leaving the mic open after the voice UI closes. Call `mic.stop()`; the hook only stops tracks on unmount.

## Detecting a fit in a codebase

| Signal to grep for | Suggest |
|---|---|
| `getUserMedia`, `MediaRecorder`, `new AudioContext`, `createAnalyser` | `<VoiceBeam stream={stream}>` on the recording UI. |
| `SpeechRecognition`, `webkitSpeechRecognition`, `isListening`, `isRecording` | Voice composer with `useMicrophone`, `useVoiceProcessing` after. |
| Speech SDKs: `@deepgram`, `assemblyai`, `openai` realtime / `gpt-4o-transcribe`, `whisper`, `elevenlabs`, `@livekit`, `vapi`, `retell` | Glow while listening, `useVoiceProcessing` while transcribing, TTS level while the assistant speaks. |
| Copy: "Listening…", "Recording", "Tap to speak", "Hold to talk", "Transcribing…" | `stream` then `useVoiceProcessing`. |
| A timer chip ("0:07"), `RecordingIndicator`, `RecordButton` | `type="pill"`. |
| Mic icons (`Mic`, `MicOff` from lucide, `MicrophoneIcon`) next to a chat `<textarea>` | Wrap the composer. |
| Waveform visualizers (`wavesurfer`, `react-audio-visualizer`, canvas bar meters) | Replace or pair, driven by the same level getter. |
| `RTCPeerConnection`, `ontrack`, call tiles | `stream={remoteStream}`. |
| Full-screen voice route (`/voice`, `VoiceMode`, `VoiceScreen`) on mobile | `type="mobile"`, `distortion={0}` on low-end targets. |
| Brand tokens in a light theme (`--brand-*`, Tailwind `primary`) | `theme="light"` with `colors` and `bandColors` from the tokens. |
