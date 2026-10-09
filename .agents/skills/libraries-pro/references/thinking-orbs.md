# Thinking orbs — Pro

`ThinkingOrb` from `thinking-orbs`: a dotted 3D orb on a 2D canvas showing what an AI agent is doing. Nine hand-tuned states, three sizes, ink tint, density, per-state engine knobs, cursor gravity and a replaceable geometry core.

## When to use

### Where it goes

The author's placement rules. Follow them before the general list below.

- **Any loading state**, usually beside a text label ("Thinking…", "Searching the web…"), or on its own where there is no room for text.
- **Not for loading under 2 seconds.** A flash of an orb reads as a glitch; show nothing or the result directly.
- Pick the `state` that names the activity (see the table under Options).

More situations it fits:

- Assistant avatar while a chat reply is being generated (`breathing`, `composing`).
- Inline status next to an agent step or tool call: "Searching the web…", "Running code…" (size 20, or 32 in compact rows).
- Web search, retrieval, lookup (`searching`). Code execution, math, debugging (`solving`). Generic tool work (`working`).
- Voice input while the mic is open (`listening`).
- Connecting services, MCP servers, linking data sources (`connecting`).
- Planning or combining results (`weaving`). Designing or building a layout (`shaping`, optionally holding a circle, triangle or square).
- Brand-coloured status indicators (the `color` tint keeps the depth shading).
- A hero or empty-state orb that reacts to the pointer (cursor gravity, desktop only).
- A bespoke loader shape (cube, spiral, logo outline) that still behaves like the library: theme, tint, pause, offscreen and reduced-motion handling (`frame`).

### When not to use

- Determinate progress. The orb has no progress value.
- Page or route skeletons.
- Large visuals. Sizes are tuned presets (64, 32, 20); CSS upscaling blurs the canvas.
- Dozens of simultaneous animated orbs in a list. Show one per active step.
- Gravity on touch-first products or where you cannot supply a pixel-exact pointer raster.

## Install

```bash
npm install thinking-orbs
pnpm add thinking-orbs
yarn add thinking-orbs
```

```tsx
import { ThinkingOrb } from 'thinking-orbs';
```

- React component rendering a `<canvas>`. Peer dependency `react >= 18`. No other runtime dependencies. ESM + CJS, types included.
- Second entry point `thinking-orbs/engine`: pure geometry, no React, no DOM (`MODE_FRAMES`, `resolvePreset`, `paintFrame`, …) for custom renderers.
- SSR: renders an empty canvas on the server, paints in client effects. No `"use client"` directive in the build; in the Next.js App Router import it from a `"use client"` file.
- Ports (in the repo, not on npm): React Native `thinking-orbs-native` (`packages/thinking-orbs/ports/react-native/thinking-orbs-native`, needs `@shopify/react-native-skia` and `react-native-reanimated`) and SwiftUI `ThinkingOrbsKit` (`packages/thinking-orbs/ports/ios/ThinkingOrbsKit`, iOS 15+). Ports take `state`, `size` (64 / 20), `theme`, `speed`, `paused` only.

## Basic usage

```tsx
import { ThinkingOrb } from 'thinking-orbs';
<ThinkingOrb state="searching" size={64} />
```

React Native:

```bash
npm install thinking-orbs-native @shopify/react-native-skia react-native-reanimated
```

```tsx
import { ThinkingOrb } from 'thinking-orbs-native';
<ThinkingOrb state="searching" size={64} />
```

SwiftUI:

```swift
// Package.swift — or Xcode: File › Add Package Dependencies… › Add Local…
.package(path: "packages/thinking-orbs/ports/ios/ThinkingOrbsKit")
```

```swift
import ThinkingOrbsKit
ThinkingOrb(state: .searching, size: .px64)
```

## Full option reference

Grouped as the Studio panel groups them. "(free)" marks what the libraries.dev detail page also exposes. Studio defaults: state `listening`, size 64, speed 100%, ink `#ededed`, dots 1, dot size 1, gravity off, not paused.

### State and Size (top of panel)

| Prop | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| `state` (free: 7 in tuner) | `OrbState` | `working`, `searching`, `solving`, `listening`, `connecting`, `weaving`, `composing`, `breathing`, `shaping` | `'working'` (Studio starts on `listening`) | Which animation. Each state is its own design. The detail page's tuner locks `weaving` and `shaping`. |
| `size` (free: 64, 20) | `OrbSize` | `64`, `32`, `20` | `64` | CSS px. 64 and 20 are hand-tuned presets with their own counts, radii and speed. 32 is interpolated between them in log space and has had no tuning pass of its own. |

| State | Engine mode | Animation | Preset speed 64 / 32 / 20 |
| --- | --- | --- | --- |
| `working` | `orbits` | particles on tilted orbits | 1.885 / 2.9072 / 3.9 |
| `searching` | `globe` | scan meridian sweeps a dotted globe | 2.015 / 2.3803 / 2.665 |
| `solving` | `rubik` | bands scramble in quarter turns, then solve | 1.82 / 1.8964 / 1.95 |
| `listening` | `wave` | waveform rolls through latitude rings | 4.388 / 4.1512 / 3.998 |
| `connecting` | `web` | constellation wires itself, packets on edges | 3.315 / 5.0104 / 6.63 |
| `weaving` | `braid` | three strands plait around the sphere | 1.625 / 2.2234 / 2.75 |
| `composing` | `ribbon` | undulating multi-band sash | 2.34 / 2.7776 / 3.12 |
| `breathing` | `ring` (ribbon geometry, face-on) | face-on ring slowly morphing | 3.24 / 3.5517 / 3.78 |
| `shaping` | `morph` | outline morphs circle, triangle, square | 2.405 / 2.2057 / 2.08 |

### Motion

| Prop | Type | Studio range / step | Default | Effect |
| --- | --- | --- | --- | --- |
| `speed` | `number` | Studio 25–300 % step 5, emitted as `speed / 100` (0.25–3) | `1` | Multiplier on the preset's baked speed. Below ~0.7 reads calm, above ~1.5 urgent. |
| `paused` (free) | `boolean` | Play / Pause button on the stage | `false` | Freezes on the current frame (one frame is still drawn). |

### Dots

| Prop | Type | Studio range / step | Default | Effect |
| --- | --- | --- | --- | --- |
| `color` | `string` | swatches below, or any hex via the picker | none (grayscale) | Ink tint. Accepts `#rgb`, `#rrggbb`, `rgb()` / `rgba()` only; anything else is ignored silently. Depth shading is kept: on dark the tint fades to black with depth, on light it fades to white. |
| `dots` | `number` | 0.4–2 step 0.05 (label "Dots amount", readout is the dot count) | `1` | Density multiplier on every count knob of the state (grid pairs by square root each, lists linearly). Clamped to a 0.1 floor. |
| `dotSize` | `number` | 0.5–2 step 0.05 | `1` | Radius multiplier on every radius knob, keeping near/far falloff. Clamped to 0.1 floor. |

Ink swatches (Studio `INK_OPTIONS`, agent spec `ink`):

| Name | Hex | Mood (agent spec) |
| --- | --- | --- |
| Ink (default) | `#ededed` | neutral, most restrained. Selecting it emits no `color` (stock grayscale). |
| Sky | `#7cd4ff` | cool, technical |
| Amber | `#ffd28f` | warm |
| Pink | `#ff9ec9` | playful |
| Mint | `#9fe8a8` | fresh, calm |

Dots amount readout at `dots = 1` (Studio's `countDots`), 64 / 32 / 20: working 52 / 22 / 13, searching 319 / 133 / 84, solving 216 / 96 / 48, listening 207 / 96 / 65, connecting 48 / 17 / 9, weaving 101 / 42 / 23, composing 170 / 69 / 48, breathing 132 / 46 / 30, shaping 0 (its outline density is not a fixed count, so the readout shows 0). The readout counts the scaled knobs, not the painted marks (working paints `orbitN × (ghostN + particles)`).

### Cursor gravity

Studio toggle Off / On; the sliders appear when On. Prop: `gravity?: boolean | GravityOptions`. `true` takes the defaults but still needs a sprite set with `setGravitySprite`.

| Option | Studio label | Type | Studio range / step | Package clamp | Default (`GRAVITY_DEFAULTS`) | Effect |
| --- | --- | --- | --- | --- | --- | --- |
| `sprite` (free) | (bundled macOS arrow) | `CursorSprite` | `{ src, width, height, hotX, hotY }` | required | none | Raster of the platform's real pointer. Without it the effect is off. |
| `reach` | Reach | px | 24–240 step 4 | min 1 | 160 | How far outside the orb's edge the pull is felt. |
| `strength` | Tail | px | 0–48 step 1 | 0–64 | 11 | Length of the pointer's tail toward the orb. The pointer never moves. |
| `deform` | Bend | px | 0–24 step 0.5 | 0–32 | 19 | How far the body leans toward the orb; tip stays pinned. |
| `taper` | Taper | number | 1–4 step 0.05 | 1–4 | 1.95 | 1 bends evenly from the tip; higher keeps the tip firm and bends the far end. |
| `curve` | Curve | number | 1–4 step 0.05 | 1–4 | 2.8 | Power on proximity: higher stays whole until close, then grabs. |
| `falloff` | Falloff | px | 2–120 step 2 | 2–200 | 24 | Band across the pointer over which the tail fades from the facing side. |
| `smoothing` | Inertia | 0–1 | 0–1 step 0.05 | 0–1 | 0.3 | Lag of the deformation behind the pointer. Higher reads heavier. |
| `handover` | Handover | 0–1 | 0–1 step 0.05 | 0–1 | 0.6 | How slowly the pull swings to the next orb when the nearest changes. |
| `squash` | Squash | number | 0–3 step 0.05 | 0–3 | 1.2 | Extra bend and tail when the orb lies off the tip's side (up-left), where the pull shortens the body. |
| `blur` | Blur | px | 0–24 step 0.5 | 0–24 | 1 | Progressive blur along the tail. 0 keeps it crisp. |
| `fadeMs` | (not in Studio) | ms | n/a | min 1 | 180 | Enter/leave envelope (~95% settled). |

Gravity module exports (from `thinking-orbs`): `attachGravity(el, options)` returns a detach function (the component calls it for you); `setGravitySprite(sprite | null)` sets the one global sprite; `GRAVITY_DEFAULTS`; `getGravityStatus()` returns `{ orbs, tracking, active, blockedBy }` for debugging; `resetGravity()` clears the fail-safe off switch; `setGravityConfig(patch | null)` / `getGravityConfig()` are a live tuning override that applies to every orb (dev panels only, leave null in production). Types: `GravityOptions`, `CursorSprite`.

### Effect settings (per state)

Shown only for the states listed. Emitted inside `opts`. Defaults come from the resolved preset, so they differ by state and size (64 / 32 / 20). Listening and solving have no effect settings.

| Studio label | Agent param | `opts` key | States | Studio range / step | Default |
| --- | --- | --- | --- | --- | --- |
| Shape | `shape` | `shape` | shaping | `cycle`, `circle`, `triangle`, `square` → key omitted, `0`, `1`, `2` | `cycle` |
| Spread | `spread` | `spread` | shaping, connecting | 0.8–2 step 0.05 | shaping 1.45; connecting 1 |
| Orbit paths | `ghostOpacity` | `ghostA` | working | 0–1 step 0.05 | 0.5 |
| Particles | `particles` | `particles` | working | 1–8 step 1 | 3 |
| Scan speed | `scanSpeed` | `scanMul` | searching | 0.5–8 step 0.1 | 4.08 / 4.2301 / 4.335 |
| Unscanned dots | `scanDim` | `dimBase` | searching | 0.1–1 step 0.05 | 0.45 |
| Link reach | `linkThreshold` | `thr` | connecting | 0.3–1.2 step 0.02 | 0.72 |
| Signals | `signals` | `signals` | connecting | 0–12 step 1 | 7 / 2 / 1 |
| Line width | `lineWidth` | `lineW` | connecting | 0.3–2.5 step 0.1 (px) | 0.8 |
| Turns | `turns` | `turns` | weaving | 1–6 step 0.5 | 3 |
| Wobble | `wobble` | `wobMul` | composing, breathing | 0–2.5 step 0.05 | composing 1; breathing 0.368 / 0.4751 / 0.565 |
| Band width | `bandWidth` | `bandMul` | composing, breathing | 1–6 step 0.1 | composing 3.9 / 4.49 / 4.94; breathing 3.627 / 3.8265 / 3.968 |
| Spin | `spin` | `spin` | composing, breathing | 0–2 step 0.05 | 0 |

Meanings (agent spec): Spread is the figure's footprint. Orbit paths 0 leaves only the particles. Scan speed is the sweep rate relative to the globe's spin. Unscanned dots low fades everything but the sweep. Link reach low is a sparse constellation, high a dense mesh. Signals 0 is a still constellation. Turns: fewer is looser. Wobble 0 is a clean band or ring. Band width narrow reads as a ring, wide as a sash. Spin above 0 sets the band precessing.

`opts` accepts any `ModeOpts` key the current mode reads; unknown keys are ignored. Keys beyond the Studio's (package-only): orbits `orbitN`, `ghostN`, `ghostR`, `partR`, `partRDepth`; globe `latRings`, `lonDensity`, `rBase`, `rDepth`, `rBoost`, `inkFar`, `inkSpan`; rubik `latRings`, `lonDensity`, `moveCount`, `rActive`; wave `rings`, `lonDensity`; web `nodeN`, `nodeR`, `nodeRDepth`; braid `strandN`, `ghostN`; ribbon / ring `lanes`, `segs`, `ghostN`; morph `rDot`, `iconD`; all `rsPow`, `rMin`.

### Theme

| Prop | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| `theme` (free) | `OrbTheme` | `auto`, `dark`, `light` | `auto` | `dark` = light ink for dark backgrounds, `light` = dark ink for light backgrounds. `auto`: ancestor `data-theme="dark|light"` or `.dark` / `.light` class (watched with `MutationObserver`), else `prefers-color-scheme` (live). |

The Studio renders the orb in the Studio stage's own theme (dark or light) and never writes `theme` into the snippet, so exported code runs on `auto`. Studio presets store one value set per theme and apply the side matching the current theme.

### Core and other props

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `frame` | `ModeFrame` `(size, t, opts) => OrbFrame` | stock geometry | Replaces the state's geometry. Studio: Agent tab `core` param. See Core customization. |
| `opts` | `ModeOpts` | none | Raw engine knobs, merged last (after `dots` / `dotSize` scaling). |
| `aria-label` | `string` | per-state label | Overrides the default label. |
| any `<canvas>` prop | | | `className`, `style`, `data-*`, `aria-hidden` pass through. |

### Presets

The Studio has a Presets menu: save the current parameter set under a name, apply, reset to mount-time values. Stored per theme, on the account when signed in, otherwise in `localStorage` (`ldev:studio:presets:orb`). There are no built-in named presets for the orb.

## Studio → code mapping

The Studio's React snippet (`sites/home/src/studio/orb.tsx`) emits props in this order, each only when it differs from default: `state`, `size`, `speed`, `color`, `dots`, `dotSize`, `opts`, `frame`, `gravity`. `theme` and `paused` are never emitted.

```tsx
import { ThinkingOrb } from 'thinking-orbs';
// A raster of the platform's own pointer — see the Gravity docs.
import { macArrow } from './cursors';

<ThinkingOrb state="searching" size={32} speed={1.5} color="#7cd4ff" dots={1.2} dotSize={0.8} opts={{ scanMul: 6, dimBase: 0.25 }} gravity={{ sprite: macArrow, reach: 200, strength: 16 }} />
```

- `gravity` always starts with `sprite: macArrow` and then lists only options that differ from `GRAVITY_DEFAULTS`. `macArrow` is your own module; the Studio's arrow is Apple artwork used on the site only and is not in the package.
- With a rebuilt core the snippet becomes:

```jsx
import { ThinkingOrb, finalizeFrame, makeProj, radiusScale, fibDir, hashD, vnoise, lerp, frac, angleDelta } from 'thinking-orbs';

const h = { finalizeFrame, makeProj, radiusScale, fibDir, hashD, vnoise, lerp, frac, angleDelta };
const frame = (size, t, o) => {
  // the core body
};

<ThinkingOrb state="working" size={64} frame={frame} />
```

This form is untyped JavaScript. In TypeScript annotate it: `const frame: ModeFrame = (size, t, o) => { … }` and type the arrays (`const dots: Dot[] = []`).

- React Native / SwiftUI snippets carry only `state`, `size`, `speed`, `paused`. Size 32 falls back to 64 with the comment `// size 32 is web-only; the ports ship the 64 and 20 presets`.
- The Studio's Copy prompt wraps the live snippet: "Add the Thinking orbs effect from Libraries.dev to my React app", install line, the snippet, "Keep the prop values exactly as given".

Agent param → prop (where names or units differ):

| Agent param (Studio label) | Prop |
| --- | --- |
| `size` (string `"64"` / `"32"` / `"20"`) | `size={64}` (number) |
| `speed` (25–300, percent) | `speed={speed / 100}` |
| `ink` (Color) | `color` (omitted when `#ededed`) |
| `dots` (Dots amount) | `dots` |
| `shape` | `opts.shape` (`circle` 0, `triangle` 1, `square` 2, `cycle` omitted) |
| `ghostOpacity` (Orbit paths) | `opts.ghostA` |
| `scanSpeed` / `scanDim` | `opts.scanMul` / `opts.dimBase` |
| `linkThreshold` (Link reach) / `lineWidth` | `opts.thr` / `opts.lineW` |
| `wobble` / `bandWidth` | `opts.wobMul` / `opts.bandMul` |
| `spread`, `particles`, `signals`, `turns`, `spin` | same name in `opts` |
| `gravity` | `gravity={{ sprite, … }}` or omitted |
| `gravityReach` (Reach) | `reach` |
| `gravityPull` (Tail) | `strength` |
| `gravityBend` (Bend) | `deform` |
| `gravityTaper` / `gravityCurve` / `gravityFalloff` | `taper` / `curve` / `falloff` |
| `gravityInertia` (Inertia) | `smoothing` |
| `gravityHandover` / `gravitySquash` / `gravityBlur` | `handover` / `squash` / `blur` |
| `core` | `frame` |

Studio behaviour worth copying: engine overrides are kept per state (composing and breathing both read `wobMul` with different tuned values), and switching state drops a rebuilt core, since a core belongs to the state it was written for.

## Core customization

`frame` replaces one state's geometry. The library keeps everything else: the preset's speed and resolved `opts`, `dots` / `dotSize` scaling, the painter, theme, tint, pause, offscreen pausing and reduced motion. `state` still matters: it picks the preset speed and the `opts` your frame receives.

### Contract (agent spec `core`, lang `js`)

- Signature: the Studio compiles the BODY of `(size, t, o, h)`. In app code it is `ModeFrame = (size: number, t: number, opts: ModeOpts) => OrbFrame`.
- `size`: canvas size in CSS px (64, 32 or 20). Draw in `0..size` on both axes; centre is `size / 2`.
- `t`: clock in seconds, already multiplied by preset speed × `speed`. Shared across all orbs (`performance.now()`), so it is large; use periodic motion. Under reduced motion the frame is drawn once at `t = 0.6`.
- `o`: the resolved draw options (same keys the stock function reads). Keep honouring them so `dots`, `dotSize` and the Effect settings still work. Read with fallbacks (`o.rBase ?? 0.6`).
- `h`: `finalizeFrame(dots, lines, rMin)`, `makeProj(yaw, tilt, cx, cy, scale)` → `(x, y, z) => [px, py, z]` (projected x/y in px, z unscaled, larger = nearer), `radiusScale(size, pow)` (`(size / 300) ** pow`), `fibDir(i, n)` (unit vector), `hashD(a, b)` (0..1), `vnoise(x, y)`, `lerp(a, b, f)`, `frac(x)`, `angleDelta(a, b)` (wrapped to −π..π). In the Studio the same helpers are also available by bare name.
- Return `h.finalizeFrame(dots, lines, o.rMin)`. Dot: `{ x, y, z, r, white, a? }` in canvas px; `white` 0..1 is ink on paper (0 darkest; mirrored on dark themes, so near dots should have low `white`); `a` optional alpha. Line: `{ x1, y1, x2, y2, white, a?, w }`, `w` in px. `finalizeFrame` drops marks with `a < 0.02`, clamps `r` to `rMin` (0.3 default), and z-sorts far to near. Lines paint before dots.
- Constraints: plain JavaScript, no types, no imports, no DOM or globals, `Math` only, under ~120 lines, start from the stock source. The agent's static check rejects code over 24,000 chars, code without `return`, and any of these words anywhere, comments included, case-insensitive: `import`, `require`, `fetch`, `XMLHttpRequest`, `WebSocket`, `document`, `window`, `globalThis`, `self`, `eval`, `Function` (so also the word "function"), `localStorage`, `sessionStorage`, `indexedDB`, `navigator`, `postMessage`, `setTimeout`, `setInterval`, `Promise`, `async`, `await`, `<script`.
- Browser check: the body is run at `(64, 0.7)` and `(20, 3.3)` with the state's resolved opts. It must return `{ dots, lines }` arrays, not be empty, and every dot's `x, y, z, r, white` must be finite.

### Stock shape

Every built-in mode follows the same pattern (`packages/thinking-orbs/src/engine/*.ts`, readable in `MODE_FRAMES[mode].toString()`):

```js
const cx = size / 2, cy = size / 2;
const R = (size / 2) * 0.82;                       // figure radius
const pt = makeProj(t * 0.12, 0.3, cx, cy, 1);     // spin with t, fixed tilt
const rs = radiusScale(size, o.rsPow ?? 0.6);      // sub-linear dot scaling
const dots = [];
// ...place points in 3D, project, derive depth = (z / R + 1) / 2...
dots.push({ x: px, y: py, z, r: (o.rBase + o.rDepth * depth) * rs, white: 0.55 - 0.45 * depth });
return finalizeFrame(dots, [], o.rMin);
```

### Example 1: `working` as a cube

Particles run the 12 edges of a turning cube; faint edges replace the orbit paths. Honours `ghostN`, `ghostR`, `ghostA` (Orbit paths), `particles`, `partR`, `partRDepth`, `rsPow`, `rMin`.

```js
// working, rebuilt: the particles run the 12 edges of a turning cube
const cx = size / 2;
const cy = size / 2;
const R = (size / 2) * 0.5; // cube half-edge; corners reach 0.87 of the radius
const pt = h.makeProj(t * 0.12, 0.3, cx, cy, R);
const rs = h.radiusScale(size, o.rsPow ?? 0.6);
const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
// the stock ghostN is per orbit; spread a third of it along each edge
const ghostN = Math.max(4, Math.round((o.ghostN ?? 40) / 3));
const particles = o.particles ?? 3;
const dots = [];
for (let e = 0; e < E.length; e++) {
  const A = V[E[e][0]];
  const B = V[E[e][1]];
  const at = (f) => pt(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f);
  for (let k = 0; k <= ghostN; k++) {
    const [x, y, z] = at(k / ghostN);
    const depth = (z / 1.732 + 1) / 2;
    dots.push({ x, y, z, r: (o.ghostR ?? 0.9) * rs, white: 0.72, a: (o.ghostA ?? 0.5) * (0.4 + 0.6 * depth) });
  }
  const dir = h.hashD(e, 3.1) > 0.5 ? 1 : -1;
  for (let m = 0; m < particles; m++) {
    const [x, y, z] = at(h.frac(dir * t * 0.35 + m / particles + h.hashD(e, 7.7)));
    const depth = (z / 1.732 + 1) / 2;
    dots.push({ x, y, z, r: ((o.partR ?? 1.2) + (o.partRDepth ?? 1.6) * depth) * rs, white: 0.3 - 0.22 * depth });
  }
}
return h.finalizeFrame(dots, [], o.rMin);
```

The same body in a TypeScript app:

```tsx
import { ThinkingOrb, finalizeFrame, makeProj, radiusScale, hashD, frac, type Dot, type ModeFrame } from 'thinking-orbs';

const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

// module scope: a stable reference, so the render loop is not restarted every render
const cubeFrame: ModeFrame = (size, t, o) => {
  const R = (size / 2) * 0.5;
  const pt = makeProj(t * 0.12, 0.3, size / 2, size / 2, R);
  const rs = radiusScale(size, o.rsPow ?? 0.6);
  const ghostN = Math.max(4, Math.round((o.ghostN ?? 40) / 3));
  const particles = o.particles ?? 3;
  const dots: Dot[] = [];
  E.forEach(([a, b], e) => {
    const A = V[a];
    const B = V[b];
    const at = (f: number) => pt(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f);
    for (let k = 0; k <= ghostN; k++) {
      const [x, y, z] = at(k / ghostN);
      dots.push({ x, y, z, r: (o.ghostR ?? 0.9) * rs, white: 0.72, a: (o.ghostA ?? 0.5) * (0.4 + 0.6 * ((z / 1.732 + 1) / 2)) });
    }
    const dir = hashD(e, 3.1) > 0.5 ? 1 : -1;
    for (let m = 0; m < particles; m++) {
      const [x, y, z] = at(frac(dir * t * 0.35 + m / particles + hashD(e, 7.7)));
      const depth = (z / 1.732 + 1) / 2;
      dots.push({ x, y, z, r: ((o.partR ?? 1.2) + (o.partRDepth ?? 1.6) * depth) * rs, white: 0.3 - 0.22 * depth });
    }
  });
  return finalizeFrame(dots, [], o.rMin);
};

export const CubeLoader = () => <ThinkingOrb state="working" size={64} frame={cubeFrame} opts={{ ghostA: 0.3 }} />;
```

### Example 2: `searching` on a Fibonacci sphere

Same scan sweep, dots spread evenly instead of in latitude rings (no pole clustering). Honours `latRings` × `lonDensity` (so `dots` still scales it), `rBase`, `rDepth`, `rBoost`, `inkFar`, `inkSpan`, `scanMul` (Scan speed), `dimBase` (Unscanned dots), `rsPow`, `rMin`.

```js
// searching, rebuilt: the same scan sweep over an even Fibonacci sphere
// instead of latitude rings
const spin = 0.5;
const radius = (size / 2) * 0.82;
const tilt = 0.4 + 0.06 * Math.sin(t * 0.35);
const pt = h.makeProj(t * spin, tilt, size / 2, size / 2, radius);
const scan = t * (spin + (1.7 - spin) * (o.scanMul ?? 1));
const rs = h.radiusScale(size, o.rsPow ?? 0.6);
const dimBase = o.dimBase ?? 1;
// keep the density knobs: the stock lattice draws about latRings x lonDensity x 0.64 dots
const n = Math.max(24, Math.round((o.latRings ?? 17) * (o.lonDensity ?? 44) * 0.64));
const dots = [];
for (let i = 0; i < n; i++) {
  const [dx, dy, dz] = h.fibDir(i, n);
  const [x, y, z] = pt(dx, dy, dz);
  const depth = (z + 1) / 2;
  const lon = Math.atan2(dz, dx);
  const d = h.angleDelta(lon + t * spin, scan);
  const boost = Math.exp(-(d * d) / 0.18) * Math.max(0, z);
  dots.push({
    x, y, z,
    r: ((o.rBase ?? 0.6) + (o.rDepth ?? 1.7) * depth + (o.rBoost ?? 1) * boost) * rs,
    white: (o.inkFar ?? 0.62) - (o.inkSpan ?? 0.54) * depth,
    a: dimBase + (1 - dimBase) * Math.min(1, boost),
  });
}
return h.finalizeFrame(dots, [], o.rMin);
```

Both bodies pass the agent's word blocklist and the browser check (finite, non-empty, inside the canvas at 64, 32 and 20).

### Driving your own renderer

```ts
import { resolvePreset, MODE_FRAMES, paintFrame } from 'thinking-orbs/engine';

const { mode, speed, opts } = resolvePreset('searching', 64);

// ctx: a 2D context already scaled to CSS px (setTransform(dpr, 0, 0, dpr, 0, 0))
export function drawOrb(ctx: CanvasRenderingContext2D, dark: boolean) {
  ctx.clearRect(0, 0, 64, 64);
  const frame = MODE_FRAMES[mode](64, (performance.now() / 1000) * speed, opts);
  paintFrame(ctx, frame, dark);
}
```

## Recipes

Brand-tinted assistant avatar. Use when: the orb must carry the product colour on a dark chat surface.

```tsx
<ThinkingOrb state="breathing" size={64} theme="dark" color="#7cd4ff" dotSize={1.15} aria-label="Assistant is thinking" />
```

Urgency by phase. Use when: one orb covers a slow planning phase and a fast execution phase.

```tsx
import { ThinkingOrb } from 'thinking-orbs';

function AgentOrb({ phase }: { phase: 'plan' | 'run' }) {
  return phase === 'plan'
    ? <ThinkingOrb state="weaving" size={64} speed={0.7} opts={{ turns: 2 }} />
    : <ThinkingOrb state="working" size={64} speed={1.6} opts={{ particles: 5 }} />;
}
```

Compact row indicator. Use when: a dense list row (agent runs, jobs) is taller than text but smaller than an avatar.

```tsx
<ThinkingOrb state="solving" size={32} dots={0.7} aria-hidden="true" />
```

Search that reads as a sweep. Use when: the search step should read as "scanning", with the rest of the globe faded.

```tsx
<ThinkingOrb state="searching" size={64} opts={{ scanMul: 6, dimBase: 0.2 }} />
```

Hold a square while building a layout. Use when: a design or layout-generation step runs.

```tsx
<ThinkingOrb state="shaping" size={64} opts={{ shape: 2, spread: 1.6 }} aria-label="Building layout" />
```

Still constellation, dense mesh. Use when: "connected, waiting" after a service links up, or a knowledge-graph step.

```tsx
<ThinkingOrb state="connecting" size={64} color="#9fe8a8" opts={{ signals: 0, thr: 0.95, lineW: 1.2 }} />
```

Calm ring for idle. Use when: the assistant is open but idle and should feel present, not busy.

```tsx
<ThinkingOrb state="breathing" size={64} speed={0.6} opts={{ wobMul: 0.15, bandMul: 2.5 }} />
```

Magnetic hero orb with an opt-out. Use when: a desktop landing or empty state wants the orb to feel physical.

```tsx
import { ThinkingOrb } from 'thinking-orbs';
import { macArrow } from './cursors'; // your own pixel-exact raster of the platform arrow

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform || '');

function HeroOrb({ gravityOn }: { gravityOn: boolean }) {
  return (
    <ThinkingOrb
      state="composing"
      size={64}
      gravity={gravityOn && isMac ? { sprite: macArrow, reach: 200, strength: 16, smoothing: 0.45 } : false}
    />
  );
}
```

## Accessibility & performance

- `role="img"` with per-state `aria-label`: "Working…", "Searching…", "Solving…", "Listening…", "Connecting…", "Weaving…", "Composing…", "Thinking…" (breathing), "Shaping…". Override with `aria-label`, or `aria-hidden="true"` next to visible text. Not a live region; announce status changes with your own `role="status"`.
- Reduced motion: one static frame at `t = 0.6`, live theme still applied. A custom `frame` must look right at that instant.
- Each instance runs its own rAF loop, paused offscreen (`IntersectionObserver`) and on hidden tabs; all share `performance.now()`. DPR capped at 2. Plain 2D arcs and lines only.
- Cost scales with dots: `dots={2}` roughly doubles painted marks. `connecting` checks every node pair per frame, so its cost grows with the square of `nodeN` (41 nodes at 64 by default).
- `color` switches every fill to an `rgba()` string per dot; cost is the same as grayscale.
- Gravity: listens to `pointermove` on `document` only while some orb has gravity on and the device has a fine pointer; its rAF loop runs only while the pointer is within reach (plus fade-out). A frame-time watchdog disables it for the session if it gets slow; any exception also disables it and restores the cursor.
- Gravity hides the OS cursor with a class on `<html>` (`thinking-orb-gravity-hide`, `cursor: none !important`) while the pointer is in a well, and only over elements whose own cursor is the plain arrow. It is off under reduced motion, forced colors, coarse or no-hover pointers, pen or touch input, page zoom, and a DPR change since the sprite was set (reload re-arms). It cannot detect macOS enlarged or recoloured pointers: those users see the stock arrow. Ship a setting to turn it off.

## Common mistakes

- Wrong ink for the background: `auto` reads ancestor `data-theme` / `.dark` / `.light`, then the OS. Pin `theme` on surfaces whose colour differs from the page theme.
- Scaling with CSS instead of `size`. The backing store follows `size`; stay within a few px (the site draws a 64 orb at 56).
- Passing a named colour or `hsl()` to `color`: silently ignored, the orb stays grayscale. Use hex or `rgb()`.
- Passing `color="#ededed"` to mean "default": that tints with #ededed instead of the stock grayscale ramp. Omit `color`.
- Pastel tints on light backgrounds: on `light` the tint is the darkest ink and depth fades toward white, so Sky, Amber, Pink and Mint read faint. Use a deeper hex on light.
- Size 32 in React Native or SwiftUI: the ports only have 64 and 20.
- Copying one state's `opts` to another: keys a mode does not read do nothing, and composing and breathing share `wobMul` / `bandMul` / `spin` with different tuned defaults.
- Overriding count keys in `opts` (`latRings`, `nodeN`…): `opts` lands after `dots` scaling, so `dots` no longer affects those keys.
- An inline `frame={(size, t, o) => …}`: `frame` is a dependency of the render effect, so a new function each render restarts the loop. Define it at module scope or `useMemo` it. (`opts` and `gravity` are compared by content, so inline literals are fine.)
- Custom core that ignores `o`: Dots amount, Dot size and Effect settings stop working. Read the stock keys.
- Custom core containing a blocked word (even "function" in a comment) or no `return`: the Studio agent rejects it.
- Gravity with `true` and no sprite, or a sprite that is not pixel-identical to the OS pointer. The Studio's macOS arrow is not in the package. Gate by platform.
- `setGravityConfig` left on in production: it overrides every orb's options globally.
- Studio snippet with both a core and gravity omits the `macArrow` import line. Add it.

## Detecting a fit in a codebase

| Signal to grep for | Suggest |
| --- | --- |
| Waits under 2 s: optimistic updates, cached or local reads, quick toggles | Nothing. Do not add an orb |
| `Thinking…`, `Thinking...`, `isThinking`, `reasoning` in chat components | `breathing` at 64 in the avatar slot; brand `color` |
| `Loader2` + `animate-spin`, `<Spinner`, `CircularProgress` near chat or agent code | the state naming the activity, 20 inline or 32 in rows |
| `TypingIndicator`, `typing-dots`, bouncing-dots CSS | `composing` |
| `useChat` (`status === 'submitted' \| 'streaming'`), `isLoading`, `isStreaming` | orb while pending; remove on first token or finish |
| `toolInvocations`, `tool-call`, `part.type === 'tool-...'` | map tool name to state (search → `searching`, code → `solving`, other → `working`) |
| `web_search`, `browse`, RAG / vector store calls | `searching`, optionally `scanMul` up |
| MCP client setup, OAuth "Connecting" / "Linking" copy | `connecting`; `signals: 0` once connected |
| `plan`, `Planning` steps in agent traces | `weaving` |
| Design, canvas, layout or slide generation | `shaping`, hold a shape with `opts.shape` |
| `getUserMedia`, `MediaRecorder`, `SpeechRecognition`, mic buttons | `listening`, `paused` when not recording |
| Brand colour tokens (`--brand`, Tailwind `primary`) | `color` with that hex |
| Custom cursor code (`cursor: none`, pointer followers) on a desktop hero | gravity, with a settings opt-out |
| Existing canvas loader drawing a custom shape | a custom `frame` on the closest state |
