# Metal — Pro

Real-time WebGL2 liquid metal (`metal-fx` v2, Paper Shaders `liquidMetal` engine) for pill buttons, circular icon buttons, metal-filled text and "New" badges, with every Studio knob mapped to code.

## When to use

### Where it goes

The author's placement rules. Follow them before the general list below.

- **A large heading**: highlight a hero `h1` or key headline with the Text type, `<MetalText>`.
- **Badges** such as "New" or "Pro": the Badge type, `<MetalBadge>`.
- **CTA buttons that sell something**, such as "Get Pro", "Upgrade" or "Start trial": the Button type, `<MetalFx variant="button">`.

All metal on a page shares one colour; keep metal elements apart rather than side by side.

More situations it fits:

- The single premium CTA on a screen: "Upgrade to Pro", "Get Pro", "Start trial" (Button type).
- The send button of an AI chat composer (Circle button type), reflecting on the model/mode chip beside it, with the cursor bend.
- A tier word in a pricing, plan or account card: "Plan **Pro**" (Text type), with the preceding label catching the metal on its glyphs.
- A "New" pill next to a feature, tab or menu label (Badge type).
- Dark UI. Proximity reflections only run in dark theme, and the presets were tuned for dark grounds first.
- Marketing hero CTAs where a custom material (your own tint, speed, stripe density) replaces the three bundled presets.

### When not to use

- Several metal elements that need different colours or themes on one page. One shared renderer draws one material for all of them.
- Lists, grids, table rows, repeated cards. Each instance costs a canvas, a glow SVG, and per-frame compositing; the cursor light and bend add pointer-rate work.
- Anything that must look identical without WebGL2. The fallback is the plain child.
- Secondary or destructive actions. Metal pulls the eye.
- Touch-only products on the web: the cursor bend and cursor reflection need a fine pointer. Use the native ports' tilt instead.

## Install

```bash
npm install metal-fx
pnpm add metal-fx
yarn add metal-fx
```

```tsx
import { MetalFx, MetalText, MetalBadge, useMetalBend, useMetalTextReflection } from 'metal-fx';
```

- Current: `metal-fx` 2.x. React only; peer deps `react` and `react-dom` >= 18. ESM (`dist/index.es.js`) and CJS (`dist/index.cjs`) with types.
- Requires WebGL2 (`isMetalFxSupported()`). Unsupported: `<MetalFx>` renders the child inside `div.metal-fx-fallback[data-metal-fx-unsupported]`.
- CSS is injected into `<head>` (`#metal-fx-styles`) on import.
- No `"use client"` directive in the package. In the Next.js App Router, import from a `"use client"` file and render client-only (see SSR below).
- Ports (not on npm; in the metal-fx repo under `ports/`):
  - React Native `metal-fx-native` 0.1.0: `npm install metal-fx-native @shopify/react-native-skia react-native-reanimated react-native-worklets` (Skia >= 2, Reanimated >= 4, React Native >= 0.78). Expo needs `expo run:ios` / `run:android`.
  - SwiftUI `MetalFxKit`, iOS 17+: `.package(path: "ports/ios/MetalFxKit")`, build through Xcode so the Metal shader compiles.
  - No cursor on a phone: device tilt drives the bend; the cursor light is web-only.

## Basic usage

```tsx
import { MetalFx, MetalText, MetalBadge } from 'metal-fx';
<MetalFx preset="chromatic" strength={1}>
  <button>Upgrade to Pro</button>
</MetalFx>
<MetalText font="500 24px/1.2 Inter" color="#E2E2E2">Pro</MetalText>
<MetalBadge>New</MetalBadge>
```

Circle button with bend, rim and reflection:

```tsx
import { useMemo, useRef } from 'react';
import { MetalFx, useMetalBend } from 'metal-fx';

export function SendButton() {
  const chipRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  useMetalBend(ref);
  const targets = useMemo(() => [chipRef], []);
  return (
    <>
      <button ref={chipRef} className="chip">Auto</button>
      <MetalFx ref={ref} preset="chromatic" variant="circle" innerShadow strength={0.81} reflectionTargets={targets}>
        <button type="button" aria-label="Send" style={{ width: 40, height: 40, borderRadius: 999 }}>↑</button>
      </MetalFx>
    </>
  );
}
```

React Native and SwiftUI equivalents are in Studio → code mapping.

## Full option reference

Studio source: `sites/home/src/studio/metal-v2.tsx`. Groups below follow the Studio's control column top to bottom. "(free)" marks what the public detail page or its Copy prompt also exposes.

### Version and Type

| Control | Values | Default | Effect |
|---|---|---|---|
| Version | `v2` \| `v1` | `v2` | v2 = `metal-fx` 2. v1 = `metal-fx@1.0.4` (see Legacy v1). (free) |
| Type | Circle button \| Button \| Text \| Badge | Circle button | Picks the component and resets Strength, Shader scale, Ring width and Metal opacity to that type's baseline. Circle button and Text are (free); Button and Badge are Studio-only. |

Type to code:

| Type | Component | Baselines applied on switch |
|---|---|---|
| Circle button | `<MetalFx variant="circle">` + `useMetalBend` | strength 81 %, shaderScale 1.3, ring 2 px |
| Button | `<MetalFx>` (`variant="button"`, the default) + `useMetalBend` | strength 63 %, shaderScale 1.6, ring 1 px |
| Text | `<MetalText>` + `useMetalTextReflection` | strength 90 %, shaderScale 2.8, metalOpacity 0.62 |
| Badge | `<MetalBadge>` | strength 90 %, shaderScale 1.6, metalOpacity 0.8 |

### Color (Circle button and Button only)

| Prop | Values | Default |
|---|---|---|
| `preset` | `"chromatic"` \| `"silver"` \| `"gold"` (free) | `"chromatic"` |

Paper's shader hardcodes near-white and near-black stripe endpoints, so every preset is the same silver material with a colour-burn tint (`colorTint`, alpha = burn amount) and a JS-side opacity (`shaderOpacity`). Exact values from `engine/presets.ts`:

| Preset | Theme | `colorTint` | `shaderOpacity` | Other overrides |
|---|---|---|---|---|
| chromatic | dark | `#88ccff2e` | 1 | shiftRed 0.75, shiftBlue 0.75, repetition 2, softness 0.09 |
| chromatic | light | `#66b0ff99` | 1 | shiftRed 0.6, shiftBlue 0.6 |
| silver | dark | `#ffffff66` | 0.88 | none |
| silver | light | `#ffffff40` | 1 | none |
| gold | dark | `#ffcc55cc` | 0.92 | speed 0.85 |
| gold | light | `#f7d488aa` | 1 | none |

Shared base (all presets): `colorBack #00000000`, speed 1, repetition 1.5, softness 0.05, shiftRed 0.3, shiftBlue 0.3, distortion 0.1, contour 0.4, angle 90, shape `SHAPE_NONE`, scale 1, rotation 0, offsets 0, origin 0.5/0.5, world 0×0, fit `FIT_CONTAIN`.

`MetalText` and `MetalBadge` hardcode `preset="chromatic"`; the Studio hides Color for them.

### Theme

| Prop | Values | Default | Effect |
|---|---|---|---|
| `theme` | `"auto"` \| `"dark"` \| `"light"` (free) | `"auto"` | Selects the preset's dark or light block. `auto` follows `prefers-color-scheme` live and resolves to `dark` on the server. |

The Studio passes its own dark/light app theme to the stage and does not write `theme` into the snippet, so exported code runs on `auto`. Theme-dependent defaults in the injected CSS: wrapper fill `#272727` / text `#f8f8f8` (dark), `#ffffff` / `#1d1d1d` (light). Reflections run only when the resolved theme is `dark`. Studio user presets (Presets menu) save one value set per theme and apply the matching side.

### Metal effect styling

| Studio knob | Prop | Type | Range / step | Default | Effect |
|---|---|---|---|---|---|
| Strength | `strength` (free) | number | 0–100 %, step 1 → prop 0–1 | per type (81/63/90/90 %); package default 1 | Multiplies metal opacity and glow alpha; the shader keeps animating at full intensity. |
| Shader scale | `shaderScale` | number | 0.6–4, step 0.05 | per type (1.3 / 1.6 / 2.8 / 1.6) | Zoom on the pattern. Low = large liquid shapes; high = fine busy grain. |
| Ring width (ring types) | `ringCssPx` | number, CSS px | 0.5–4, step 0.25 | circle 2, button 1 | Band thickness. |
| Metal opacity (Text, Badge) | `metalOpacity` | number | 0–1, step 0.01 | Text 0.62, Badge 0.8 | How much metal shows over the base colour or white fill; multiplied with `strength`. |

### Badge layers (Badge only)

| Studio knob | Prop | Range / step | Default | Effect |
|---|---|---|---|---|
| Core size | `core.size` | 5–100 %, step 1 | 49 | Size of the white radial core ellipse, % of the box. |
| White core | `core.r` | 0–100 %, step 1 | 46 | Solid radius of the core, % of the ellipse. |
| Core blur | `core.blur` | 0–100 %, step 1 | 100 | Ramp width from solid to clear. |
| Core strength | `core.a` | 0–1, step 0.01 | 0.94 | Opacity of the core. |
| Top gradient | `gradient` | 0–1, step 0.01 | 0 | White wash from top to bottom. |
| Inner glow | `glow` | 0–1, step 0.01 | 0.41 | The two soft inset white glows; hairline rims stay fixed. |

`core` must be passed whole: `{ r, blur, a, size }` (`MetalBadgeCore`). Defaults are exported as `METAL_BADGE_DEFAULTS`. Package-only badge props: `children` (default `"New"`), `scale` (size multiplier on the 45×25 design), `textColor` (default `#323232`), `theme`, `reflectionTargets`.

### Glow (hidden for Badge and when No Glow is on)

| Studio knob | Code | Range / step | Default | Effect |
|---|---|---|---|---|
| Text glow gain (Text) | `<MetalText glowGain>` | 0–6, step 0.05 | 2.5 | Glow multiplier when `glow` is on. |
| Intensity | `setGlowConfig({ haloOpMul })` | 0–2, step 0.01 | 2 | Overall halo opacity. Engine-wide. |
| Appear | `setGlowConfig({ relocFadeMs })` | 0–2000 ms, step 10 | 300 | Fade-in when the halo moves to a new hotspot. Engine-wide. |
| Disappear | `setGlowConfig({ relocFadeOutMs })` | 0–3000 ms, step 10 | 450 | Fade-out at the old hotspot. Engine-wide. |

Per-instance glow props on `<MetalFx>`: `disableGlow` (free), `glowGain` (free, default 1, clamped to 0..1 after multiplying with `strength`), `glowMode` (`"mask"` \| `"ring"`, package-only, see Core customization). `GLOW_DEFAULTS` holds every other glow constant; markup keys (`GLOW_MARKUP_KEYS`) rebuild the SVG when changed.

### Cursor bend (Circle button and Button; hidden when No Bend is on)

| Studio knob | Code | Range / step | Default | Effect |
|---|---|---|---|---|
| Strength | `setBendConfig({ strength })` | 0–3, step 0.01 | 0.74 | Amplitude of the whole displacement field. |
| Reach | `setBendConfig({ reach })` | 0–120 px, step 1 | 36 | How far outside the edge the cursor is felt. |
| Max dent | `setBendConfig({ maxDisp })` | 0–30 px, step 0.5 | 9 | Displacement cap. |

Engine-wide. Needs `useMetalBend(ref)` with `ref` on `<MetalFx>`. Other `BendConfig` fields (package-only): `applyTo` (`"ring"` default, `"all"` bends content too via `feDisplacementMap`), `fadeInMs` 200, `fadeOutMs` 350, `smoothMs` 140, `blob` 13, `liquidBlob` 10, `gain` 0.6, `pressGain` 0.55, `pullGain` 0.49, `press` 5, `liquid` 7.5, `liquidReach` 8, `liquidStiffness` 53, `liquidDamping` 9, `stiffness` 260, `damping` 13, `mass` 1, `follow` 0.32, `mapRes` 2, `smooth` 0.25.

### Cursor reflection (hidden when No Cursor Reflection is on)

| Studio knob | Code | Range / step | Default | Effect |
|---|---|---|---|---|
| Distance | `setCursorLightConfig({ cursorDistance })` | 4–200 px, step 1 | 186 | How far from the ring the pointer is still lit. |
| Specular | `setCursorLightConfig({ cursorStrength })` | 0–4, step 0.05 | 3.35 | Intensity of the mirrored ring on the pointer. |
| Falloff | `setCursorLightConfig({ cursorFalloff })` | 2–60 px, step 1 | 37 | Distance at which light has halved (inverse square). |
| Reach | `setCursorLightConfig({ cursorReach })` | 1–30 px, step 0.5 | 11.5 | How far the light spreads across the pointer body. |

Engine-wide. Needs a pointer sprite: `setCursorSprite({ src, width, height, hotX, hotY })` with an image of the platform's real arrow. The package ships none (the site uses a macOS arrow on macOS only); without one this effect is off. Other `CursorLightConfig` fields (package-only): `enabled` true, `reach` 56, `fadeMs` 200, `cursorDiffuse` 1.4, `cursorDepth` 0.4, `cursorEdge` 0, `cursorBlur` 0.5, `cursorZoom` 3, `spill` false (+ `spillRadius` 48, `spillStrength` 0.55, `spillOffset` 0.35, `spillLumGain` 0.7, `spillSaturation` 1.3, `spillInside` 0.5, `spillBlur` 0), `catchLight` false (+ `catchFollow` 0.25, `catchGain` 1).

### Options (toggles)

| Toggle | Shown for | Code | Default |
|---|---|---|---|
| No Glow | all but Badge | `disableGlow` (free) | off |
| Text Glow | Text | `<MetalText glow>` | off |
| No Reflection | all but Badge | omit `reflectionTargets` (free) | off (reflection on) |
| No Inner Shadow | all but Badge | ring: omit `innerShadow`; text: `innerShadow={null}` | off (rim on) |
| No Bend | ring types | `setBendConfig({ enabled: false })`, drop `useMetalBend` | off |
| No Cursor Reflection | all | `setCursorLightConfig({ cursor: false })` (free) | off |
| Play / Pause button | all | `paused` (free) | playing in the Studio |

`innerShadow` on `<MetalFx>`: `true` uses `RIM_DEFAULTS` `{ offsetY: 1, blur: 0.5, alpha: 0.9, color: '#ffffff' }`, or pass a partial object. On `<MetalText>` it is `TextInnerShadow | null`, default `{ offsetY: 1, blur: 0.5, alpha: 0.9 }`.

### Other public props (package, not in the Studio)

| Prop | Type | Default | Effect |
|---|---|---|---|
| `borderRadius` | number (px) | read from the child's computed `border-radius` | Explicit ring radius. `circle` always uses `min(w, h) / 2`. |
| `normalizeHostStyles` | boolean | `true` | Strips the direct child's background, border, outline and box-shadow. |
| `scale` | number | 1 | Master multiplier for every internal pixel constant (for CSS `zoom` or doubled sizing). |
| `mask` | `MaskFn` | none | Custom alpha mask in device px; replaces the ring punch. |
| `glowMode` | `"mask"` \| `"ring"` | `"mask"` | Glow placement when `mask` is set. |
| `className`, `style`, other div attributes | | | Forwarded to the wrapper `div.metal-fx-root`. |

`MetalText` also takes `className` (on the inner span) and `theme`.

## Studio → code mapping

The Studio snippet is built in `metal-v2.tsx`: one import line, then config calls for any engine-wide knob that left its default, then the component. Props equal to the type's baseline are omitted.

```tsx
import { MetalFx, useMetalBend, setGlowConfig, setBendConfig, setCursorLightConfig } from 'metal-fx';

setGlowConfig({ haloOpMul: 1.2, relocFadeMs: 600 }); // halo
setBendConfig({ strength: 1.1, reach: 48 }); // cursor bend
setCursorLightConfig({ cursorDistance: 120 }); // cursor reflection

const ref = useRef(null);
useMetalBend(ref); // cursor-driven liquid dent

<MetalFx ref={ref} preset="gold" variant="circle" strength={0.7} shaderScale={1.8} ringCssPx={1.5} innerShadow reflectionTargets={[siblingRef]}>
  <button aria-label="Send"><ArrowUpIcon /></button>
</MetalFx>
```

Rules the builder follows:

- `strength` = slider / 100, omitted at 1. `num()` rounds to 3 decimals.
- `shaderScale`, `ringCssPx`, `metalOpacity` only when they differ from the type baseline.
- Glow config is emitted only while No Glow is off; bend config only for ring types.
- `theme` and `paused` are never emitted.
- Text: `font="500 24px/1.2 Inter, sans-serif" color="#E2E2E2"` always; `innerShadow={null}` when the rim is off; `glow` or `glow glowGain={x}` when Text Glow is on.
- Badge: `core={{ r, blur, a, size }}` only if any core knob moved; `gradient` / `glow` only when changed.
- Copy prompt wraps the snippet: "Use exactly this configuration — it was tuned by hand in the Libraries.dev Studio", then "Keep the prop values exactly as given; adapt only the child content to my app."

Name differences (Studio label, agent param key, prop):

| Studio label | Agent param | Web prop / call | React Native | SwiftUI |
|---|---|---|---|---|
| Type | `type` | component + `variant` | same | same |
| Color | `preset` | `preset` | `preset` | `preset: .gold` |
| Strength | `strength` (0–100) | `strength` (0–1) | `strength` | `strength:` |
| Shader scale | `shaderScale` | `shaderScale` | `shaderScale` | `shaderScale:` |
| Ring width | `ring` | `ringCssPx` | `ringWidth` | `ringWidth:` |
| Metal opacity | `metalOpacity` | `metalOpacity` | `metalOpacity` | `metalOpacity:` |
| No Glow | `disableGlow` | `disableGlow` | `glow={false}` | `glow: false` |
| No Reflection | `disableReflection` | omit `reflectionTargets` | drop `id` + `<MetalReflection of>` | drop `id:` + `.metalReflection(of:)` |
| No Inner Shadow | `innerShadow` (inverted) | `innerShadow` | `innerShadow` | `innerShadow:` |
| No Bend | `noBend` | `setBendConfig({ enabled: false })` | `tilt={false}` | `tilt: false` |
| No Cursor Reflection | `noCursor` | `setCursorLightConfig({ cursor: false })` | n/a | n/a |
| Intensity / Appear / Disappear | `glowIntensity` / `glowAppear` / `glowDisappear` | `haloOpMul` / `relocFadeMs` / `relocFadeOutMs` | not emitted | not emitted |
| Bend Strength / Reach / Max dent | `bendStrength` / `bendReach` / `bendMaxDent` | `strength` / `reach` / `maxDisp` | not emitted | not emitted |
| Cursor Distance / Specular / Falloff / Reach | `cursorDistance` / `cursorSpecular` / `cursorFalloff` / `cursorReach` | `cursorDistance` / `cursorStrength` / `cursorFalloff` / `cursorReach` | n/a | n/a |
| Core size / White core / Core blur / Core strength | `badgeCoreSize` / `badgeCore` / `badgeCoreBlur` / `badgeCoreStrength` | `core.size` / `core.r` / `core.blur` / `core.a` | not emitted | not emitted |
| Top gradient / Inner glow | `badgeGradient` / `badgeGlow` | `gradient` / `glow` | `gradient` / `glow` | `gradient:` / `glow:` |
| Text Glow / Text glow gain | `textGlow` / `textGlowGain` | `glow` / `glowGain` | `glow` / `glowGain` | `glow: true` / `glowGain:` |

Port snippets the Studio emits (ring type, reflection on):

```tsx
import { MetalFx, MetalReflection } from 'metal-fx-native';

<MetalFx preset="chromatic" variant="circle" strength={0.81} innerShadow id="ring">
  <View style={{ width: 40, height: 40 }}><ArrowUp /></View>
</MetalFx>
<MetalReflection of="ring"><Chip /></MetalReflection>
```

```swift
import MetalFxKit

MetalFx(variant: .circle, preset: .chromatic, strength: 0.81, innerShadow: true, id: "ring") {
    Image(systemName: "arrow.up").frame(width: 40, height: 40)
}
Text("Auto").metalReflection(of: "ring")
```

Text on the ports: `<MetalReflectionText of="pro" strength={0.64}>Plan</MetalReflectionText>` + `<MetalText fontSize={24} fontWeight="500" id="pro">Pro</MetalText>`; Swift `Text("Plan").metalReflection(of: "pro", strength: 0.64, style: .glyphs)` + `MetalText("Pro", id: "pro")`. The RN port's `theme` defaults to `"dark"` (web: `"auto"`).

## Core customization

v2 has no `core` code param. `METAL_SPEC.core` in `services/studio-agent/spec.ts` is a WebGL 1 fragment-shader contract that only the v1 bench wires (see Legacy v1). The v2 engine compiles Paper's `liquidMetal` GLSL ES 3.00 shader unmodified and exposes no shader prop. Deeper v2 changes go through these public APIs:

| Goal | API |
|---|---|
| Change the material (tint, flow speed, stripes, dispersion, warp, angle) | `setSharedPresetMode(mode: PresetMode \| null)` |
| Metal inside an arbitrary shape (icon, glyph, logo silhouette) | `mask: MaskFn` prop, `glowMode` |
| Rim colour and softness | `innerShadow={{ offsetY, blur, alpha, color }}` |
| Glow, bend, cursor light, reflection shadow | `setGlowConfig`, `setBendConfig`, `setCursorLightConfig`, `setReflectionOccluderConfig` (each with a `reset*` and `*_DEFAULTS`) |
| Non-React integration or custom deformation | `createInstance`, `updateInstance`, `destroyInstance`, `setInstanceDeform(canvas, deform, layers?)`, `redrawInstance`, `pauseShared` / `resumeShared` |

Contract for `setSharedPresetMode`:

- Input: a full `PresetMode`. Start from `PRESETS.<name>.modes.<theme>` and override fields.
- Global: one GL program feeds every instance, so the mode applies to all metal on the page. Once set, it overrides every `preset` / `theme` prop until cleared.
- `null` hands control back to `preset` / `theme`, but the current material stays until an instance next re-applies its preset (a `preset` or `theme` change).
- Keep `shape: SHAPE_NONE` and a fully transparent `colorBack` for rings; other shapes or an opaque backdrop fill the punched centre.
- Ranges: `repetition` 1–10, `softness` 0–1, `shiftRed` / `shiftBlue` -1–1, `distortion` 0–1, `contour` 0–1, `angle` 0–360, `scale` 0.01–4. `speed` multiplies time. `shaderOpacity` is a JS-side alpha multiply. `colorTint` is `#rrggbbaa`, alpha = burn amount.
- Calling it creates the shared renderer, which throws without WebGL2. Guard with `isMetalFxSupported()` and call it in an effect, never at module scope (SSR).

Worked example 1: a rose-gold material, slower and denser.

```tsx
import { useEffect } from 'react';
import { MetalFx, PRESETS, isMetalFxSupported, setSharedPresetMode, type PresetMode } from 'metal-fx';

const ROSE_GOLD: PresetMode = {
  ...PRESETS.gold.modes.dark,
  colorTint: '#ff9a8ab3',
  speed: 0.6,
  repetition: 3,
  distortion: 0.2,
  shiftRed: 0.45,
  shiftBlue: 0.2,
};

export function RoseGoldCta() {
  useEffect(() => {
    if (!isMetalFxSupported()) return;
    setSharedPresetMode(ROSE_GOLD);
    return () => setSharedPresetMode(null);
  }, []);
  return (
    <MetalFx preset="gold" theme="dark" strength={0.8}>
      <button style={{ height: 40, padding: '0 18px', borderRadius: 999 }}>Start trial</button>
    </MetalFx>
  );
}
```

Contract for `mask: MaskFn`:

- Signature: `(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => void`.
- `w` / `h` are device pixels; origin is the wrapper's top-left. Paint opaque shapes; the engine keeps the shader only where alpha was painted (`destination-in`) and skips the ring punch.
- Keep the function referentially stable (`useCallback`); a new function updates the instance.
- The glow assumes a ring: pass `disableGlow`, or `glowMode="ring"` for a full-fill shape (as `MetalBadge` does). The default `"mask"` samples points inside the mask and clips the halo to it.
- The wrapper still paints its fill and inset rims (`::before`, `::after`, `.metal-fx-inner`); clear them with CSS for a bare shape.

Worked example 2: a metal-filled star icon.

```tsx
import { useCallback } from 'react';
import { MetalFx, type MaskFn } from 'metal-fx';

const STAR_D = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

// In your CSS:
// .metal-bare { background: transparent !important; }
// .metal-bare::before, .metal-bare::after { box-shadow: none !important; }
// .metal-bare .metal-fx-inner { display: none !important; }

export function MetalStar({ size = 24, label = 'Favourite' }: { size?: number; label?: string }) {
  const mask = useCallback<MaskFn>((ctx, w, h) => {
    ctx.save();
    ctx.scale(w / 24, h / 24);
    ctx.fill(new Path2D(STAR_D));
    ctx.restore();
  }, []);
  return (
    <MetalFx className="metal-bare" mask={mask} disableGlow borderRadius={0} shaderScale={2.4}>
      <span role="img" aria-label={label} style={{ display: 'block', width: size, height: size }} />
    </MetalFx>
  );
}
```

## Recipes

Quiet silver CTA. Use when: a restrained, "expensive" upgrade button in a dark nav.

```tsx
<MetalFx preset="silver" strength={0.55} shaderScale={1.3} glowGain={0.6}>
  <button style={{ height: 36, padding: '0 16px', borderRadius: 999 }}>Upgrade to Pro</button>
</MetalFx>
```

Chunky gold send button with a strong bend. Use when: a playful consumer chat app.

```tsx
import { useEffect, useMemo, useRef } from 'react';
import { MetalFx, resetBendConfig, setBendConfig, useMetalBend } from 'metal-fx';

export function GoldSend() {
  const ref = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  useMetalBend(ref);
  useEffect(() => {
    setBendConfig({ strength: 1.4, reach: 60, maxDisp: 14 });
    return () => resetBendConfig();
  }, []);
  const targets = useMemo(() => [chipRef], []);
  return (
    <>
      <button ref={chipRef} className="chip">GPT</button>
      <MetalFx ref={ref} preset="gold" variant="circle" ringCssPx={3} strength={0.9} innerShadow reflectionTargets={targets}>
        <button type="button" aria-label="Send" style={{ width: 44, height: 44, borderRadius: 999 }}>↑</button>
      </MetalFx>
    </>
  );
}
```

Calm halo. Use when: the glow reads too busy next to body copy.

```tsx
import { useEffect } from 'react';
import { resetGlowConfig, setGlowConfig } from 'metal-fx';

useEffect(() => {
  setGlowConfig({ haloOpMul: 1.1, relocFadeMs: 900, relocFadeOutMs: 1400 });
  return () => resetGlowConfig();
}, []);
```

Glowing plan name. Use when: a hero pricing card where the tier word should shine.

```tsx
<MetalText
  font="600 40px/1.1 Inter, sans-serif"
  color="#D8D8D8"
  strength={1}
  metalOpacity={0.75}
  shaderScale={2.2}
  glow
  glowGain={3.5}
>
  Pro
</MetalText>
```

Softer "New" badge, larger. Use when: the badge sits on a settings row at 1.25× type size.

```tsx
<MetalBadge scale={1.25} metalOpacity={0.6} core={{ r: 55, blur: 80, a: 1, size: 60 }} gradient={0.2} glow={0.3}>
  New
</MetalBadge>
```

Container-edge reflection. Use when: the metal button sits inside a card whose edges should catch a faint echo.

```tsx
const cardRef = useRef<HTMLDivElement>(null);
const targets = useMemo(() => [{ ref: cardRef, strength: 0.3 }], []);

<div ref={cardRef} className="card">
  <MetalFx preset="chromatic" theme="dark" reflectionTargets={targets}>
    <button>Upgrade</button>
  </MetalFx>
</div>
```

A target that contains the button gets the reflection on its nearest vertical and horizontal inner edges.

Cursor light with a pointer sprite. Use when: a macOS-heavy desktop audience and a showcase page.

```tsx
import { useEffect } from 'react';
import { setCursorLightConfig, setCursorSprite, resetCursorLightConfig } from 'metal-fx';

useEffect(() => {
  if (!/Mac/.test(navigator.platform)) return;
  setCursorSprite({ src: '/cursors/arrow@2x.png', width: 17, height: 23, hotX: 4, hotY: 4 });
  setCursorLightConfig({ cursorDistance: 120, cursorStrength: 2.5, spill: true });
  return () => { setCursorSprite(null); resetCursorLightConfig(); };
}, []);
```

The sprite must match the OS pointer pixel for pixel, or the swap shows. Ship your own artwork.

## Accessibility & performance

- No built-in `prefers-reduced-motion` handling for the shader, glow or bend. Pass `paused` and `disableGlow` yourself, and `setBendConfig({ enabled: false })` if the bend should stop too.
- The cursor sprite swap turns itself off under `prefers-reduced-motion`, `forced-colors`, non-fine or non-hover pointers, pen/touch input, pinch-zoom, and while typing. It hides the OS cursor with an inline style on one element and restores it on leave, blur, hide, keydown or any error. A frame-time watchdog disables it if it gets slow. macOS enlarged-pointer settings are not detectable: offer a way to turn it off.
- All engine layers (canvas, glow, rim, reflection, bend SVG, sprite) are `aria-hidden`. The child keeps its role and focus; label icon-only children. `MetalText` / `MetalBadge` put `aria-label` on the text span.
- Cost model: one shared WebGL2 context and program; the GL canvas is ~96 px base with DPR capped at 2; the main loop composites at ~15 fps (66 ms); glow luminance readback every 1500 ms; reflections repaint at the same 66 ms throttle.
- `useMetalBend` redraws the instance at pointer rate (capped at 60 fps, skipped when nothing moved). Several bent rings on screen multiply this.
- Cursor light tracking runs only on fine pointers and only while the pointer is within reach of a ring.
- Offscreen instances (IntersectionObserver, 64 px margin) are skipped; the loop stops when all are offscreen or the tab is hidden. The GL context is released when the last instance unmounts.
- Expensive settings: high `shaderScale` does not cost more (the GL canvas is fixed), but more instances, `reflectionTargets` on many elements, `applyTo: 'all'` bend, `spill`, and large `setGlowConfig` stroke/blur markup values do.
- SSR: on the server `isMetalFxSupported()` is false, so the fallback markup renders; the client renders the canvas markup. Render client-only (`next/dynamic` with `ssr: false`, or a mounted flag) to avoid a hydration mismatch.

## Common mistakes

- Different `preset` or `theme` on two instances. The shared renderer draws one material; the last applied wins. `MetalText` and `MetalBadge` force `chromatic`, which will override a gold `MetalFx` on the same page.
- Engine configs (`setGlowConfig`, `setBendConfig`, `setCursorLightConfig`, `setSharedPresetMode`) are global singletons. Set them in one place and reset them on unmount, or one screen's tuning leaks into the next.
- Child background disappears. `normalizeHostStyles` (default on) strips the direct child's background, border, outline and box-shadow; the wrapper paints `#272727` / `#ffffff`. Set the fill on `<MetalFx style={{ background }}>`, or nest your styled layer one level down as `MetalBadge` does.
- Children without a size. The wrapper sizes to the child. Give icon buttons width and height, or size the wrapper and set the child to `width: 100%; height: 100%`.
- Toggling `innerShadow` on a mounted `<MetalFx>`. The rim layer is built when the instance mounts; change `key` to remount after switching it.
- Inline `innerShadow={{ ... }}` on `<MetalText>` redraws the rim on every render (the effect depends on object identity). Hoist the object.
- Inline `reflectionTargets` arrays re-register reflections every render. Memoise them.
- Hooks against unmounted refs. `useMetalBend` and `useMetalTextReflection` run once per ref; if the metal element renders conditionally, move it into its own component.
- `setSharedPresetMode` at module scope or without a WebGL2 check. It creates the renderer and throws without WebGL2.
- Setting Studio-range values past the knobs in code: `strength` above 1 is clamped; `shaderScale` works outside 0.6–4 but was never tuned there.
- Expecting reflections or the cursor light on light theme or touch devices. Reflections are dark-only; cursor effects need a fine pointer.
- The wrapper, including the child, stays invisible until the first metal frame lands.
- React StrictMode in development: the Libraries.dev pages mount without it because the double mount froze the shared renderer.

## Detecting a fit in a codebase

| Signal to grep | Suggest |
|---|---|
| `Upgrade to Pro`, `Get Pro`, `Go Pro`, `Upgrade`, `Start trial`, `/pricing` links in navs, sidebars, paywalls | Button type: `<MetalFx preset="silver" strength={0.6}>` around that one CTA |
| Chat composer: `<textarea` with `Ask`, `Message`, `Build anything`; `aria-label="Send"`; `ArrowUp`, `SendIcon`, `PaperPlane` | Circle button + `useMetalBend`, reflecting on a sibling chip |
| Model / mode pickers beside send (`Auto`, `Agent`, `model-select`, `ModelPicker`) | `reflectionTargets` |
| Hero or page headline: the `<h1>` on a landing, pricing or launch page, a key display heading | `<MetalText>` on that heading |
| Pricing and plan UI: `plan`, `tier`, `Pro`, `Premium`, `Plus`, `Enterprise` | `<MetalText>` on the tier word, `useMetalTextReflection` on the preceding label |
| `New`, `Beta` badges: `badge--new`, `<Badge>New</Badge>`, `isNew` | `<MetalBadge>` |
| Hand-rolled shine: `shimmer`, `shine`, `conic-gradient` borders, `animate-border`, `gradient-border`, `border-beam` on a CTA | `<MetalFx>` with a preset or a custom `setSharedPresetMode` material |
| Brand colour requests ("rose gold", "copper", "blue steel") | `setSharedPresetMode` with a custom `colorTint` |
| Star/heart/logo icons that should read as metal | `mask` prop with a `Path2D` |
| React Native with Skia + Reanimated, or SwiftUI iOS 17+ | The `metal-fx-native` / `MetalFxKit` ports |

## Legacy v1

- Package: `metal-fx@1.0.4` (`npm install metal-fx@1`, or side by side `npm install metal-fx-v1@npm:metal-fx@1.0.4`). Plasma shader on WebGL 1. `MetalFx` only: no `MetalText`, `MetalBadge`, `useMetalBend`, `innerShadow`, `glowGain`, cursor light or `mask`.
- Studio v1 bench: Type Button / Circle, Color chromatic / silver / gold, Strength 0–100 step 1 (default 90), Shader scale 0.6–3 step 0.05 (baseline 1.6 / 1.3), Ring width 0.5–4 step 0.25 (baseline 1 / 2), toggles No Glow and No Reflection.
- `core` (agent param, v1 only): a complete WebGL 1 fragment shader (GLSL ES 1.00: `precision highp float;`, `gl_FragColor`, `texture2D`). Keep every uniform the stock source declares, with the same names and types (among them `u_time`, `u_resolution`, `u_color1`–`u_color7`, `u_alpha1`–`u_alpha7`, `u_shaderOpacity`), and multiply the output alpha by `u_shaderOpacity` so strength still works. Start from the stock source. Max 24,000 characters; it must compile in WebGL 1.
- v1 has no shader prop. The Studio exports a rebuilt core as `const metalShader = ...` beside the JSX, to swap into a fork's `shaders.ts`.
