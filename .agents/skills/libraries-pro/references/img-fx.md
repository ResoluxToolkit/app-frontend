# Image — Pro

A React WebGL loader (npm `img-fx`): a churning pixel-mosaic shader fills a card while an image is generated, then dissolves into the real image. This file covers every Studio control, the package props behind them, and rebuilding the shader.

## When to use

- Placeholder for an AI image generation result (text-to-image, edit, inpaint, avatar, thumbnail, cover art) while the request runs.
- A "Regenerate" or "Variations" flow: the shown image breaks back into cells, churns in colours sampled from it, and the next image dissolves in.
- Grids of generated or slow media where a flat skeleton reads dead. Several cards can share one image pool without showing the same image twice (`excludeSrcs`).
- Hero or marketing cards that loop between sample outputs (`autoReveal`, staggered with `revealInitialDelay`).
- Brand-tinted loaders: re-hue the preset (`colors`) and match the host card (`cardBg`).
- A bespoke generation look (round dots, bars, a new colour field) through a replacement fragment shader.

### When not to use

- Ordinary photo lazy-loading on content pages. A blur-up or plain skeleton is cheaper.
- Text or list loading states. This is a media surface.
- Dozens of simultaneously visible tiles. All cards render through one shared WebGL context, one after another each frame.
- Non-React stacks, unless you are willing to drive the exported engine (`createInstance`, `createReveal`, `createCycle`) by hand.

## Install

```bash
npm install img-fx three
pnpm add img-fx three
yarn add img-fx three
```

```tsx
import { ImageGeneration } from 'img-fx';
```

- React component. Peer dependencies: `react` >= 18, `react-dom` >= 18, `three` >= 0.149.0.
- ESM + CJS with types. Package version at time of writing: 0.5.1.
- No `"use client"` directive in the bundle. In the Next.js App Router, import it from a file that starts with `"use client"`.
- Uses `useLayoutEffect`, WebGL (through three.js), `ResizeObserver`, `IntersectionObserver`, `MutationObserver`. GPU work starts after mount.
- Also exported: `PRESETS`, `IMAGE_FRAGMENT_SHADER`, `setSharedFragmentShader`, `setFrameRate`, `getFrameRate`, `setMaxDpr`, `getMaxDpr`, `parseCssColor`, `samplePaletteFromCanvas`, the engine primitives (`createInstance`, `createReveal`, `createCycle`, `setInstance*`), and the types `ImageGenerationHandle`, `ImageGenerationProps`, `ImageGenerationPreset`, `ImageGenerationTheme`, `ImageGenerationCycleEvent`, `Preset`, `PresetMode`.

## Basic usage

```tsx
import { ImageGeneration } from 'img-fx';

<ImageGeneration
  preset="pixels-organic"
  images={['/img/a.jpg', '/img/b.jpg']}
  autoReveal
>
  <div className="card" style={{ width: 320, height: 320, borderRadius: 20 }} />
</ImageGeneration>
```

The child is the card. The wrapper (`div.image-gen-root`, `inline-block`, `overflow: hidden`) sizes to it and reads its corner radius from the child's computed `border-top-left-radius`. Two canvases sit on top: the shader (`z-index: 1`) and the reveal overlay (`z-index: 2`), both `pointer-events: none`.

## Full option reference

Grouped like the Studio panel (top to bottom). "(free)" marks what the public detail page also exposes.

### Type

| Prop | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| `preset` (free) | `ImageGenerationPreset` | `'pixels-organic'` (Organic), `'pixels-mechanic'` (Mechanic), `'sweep-gradient'` (Gradient Sweep) | `'pixels-organic'` | The whole character. Organic: soft chrome-ridge field (effect "Chromium Flow"). Mechanic: sharper, faster domain-warp field (effect "Nebula") with cell flicker in the reveal. Gradient Sweep: a diagonal band sweeping top-left to bottom-right with per-cell flicker, revealed along the band. All three render as a square-cell mosaic. |

Preset internals (from `PRESETS[name].modes[theme]`, read-only):

| Preset | Theme | Stock `colors` (slots 1-7) | Preset `cardBg` | Baked speed | Flicker | Reveal mask |
| --- | --- | --- | --- | --- | --- | --- |
| pixels-organic | dark | `#0f0f0f #4a4949 #b9b9b9 #0f0f0f #d8d8d8 #0f0f0f #2f2f2f` | `#0f0f0f` | 0.3 | none | shader colour 4 |
| pixels-organic | light | `#e3e3e3 #ffffff #f5f5f5 #f5f5f5 #080808 #f5f5f5 #f5f5f5` | `#f5f5f5` | 0.3 | none | shader colour 4 |
| pixels-mechanic | dark | `#949494 #2d2d2d #333333 #3a3a3a #0b0b0b #060606 #2f2f2f` | `#0f0f0f` | 0.7 | 0.5 | shader colour 4 |
| pixels-mechanic | light | `#e0e0e0 #fdfdfd #f2f2f2 #0a0a0a #dcdcdc #f5f5f5 #f5f5f5` | `#f5f5f5` | 0.55 | 0.5 | shader colour 4 |
| sweep-gradient | dark | `#0f0f0f #0f0f0f #282828 #3a3a3a #525252 #0f0f0f #0f0f0f` | `#0f0f0f` | 2.65 | 0.5 | gradient sweep |
| sweep-gradient | light | `#f5f5f5 #f5f5f5 #ededed #eaeaea #d2d2d2 #f5f5f5 #f5f5f5` | `#f5f5f5` | 2.65 | 0.5 | gradient sweep |

All presets: cell size 0.22 (about 22 cells across a 320px card), gap 0.14, reveal 3 s `easeOutCubic`. The bundled effects only read colour slots 1-5; slots 6-7 are carried but unused by these three presets.

### Effect settings

| Prop | Type | Studio range / step | Default | Effect |
| --- | --- | --- | --- | --- |
| `strength` (free, 0-1 only) | `number` | Studio slider 0-100% step 1, maps to `strength = value / 50`, so 0 to 2 | `1` (Studio 50%) | 0-1: scales the shader canvas opacity; animation unchanged. 1-2: canvas stays opaque and the shader's intensity and highlight are boosted (`intensity * (1 + (strength - 1) * 2.2)`), so 2 is about a 3x push. Clamped to 0..2. |
| `speed` | `number` | Studio 25-300% step 5, maps to `speed = value / 100`, so 0.25 to 3 | `1` | Multiplier on the preset's baked tempo. Scales the whole clock (drift, churn, flicker) together. Values <= 0 fall back to 1. |
| `pixelScale` | `number` | 0.5-2 step 0.05 | `1` | Cell size multiplier. 0.5 = finer grid, 2 = chunkier. The reveal's pixel dissolve follows the same grid. The grid keeps at least 2 cells per axis. Values <= 0 fall back to 1. |

Cell size is in CSS pixels, not relative to the card: a bigger card gets more cells of the same size. Cells stay square on any aspect ratio.

### Palette

The Studio's "Palette" tabs are not a prop. They produce a `colors` array.

| Prop | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| `colors` | `(string \| null \| undefined)[]` | Up to 7 CSS colours, one per shader slot | preset palette | A string replaces that slot; `null` / `undefined` keeps the preset colour. Any CSS colour string (hex, `rgb()`, `hsl()`, names). |

Studio palette options: Preset, Ocean, Ember, Mono. "Preset" emits no `colors`. The others re-hue each slot: hue and saturation are fixed per palette, lightness is kept per slot, and any slot whose luminance is within 0.08 of the preset's own `cardBg` is emitted as `null` (it stays the card surface).

| Palette | Hue | Saturation |
| --- | --- | --- |
| Ocean | 205 | 0.62 |
| Ember | 20 | 0.72 |
| Mono | 0 | 0 |

Exact arrays the Studio exports (computed from the stock palettes above). They are theme-specific: use the one matching the theme the card renders in.

| Preset / theme | Ocean | Ember | Mono |
| --- | --- | --- | --- |
| pixels-organic dark | `[null, '#1c5177', '#8ec0e4', null, '#c0dcf0', null, '#12344c']` | `[null, '#7e3815', '#eba887', null, '#f4cfbc', null, '#51240d']` | `[null, '#494949', '#b9b9b9', null, '#d8d8d8', null, '#2f2f2f']` |
| pixels-organic light | `[null, null, null, null, '#03090d', null, null]` | `[null, null, null, null, '#0e0602', null, null]` | `[null, null, null, null, '#080808', null, null]` |
| pixels-mechanic dark | `['#529fd6', '#113249', '#133853', '#16405e', null, null, '#12344c']` | `['#e17a47', '#4d220d', '#58270e', '#642c10', null, null, '#51240d']` | `['#949494', '#2d2d2d', '#333333', '#3a3a3a', null, null, '#2f2f2f']` |
| pixels-mechanic light | `['#cde3f3', null, null, '#040b10', '#c6e0f2', null, null]` | `['#f6d9ca', null, null, '#110803', '#f5d4c3', null, null]` | `['#e0e0e0', null, null, '#0a0a0a', '#dcdcdc', null, null]` |
| sweep-gradient dark | `[null, null, '#0f2c41', '#16405e', '#1f5a85', null, null]` | `[null, null, '#451e0b', '#642c10', '#8d3e17', null, null]` | `[null, null, '#282828', '#3a3a3a', '#525252', null, null]` |
| sweep-gradient light | `[null, null, null, null, '#b6d7ee', null, null]` | `[null, null, null, null, '#f2c7b2', null, null]` | `[null, null, null, null, '#d2d2d2', null, null]` |

The bundled palettes are already grey, so Mono is effectively the preset palette. On the light presets only the one or two ink slots change, so Ocean and Ember read as a faint tint there.

### Card background

| Prop | Type | Studio values | Default | Effect |
| --- | --- | --- | --- | --- |
| `cardBg` | `string` (any CSS colour) | "Surface (default)" (the Studio stage paints `#242424` dark / `#EEEEEF` light, and exports no prop), Ink `#1b1b24`, Navy `#1a2330`, Plum `#241a2e`, or a custom colour | preset `cardBg` (`#0f0f0f` dark / `#f5f5f5` light) | Painted verbatim as the wrapper's CSS `background` (alpha kept), and parsed to opaque RGB for the shader's `u_cardBg`. Cells whose luminance is close to it fade out, so it shapes the whole tile. Preset colour slots equal to the preset's own `cardBg` follow the override, unless `colors` sets that slot. |

Keep it dark on the dark theme and light on the light theme, or the reveal loses contrast (agent spec guidance).

### Stage toolbar (actions)

Through `ref` (`ImageGenerationHandle`):

| Method | Studio control | Behaviour |
| --- | --- | --- |
| `triggerReveal(opts?: { hold?: 'auto' \| 'manual' })` (free) | "Reveal image" (`hold: 'manual'`) | `'auto'` (default): reveal, hold `revealHoldMs`, hide. `'manual'`: stays until `triggerHide()`. No-op while a reveal is running or with no images. |
| `triggerHide()` (free) | "Hide image" | Fades the image back to the shader. No-op if nothing is shown. |
| `triggerRegenerate(opts?: { durationMs?: number; tintFromImage?: boolean; autoReveal?: boolean })` (free, `durationMs` only) | "Regenerate" (`durationMs: 3000`) | Only while an image is revealed. The image breaks into cells and churns for `durationMs` (default 4000), then the next image dissolves in and is held. `tintFromImage` (default `true`) recolours the churn from the outgoing image. `autoReveal: false` churns until you call `triggerReveal()` or `triggerHide()`. A `sweep-gradient` card switches to a random pixel preset for the churn and restores itself when the new image is visible. Ignored while `paused`. |
| `isImageActive()` (free) | label of the toggle | `true` in `reveal`, `visible` or `hide`. |
| `element` | none | The wrapper `<div>`. |

| Prop | Type | Default | Studio control |
| --- | --- | --- | --- |
| `paused` (free) | `boolean` | `false` | Play / Pause. Freezes the shader and the scheduler. Prop edits still repaint a paused card once. |

### Theme

| Prop | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| `theme` | `ImageGenerationTheme` | `'auto'`, `'dark'`, `'light'` | `'auto'` | Picks the preset's dark or light block. `'auto'` checks, in order: `<html data-theme="dark\|light">`, `<html class="dark">` / `"light"`, `color-scheme` on `<html>`, `prefers-color-scheme`, then falls back to `'dark'` (also on the server). It re-resolves live on OS changes and on `class` / `style` / `data-theme` mutations of `<html>`. |

The Studio has no theme control. It passes its own light/dark theme to the stage, and computes palettes and the default card surface for that theme. Saved Studio presets store one value set per theme.

### Package props the Studio does not show

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `images` (free) | `string \| string[]` | `[]` | Reveal pool. Random pick per cycle, never the previous one. Live-updatable. |
| `autoReveal` (free) | `boolean` | `false` | Auto loop: idle, reveal, hold, hide, repeat. |
| `revealDelayRange` | `[number, number]` seconds | `[2, 4]` | Random idle time between reveals. |
| `revealInitialDelay` | `number \| [number, number]` seconds | random 0-1.5 s jitter | One-time delay before the first reveal. A range is randomised once at mount. |
| `revealHoldMs` | `number \| [number, number]` ms | `2000` | How long the image stays after revealing. A range is re-rolled each cycle. |
| `revealFadeOutMs` | `number` ms | `300` | Cross-fade back to the shader. |
| `borderRadius` | `number` px | read from child | One radius for all four corners. |
| `fragmentShader` | `string` (GLSL) | bundled shader | Replacement fragment shader. See Core customization. Page-wide while set. |
| `onCycle` | `(e: { phase: 'idle' \| 'reveal' \| 'visible' \| 'hide'; src: string \| null }) => void` | none | Fires on each phase change. |
| `excludeSrcs` | `() => string[] \| Set<string> \| null \| undefined` | none | Called before each pick; returned srcs are skipped this round. Falls back to a normal pick if everything is excluded. |
| `className`, `style`, any `div` attribute | | | Forwarded to the wrapper. `style` merges over the computed `background`. |

Global engine settings (affect every card on the page):

| Function | Range | Default | Effect |
| --- | --- | --- | --- |
| `setFrameRate(fps)` | clamped 1-60 | 10 | Render tick cap. |
| `setMaxDpr(dpr)` | clamped 1-4 | 1.25 | Device-pixel-ratio cap of the GL canvas. Fragment cost grows with its square. |
| `setSharedFragmentShader(src \| null)` | GLSL or `null` | bundled | Same as the `fragmentShader` prop, without React. |

## Studio → code mapping

The Studio snippet builder emits exactly this shape. A line appears only when its control is off its default:

```tsx
import { ImageGeneration } from 'img-fx';

<ImageGeneration
  preset="pixels-mechanic"
  strength={1.4}
  speed={0.75}
  pixelScale={1.5}
  cardBg="#1a2330"
  colors={['#529fd6', '#113249', '#133853', '#16405e', null, null, '#12344c']}
  images={['/images/gen-1.jpg', '/images/gen-2.jpg']}
>
  <div style={{ width: 200, height: 200, borderRadius: 20 }} />
</ImageGeneration>
```

| Studio / agent param | Studio value | Prop in code | Conversion | Omitted when |
| --- | --- | --- | --- | --- |
| `preset` (label "Type") | enum | `preset` | same | never |
| `strength` | 0-100 | `strength` | `value / 50`, rounded to 3 decimals | 50 |
| `speed` | 25-300 | `speed` | `value / 100` | 100 |
| `pixelScale` | 0.5-2 | `pixelScale` | same | 1 |
| `cardBg` (label "Card background") | `"default"` or a colour | `cardBg` | same string | `"default"` |
| `palette` | `preset \| ocean \| ember \| mono` | `colors` | re-hue per current theme (tables above); `null` slots are written as bare `null` | `preset` |
| `paused` | boolean | not exported | | always |
| `core` | GLSL string | `fragmentShader` | prelude + core, see below | empty |

The detail page's free slider is different: 0-100% there maps to `strength = value / 100` (0-1), and 100% is the default.

With a rebuilt core, the export moves the shader above the JSX:

```tsx
import { ImageGeneration, IMAGE_FRAGMENT_SHADER } from 'img-fx';

// The bundled prelude (uniforms, noise, palette, computeEffect) plus a rebuilt mosaic stage.
const prelude = IMAGE_FRAGMENT_SHADER.slice(0, IMAGE_FRAGMENT_SHADER.indexOf('void main()'));
const imageShader = prelude + `void main() { /* ...core... */ }`;

<ImageGeneration
  fragmentShader={imageShader}
  preset="pixels-organic"
  images={['/images/gen-1.jpg', '/images/gen-2.jpg']}
>
  <div style={{ width: 200, height: 200, borderRadius: 20 }} />
</ImageGeneration>
```

The Studio's "Copy prompt" hands over: install line (`npm install img-fx`), the live snippet, "Keep the prop values exactly as given; adapt only the child content to my app.", and the docs link `https://libraries.dev/image.html`. When porting a Studio snippet, keep its values, add `three` to the install, and pin `theme` if it includes `colors` (see Common mistakes).

## Core customization

The agent spec has a `core` param (`kind: "code"`, `lang: "glsl"`). It replaces the mosaic stage of the fragment shader: everything from `void main()` on. It ships as the `fragmentShader` prop.

### Contract

- The stock shader (`IMAGE_FRAGMENT_SHADER`) has two halves. The prelude: uniforms, noise (`snoise`, `fbm`, `nfbm`), `palette()`, `softBlend()`, `warp()`, `gridCounts()`, and `computeEffect()`, which colours a point for the selected preset. Then `main()`, which lays that colour onto the card as the cell mosaic: grid, cell mask, highlight, edge fade, alpha.
- You send only the second half. Your source contains `void main() {`. New helper functions go before it, in your source. It is appended after the stock prelude.
- Every uniform and helper in the prelude is already in scope. Do not redeclare them. Do not reuse their names for new globals.
- GLSL ES 1.00 syntax: `gl_FragColor`, `texture2D`. three.js adds the version line and precision. Do not write `#version` or `precision`.
- Write `gl_FragColor` with alpha multiplied by `u_shaderOpacity`.
- Keep `computeEffect()` as the colour source. A different colour field is a new helper called from `main()` in place of `computeEffect()`.
- Honour `u_dotMode`, `u_cellSize` and `u_gap` so the knobs still act. `u_cellSize` already includes `pixelScale`.
- A different cell shape, mask or layout is a rewrite of `main()`'s mosaic block.

Signatures and inputs in scope:

```glsl
// grid cells per axis for a base count; keeps cells square in CSS px (reference edge 320px)
vec2 gridCounts(float baseCount);            // stock base: 6.0 + u_cellSize * 74.0
vec3 computeEffect(vec2 uv, float aspect, float t, float dist, float soft, float cpx, float shp);
// stock call: computeEffect(sampleUV, aspect, u_time * u_speed, u_distortion, u_softness, u_complexity, u_shape)

uniform vec2 u_resolution;   // this card's size in GL pixels (CSS px * dpr); uv = gl_FragCoord.xy / u_resolution
uniform float u_dpr, u_time; // u_time already includes the speed prop
uniform vec3 u_color1..u_color7, u_cardBg;   // palette (after colors / cardBg overrides), card surface
uniform float u_alpha1..u_alpha7;            // all 1.0 in bundled presets
uniform float u_speed, u_intensity, u_scale, u_direction, u_softness, u_distortion, u_complexity, u_shape, u_flicker;
uniform float u_vignette, u_vigOpacity, u_blur, u_highlight, u_shaderOpacity;
uniform float u_cellSize, u_gap, u_dotSize, u_dotSoftness, u_dotOpacity, u_hlScale, u_fillOpacity, u_edgeFade, u_fadeStr;
uniform float u_dotMode;     // 0 raw field, 1 square cells (all bundled presets), 2 dots
uniform int u_effect, u_sweepEase;
```

`u_intensity` and `u_highlight` carry the strength boost above 1. `u_edgeFade` is in CSS px.

What the stock `main()` does, in order:

1. `uv`, `aspect`, `t = u_time * u_speed`.
2. If `u_dotMode > 0.5`: grid from `gridCounts(6.0 + u_cellSize * 74.0)`, snap `uv` to cell centres.
3. Colour from `computeEffect()`; if `u_blur >= 0.01`, a 5-tap blur (centre 0.4, four neighbours 0.15 at radius `u_blur * 0.02`).
4. Raw mode only: `pow(col, 1.3)`. Edge vignette from `u_vignette * u_vigOpacity`.
5. Cells: square mask with gap `u_gap * 0.35`, a travelling highlight wave (`u_highlight`, `u_hlScale`), edge fade (`u_edgeFade`, `u_fadeStr`), alpha `mix(u_fillOpacity, u_dotOpacity, mask)`, times a fade where the colour's luminance is close to `u_cardBg`.
6. `gl_FragColor = vec4(col, alpha * u_shaderOpacity)`.

What must not break:

- On the pixel presets the reveal re-renders the card with `u_dotMode = 0` and `u_fillOpacity = 0` to sample the raw colour field, and shapes its mask from where that field matches colour slot 4. Keep the raw branch close to stock, or reveals change shape.
- The reveal's pixel dissolve and flicker use a JS-side square grid of `floor(6 + cellSize * 74)` cells. A custom cell layout does not change the dissolve grid.
- `sweep-gradient`'s flicker is computed inside `computeEffect()` on the stock square grid.
- The material is shared: a custom shader applies to every card on the page while any card sets it. It reverts when that card unmounts or drops the prop.
- Compile errors surface from three.js on the next render. The Studio validates with a scratch WebGL2 context first.

### Example 1: round dots

Replaces square cells with anti-aliased circles, transparent between dots. Keeps the stock blur, edge fade and card-contrast fade. Drops the highlight wave.

```glsl
vec3 fxField(vec2 suv, float aspect, float t) {
  vec3 c = computeEffect(suv, aspect, t, u_distortion, u_softness, u_complexity, u_shape);
  if (u_blur < 0.01) return c;
  float r = u_blur * 0.02;
  c *= 0.4;
  c += computeEffect(suv + vec2(r, 0.0), aspect, t, u_distortion, u_softness, u_complexity, u_shape) * 0.15;
  c += computeEffect(suv - vec2(r, 0.0), aspect, t, u_distortion, u_softness, u_complexity, u_shape) * 0.15;
  c += computeEffect(suv + vec2(0.0, r), aspect, t, u_distortion, u_softness, u_complexity, u_shape) * 0.15;
  c += computeEffect(suv - vec2(0.0, r), aspect, t, u_distortion, u_softness, u_complexity, u_shape) * 0.15;
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  float t = u_time * u_speed;
  if (u_dotMode < 0.5) {
    // Raw field: the reveal samples this for its mask, so match stock.
    gl_FragColor = vec4(pow(fxField(uv, aspect, t), vec3(1.3)), u_shaderOpacity);
    return;
  }
  vec2 grid = gridCounts(6.0 + u_cellSize * 74.0);
  vec3 col = fxField((floor(uv * grid) + 0.5) / grid, aspect, t);
  vec2 cellPx = u_resolution / grid;
  float d = length((fract(uv * grid) - 0.5) * cellPx);
  float rad = 0.5 * min(cellPx.x, cellPx.y) * (1.0 - u_gap);
  float mask = 1.0 - smoothstep(rad - 0.75, rad + 0.75, d);
  vec2 css = u_resolution / max(u_dpr, 0.0001);
  vec2 p = uv * css;
  float edge = min(min(p.x, css.x - p.x), min(p.y, css.y - p.y));
  mask *= mix(1.0, smoothstep(0.0, u_edgeFade, edge), u_fadeStr);
  float alpha = u_dotOpacity * mask;
  float bgLum = dot(u_cardBg, vec3(0.299, 0.587, 0.114));
  alpha *= smoothstep(0.0, 0.33, abs(dot(col, vec3(0.299, 0.587, 0.114)) - bgLum));
  gl_FragColor = vec4(col, alpha * u_shaderOpacity);
}
```

### Example 2: text-line bars

Cells three columns wide, like lines of text being written. Some bars drop out and re-roll twice a second (on the stock clock). One `computeEffect()` call per fragment, so it is cheaper than stock (no blur).

```glsl
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  float t = u_time * u_speed;
  if (u_dotMode < 0.5) {
    vec3 raw = computeEffect(uv, aspect, t, u_distortion, u_softness, u_complexity, u_shape);
    gl_FragColor = vec4(pow(raw, vec3(1.3)), u_shaderOpacity);
    return;
  }
  vec2 grid = gridCounts(6.0 + u_cellSize * 74.0);
  grid.x = max(2.0, floor(grid.x / 3.0));
  vec2 cell = floor(uv * grid);
  vec3 col = computeEffect((cell + 0.5) / grid, aspect, t, u_distortion, u_softness, u_complexity, u_shape);
  vec2 cellPx = u_resolution / grid;
  vec2 lp = fract(uv * grid) * cellPx;
  float gapPx = u_gap * 0.35 * cellPx.y;
  float mask = step(gapPx, lp.x) * step(gapPx, cellPx.x - lp.x)
             * step(gapPx, lp.y) * step(gapPx, cellPx.y - lp.y);
  // Wrapped clock keeps the hash stable on mediump GPUs, as the stock shader does.
  float tick = mod(floor(t * 0.5), 1024.0);
  float keep = step(0.2, fract(sin(dot(cell, vec2(127.1, 311.7)) + tick * 17.23) * 43758.5453));
  float alpha = mix(u_fillOpacity, u_dotOpacity, mask) * keep;
  float bgLum = dot(u_cardBg, vec3(0.299, 0.587, 0.114));
  alpha *= smoothstep(0.0, 0.33, abs(dot(col, vec3(0.299, 0.587, 0.114)) - bgLum));
  gl_FragColor = vec4(col, alpha * u_shaderOpacity);
}
```

Shipping either one:

```tsx
import { ImageGeneration, IMAGE_FRAGMENT_SHADER } from 'img-fx';
import dotsCore from './dots-core.glsl?raw'; // or an inline template string

const prelude = IMAGE_FRAGMENT_SHADER.slice(0, IMAGE_FRAGMENT_SHADER.indexOf('void main()'));
const dotsShader = prelude + dotsCore;

<ImageGeneration preset="pixels-organic" fragmentShader={dotsShader} images={images}>
  <div style={{ width: 320, height: 320, borderRadius: 20 }} />
</ImageGeneration>
```

The `?raw` import is a Vite feature. With other bundlers, inline the GLSL as a template string.

## Recipes

Loading flag with a known image. Use when: your app has a boolean such as `generating` or `loading`, and the image URL is already known (or arrives before the flag turns off).

```tsx
import { useEffect, useRef } from 'react';
import { ImageGeneration, type ImageGenerationHandle } from 'img-fx';

function ResultCard({ generating, src }: { generating: boolean; src: string }) {
  const ref = useRef<ImageGenerationHandle>(null);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    // Generating: fade any shown image back to the shader.
    // Done: reveal the image and keep it until the next run.
    if (generating) ref.current?.triggerHide();
    else ref.current?.triggerReveal({ hold: 'manual' });
  }, [generating, src]);
  return (
    <ImageGeneration
      ref={ref}
      images={[src]}
      paused={reduced && generating}
      role="img"
      aria-label={generating ? 'Generating image' : 'Result'}
      aria-busy={generating}
    >
      <div style={{ width: 320, height: 200, borderRadius: 12 }} />
    </ImageGeneration>
  );
}
```

How the calls behave, so this stays correct:

- `triggerReveal()` and `triggerHide()` do nothing while `paused` is true. Pause only while waiting (`reduced && generating`), never for the whole lifetime, or the image never reveals.
- `triggerReveal()` does nothing while a reveal, hold or hide is already running, and with an empty `images` list. `triggerHide()` only acts while an image is revealing or shown.
- Calling them from an effect in the parent is safe on the first render: the component sets itself up in its own effect, which runs before the parent's.

Brand re-hue from any hue. Use when: none of Ocean / Ember / Mono fits the brand. Mirrors the Studio's palette algorithm.

```tsx
import { PRESETS, type PresetName } from 'img-fx';

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function hsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  return '#' + rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
export function rehue(preset: PresetName, theme: 'dark' | 'light', h: number, s: number): (string | null)[] {
  const mode = PRESETS[preset].modes[theme];
  const bg = lum(mode.cardBg);
  return mode.colors.map((c) => (Math.abs(lum(c) - bg) < 0.08 ? null : hsl(h, s, lum(c))));
}

// <ImageGeneration preset="pixels-mechanic" theme="dark" colors={rehue('pixels-mechanic', 'dark', 265, 0.6)} />
```

Ocean on a navy card. Use when: a cool, product-y dark UI.

```tsx
<ImageGeneration
  preset="pixels-organic"
  theme="dark"
  cardBg="#1a2330"
  colors={[null, '#1c5177', '#8ec0e4', null, '#c0dcf0', null, '#12344c']}
  images={images}
>
  <div style={{ width: 320, height: 320, borderRadius: 20 }} />
</ImageGeneration>
```

Theme-aware palette. Use when: the app switches light and dark and you want Ember in both.

```tsx
const EMBER = {
  dark: ['#e17a47', '#4d220d', '#58270e', '#642c10', null, null, '#51240d'],
  light: ['#f6d9ca', null, null, '#110803', '#f5d4c3', null, null],
} as const;

<ImageGeneration preset="pixels-mechanic" theme={appTheme} colors={[...EMBER[appTheme]]} images={images}>
  <div style={{ width: 320, height: 320, borderRadius: 20 }} />
</ImageGeneration>
```

Calm, restrained loader. Use when: a considered, premium flow where urgency would feel wrong.

```tsx
<ImageGeneration preset="sweep-gradient" speed={0.5} strength={0.8} cardBg="#1b1b24">
  <div style={{ width: 360, height: 240, borderRadius: 16 }} />
</ImageGeneration>
```

Loud, fast "working hard" state. Use when: a long job should read busy.

```tsx
<ImageGeneration preset="pixels-mechanic" strength={1.6} speed={2} pixelScale={1.5} images={images}>
  <div style={{ width: 320, height: 320, borderRadius: 20 }} />
</ImageGeneration>
```

Fine grain on a large hero. Use when: a card over ~600px wide looks blocky at the stock cell size.

```tsx
<ImageGeneration preset="pixels-organic" pixelScale={0.6} images={samples} autoReveal revealHoldMs={[2500, 4000]}>
  <div style={{ width: 720, height: 405, borderRadius: 24 }} />
</ImageGeneration>
```

Staggered grid sharing one pool. Use when: several showcase cards should never show the same image at once or reveal together.

```tsx
import { useRef } from 'react';
import { ImageGeneration } from 'img-fx';

export function Showcase({ pool }: { pool: string[] }) {
  const showing = useRef(new Map<number, string>());
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <ImageGeneration
          key={i}
          preset={i === 1 ? 'pixels-mechanic' : 'pixels-organic'}
          images={pool}
          autoReveal
          revealInitialDelay={i === 0 ? 0 : [1, 3]}
          excludeSrcs={() => [...showing.current.entries()].filter(([k]) => k !== i).map(([, v]) => v)}
          onCycle={(e) => {
            if (e.phase === 'reveal' && e.src) showing.current.set(i, e.src);
            if (e.phase === 'idle') showing.current.delete(i);
          }}
        >
          <div style={{ width: 240, height: 240, borderRadius: 20 }} />
        </ImageGeneration>
      ))}
    </div>
  );
}
```

Regenerate without auto-advance. Use when: the churn should last until the new image actually exists.

```tsx
// On "Regenerate": churn indefinitely.
ref.current?.triggerRegenerate({ autoReveal: false });
// When the new URL has been added to `images`:
ref.current?.triggerReveal({ hold: 'manual' });
```

## Accessibility & performance

- Both canvases are `aria-hidden="true"`; the wrapper has no role. Add `role="img"` and `aria-label` (for example "Generating image") or `aria-busy` on `<ImageGeneration>`; they are forwarded.
- The revealed image is painted into a canvas, not an `<img>`: no alt text. Provide the description elsewhere if it matters.
- No `prefers-reduced-motion` handling in the package. Pass `paused` from a media query only while waiting (`paused={reduced && generating}`), or `speed={0.5}` if some motion must remain. A paused card ignores `triggerReveal()`, so pausing it for good means the image never appears (see the loading flag recipe).
- One shared `THREE.WebGLRenderer` and WebGL context for all cards. Each card copies its frame into its own 2D canvas with nearest-neighbour scaling.
- 10 fps cap (`setFrameRate`, 1-60). GL DPR cap 1.25 (`setMaxDpr`, 1-4); the visible canvas is capped at DPR 2. Both are global.
- Offscreen cards pause (`IntersectionObserver`, 64px margin). With no active card the loop is cancelled.
- WebGL context loss is handled (loop stops, resumes on restore).
- Images: decoded once per URL and cached across cards, drawn like `object-fit: cover`.
- Cost drivers: the stock shader runs `computeEffect()` five times per fragment when the preset's blur is on (all three bundled presets have blur 1). During a reveal on the two pixel presets (shader-shaped masks), each card is rendered a second time every other frame to sample the raw field. `sweep-gradient` uses an analytic mask and skips this. Larger cards, higher `setMaxDpr` and higher `setFrameRate` scale cost directly.
- `strength` 0-1 is canvas opacity only. 1-2 changes uniforms only. Neither changes cost.

## Common mistakes

- Child without a size. The wrapper is `inline-block` and sizes to the child; a sizeless child renders nothing.
- Forgetting `three`. The Studio's copied prompt says `npm install img-fx`; `three` is a required peer dependency.
- Mixing the two strength scales. Detail page: 100% = `strength={1}`. Studio and agent: 50% = `strength={1}`, 100% = `strength={2}`.
- Using a Studio `colors` array under `theme="auto"`. The arrays are computed for the Studio's theme; on the other theme they hit the other preset block (light presets have light slot colours). Pin `theme` or switch arrays per theme.
- Expecting "Surface (default)" to export a colour. The Studio stage shows `#242424` / `#EEEEEF`, but the snippet omits `cardBg`, so the package uses the preset's `#0f0f0f` / `#f5f5f5`. Set `cardBg` to your real card colour.
- Translucent `cardBg`. The wrapper keeps the alpha, but the shader reasons against the opaque colour. Pass the opaque colour you want contrast computed against.
- Setting `colors` slots 6-7 and expecting a change. The bundled effects read slots 1-5 only.
- Two cards with different `fragmentShader` values. The material is shared; the last one set wins page-wide, and unmounting either reverts to the bundled shader.
- Writing `#version`, `precision`, or redeclaring a prelude uniform in a core. Compile fails on the next render.
- Ignoring `u_dotMode` in a core. The reveal samples the raw field (`u_dotMode = 0`); a core that always draws cells changes the reveal mask.
- `pixelScale` on `sweep-gradient` does change its cells (the agent spec says it barely shows). It is the flicker grid there.
- `triggerRegenerate()` from idle or while paused: no-op. `triggerReveal()` with empty `images`: no-op.
- Cross-origin images without CORS: they reveal, but `tintFromImage` falls back to the preset palette.
- Server rendering on light pages under `theme="auto"`: the server assumes dark. Pin `theme` from your app's theme state, or render client-only.

## Detecting a fit in a codebase

| Signal to grep for | Suggest |
| --- | --- |
| Image generation APIs: `images.generate`, `dall-e`, `gpt-image`, `replicate`, `fal.ai`, `@fal-ai`, `stability`, `flux`, `midjourney` | Wrap the result slot; `triggerReveal({ hold: 'manual' })` when the URL arrives. |
| Copy like "Generating image", "Creating your image", "Rendering…", `isGenerating`, `status === 'generating'` | Generated-image flow; `paused={!isGenerating}` if the card persists. |
| "Regenerate", "Try again", "Variations", "Reroll" next to an image | `triggerRegenerate()`; `autoReveal: false` if the next image is not ready yet. |
| `animate-pulse`, `<Skeleton`, `shimmer`, `aspect-square bg-muted` on image boxes | `sweep-gradient`, `speed` below 1, `cardBg` set to the skeleton's colour. |
| Spinners (`Loader2`, `animate-spin`, `<Spinner`) over an image or canvas area | Replace with the mosaic on the image box. |
| Hero or gallery cycling sample outputs | `autoReveal` + `revealInitialDelay` + `excludeSrcs` across cards. |
| Brand tokens (`--brand`, `primary` in a Tailwind config) on an AI product | Re-hue with `colors` (the `rehue` recipe) and match `cardBg` to the card token. |
| Theme providers (`next-themes`, `data-theme`, `class="dark"`) | Keep `theme="auto"` for stock palettes; pin `theme` when using `colors`. |
| Avatar, thumbnail or cover generators (`generateAvatar`, `generateThumbnail`, `cover-art`) | Generated-image flow sized to that box; `pixelScale` below 1 on small avatars keeps enough cells. |
