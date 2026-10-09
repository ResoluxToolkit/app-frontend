# Border beam — Pro

An animated glow that rides the border of a card, button or input: the full Studio surface of `border-beam` (every knob, all eight palettes, per-layer control, theme handling and stylesheet-level core rewrites through the `css` prop).

## When to use

### Where it goes

The author's placement rules. Follow them before the general list below.

- **Loading that lasts longer than 3 seconds**: wrap the element doing the work (the prompt input, the result card) and set `active` from the real loading flag. Shorter waits get no beam.
- **Highlighting a component**, such as a prompt input or a CTA button, uses a Pulse type:
  - a **button**: `size="pulse-inner"` (the glow breathes inside the button);
  - an **input**: `size="pulse-outside"` (the glow blooms outside the field).
- **An input that loads after the user submits text** (search, ask, command bar): `size="line"`, active from submit until results arrive.

More situations it fits:

- An AI chat input or composer while the model streams or an agent works: `size="md"` with `active={isStreaming}`.
- A brand-coloured accent: a palette plus `staticColors`, or `--beam-hue-base` to rotate the palette toward the brand hue.
- A near-invisible "system is alive" edge: stroke only, inner glow and bloom at 0.

| Family | Types (`size`) | Motion | Wrapper overflow |
| --- | --- | --- | --- |
| Rotate | `md` (Large), `sm` (Small), `line` (Line) | Beam travels round the border (`line`: along the bottom) | `hidden` |
| Pulse | `pulse-inner`, `pulse-outside` | Breathes in place; hue rotates continuously | `hidden` (inner), `visible` (outside) |

### When not to use

- Permanent decoration with no state behind it. A static border or shadow costs nothing per frame.
- Lists, tables or grids where every item would carry a live beam. Each one repaints masked, filtered layers.
- Elements whose children must escape the box (dropdowns, tooltips, outside focus rings) with any type except `pulse-outside`, which all clip the wrapper.
- Places that must honour reduced motion with the same visual. Pulse types disappear under `prefers-reduced-motion: reduce`, and rotate types keep moving unless you turn them off.

## Install

```bash
npm install border-beam
pnpm add border-beam
yarn add border-beam
```

```tsx
import { BorderBeam } from 'border-beam';
import type {
  BorderBeamProps,
  BorderBeamSize,
  BorderBeamTheme,
  BorderBeamColorVariant,
} from 'border-beam';
// Also exported: sizePresets, sizeThemePresets, themeColors (deprecated), SizeConfig, ThemeColors
```

- React component (`forwardRef` to the wrapper `<div>`). Peer dependencies: `react >= 18`, `react-dom >= 18`. No runtime dependencies. Current version 1.4.1.
- ESM (`dist/index.es.js`) and CommonJS (`dist/index.cjs`) with types. Default export too.
- No `"use client"` directive ships. In the Next.js App Router, render it from a `"use client"` file.
- SSR-safe ids (`useId`). The component renders a `<style>` sibling right before its wrapper `<div>`.

Ports (local to the repo, not on npm):

| Platform | Package / path | Install | Notes |
| --- | --- | --- | --- |
| React Native | `border-beam-native`, `packages/border-beam/ports/react-native/border-beam-native` | `npm install border-beam-native @shopify/react-native-skia react-native-reanimated` | Expo needs `expo run:ios` / `run:android`. No radius auto-detect. Palettes: `colorful`, `mono`, `ocean`, `sunset` only |
| SwiftUI (iOS 17+) | `BorderBeamKit`, `packages/border-beam/ports/ios/BorderBeamKit` | `.package(path: "packages/border-beam/ports/ios/BorderBeamKit")` | Build through Xcode (Metal shader). Palettes: `.colorful`, `.mono`, `.ocean`, `.sunset` only |

Neither port supports `glowSize`, `css` or the CSS-variable knobs.

## Basic usage

```tsx
import { BorderBeam } from 'border-beam';

<BorderBeam>
  <YourCard>Content</YourCard>
</BorderBeam>
```

React Native:

```tsx
import { BorderBeam } from 'border-beam-native';

<BorderBeam borderRadius={16}>
  <Card />
</BorderBeam>
```

SwiftUI:

```swift
import BorderBeamKit

BorderBeam(
    borderRadius: 16
) {
    Card()
}
```

## Full option reference

Grouped as the Studio groups its controls. "(free)" marks what the public detail page exposes (tuner or Copy prompt). The Studio column is the control label. Agent param names are listed where they differ from the prop.

### Type and colour (top of the panel)

| Prop | Studio | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- | --- |
| (none) | Family | tab | Rotate, Pulse | Rotate | Switches the Type tabs. Picking a family selects `md` or `pulse-inner` |
| `size` (free) | Type | enum | `"md"` Large, `"sm"` Small, `"line"` Line, `"pulse-inner"`, `"pulse-outside"` | `"md"` | Beam type. Each type has its own geometry, layer opacities and default duration |
| `colorVariant` (free: colorful, mono, ocean, sunset) | Color theme | enum | `"colorful"`, `"mono"`, `"ocean"`, `"sunset"`, `"forest"`, `"candy"`, `"ice"`, `"gold"` | `"colorful"` | Palette. `mono` forces `staticColors` and halves the three layer opacities on `md`, `sm` and the pulse types |

### Motion

| Prop | Studio | Type | Range / step | Default | Effect |
| --- | --- | --- | --- | --- | --- |
| `duration` | Duration | number (s) | 0.5 to 6, step 0.02 | Package: `md`/`sm` 1.96, `line` 3.1, pulse 2.3. Studio: 1.96, `line` 2.4 | Rotate: one full lap. `line` also derives breathe (x1.3), spike (x1.33) and second spike (x1.7). Pulse: scales every breathing period (`duration / 2.3`). Longest lever on calm vs urgent |

### Glow styling

| Prop / hook | Studio | Type | Range / step | Default | Effect |
| --- | --- | --- | --- | --- | --- |
| `strength` (free) | Strength | number | Studio 0 to 100 %, step 1; prop 0 to 1 | 1 (100 %) | Multiplies every layer's opacity via `--beam-strength`. Clamped to 0..1. Never touches children |
| `borderRadius` (agent: `radius`) | Corner radius | number (px) | 0 to 32, step 1 | Auto-detected from the first child, else preset (`sm` 32, others 16) | Wrapper radius and every layer's clip |
| `glowSize` | Size | number | 0.25 to 3, step 0.05 | 1 | Multiplies each glow layer's blur radius (min 0.5 px). Below 1 tighter, above 1 softer and wider |
| `brightness` | Brightness | number | 0.5 to 2.2, step 0.05 | Per type (table below). Studio starts at 1.3 | CSS `brightness()` on the glow layers |
| `saturation` | Saturation | number | 0.4 to 2.2, step 0.05 | Per type and theme (table below). Studio starts at 1.2 | CSS `saturate()` on the glow layers. Low reads muted, high reads neon |
| `--beam-stroke-opacity` (agent: `strokeOpacity`) | Stroke | CSS var | 0 to 2, step 0.05 | 1 | Multiplier on the `::after` layer: the crisp 1 px ring (rotate) or coloured perimeter (pulse) |
| `--beam-inner-opacity` (agent: `innerOpacity`) | Inner glow | CSS var | 0 to 2, step 0.05 | 1 | Multiplier on `::before`: soft light hugging the edge (`pulse-outside`: the core glow behind the child) |
| `--beam-bloom-opacity` (agent: `bloomOpacity`) | Bloom | CSS var | 0 to 2, step 0.05 | 1 | Multiplier on `[data-beam-bloom]`: the wide, diffuse halo |
| `hueRange` | Hue range | number (deg) | 0 to 120, step 1 | 30 | Rotate types: the hue-shift animation swings `base ± hueRange` over 12 s. `line` caps it at 13. Hidden when `staticColors` |
| `--beam-hue-base` (agent: `hueShift`) | Hue shift | CSS var (deg) | -180 to 180, step 5 | 0deg | Rotates the whole palette. Negative toward blues and violets, positive toward oranges and reds. Only emitted when not `staticColors` |
| `--beam-spike-mul` (agent: `spikes`) | Spikes | CSS var | 0 to 2, step 0.05 | 1 | `line` only. Size of the travelling spikes: 0 flat, 2 sharp comet head |
| `--pulse-glow-sx` (agent: `glowSx`) | Glow spread X | CSS var | 0.5 to 2, step 0.05 | 1 | Pulse only. Horizontal size of the breathing blobs |
| `--pulse-glow-sy` (agent: `glowSy`) | Glow spread Y | CSS var | 0.5 to 2, step 0.05 | 1 | Pulse only. Vertical size of the breathing blobs |
| `--pulse-glow-boost` (agent: `glowBoost`) | Glow boost | CSS var | 0.5 to 2, step 0.05 | 1 | Pulse only. Scales blob width and height together on top of the spreads |

### Not on a knob

| Prop | Where | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- | --- |
| `active` (free) | Play / Pause on the stage; agent `active` | boolean | | `true` | Fades in 0.6 s / out 0.5 s. When off, no layers render |
| `staticColors` | Agent only (no manual toggle) | boolean | | `false` | Freezes the palette (no hue animation). Hides Hue range and Hue shift |
| `core` (agent) -> `css` prop | Agent only | string (CSS) | see Core customization | `""` (stock) | Extra stylesheet appended after the generated one |
| `theme` (free: dark, light) | Studio light/dark switch | enum | `"dark"`, `"light"`, `"auto"` | `"dark"` | Picks the theme preset column below and dark or light gradient inks. `auto` follows `prefers-color-scheme` live |
| `onActivate`, `onDeactivate` | package only | `() => void` | | | Fire when the fade-in / fade-out animation ends. Your own `onAnimationEnd` is still called |
| `className`, `style`, `ref`, any `div` attribute | package only | | | | Forwarded to the wrapper. `style` is where the CSS-variable knobs go |

The agent spec also lists `cardScale` (`s`, `m`, `l`), a preview-only card size. It is not a library prop.

### Per-type presets (package defaults)

The layer multipliers above scale these base opacities. `brightness` and `saturation` replace the preset value when passed.

| `size` | theme | stroke | inner | bloom | saturation | brightness | radius |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sm` | dark | 0.46 | 0.24 | 0.38 | 1.2 | 1.3 | 32 |
| `sm` | light | 0.12 | 0.30 | 0.16 | 1.8 | 1.3 | 32 |
| `md` | dark | 0.26 | 0.42 | 0.24 | 1.2 | 1.3 | 16 |
| `md` | light | 0.12 | 0.26 | 0.34 | 1.5 | 1.3 | 16 |
| `line` | dark | 1.14 | 0.70 | 0.80 | 1.2 | 1.3 | 16 |
| `line` | light | 0.16 | 0.32 | 0.30 | 1.95 | 1.3 | 16 |
| `pulse-inner` | dark | 1.54 | 0.44 | 0.66 | 1.2 | 0.75 | 16 |
| `pulse-inner` | light | 0.32 | 0.40 | 0.80 | 0.75 | 1.3 | 16 |
| `pulse-outside` | dark | 0.94 | 0.34 | 0.30 | 1.2 | 1.9 | 16 |
| `pulse-outside` | light | 1.96 | 1.04 | 0.42 | 0.6 | 1.7 | 16 |

### Palettes

Nine colour stops per palette (the `md` border set, converted from the package's `rgb()` values). `sm` and `line` use their own tuned sets in the same hues.

| `colorVariant` | Reads as | Stops |
| --- | --- | --- |
| `colorful` | full spectrum | `#ff3264` `#288cff` `#32c850` `#1eb9aa` `#6446ff` `#288cff` `#ff7828` `#f032b4` `#b428f0` |
| `mono` | neutral grey, static | `#b4b4b4` `#8c8c8c` `#a0a0a0` `#828282` `#aaaaaa` `#969696` `#bebebe` `#919191` `#a5a5a5` |
| `ocean` | blue, violet (cool) | `#6450dc` `#3c78ff` `#5064c8` `#328cdc` `#7850ff` `#4682ff` `#8c64f0` `#5a6ee6` `#8246ff` |
| `sunset` | orange, red, yellow (warm) | `#ff5032` `#ffa028` `#ff783c` `#ffc832` `#ff6450` `#ffb43c` `#ff3c3c` `#ff8c32` `#ff5a46` |
| `forest` | green, teal | `#2ea05a` `#1ebe78` `#46b446` `#149682` `#5ac850` `#28aa6e` `#78d246` `#239164` `#3cc38c` |
| `candy` | pink, magenta | `#f046aa` `#ff5a8c` `#d73cc8` `#ff6eb4` `#c850f0` `#fa3c96` `#e678dc` `#f555a5` `#d246e6` |
| `ice` | cyan, pale blue | `#5ac8f0` `#3cafe6` `#82dcfa` `#46bed7` `#6ed2ff` `#32a5dc` `#96e6fa` `#55c3eb` `#41b4f5` |
| `gold` | amber, yellow | `#f0be3c` `#ffd25a` `#e1a528` `#fac846` `#ffe178` `#e6af32` `#f5cd55` `#d79b23` `#ffd764` |

There are no custom-colour props. For a brand hue, pick the nearest palette and rotate it with `--beam-hue-base`, or rewrite the gradients through `css`.

### Theme handling

- The Studio has a light/dark switch. It passes `theme` to the beam and re-renders the preview on the matching stage.
- Presets are user-saved, not built in. Each preset stores one value set per theme; saving writes the current theme's side, applying loads the matching side. Signed in, they sync to the account; signed out, they live in `localStorage`. Reset restores the bench defaults.
- In code, drive `theme` from your app's theme state. Use `"auto"` only for client-only rendering (see SSR note).

## Studio → code mapping

The Studio's React snippet keeps only values that differ from the bench defaults, in this order: `size`, `colorVariant`, `strength`, `duration`, `glowSize`, `brightness`, `saturation`, `hueRange`, `borderRadius`, `staticColors`, `active={false}`, then a `style` object for the CSS-variable knobs, then `css={beamCss}` for a core.

Bench defaults it compares against: `size` md, `colorVariant` colorful, strength 100, duration 1.96 (`line` 2.4), glowSize 1, brightness 1.3, saturation 1.2, hueRange 30, radius 16, `staticColors` false, `active` true, every CSS-variable knob 1 (hue shift 0).

Exported shape, with the one fix it needs to type-check (the Studio prints the `style` object without the cast; custom properties are not in `CSSProperties`):

```tsx
import type { CSSProperties } from 'react';
import { BorderBeam } from 'border-beam';

const beamCss = `/* core, when the Agent rewrote it */`;

<BorderBeam
  size="line"
  colorVariant="ocean"
  strength={0.8}
  duration={3.2}
  brightness={1.5}
  style={{ '--beam-hue-base': '-20deg', '--beam-spike-mul': 1.4, '--beam-bloom-opacity': 0.6 } as CSSProperties}
  css={beamCss}
>
  <Card>Content</Card>
</BorderBeam>
```

| Studio control | Agent param | Code |
| --- | --- | --- |
| Family | (derived from `size`) | none |
| Type | `size` | `size` |
| Color theme | `colorVariant` | `colorVariant` |
| Duration | `duration` | `duration` |
| Strength (0 to 100 %) | `strength` (0 to 100) | `strength={value / 100}` |
| Corner radius | `radius` | `borderRadius` (omitted at 16) |
| Size | `glowSize` | `glowSize` |
| Brightness, Saturation, Hue range | same | same |
| Stroke / Inner glow / Bloom | `strokeOpacity` / `innerOpacity` / `bloomOpacity` | `style` `--beam-stroke-opacity` / `--beam-inner-opacity` / `--beam-bloom-opacity` |
| Hue shift | `hueShift` | `style` `'--beam-hue-base': '<n>deg'` (skipped when `staticColors`) |
| Spikes | `spikes` | `style` `--beam-spike-mul` (only for `line`) |
| Glow spread X / Y, Glow boost | `glowSx` / `glowSy` / `glowBoost` | `style` `--pulse-glow-sx` / `--pulse-glow-sy` / `--pulse-glow-boost` (pulse only) |
| (Agent) | `staticColors` | `staticColors` |
| (Agent) | `core` | `const beamCss = \`...\`` and `css={beamCss}` |
| Play / Pause | `active` | `active={false}` when paused |
| Light/dark switch | (none) | Not emitted in the React snippet. Add `theme="light"` yourself |

Port snippets use the same knobs with three differences. `borderRadius` is always written (no auto-detect). `theme` is written when the Studio is light. `glowSize`, `css` and every CSS-variable knob are dropped. SwiftUI uses `.pulseInner` / `.pulseOutside` and labelled arguments.

When porting Studio values by hand, keep the preview's implicit values explicit. The Studio stage always passes `duration`, `brightness` and `saturation`, but the snippet omits them at the bench defaults, and the package's own defaults differ per type (table above). To reproduce the preview exactly for `line`, the pulse types or the light theme, write `duration`, `brightness` and `saturation` out.

## Core customization

The agent spec has a `core` param of kind `code`, `lang: "css"`. In code it is the `css` prop.

**What it replaces.** Nothing is removed. The string is appended after the beam's generated stylesheet for that instance, in the same `<style>` element, so it can override any rule, redefine any keyframe or add new layers.

**Contract.**

- Write `{id}` wherever the instance id belongs. The component substitutes it per instance (`useId` with `:` replaced by `-`).
- Root: `[data-beam="{id}"]`. Light layers: its `::before` and `::after` pseudo-elements, plus the child `[data-beam-bloom]`.
- State attributes on the root: `[data-active]` (on), `[data-fading]` (fading out), `[data-paused]` (offscreen). Layers only get `content` under `[data-active]` / `[data-fading]`.
- Every keyframe and registered property is named `<name>-{id}`. Redefine a keyframe under the same name to change its motion; the later definition wins.
- Keep the `--beam-*` hooks meaningful where you can: multiply opacities by `var(--beam-strength, 1)` and the per-layer `var(--beam-stroke-opacity, 1)` / `--beam-inner-opacity` / `--beam-bloom-opacity`, and keep `var(--beam-hue-base, 0deg)` in hue rotations.
- Keep every layer `pointer-events: none` and inside the root.
- Plain CSS only: no `url()`, no `@import`, no vendor hacks. The Studio rejects `url(` and `@import`, then parses the sheet with `{id}` replaced; it must yield at least one rule. An empty string restores the stock core.
- If you override the root's `animation`, keep the fade: `beam-fade-in-{id}` on `[data-active]`, `beam-fade-out-{id}` on `[data-fading]`. They drive `--beam-opacity-{id}` from 0 to 1. Without them every layer stays invisible and `onActivate` / `onDeactivate` never fire.

**Stock implementation shape per type.**

| Type | Registered properties | Root animations | Layers |
| --- | --- | --- | --- |
| `md`, `sm` | `--beam-angle-{id}` (angle), `--beam-opacity-{id}` | `beam-spin-{id}` (0 to 360deg, `duration`, linear) + fade | `::after` stroke: white conic highlight + palette radial blobs, conic mask from `--beam-angle`, ring via `mask-composite`. `::before` inner glow, conic mask + 28 px edge fades. `[data-beam-bloom]` blurred conic ring. `beam-hue-shift-{id}` 12 s on the layers |
| `line` | `--beam-x/w/h/spike/spike2/edge-{id}`, `--beam-opacity-{id}` | `beam-travel`, `beam-edge-fade` (`duration`), `beam-breathe` (x1.3), `beam-spike` (x1.33), `beam-spike2` (x1.7) + fade | Radial masks at `calc(var(--beam-x-{id}) * 100%) 100%` on the bottom edge. `beam-hue-shift-{id}` 12 s, `beam-hue-shift-bloom-{id}` 8 s |
| `pulse-inner`, `pulse-outside` | `--bw1..3`, `--bh1..3`, `--bx1..3`, `--by1..3`, `--bgh`, `--bop-tl/tr/bl/br`, `--beam-hue` (all `-{id}`), `--beam-opacity-{id}` | Fade only | Breathing values and hue are written inline by the shared JS loop, not keyframes. Retime them with `duration`, not CSS |

`pulse-outside` also reads `--beam-core-blur`, `--beam-bloom-blur`, `--beam-glow-brightness` and `--beam-glow-saturate` on its core and bloom filters. These are package hooks with no Studio knob.

**Example 1: sweep, then rest (`md` / `sm`).** The beam laps once with an ease, then holds for a beat. Redefines the spin keyframe and re-declares the active animation with the fade kept.

```css
@keyframes beam-spin-{id} {
  0%   { --beam-angle-{id}: 0deg; }
  70%  { --beam-angle-{id}: 360deg; }
  100% { --beam-angle-{id}: 360deg; }
}

[data-beam="{id}"][data-active] {
  animation:
    beam-spin-{id} 3s cubic-bezier(0.65, 0, 0.35, 1) infinite,
    beam-fade-in-{id} 0.6s ease forwards;
}
```

The `[data-fading]` rule keeps the stock linear spin while it fades out, which is fine for a 0.5 s exit.

**Example 2: twin beams (`md`).** Two opposite beams chase each other. Swaps the single conic lobe in the stroke and inner-glow masks for a repeating one. The ring composites and edge fades stay as stock.

```css
[data-beam="{id}"][data-active]::after,
[data-beam="{id}"][data-fading]::after {
  -webkit-mask:
    repeating-conic-gradient(from var(--beam-angle-{id}),
      transparent 0deg 40deg, rgba(255, 255, 255, 0.35) 80deg, white 115deg 145deg, transparent 180deg),
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: source-in, xor;
  mask:
    repeating-conic-gradient(from var(--beam-angle-{id}),
      transparent 0deg 40deg, rgba(255, 255, 255, 0.35) 80deg, white 115deg 145deg, transparent 180deg),
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: intersect, exclude;
}

[data-beam="{id}"][data-active]::before,
[data-beam="{id}"][data-fading]::before {
  -webkit-mask-image:
    repeating-conic-gradient(from var(--beam-angle-{id}),
      transparent 0deg 40deg, rgba(255, 255, 255, 0.35) 80deg, white 115deg 145deg, transparent 180deg),
    linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
    linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
  -webkit-mask-composite: source-in, source-over;
  mask-image:
    repeating-conic-gradient(from var(--beam-angle-{id}),
      transparent 0deg 40deg, rgba(255, 255, 255, 0.35) 80deg, white 115deg 145deg, transparent 180deg),
    linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
    linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
  mask-composite: intersect, add;
}
```

Opacity, strength and per-layer multipliers are untouched, so every Studio knob still works. The white highlight in the stroke is a single conic lobe, so one of the twins reads brighter.

Using either core in code:

```tsx
import { BorderBeam } from 'border-beam';

const beamCss = `
@keyframes beam-spin-{id} {
  0%   { --beam-angle-{id}: 0deg; }
  70%  { --beam-angle-{id}: 360deg; }
  100% { --beam-angle-{id}: 360deg; }
}
[data-beam="{id}"][data-active] {
  animation: beam-spin-{id} 3s cubic-bezier(0.65, 0, 0.35, 1) infinite, beam-fade-in-{id} 0.6s ease forwards;
}`;

<BorderBeam css={beamCss}>
  <Card>Content</Card>
</BorderBeam>
```

## Recipes

Calm, premium composer. Use when the default rainbow reads too loud for the brand.

```tsx
import type { CSSProperties } from 'react';
import { BorderBeam } from 'border-beam';

<BorderBeam
  colorVariant="ice"
  active={isStreaming}
  strength={0.8}
  duration={3.2}
  saturation={0.8}
  style={{ '--beam-bloom-opacity': 0.5 } as CSSProperties}
>
  <form className="composer">…</form>
</BorderBeam>
```

Hairline only. Use for a subtle "live" edge on dense UI where a halo would bleed into neighbours.

```tsx
<BorderBeam
  strength={0.9}
  style={{ '--beam-stroke-opacity': 1.6, '--beam-inner-opacity': 0, '--beam-bloom-opacity': 0 } as CSSProperties}
>
  <div className="panel">…</div>
</BorderBeam>
```

Comet under a search field. Use for a command menu or search that should feel fast.

```tsx
<BorderBeam
  size="line"
  colorVariant="sunset"
  active={isSearching}
  duration={2.4}
  style={{ '--beam-spike-mul': 1.6 } as CSSProperties}
>
  <div className="search">…</div>
</BorderBeam>
```

Warm brand tint from the colourful palette. Use when the brand is orange or red and a narrow, considered hue band beats a rainbow.

```tsx
<BorderBeam hueRange={12} brightness={1.2} style={{ '--beam-hue-base': '40deg' } as CSSProperties}>
  <div className="card">…</div>
</BorderBeam>
```

Needs-attention card. Use for an approval or a blocking step; breathing reads urgent without travelling motion.

```tsx
<BorderBeam
  size="pulse-inner"
  colorVariant="gold"
  duration={3.4}
  style={{ '--pulse-glow-sx': 1.2, '--pulse-glow-boost': 1.3 } as CSSProperties}
>
  <article className="approval">…</article>
</BorderBeam>
```

Featured pricing card with a softer, wider halo. Use for the one plan that should stand out on a dark page.

```tsx
<BorderBeam
  size="pulse-outside"
  colorVariant="candy"
  glowSize={1.4}
  style={{ '--pulse-glow-boost': 1.2, '--beam-bloom-opacity': 0.8 } as CSSProperties}
>
  <div className="plan" style={{ background: '#1d1d1d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16 }}>…</div>
</BorderBeam>
```

Light-mode product card. Use on white surfaces; set the theme and lift saturation a little.

```tsx
<BorderBeam theme="light" colorVariant="ocean" saturation={1.7} strength={0.9}>
  <div className="card" style={{ background: '#fff', borderRadius: 16 }}>…</div>
</BorderBeam>
```

Static brand accent that tracks the app theme. Use when the beam must not cycle hues.

```tsx
<BorderBeam
  colorVariant="ocean"
  staticColors
  theme={appTheme}   // 'dark' | 'light' from your theme state
  duration={2.8}
  style={{ '--beam-bloom-opacity': 1.4 } as CSSProperties}
>
  <div className="card">…</div>
</BorderBeam>
```

## Accessibility & performance

- **Reduced motion, rotate types.** `md`, `sm` and `line` ignore `prefers-reduced-motion`. Gate `active` yourself:

```tsx
import { useEffect, useState } from 'react';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}
```

- **Reduced motion, pulse types.** A built-in media block sets `animation: none !important` on the root and layers, which also removes the fade-in. `--beam-opacity-{id}` stays 0, so the glow is not shown at all, and the JS breathing loop is not registered. If the glow carries meaning, add a static cue (border colour, label).
- **ARIA.** None is set. Layers are pseudo-elements and an empty `div`, all `pointer-events: none`. Put `aria-busy`, a status label or a live region on the real control.
- **Offscreen.** An `IntersectionObserver` with a 256 px margin toggles `data-paused` (pauses every CSS animation with `!important`) and unregisters pulse instances from the loop.
- **Pulse loop.** One shared `requestAnimationFrame` loop for all pulse instances, throttled near 30 fps. It stops when none are registered.
- **Cost drivers.** Masks with `mask-composite`, conic and radial gradients and blur filters repaint every frame on rotate types. Higher `glowSize` widens blur radii; a wide halo on a large card is the most expensive setting. Each `line` instance animates six registered properties. Keep live beams few, and set `active={false}` when the state ends (inactive beams render no layers).
- **`pulse-outside` measuring.** A `ResizeObserver` on the first child rescales the glow per axis (reference 350 x 140 px, clamped 0.35 to 4).
- **`@property`** is needed for interpolated rotate motion (Chrome 85+, Safari 15.4+, Firefox 128+). Without it motion steps. The pulse breathing does not need it.
- **SSR.** `theme="auto"` renders dark on the server and may render light on the client's first pass, which can mismatch. Pass an explicit theme from your theme state.

## Common mistakes

- **Wrapper width.** The wrapper is a block `<div>` and the beam traces the wrapper, not the child. Put it in a flex or grid parent, or give it `display: inline-block` / `width: fit-content`, or make the child fill it.
- **Clipping.** Rotate types and `pulse-inner` set `overflow: hidden` plus the radius on the wrapper. A child's `box-shadow`, open popovers and outside focus rings get cut. Put shadows on the wrapper; portal popovers.
- **Radius detection.** Read from the first element child's `border-top-left-radius`. If that element is not the rounded one, pass `borderRadius`. Only the first child counts.
- **`<style>` sibling.** The component renders `<style>` then the wrapper. Selectors like `.row > :first-child` or `:nth-child` in the parent will count the `<style>`.
- **`pulse-outside` needs an opaque child with a 1 px border**, and ancestors that do not clip the halo. Its core and bloom sit at `z-index: -1` behind the child.
- **`style` knobs without a cast.** `style={{ '--beam-hue-base': '40deg' }}` fails type-checking in TSX. Cast with `as CSSProperties`, as in the recipes.
- **Glow spread X / Y on `pulse-outside`.** The component writes `--pulse-glow-sx` / `--pulse-glow-sy` inline from its size measurement after your `style`, so your values are overwritten. Use `--pulse-glow-boost` (or `glowSize`) on `pulse-outside`; the spreads work on `pulse-inner`.
- **Hue knobs on pulse types.** Pulse hue rotates a full 360 degrees continuously (16 s inner, 14 s outside) and ignores `hueRange`. `--beam-hue-base` only offsets that rotation, so it does not tint. Pick warmth with `colorVariant` or set `staticColors`.
- **Brightness and saturation with `staticColors` or `mono` on rotate types.** On `md`, `sm` and `line` the stroke and inner-glow filters ride the hue-shift animation. With static colours those two layers get no filter, so `brightness` and `saturation` only reach the bloom.
- **Forest, Candy, Ice, Gold on `sm` and `line` (1.4.1).** Many colour stops in those types' tables for these four palettes are written `rgba(r, g, b,, a)`, which is invalid CSS. The declarations holding them are dropped, so layers can go missing. Use these palettes with `md` or the pulse types, or check the result in the browser.
- **Core that drops the fade.** Overriding the root `animation` without `beam-fade-in-{id}` leaves everything at opacity 0.
- **Studio preview vs snippet.** The Studio preview always passes `duration`, `brightness` and `saturation`, but its snippet omits them at 1.96 / 2.4, 1.3 and 1.2. For `line` (package default 3.1 s), the pulse types (2.3 s, own brightness) and light theme (own saturation) the app will differ unless you write them out. The React snippet also omits `theme` when the Studio is light.
- **Port palettes.** React Native and SwiftUI accept only `colorful`, `mono`, `ocean`, `sunset`. A Studio port snippet with `forest`, `candy`, `ice` or `gold` will not compile. The SwiftUI init takes labelled arguments in declaration order (`size, colorVariant, theme, staticColors, duration, active, borderRadius, brightness, saturation, hueRange, strength`), so reorder the Studio's Swift snippet if it does not compile.

## Detecting a fit in a codebase

| Signal to grep for | Suggest |
| --- | --- |
| Chat composers where the reply takes more than 3 s: `<textarea` with `onSubmit`, `ChatInput`, `Composer`, `PromptInput`, `useChat`, `isStreaming`, `status === 'streaming'` | `md` around the composer, `active={isStreaming}`; calm composer recipe for restrained brands |
| Agent or job status: `Thinking…`, `Generating`, `Working…`, `Agent is running`, `aria-busy` | `md` or `pulse-inner` on the card while the state holds |
| Search: `type="search"`, `SearchBar`, `CommandMenu`, `cmdk`, `isSearching`, `isFetching` | `line`, optionally the comet recipe |
| CTA or AI action buttons to highlight: `Sparkles`, `Wand` icons, "Generate", "Ask AI", "Get started" | `pulse-inner` around the button |
| A prompt input to highlight while idle (the main field on an empty state or landing) | `pulse-outside` around the input |
| Featured cards: `featured`, `recommended`, `popular`, `highlight` on pricing or plan cards | `pulse-outside` with boost, featured pricing recipe |
| Pending or selected: `needsApproval`, `pendingReview`, `isSelected` | `pulse-inner`, `gold` or `mono` |
| Brand colours in theme config (`--brand`, `primary: '#...'` in Tailwind config) | Nearest palette plus `--beam-hue-base`, or `staticColors` |
| Hand-rolled beams: `conic-gradient` + rotate `@keyframes`, `animate-border`, `shine-border`, `magic-border`, `border-beam` classes | Replace with `<BorderBeam>`; port bespoke motion into `css` |
| Light mode: `bg-white` cards, `data-theme="light"`, `next-themes`, `prefers-color-scheme` | Pass `theme` from the theme state |
| React Native with Skia (`@shopify/react-native-skia`) or SwiftUI targets | The ports, with the four shared palettes |
