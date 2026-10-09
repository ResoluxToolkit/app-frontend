# Gooey (liquid-gooey) — Pro

Liquid UI for React: pieces merge like goo, trail like rubber, bow like soft bodies and melt into each other, with every Studio knob, theme and the rebuildable SVG filter core.

## When to use

- Floating "+" / speed-dial button that blooms into satellite actions, with open and close choreography (`morph`).
- Toolbars, avatar groups and chip clusters that should read as one merged surface (`morph`).
- Slider thumbs, tab and segmented-control indicators that trail and stretch while moving (`move`).
- Dragged cards, sortable rows and dropdown pills that bow with velocity, optionally bending their content (`bend`).
- Two photo cards dragged into each other that fuse, average colour and marble at the seam (`melt`).
- A custom liquid material (gloss, outline, grain, wavy edge) built on the same crisp-content architecture (`filter` core).

### When not to use

- Static layouts where nothing moves or touches.
- Long lists or grids with many groups. Each group is one SVG filter; WebKit rasterises it on the CPU.
- Non-React stacks. There is no vanilla or custom-element build.
- Content whose items must keep opaque backgrounds (the liquid is the surface).

## Install

```bash
npm install liquid-gooey
pnpm add liquid-gooey
yarn add liquid-gooey
```

```tsx
import { Liquid } from 'liquid-gooey'
```

- `Liquid` is the group; `Liquid.Item` is each piece. React only.
- Peer dependencies: `react >=18`, `react-dom >=18`. No runtime dependencies. ESM + CJS + types.
- The dist has no `"use client"` directive. In the Next.js App Router, render `<Liquid>` from a `"use client"` file.
- Other exports: types `LiquidProps`, `LiquidItemProps`, `LiquidEffect`, `MorphTuning`, `MoveTuning`, `BendTuning`, `ImageMeltOptions`, `DissolveOptions`, `EvolveOptions`, `MoveOptions`, `SpringConfig`, `Transition`, `TransitionPreset`, `CornerRadii`; values `IMAGE_MELT_DEFAULTS`, `EVOLVE_DEFAULTS`, `MOVE_DEFAULTS`, `presets`, `easingFunction`.

## Basic usage

```tsx
import { Liquid } from 'liquid-gooey'
<Liquid blur={6} contrast={18} fill="#fff" shadow="0 2px 6px rgba(0,0,0,.08)">
  <Liquid.Item x={open ? -54 : 0} y={open ? -34 : 0} transition="bouncy">
    <button className="round-btn">…</button>
  </Liquid.Item>
  <Liquid.Item x={0} y={open ? -64 : 0} transition="bouncy" delay={40}>
    <button className="round-btn">…</button>
  </Liquid.Item>
</Liquid>
```

Two ways an item moves:

- Mirrored (morph with `x`/`y`/`scale`): the library animates the wrapper and its liquid on one rAF clock. It owns the wrapper's `transform`.
- Observed (`move`, `bend`): you move the child (CSS, pointer events, Framer Motion). The liquid follows the child's rendered rect. The child must be a single element.

`melt` is separate: the two items' DOM stays interactive at `opacity: 0` and an SVG layer paints their images.

## Full option reference

Grouped as in the Studio's Manual control panel. "(free)" marks controls also on the public detail page tuner.

### Effect

| Prop | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| `Liquid.Item effect` (free) | enum | `"morph"`, `"move"`, `"bend"`, `"melt"` | `"morph"` | Picks the behaviour and which knobs exist. |

### Effect settings (morph, move, bend)

Surface knobs are props on `<Liquid>`. Move and bend physics are props on `<Liquid.Item>`.

| Prop | Type | Range / step | Default | Effect |
| --- | --- | --- | --- | --- |
| `Liquid blur` (free) — "Goo blur" | number | 0 to 16, step 0.5 | `6` | Gaussian sigma in px. Pieces bridge when blur is about the size of the gap. |
| `Liquid contrast` (free) — "Contrast" | number | 4 to 40, step 1 | `18` | Alpha-contrast slope. Higher is crisper and beadier. |
| `Liquid waviness` — "Waviness" | number | 0 to 8, step 0.5 | `0` | Max px the boundary undulates (noise displacement). Shadows follow the wavy edge. |
| `move.springiness` — "Springiness" | number | 0 to 1, step 0.05 | Studio `0.5` (lib `0.5`) | How tightly the liquid chases the element. 0 syrupy, 1 near-instant. |
| `move.wobble` — "Wobble" | number | 0 to 1, step 0.05 | Studio `0.5` (lib `0.5`) | Overshoot and wobble on arrival. |
| `move.stretch` — "Stretch" | number | 0 to 1, step 0.02 | Studio `0.6` (lib `0.36`) | Velocity stretch of the drop. 0 is rigid. |
| `move.trail` — "Trail" | number | 0 to 1, step 0.025 | Studio `0.35` (lib `0.575`) | Trailing droplet size. 0 removes the tail. |
| `bend.vertical` — "Vertical bow" | number | 0 to 1, step 0.05 | `0.6` | Vertical drag arcs the long edges; middle leads, ends lag. |
| `bend.horizontal` — "Horizontal caps" | number | 0 to 1, step 0.05 | `0.35` | Horizontal drag reshapes the caps; leading blunts, trailing stretches. |
| "Content bend" (CSS, not a prop) | number | 0 to 1, step 0.05 | `0.3` | Scales how much the card's content follows the bend via the `--lg-bend-*` CSS vars. See Studio → code mapping. |

Move and bend show only their own rows. Morph shows the three surface rows.

### Button fill color (morph, move, bend)

`Liquid fill`: any CSS colour (`var()` works). Studio swatches plus a custom colour picker.

| Swatch | Value | Notes |
| --- | --- | --- |
| Surface (default) | per theme and effect, below | Swatch chip shows `#202020` (dark) or `#ffffff` (light). |
| Light | `#e9e9e9` | |
| Sky | `#7cd4ff` | Cool. |
| Amber | `#ffd28f` | Warm. |
| Custom | any hex | Picker. |

"Surface (default)" resolves to:

| Theme | morph | move | bend | melt |
| --- | --- | --- | --- | --- |
| dark | `#202020` | `#525252` | `#202020` | `#ffffff` |
| light | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` |

Content ink in the Studio demos flips with the fill: luminance `0.299R + 0.587G + 0.114B > 140` gives `#17181c`, otherwise `#fbfbfb`.

### Component animation (morph only)

These are choreography of the plus-menu demo, not library props. They map onto `x`, `y`, `transition`, `delay` and CSS.

| Studio knob | Range / step | Default | Maps to |
| --- | --- | --- | --- |
| Open duration | 80 to 1200 ms, step 10 | `550` | `transition={{ duration, ease }}` while opening |
| Close duration | 80 to 1200 ms, step 10 | `250` | `transition` duration while closing |
| Open stagger | 0 to 200 ms, step 5 | `40` | `delay={i * stagger}` while opening |
| Close stagger | 0 to 200 ms, step 5 | `0` | `delay={i * stagger}` while closing |
| Spread | 0.4 to 2, step 0.05 | `1` | Multiplies each satellite's `x`/`y` offset |
| Anticipation | 0 to 24 px, step 1 | `5` | Dip of the liquid layer and main button on close (CSS keyframe) |
| Anticipation duration | 120 to 1400 ms, step 20 | `700` | Duration of that keyframe |
| Icon fade | 0 to 600 ms, step 10 | `180` | Satellite icon opacity/blur transition when opening |
| Icon delay | 0 to 600 ms, step 10 | `120` | Icon reveal delay, plus `i * stagger` |

Opening easing is fixed to "Bouncy" in the panel; closing always uses "Snappy":

| Name | Curve |
| --- | --- |
| Bouncy | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Smooth | `cubic-bezier(0.3, 1.05, 0.4, 1)` |
| Snappy | `cubic-bezier(0.22, 1, 0.36, 1)` |

Satellite offsets at spread 1: New file `(-54, -34)`, Add image `(0, -64)`, New folder `(54, -34)`.

### Effect settings (melt only)

`melt` object on each `Liquid.Item effect="melt"`. Library defaults are `IMAGE_MELT_DEFAULTS`.

| Prop | Studio label | Range / step | Default | Effect |
| --- | --- | --- | --- | --- |
| `melt.blur` | Goo blur | 0 to 20, step 0.5 | `7` | How far the bodies reach and how wide colour averaging runs. |
| `melt.contrast` | Contrast | 10 to 80, step 1 | `40` | Sharpness of the liquid boundary. |
| `melt.reach` | Reach | 0 to 2, step 0.05 | `0.8` | How far each crisp face dissolves back before the neighbour (factor of half-diagonal). |
| `melt.fade` | Fade | 0 to 40, step 1 | `17` | Softness of that dissolve (mask blur sigma). |
| `melt.warp` | Warp | 0 to 40, step 1 | `0` | Turbulence displacement of the molten layer, px. |
| `melt.mix` | Marbling | 0 to 1, step 0.05 | `1` | Two-liquid marbling strength in the touch area. |
| `melt.mixBlur` | Marbling blur | 0 to 24, step 0.5 | `8` | Blur of the marble pass's source colours. Low keeps detail, high folds to soup. |
| `melt.gravity` | Gravity | 0 to 4, step 0.1 | `1.9` | How deep the marble zone reaches into each card. |
| `melt.waviness` | Waviness | 0 to 40, step 1 | `12` | Wavelength of the warp noise. Low = long rolls, high = fine ripples. |
| `melt.src` | (none) | URL | first `<img>` inside the item | Image source override. |

Melt ignores the group's `blur`, `contrast`, `waviness` and `fill`.

### Liquid shadow (theme-driven, no knob)

`Liquid shadow` takes `box-shadow` syntax. The Studio demos use:

| Theme | `shadow` |
| --- | --- |
| dark | `0 0 0 1px rgba(255, 255, 255, 0.04) inset, 0 1px 0 0 rgba(255, 255, 255, 0.03) inset, 0 0 0 1px rgba(0, 0, 0, 0.06), 0 2px 6px 0 rgba(0, 0, 0, 0.05), 0 4px 42px 0 rgba(0, 0, 0, 0.24)` |
| light | `0 0 0 1px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.05), 0 4px 42px rgba(0, 0, 0, 0.06)` |

How layers render: `inset` and spread layers become SVG filter passes on the merged silhouette; blurred/offset outer layers with spread 0 become CSS `drop-shadow()` on the svg element (GPU). A layer with no colour gets `rgba(0, 0, 0, 0.35)`.

### Theme and presets

- Theme: the Studio has a dark/light switch. It changes the default fills and the shadow above. The library itself has no theme prop: pass `fill="var(--surface)"` and a themed `shadow` to follow your own tokens.
- Presets: no built-in presets. The Presets menu saves your current values under a name, separately for dark and light, on your account when signed in or in localStorage otherwise. Reset restores the mount-time values.

### Agent tab and core

| Param | Kind | Effect |
| --- | --- | --- |
| `core` | SVG filter primitives (string) | Replaces the goo chain. Emitted as the `filter` prop. See Core customization. |

### Package props outside the Studio

Public API the Studio does not expose. Use when the Studio knobs are not enough.

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `Liquid filterPadding` | number | `24` | Extra filter-region px for items travelling outside the group box. |
| `Liquid wavinessFreq` | number | `0.018` | Noise frequency of `waviness`. Lower = longer waves. |
| `Liquid.Item scale` | number | `1` | Mirrored scale, animated with `x`/`y`. |
| `Liquid.Item transition` | `"snappy"` / `"smooth"` / `"bouncy"` / `{ stiffness, damping, mass }` / `{ duration, ease }` | `"smooth"` | Presets: snappy 480/34/1, smooth 190/26/1, bouncy 320/17/1. A partial spring fills from 300/24/1. `{ duration }` defaults `ease` to `cubic-bezier(0.22, 1, 0.36, 1)`. |
| `Liquid.Item observe` | boolean | `false` | Liquid follows a morph child you animate yourself. |
| `Liquid.Item radius` | number or `[tl, tr, br, bl]` | measured | Override the measured border-radius. |
| `Liquid.Item morph` | `{ shape, speed, bounce, contentBlur, advanced }` | `shape: false`, `speed: 1`, `bounce: 0.5`, `contentBlur: 7` | Jelly shape-change physics for size changes. Writes `filter: blur()` on the content mid-morph. |
| `Liquid.Item dissolve` | `true`, `0..1`, or `DissolveOptions` | off | Melts a morph item's imagery into a touching neighbour. Ignored (dev warning) with `effect="move"`. |
| `move.advanced`, `bend.advanced` | `MoveOptions` | — | Raw `stiffness` (380), `damping` (18), `stretch` (0.18), `tail` (0.46), `force` (0.5), `bend`, `bendX`. |

Knob-to-engine mapping for move: `stiffness = 380 * 10^(springiness - 0.5)`, engine `stretch = 0.5 * stretch`, engine `tail = 0.8 * trail`. Bend runs the move engine at springiness 1 with no stretch or tail.

## Studio → code mapping

The Studio's "Copy Studio code" snippet (and the Usage block of its Copy prompt) is built like this:

- `<Liquid>` attributes: `blur` only if not 6, `contrast` only if not 18, `fill` always (the resolved hex, never "default"), `waviness` only if not 0. `shadow` is never emitted.
- Morph: every item gets `transition={{ duration: <Open duration>, ease: '<Open easing curve>' }}`; offsets are `-54 * spread`, `-34 * spread`, `-64 * spread`; the second item gets `delay={<Open stagger>}`. Close timing, anticipation and icon knobs are not emitted.
- Move: `move={{ ... }}` with `springiness` and `wobble` only when not 0.5, `stretch` and `trail` always.
- Bend: `bend={{ ... }}` with `vertical` only if not 0.6, `horizontal` only if not 0.35. Content bend is not emitted.
- Melt: `<Liquid>` with no attributes; `melt={{ ... }}` on both items with `blur`, `contrast`, `reach`, `fade`, `warp`, `mix`, `gravity` when off-default. `mixBlur` and `waviness` are not emitted.
- Core: `const liquidFilter = \`...\`` is inserted after the import and `<Liquid filter={liquidFilter} ...>`.

Example export (dark, Move, springiness 0.3, waviness 2):

```tsx
import { Liquid } from 'liquid-gooey'

<Liquid fill="#525252" waviness={2}>
  <Liquid.Item effect="move" move={{ springiness: 0.3, stretch: 0.6, trail: 0.35 }}>
    <div className="thumb" style={{ transform: `translateX(${x}px)` }} />
  </Liquid.Item>
</Liquid>
```

The Studio's Copy prompt wraps that snippet: "Add the Gooey effect from Libraries.dev to my React app.", the install line, the snippet, and an instruction to keep the prop values and adapt only child content.

Agent param names vs code:

| Agent param | Studio label | Code |
| --- | --- | --- |
| `effect` | Effect | `Liquid.Item effect` |
| `blur` / `contrast` / `waviness` | Goo blur / Contrast / Waviness | `Liquid blur` / `contrast` / `waviness` |
| `fill` | Button fill color | `Liquid fill` (`"default"` resolves to the theme table) |
| `morphDuration` | Open duration | `transition.duration` while opening |
| `morphEasing` | (no knob) | `transition.ease` while opening |
| `morphStagger` | Open stagger | `delay` multiplier while opening |
| `morphSpread` | Spread | `x`/`y` multiplier |
| `morphAnticipation` | Anticipation | CSS `--pm-anticip` |
| `morphCloseDuration`, `morphCloseStagger`, `morphAnticipationDuration`, `morphIconDuration`, `morphIconDelay` | Close duration, Close stagger, Anticipation duration, Icon fade, Icon delay | close `transition`/`delay`, CSS vars |
| `moveSpringiness` / `moveWobble` / `moveStretch` / `moveTrail` | Springiness / Wobble / Stretch / Trail | `move.springiness` / `wobble` / `stretch` / `trail` |
| `bendVertical` / `bendHorizontal` | Vertical bow / Horizontal caps | `bend.vertical` / `bend.horizontal` |
| `bendContent` | Content bend | CSS multiplier on `--lg-bend-*` |
| `meltBlur` … `meltWaviness` | melt labels | `melt.blur`, `contrast`, `reach`, `fade`, `warp`, `mix` (`meltMarbling`), `mixBlur` (`meltMixBlur`), `gravity`, `waviness` |
| `core` | Agent core | `Liquid filter` |

### Reproducing the Studio-only choreography

```tsx
const EASES = {
  Bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  Snappy: 'cubic-bezier(0.22, 1, 0.36, 1)',
}
const k = { openDur: 550, closeDur: 250, openStagger: 40, closeStagger: 0, spread: 1, iconDelay: 120 }
const phase = open
  ? { duration: k.openDur, ease: EASES.Bouncy, stagger: k.openStagger }
  : { duration: k.closeDur, ease: EASES.Snappy, stagger: k.closeStagger }

{SATELLITES.map((s, i) => (
  <Liquid.Item
    key={s.label}
    className="pm-slot"
    x={open ? s.x * k.spread : 0}
    y={open ? s.y * k.spread : 0}
    transition={{ duration: phase.duration, ease: phase.ease }}
    delay={i * phase.stagger}
  >
    <button className="pm-btn pm-sat" aria-label={s.label} tabIndex={open ? 0 : -1}>
      <span className="pm-sat-icon" style={{ transitionDelay: open ? `${k.iconDelay + i * phase.stagger}ms` : '0ms' }}>
        {s.icon}
      </span>
    </button>
  </Liquid.Item>
))}
```

Anticipation (add class `pm-anticipating` to `<Liquid>` for the anticipation duration when closing; set `--pm-anticip` and `--pm-anticip-dur` on it):

```css
@keyframes pm-anticipate {
  0% { transform: translateY(0); }
  30% { transform: translateY(var(--pm-anticip, 5px)); }
  100% { transform: translateY(0); }
}
.pm-anticipating [data-gooey-svg],
.pm-anticipating .pm-main {
  animation-name: pm-anticipate;
  animation-duration: var(--pm-anticip-dur, 700ms);
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  animation-fill-mode: both;
}
.pm-sat-icon { opacity: 0; filter: blur(2px); transition: opacity 120ms ease, filter 120ms ease; }
.pm-open .pm-sat-icon { opacity: 1; filter: blur(0); transition-duration: var(--pm-icon-dur, 180ms); }
```

Content bend (set `--dgc-cb` to the knob value on the card; the engine writes `--lg-bend-x`/`-y` in px and `--lg-bend-xn`/`-yn` unitless on it):

```css
.card > * {
  --k: calc(var(--dgc-cb, 0) * var(--arc, 1));
  transform:
    translate(calc(var(--lg-bend-x, 0px) * var(--k) * 2.4), calc(var(--lg-bend-y, 0px) * var(--k) * 2.4))
    rotate(calc(var(--lg-bend-yn, 0) * var(--rot, 0) * var(--dgc-cb, 0) * 1deg))
    skewX(calc(var(--lg-bend-xn, 0) * var(--dgc-cb, 0) * -0.55deg));
}
.card > :nth-child(1) { --arc: 0.45; --rot: 1.6; }
.card > :nth-child(2) { --arc: 1; --rot: 0; }
.card > :nth-child(3) { --arc: 0.6; --rot: -1.6; }
```

## Core customization

The `core` param is the `filter` prop on `<Liquid>`: a string of raw SVG filter primitives that replaces the library's goo chain inside its `<filter>` element.

### Contract

- Input: `SourceGraphic`, the plain silhouettes of every item (rounded rects filled with `fill`), in the group's px coordinates (`filterUnits="userSpaceOnUse"`, `color-interpolation-filters="sRGB"`).
- Output: the last primitive's result is what paints. End with the result you want shown.
- Shadows: with a custom `filter`, the SVG half of `shadow` (inset layers and layers with spread) is not rendered; reproduce it yourself. The CSS half (outer layers with spread 0) still applies as `drop-shadow()` on the svg. If you keep shadow passes, name the merged silhouette `shape`; inset and spread passes read a binarised copy of it (`bin`).
- Allowed: `fe*` elements only, with plain attributes. Examples: `feGaussianBlur`, `feColorMatrix`, `feComposite`, `feMorphology`, `feOffset`, `feFlood`, `feTurbulence`, `feDisplacementMap`, `feDiffuseLighting`, `feSpecularLighting` (with `feDistantLight` / `fePointLight` children), `feMerge` / `feMergeNode`.
- Not allowed (Studio validation): `feImage`, any non-`fe` element, `on*` attributes, `href` / `xlink:`, `<script>`. Max 24,000 characters. `""` restores the stock chain.
- Region: the filter region is the group box plus `ceil(blur * 3 + shadowExtent + filterPadding)` px on each side, computed from the `blur` prop, not from your chain. If your chain blurs wider, raise `blur` or `filterPadding`, or edges clip.
- Scope: affects morph, move and bend. Melt paints through its own SVG, so a core has no visible effect there.
- Security: the string is injected with `dangerouslySetInnerHTML`. Never build it from user input.

### Stock chain

For `blur={6} contrast={18}` with the dark Studio shadow:

```xml
<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
<feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo"/>
<feComposite in="SourceGraphic" in2="goo" operator="atop" result="shape"/>
<feColorMatrix in="shape" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 60 -29.5" result="bin"/>
<!-- inset 1px ring -->
<feMorphology in="bin" operator="erode" radius="1" result="s0-er"/>
<feComposite in="bin" in2="s0-er" operator="out" result="s0-band"/>
<feFlood flood-color="rgba(255, 255, 255, 0.04)" result="s0-c"/>
<feComposite in="s0-c" in2="s0-band" operator="in" result="s0"/>
<!-- inset top highlight -->
<feOffset in="bin" dx="0" dy="1" result="s1-o"/>
<feComposite in="bin" in2="s1-o" operator="out" result="s1-band"/>
<feFlood flood-color="rgba(255, 255, 255, 0.03)" result="s1-c"/>
<feComposite in="s1-c" in2="s1-band" operator="in" result="s1"/>
<!-- outer 1px ring -->
<feMorphology in="bin" operator="dilate" radius="1" result="s2-sp"/>
<feFlood flood-color="rgba(0, 0, 0, 0.06)" result="s2-c"/>
<feComposite in="s2-c" in2="s2-sp" operator="in" result="s2"/>
<feMerge>
  <feMergeNode in="s2"/>
  <feMergeNode in="shape"/>
  <feMergeNode in="s0"/>
  <feMergeNode in="s1"/>
</feMerge>
```

The colour-matrix intercept is `round((0.5 - contrast * 5/12) * 100) / 100` (18 gives -7). With `waviness > 0`, the atop result is named `shape-raw` and followed by `feTurbulence type="fractalNoise" baseFrequency={wavinessFreq} numOctaves="2" seed="7"` and `feDisplacementMap scale={waviness * 2}` (channels R, G) producing `shape`. The two blurred outer layers are on the svg as `drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.05)) drop-shadow(0px 4px 42px rgba(0, 0, 0, 0.24))`.

### Example 1: glossy liquid with a specular highlight

```tsx
import type { ReactNode } from 'react'
import { Liquid } from 'liquid-gooey'

const glossFilter = `
  <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
  <feColorMatrix in="blur" type="matrix"
    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo"/>
  <feComposite in="SourceGraphic" in2="goo" operator="atop" result="shape"/>
  <feGaussianBlur in="shape" stdDeviation="3" result="bump"/>
  <feSpecularLighting in="bump" surfaceScale="4" specularConstant="0.8"
    specularExponent="22" lighting-color="#ffffff" result="spec">
    <feDistantLight azimuth="235" elevation="55"/>
  </feSpecularLighting>
  <feComposite in="spec" in2="shape" operator="in" result="gloss"/>
  <feComposite in="gloss" in2="shape" operator="over"/>
`

export function GlossyMenu({ children }: { children: ReactNode }) {
  return (
    <Liquid
      filter={glossFilter}
      fill="#7cd4ff"
      shadow="0 2px 6px rgba(0, 0, 0, 0.05), 0 4px 42px rgba(0, 0, 0, 0.24)"
    >
      {children}
    </Liquid>
  )
}
```

Keeps `shape` as the merged silhouette. The shadow layers are outer, spread 0, so they still render as CSS `drop-shadow()`.

### Example 2: hollow outline liquid

```tsx
import { Liquid } from 'liquid-gooey'

const outlineFilter = `
  <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
  <feColorMatrix in="blur" type="matrix"
    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -9.5" result="goo"/>
  <feComposite in="SourceGraphic" in2="goo" operator="atop" result="shape"/>
  <feMorphology in="shape" operator="erode" radius="1.5" result="inner"/>
  <feComposite in="shape" in2="inner" operator="out" result="ring"/>
  <feFlood flood-color="#ffd28f" result="ink"/>
  <feComposite in="ink" in2="ring" operator="in"/>
`

<Liquid filter={outlineFilter} contrast={24}>
  {/* items */}
</Liquid>
```

Contrast 24 gives intercept `0.5 - 24 * 5/12 = -9.5`. The `contrast` prop is set only for readability; with a custom filter the library ignores it. Only the outline paints, so the merge reads as a traced ring that necks and splits.

## Recipes

### Light-theme plus menu matching the Studio

Use when: the product is light and the menu should match the Studio's light surface.

```tsx
import type { CSSProperties } from 'react'

<Liquid
  fill="#ffffff"
  shadow="0 0 0 1px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.05), 0 4px 42px rgba(0, 0, 0, 0.06)"
  className={`pm ${open ? 'pm-open' : ''}`}
  style={{ '--gd-ink': '#17181c' } as CSSProperties}
>
  {/* satellites and main button as in "Reproducing the Studio-only choreography" */}
</Liquid>
```

### Calm, deliberate menu

Use when: a settings or admin surface should open without bounce.

```tsx
<Liquid.Item
  x={open ? s.x * 0.8 : 0}
  y={open ? s.y * 0.8 : 0}
  transition={{ duration: open ? 700 : 300, ease: open ? 'cubic-bezier(0.3, 1.05, 0.4, 1)' : 'cubic-bezier(0.22, 1, 0.36, 1)' }}
  delay={i * (open ? 80 : 0)}
>
  <button className="pm-btn pm-sat" aria-label={s.label} tabIndex={open ? 0 : -1}>{s.icon}</button>
</Liquid.Item>
```

Spread 0.8, Smooth open easing, 80ms stagger, anticipation 0 (skip the `pm-anticipating` class).

### Syrupy slider

Use when: a media scrubber or playful control should feel viscous.

```tsx
<Liquid fill="#525252" blur={8} contrast={14}>
  <Liquid.Item effect="move" move={{ springiness: 0.2, wobble: 0.2, stretch: 0.8, trail: 0.8 }}>
    <div className="thumb" style={{ transform: `translateX(${x}px)` }} />
  </Liquid.Item>
</Liquid>
```

### Tight segmented-control indicator

Use when: the indicator should feel precise with a hint of liquid.

```tsx
<Liquid fill="#e9e9e9" contrast={28}>
  <Liquid.Item effect="move" move={{ springiness: 0.8, wobble: 0.3, stretch: 0.3, trail: 0 }}>
    <div className="indicator" style={{ transform: `translateX(${active * 96}px)`, transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
  </Liquid.Item>
  {segments}
</Liquid>
```

### Rubbery drag card with bending content

Use when: a dragged card or dropdown pill should visibly flex, text included.

```tsx
<Liquid fill="#202020" waviness={1.5}>
  <Liquid.Item effect="bend" bend={{ vertical: 0.9, horizontal: 0.6 }}>
    <div className="card" style={{ transform: `translate(${x}px, ${y}px)`, ['--dgc-cb' as string]: 0.5 }}>
      <span className="chip" />
      <span className="title">Gooey Project</span>
      <span className="count">45 files</span>
    </div>
  </Liquid.Item>
</Liquid>
```

Pair with the content-bend CSS above.

### Molten photo merge

Use when: two photos should swirl into each other rather than just touch.

```tsx
const melt = { blur: 10, warp: 12, mix: 1, mixBlur: 12, gravity: 2.4, waviness: 20 }

<Liquid style={{ width: 'min(100%, 420px)', height: 200 }}>
  <Liquid.Item effect="melt" melt={melt}>
    <div className="mp-card" style={{ left: a.x, top: a.y, width: 84, height: 84 }}><img src={srcA} alt="" /></div>
  </Liquid.Item>
  <Liquid.Item effect="melt" melt={melt}>
    <div className="mp-card" style={{ left: b.x, top: b.y, width: 84, height: 84 }}><img src={srcB} alt="" /></div>
  </Liquid.Item>
</Liquid>
```

`.mp-card` is `position: absolute; border-radius: 16px; overflow: hidden`. Pass the same `melt` object to both items.

### Organic amber toolbar

Use when: a creative tool's toolbar should read as a living drop.

```tsx
<Liquid
  fill="#ffd28f"
  blur={9}
  contrast={16}
  waviness={3}
  shadow="0 2px 6px rgba(0, 0, 0, 0.05), 0 4px 42px rgba(0, 0, 0, 0.24)"
  style={{ display: 'flex', gap: 4 }}
>
  {tools.map(t => (
    <Liquid.Item key={t.id}>
      <button className="round-btn" aria-label={t.label} style={{ color: '#17181c' }}>{t.icon}</button>
    </Liquid.Item>
  ))}
</Liquid>
```

A 4px gap at `blur={9}` keeps the buttons bridged into one surface.

## Accessibility & performance

- Both library svgs are `aria-hidden="true"`, `focusable="false"`, `pointer-events: none`. Content is real DOM: set `aria-label` on icon-only buttons, `aria-expanded` on the toggle, `tabIndex={-1}` on hidden satellites, `role="slider"` with `aria-valuemin/max/now` on thumbs.
- Reduced motion: mirrored `x`/`y`/`scale` transitions resolve to duration 0 under `prefers-reduced-motion: reduce`. Move, bend, melt and `morph.shape` do not check it; gate your own motion. Disable the anticipation keyframe and icon transitions under the media query, as the Studio CSS does.
- Filter cost: WebKit runs SVG filters on the CPU at device scale. The library moves blurred outer shadows to CSS `drop-shadow()` (GPU) and computes the binarised silhouette once. Costs that remain, in rough order:
  - `waviness > 0`: a full-region `feTurbulence` + `feDisplacementMap` on every repaint.
  - Large `blur`: the filter region grows by `blur * 3` px per side.
  - Each inset or spread shadow layer: 3 to 4 extra passes.
  - Custom cores with lighting or turbulence primitives.
- Observed items (move, bend) share one rAF loop per group that sleeps after about 30 still frames and polls 3 times a second while asleep. It wakes on style/class mutations, `transitionrun`, `animationstart`, `pointerdown` and scroll.
- Melt polls the pair's rects every frame while two melt items are mounted, and `melt.warp > 0` adds turbulence. Unmount when offscreen.
- No IntersectionObserver pause anywhere.
- SSR: content renders server-side; the liquid appears after hydration once the group is measured.

## Common mistakes

- Opaque item backgrounds hiding the liquid. Keep item backgrounds transparent.
- Group too small for the items' travel; the liquid clips at the filter region. Size the group or raise `filterPadding`.
- `<Liquid.Item>` outside `<Liquid>` throws `<Gooey.Item> must be rendered inside a <Gooey> group.`
- Setting `transform` or a CSS transition on a mirrored item's wrapper. The library writes it every frame.
- Backgrounds under the liquid at `z-index` above -1. The svg sits at -1 in an isolated group; tracks need -2.
- Pasting the Studio snippet and expecting the Studio look: it omits `shadow`, close choreography, content bend, and melt's `mixBlur` / `waviness`. Add them by hand.
- Different `melt` objects per item. Only the first registered item's tuning is used, and only the first two melt items pair.
- Custom `filter` without reproducing inset/spread shadows, or with a wider blur than the `blur` prop (clipped edges).
- Expecting a core to change melt. It does not.
- Combining your own `filter` on a `morph.shape` child, or your own `mask-image` on images under `dissolve`. The library writes those properties.
- `dissolve` on `effect="move"`: ignored with a dev warning.
- Next.js App Router without `"use client"`.

## Detecting a fit in a codebase

| Signal to grep for | Suggest |
| --- | --- |
| FAB, speed dial, "plus menu", round "+" with `aria-expanded` and action buttons | `morph` menu with Studio choreography |
| Avatar stacks, chip groups, rounded toolbars | `morph` group, fill swatch, optional `waviness` |
| `input type="range"`, `role="slider"`, custom thumbs, scrubbers | `move` thumb (syrupy or tight recipe) |
| Tab bars, segmented controls, `layoutId` indicators, `translateX` on an indicator | `move` indicator |
| `@dnd-kit`, `react-beautiful-dnd`, `framer-motion` `drag`, sortable rows, draggable pills | `bend` with content bend |
| Before/after sliders, image-compare, two draggable image cards | `melt` pair |
| Hand-rolled goo: `feColorMatrix` `0 0 0 18 -7`, `filter: url(#goo)`, "metaball" | `<Liquid>`; port custom primitives to the `filter` core |
| Light/dark tokens like `--surface` | `fill="var(--surface)"` plus a themed `shadow` |
