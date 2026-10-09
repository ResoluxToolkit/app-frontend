# Bot avatars — Pro

Animated 3D bot avatars for AI agents: eighteen glossy bodies with living faces, three states (idle, working, sleeping), every Studio knob for look, motion and the jump. React on a 2D canvas, no WebGL, no runtime dependencies. npm package `bot-avatars` (0.1.1).

## When to use

### Where it goes

The author's placement rules. Follow them before the general list below.

- **Anything avatar related for a bot or agent**: assistant avatars in a thread, agent lists and sidebars, agent pickers, job headers and empty-state mascots.
- The state follows the agent's real status (see the status mapping under Common mistakes).

More situations it fits:

- The avatar next to an assistant's reply: `working` while the model streams, `default` (idle) once the answer lands.
- A roster or sidebar of agents: one body type and colour per agent, `working` for running, `sleeping` for offline, paused or scheduled ("Back at 9:00").
- The header of a long-running agent job or background task.
- An agent picker, onboarding step or "create your agent" flow where the user picks a body, colour and face.
- Empty states, success screens and mascots, at 96 to 200 px, with a livelier jump and the whirl.
- Brand-matched bots: body colour from the brand palette, ink chosen for contrast, lighting matched to the UI.

### When not to use

- Human user avatars. Use a photo or initials.
- Surfaces with no client JavaScript (email, static OG images). For those, render a PNG once with the exported renderer (see Core customization).
- Hundreds of simultaneously visible, animating avatars. Each is a live canvas; use `paused` or a still render for long lists.
- A generic loading indicator with no agent behind it.

## Install

```bash
npm install bot-avatars
pnpm add bot-avatars
yarn add bot-avatars
```

```tsx
import { BotAvatar } from 'bot-avatars';
```

- React component (`<BotAvatar>` renders a `<canvas>`, ref forwarded to it). Peer dependency `react >= 18`.
- ESM and CommonJS builds with types. `sideEffects: false`.
- No `"use client"` directive ships. In the Next.js App Router, wrap it in a `"use client"` file.
- SSR: the server emits an empty canvas; painting starts in a layout effect after mount.
- Ports (local to the repo, not on npm): React Native `bot-avatars-native` (react-native-skia + Reanimated, same prop names and defaults, `size` in points) and SwiftUI `BotAvatarsKit` (iOS 17+). The Studio's Install & Usage shows React only; the detail page shows all three.

## Basic usage

```tsx
import { BotAvatar } from 'bot-avatars';

<BotAvatar type="clover" state={busy ? 'working' : 'default'} />
```

React Native:

```tsx
import { BotAvatar } from 'bot-avatars-native';

<BotAvatar type="clover" state={busy ? 'working' : 'default'} size={64} />
```

SwiftUI:

```swift
import BotAvatarsKit

BotAvatar(type: .clover, state: busy ? .working : .default)
```

## Full option reference

Grouped as the Studio bench groups them (`sites/home/src/studio/avatars.tsx`). "(free)" marks what the public detail page tuner also offers. Studio sliders show percentages or milliseconds; the Range column gives the prop value (Studio value converted). Package defaults are listed; where the Studio starts elsewhere it is noted.

### Top rows: Type, Face, State

| Prop | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| `type` (free, 8 of 18) | `BotAvatarType` | `clover`, `flower`, `triangle`, `square`, `blob`, `ghost`, `circle`, `drop`, `star`, `droid`, `mech`, `alien`, `hexagon`, `cat`, `cloud`, `pill`, `pebble`, `puddle` | `clover` | Body shape; sets the default colour and face placement. Free page opens `clover flower star ghost mech circle hexagon square`. |
| `face` | `BotAvatarFace` | `eyes`, `mouth` | the type's own (`eyes` for all 18) | `mouth` adds a small mouth that morphs with the state. |
| `state` (free: `default`, `working`) | `BotAvatarState` | `default`, `working`, `sleeping` | `default` | Idle looks corner to corner and jumps now and then; working hops, every third hop a spin, with a smile and the odd laugh; sleeping drops the head, shuts the lids, breathes slowly and nods. Switches cross-animate. |

### Look

| Prop | Type | Range / step (prop units) | Default | Effect |
| --- | --- | --- | --- | --- |
| `size` (free: 96, 64, 32) | `number \| string` | Studio 16 to 200, step 2 (px); any CSS length in code | `64` (Studio starts at 96) | Layout box. The canvas overscans 1.5x and pulls back with negative margins. |
| `color` | `string` | Studio: 14 palette swatches plus custom; `#rgb`, `#rrggbb`, `rgb()`, `hsl()` | the type's palette colour | Body colour. |
| `brightness` | `number` | 0.5 to 1.5, step 0.01 | `1` | Lightness of the body colour. Code clamps to 0 to 2. |
| `saturation` | `number` | 0.5 to 1.5, step 0.01 | `1.5` | Saturation of the body colour; the default is more vivid than the palette. Code clamps to 0 to 2. |
| `ink` | `string` | Studio: 4 swatches plus custom | auto: `#1E1A33` (dark), or `#F7F5F2` on a body with luminance below 0.13 | Face colour. |
| `shading` | `BotAvatarShading \| boolean` | `plastic`, `crisp`, `smooth`, `flat` (`true` = crisp, `false` = flat) | `plastic` | `plastic`: per-pixel glossy material. `crisp`: lit rim with a clean edge. `smooth`: soft shadow and highlight, no edge. `flat`: depth only, no lighting. |
| `shadow` | `number` | 0 to 2, step 0.05 | `0.35` | Strength of the shadow side. Hidden for `flat`. |
| `highlight` | `number` | 0 to 2, step 0.05 | `1.3` | Strength of the lit side. Hidden for `flat`. |
| `light` | `number` (deg) | 0 to 360, step 5 | `265` | Light direction, clockwise from the top (265 is from the left). Studio label "Light angle". Hidden for `flat`. |
| `rim` | `number` | 0 to 2, step 0.05 | `0.5` | Fresnel rim strength in `plastic`, rim width in `crisp`. Hidden for `smooth` and `flat`. |
| `spread` | `number` | 0.4 to 2.5, step 0.05 | `1.55` | Highlight width in `plastic`, reach of the soft shading in `smooth`. Hidden for `crisp` and `flat`. |
| `depth` | `number` | 0.2 to 2, step 0.05 | `0.65` | Body thickness, seen when it turns or flips. Shown for every shading. |

Body palette (Studio Color swatches, deduplicated; label is the first type with that colour):

| Swatch | Hex | Types using it by default |
| --- | --- | --- |
| Clover | `#35B8FF` | clover, square |
| Flower | `#2FCB7A` | flower, blob, pebble |
| Triangle | `#DC48FF` | triangle |
| Ghost | `#F4F2FA` | ghost |
| Circle | `#9A62FF` | circle |
| Drop | `#1ED3C6` | drop |
| Star | `#FFD32B` | star |
| Droid | `#D5DBEA` | droid |
| Mech | `#95A6C4` | mech |
| Alien | `#9BE85A` | alien |
| Hexagon | `#FF2A2A` | hexagon, puddle |
| Cat | `#FF8C42` | cat |
| Cloud | `#CFE6FF` | cloud |
| Pill | `#7B77F0` | pill |

Ink swatches (Studio): Dark ink `#1F1B2E`, Light ink `#F6F4F0`, Sky `#35B8FF`, Magenta `#DC48FF`, plus custom.

Per-type presets (`botAvatarPresets`, exported). Face position is in the 100x100 body box.

| Type | Label | Color | faceX | faceY | faceScale |
| --- | --- | --- | --- | --- | --- |
| clover | Clover | `#35B8FF` | 50 | 50 | 1 |
| flower | Flower | `#2FCB7A` | 50 | 51 | 0.95 |
| triangle | Triangle | `#DC48FF` | 50 | 61 | 0.9 |
| square | Square | `#35B8FF` | 50 | 50 | 1 |
| blob | Blob | `#2FCB7A` | 49.5 | 50 | 1 |
| ghost | Ghost | `#F4F2FA` | 50 | 48 | 0.95 |
| circle | Circle | `#9A62FF` | 50 | 50 | 1 |
| drop | Drop | `#1ED3C6` | 50 | 62 | 0.9 |
| star | Star | `#FFD32B` | 50 | 52 | 0.82 |
| droid | Droid | `#D5DBEA` | 50 | 60 | 0.95 |
| mech | Mech | `#95A6C4` | 50 | 59 | 1 |
| alien | Alien | `#9BE85A` | 50 | 45 | 1.05 |
| hexagon | Hexagon | `#FF2A2A` | 50 | 50 | 0.95 |
| cat | Cat | `#FF8C42` | 50 | 58 | 1 |
| cloud | Cloud | `#CFE6FF` | 50 | 58 | 0.95 |
| pill | Pill | `#7B77F0` | 50 | 50 | 0.9 |
| pebble | Pebble | `#2FCB7A` | 50 | 50 | 0.95 |
| puddle | Puddle | `#FF2A2A` | 50 | 50 | 0.95 |

`droid` and `mech` also draw thin parts (antennae) from `botAvatarParts`. Every preset's face is `eyes`.

### Motion

| Prop | Type | Range / step | Default | Effect |
| --- | --- | --- | --- | --- |
| `speed` | `number` | 0.25 to 3, step 0.05 | `1` | Multiplier on every animation. `0` or less freezes, like `paused`. |
| `seed` | `number` | 0 to 1, step 0.01 | derived from the React id ("auto" in the Studio) | Offsets blink and glance loops. Same seed on two avatars moves them in step. |
| `turn` | `number` | 0 to 2, step 0.05 | `1` | How far the head turns side to side while idle. `0` faces forward. Studio label "Side turn". |
| `interactive` | `boolean` | toggle "Follow pointer" | `true` | Eyes and head follow a pointer within about three head widths; a click hops and turns right round, in any state. Your `onClick` runs either way. |
| `whirl` | `number` | 0 to 2; Studio toggle "Whirl ring" sets `0` or `1` | `0` | Motion ring round a spin (idle jump, click, working spin hop): a translucent tube of the body's material. |
| `jumpEvery` | `number` (s) | Studio toggle "Jump in idle" sets `0` or `8` | `8` | Also a Jump slider, below. |

### Jump

The idle flip and a click's hop. Studio times are in ms; props are seconds.

| Prop | Type | Range / step | Default | Effect |
| --- | --- | --- | --- | --- |
| `jumpHeight` | `number` | 0 to 50, step 1 (body units; body is 100 tall) | `26` | Studio "Height". |
| `jumpTime` | `number` (s) | 0.4 to 1.4, step 0.02 | `0.68` | Seconds in the air. Studio "Air time". Code floor 0.2. |
| `jumpStretch` | `number` | 0 to 2, step 0.05 | `1` | Stretch in the air. |
| `jumpSpin` | `number` | `0`, `1`, `2` (tabs None / One turn / Two turns) | `1` | Whole turns in the air. Code rounds to an integer. |
| `jumpLean` | `number` (deg) | 0 to 15, step 1 | `6` | Lean into the jump. |
| `jumpSquash` | `number` | 0 to 2, step 0.05 | `1.15` | Squash on the ground, before take-off and on landing. |
| `jumpSquashTime` | `number` (s) | 0.1 to 0.6, step 0.01 | `0.37` | Landing squash duration. Code floor 0.05. |
| `jumpGroundTime` | `number` (s) | 0 to 0.6, step 0.01 | `0.11` | Hold at the deepest squash. `0` for none. |
| `jumpGroundEase` | `BotAvatarSquashEase` | `sharp`, `pulse`, `soft`, `bouncy` | `pulse` | How the weight settles through the hold. Studio shows it only when ground time > 0. |
| `jumpRiseTime` | `number` (s) | 0.08 to 0.8, step 0.01 | `0.33` | From deepest squash back to shape. Code floor 0.05. |
| `jumpRiseEase` | `BotAvatarSquashEase` | `sharp`, `pulse`, `soft`, `bouncy` | `pulse` | `bouncy` passes rest into a slight stretch. |
| `jumpSquashEase` | `BotAvatarSquashEase` | `sharp`, `pulse`, `soft`, `bouncy` | `pulse` | Shape of the landing squash. |
| `jumpClickSquashTime` | `number` (s) | 0.1 to 1.0, step 0.01 | `0.24` | A click's jump landing squash (idle jumps use `jumpSquashTime`). |
| `jumpLand` | `number` (s) | -0.2 to 0.15, step 0.01 | `0` | When the landing squash starts: negative is before touch-down, positive after. Studio "Land squash". |
| `jumpEvery` | `number` (s) | 0 to 20, step 1 | `8` | Seconds between idle jumps, plus or minus 40 %. `0` for none. |

`BotAvatarSquashEase` is not re-exported by name; type the value as the string union.

### Stage and theme

| Prop | Type | Values | Default | Effect |
| --- | --- | --- | --- | --- |
| `paused` (free) | `boolean` | Play / Pause button | `false` | Freezes on the current frame and disables the click hop. The free playground loads paused; the Studio loads playing. |
| `theme` | `'auto' \| 'dark' \| 'light'` | from the Studio's light/dark switch | `'auto'` | The surface the avatar sits on. `auto` reads the nearest ancestor `data-theme="dark\|light"` or `.dark` / `.light` class, then `prefers-color-scheme`. In 0.1.1 the resolved theme is passed to the renderer but nothing drawn reads it; it is reserved. |

### Package props the Studio does not expose

| Prop | Type | Range | Default | Effect |
| --- | --- | --- | --- | --- |
| `whirlSize` | `number` | 0.6 to 1.6 | `1` | Ring size. |
| `whirlWidth` | `number` | 0.4 to 2 | `1` | Trail thickness. |
| `whirlLength` | `number` | 0.4 to 1.6 | `1` | Trail length round the ring. |
| `whirlTilt` | `number` | 0.5 to 1.8 | `1` | How open the ring is seen. |
| `aria-label` | `string` | | `"<Label> bot, <idle\|working\|sleeping>"` | Replaces the per-state label. |
| other canvas props | `className`, `style`, `onClick`, `data-*` | | | Pass through. `className` is appended to `ba`. |

## Studio → code mapping

The Studio exports one JSX element. `type` is always written; every other prop is written only when it differs from the package default:

```tsx
import { BotAvatar } from 'bot-avatars';

<BotAvatar type="flower" face="mouth" state="working" size={96} color="#9A62FF" saturation={1.2} shading="crisp" rim={1.2} light={315} depth={0.9} whirl={1} jumpSquashEase="bouncy" jumpEvery={5} />
```

Emission rules (from the snippet builder):

- Percent sliders are divided by 100 (`brightness`, `saturation`, `speed`, `shadow`, `highlight`, `rim`, `spread`, `depth`, `turn`, `whirl`, `jumpStretch`, `jumpSquash`, and `jumpTime` whose slider is in hundredths of a second). Millisecond sliders are divided by 1000 (`jumpSquashTime`, `jumpGroundTime`, `jumpRiseTime`, `jumpClickSquashTime`, `jumpLand`).
- `size` is written unless 64, even though the Studio starts at 96.
- `face` only if it differs from the type's own; `color` only if it differs from the type's palette colour; `ink` only if it differs from the auto ink.
- Lighting props are dropped when `shading="flat"`; `rim` is dropped for `smooth`; `spread` is dropped for `crisp`. `depth` is always eligible.
- `jumpGroundEase` is written only when `jumpGroundTime > 0`.
- `interactive={false}` when "Follow pointer" is off. `theme="light"` when the Studio is in light mode. `paused` when the stage is paused.
- Colour and face picks are remembered per type while the bench is open, so switching type and back keeps them.

Studio label to prop:

| Studio label | Prop | Conversion |
| --- | --- | --- |
| Light angle | `light` | degrees |
| Side turn | `turn` | % / 100 |
| Follow pointer | `interactive` | toggle |
| Whirl ring | `whirl` | off `0`, on `1` |
| Jump in idle | `jumpEvery` | off `0`, on `8` |
| Height | `jumpHeight` | body units |
| Air time | `jumpTime` | slider / 100 s |
| Stretch, Squash | `jumpStretch`, `jumpSquash` | % / 100 |
| Spin | `jumpSpin` | `0`, `1`, `2` |
| Lean | `jumpLean` | degrees |
| Squash time, Ground time, Rise time, Click squash time | `jumpSquashTime`, `jumpGroundTime`, `jumpRiseTime`, `jumpClickSquashTime` | ms / 1000 |
| Ground easing, Rise easing, Squash easing | `jumpGroundEase`, `jumpRiseEase`, `jumpSquashEase` | lowercase enum |
| Land squash | `jumpLand` | ms / 1000, negative = early |
| Every | `jumpEvery` | seconds |

The Studio's Copy prompt wraps the live snippet:

```text
Add the Bot avatars effect from Libraries.dev to my React app.

Install:
npm install bot-avatars

Use exactly this configuration — it was tuned by hand in the Libraries.dev Studio:

<the snippet>

Keep the prop values exactly as given; adapt only the child content to my app.
Needs React 18 or newer. Docs: https://libraries.dev/bots.html
```

There is no Studio agent spec for this library: `services/studio-agent/spec.ts` has no bot-avatars entry in `SPECS`, so no agent param names, presets or save/apply exist for it. Prop names are the only names.

## Core customization

There is no `core` code param for Bot avatars. The Studio agent has no core param (and no spec at all) for this library yet, so it cannot rewrite the geometry or the renderer. `type` is a closed union: `<BotAvatar>` cannot take a custom outline.

Deeper changes go through the package's exported rig and renderer, which the component itself uses:

| Export | What it is |
| --- | --- |
| `BotAvatarSim` | The rig. `new BotAvatarSim(seed, state)`, `.update(dt)` (seconds, already multiplied by speed; clamped to 0.05 per call), `.pose`, `.setState(state)`, `.setPointer(x, y, strength)`, `.poke()` (hop now), `.setTurn(k)`, `.setJump(partial)`. |
| `restPose(state)` | The still pose of a state (what reduced motion draws). |
| `drawBotAvatarFrame(ctx, box, pose, cfg)` | Draws one frame. Clears the canvas itself. |
| `BotAvatarDrawConfig` | `path`, `face`, `faceX`, `faceY`, `faceScale`, `color`, `ink`, `shading`, optional `shadow`, `highlight`, `depth`, `light`, `rim`, `spread`, `typeKey`, `still`, `parts`, `partsDepth`, `theme`, `dpr`, `sides` (`auto`, `vector`, `sprite`), `whirl` (`{ strength, size, width, length, tilt }`). |
| `botAvatarShapes`, `botAvatarParts` | SVG path strings per type (100x100 box, centred on 50,50). |
| `botAvatarPresets`, `botAvatarPalette` | Per-type label, colour, face placement. |
| `autoInk`, `shade`, `luminance`, `parseColor` | Colour helpers the component uses. |
| `BOT_AVATAR_OVERSCAN` (1.5), `BOT_AVATAR_RISE` (0.1) | Canvas is `box * 1.5` square; body centre sits `0.1 * box` below its middle. |
| `warmBotAvatarPlastic(key, path, devicePx, depth)` | Bakes the plastic form ahead of time. |
| `botAvatarJumpDefaults` | The jump defaults as a `BotAvatarJumpConfig`. |

Contract for a custom renderer:

- `path` is a `Path2D` of an outline in a 100x100 box centred on (50, 50). `faceX`/`faceY` are in the same box, `faceScale` near 1.
- `box` is the layout size in CSS px. Size the backing store to `round(box * BOT_AVATAR_OVERSCAN * dpr)`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` before each draw, and pass `dpr` in the config so the renderer never reads the transform back.
- Give every custom outline a unique `typeKey`. Plastic forms and lighting are cached by that key (the cap falls back to a path id, the side stack to `'custom'`), so two outlines sharing a key share a baked form.
- Plastic bakes the form on idle time and draws `smooth` until it is ready; pass `still: true` for one-off renders so it bakes synchronously.
- To match `<BotAvatar>` colours, apply its saturation boost: `shade(color, 0, 0.25)` is the component's default (`saturation` 1.5).
- Keep the component's layout trick if the result sits in a layout: margins of `-0.25 * box` left and right, `-(0.25 + RISE) * box` top, `-(0.25 - RISE) * box` bottom.
- Do not drive `update` with unbounded `dt` values and do not call `draw` without a `path`; reduced motion should draw `restPose(state)` once instead of looping.

Example 1: a custom heart-shaped bot with the stock rig and material.

```tsx
import { useEffect, useRef } from 'react';
import { BotAvatarSim, drawBotAvatarFrame, autoInk, shade, BOT_AVATAR_OVERSCAN, BOT_AVATAR_RISE, type BotAvatarState } from 'bot-avatars';

const HEART = 'M50 88C30 74 12 60 12 38C12 24 23 14 35 14C42 14 47 18 50 23C53 18 58 14 65 14C77 14 88 24 88 38C88 60 70 74 50 88Z';

export function HeartBot({ size = 64, state = 'default', color = '#FF5C8A' }: { size?: number; state?: BotAvatarState; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sim = useRef<BotAvatarSim | null>(null);
  useEffect(() => { sim.current?.setState(state); }, [state]);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (!sim.current) sim.current = new BotAvatarSim(Math.random(), state);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size * BOT_AVATAR_OVERSCAN * dpr);
    const body = shade(color, 0, 0.25);
    const cfg = { path: new Path2D(HEART), face: 'eyes' as const, faceX: 50, faceY: 46, faceScale: 0.9, color: body, ink: autoInk(body), shading: 'plastic' as const, typeKey: 'heart', dpr };
    let raf = 0, last = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      sim.current!.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBotAvatarFrame(ctx, size, sim.current!.pose, cfg);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, color]);
  const s = (BOT_AVATAR_OVERSCAN - 1) / 2;
  return (
    <canvas ref={ref} role="img" aria-label="Heart bot"
      style={{ width: size * BOT_AVATAR_OVERSCAN, height: size * BOT_AVATAR_OVERSCAN, margin: `${-(s + BOT_AVATAR_RISE) * size}px ${-s * size}px ${-(s - BOT_AVATAR_RISE) * size}px` }} />
  );
}
```

This skips what the component adds on top (pointer follow, offscreen pause, reduced motion); add them if the custom bot ships widely.

Example 2: a still PNG of any stock type, for email, OG images or a favicon.

```ts
import { restPose, drawBotAvatarFrame, botAvatarShapes, botAvatarParts, botAvatarPresets, autoInk, shade, BOT_AVATAR_OVERSCAN, type BotAvatarType, type BotAvatarState } from 'bot-avatars';

export function botAvatarPng(type: BotAvatarType, box = 128, state: BotAvatarState = 'default', color?: string): string {
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(box * BOT_AVATAR_OVERSCAN * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const p = botAvatarPresets[type];
  const parts = botAvatarParts[type];
  const body = shade(color ?? p.color, 0, 0.25); // the component's default saturation
  drawBotAvatarFrame(ctx, box, restPose(state), {
    path: new Path2D(botAvatarShapes[type]),
    parts: parts ? new Path2D(parts) : undefined,
    face: p.face, faceX: p.faceX, faceY: p.faceY, faceScale: p.faceScale,
    color: body, ink: autoInk(body),
    shading: 'plastic', typeKey: type, still: true, dpr,
  });
  return canvas.toDataURL('image/png');
}
```

The PNG is `box * 1.5` square with the body a tenth of `box` below centre; crop if you need a tight square.

## Recipes

Agent roster with brand colours and sleep. Use when a sidebar lists agents with online, running and offline states.

```tsx
import { BotAvatar, type BotAvatarType } from 'bot-avatars';

type Agent = { id: string; name: string; avatar: BotAvatarType; color?: string; status: 'running' | 'idle' | 'offline' };

const STATE = { running: 'working', idle: 'default', offline: 'sleeping' } as const;

export function Roster({ agents }: { agents: Agent[] }) {
  return (
    <ul className="roster">
      {agents.map((a) => (
        <li key={a.id}>
          <BotAvatar type={a.avatar} color={a.color} state={STATE[a.status]} size={36} aria-label={`${a.name}, ${a.status}`} />
          <span>{a.name}</span>
        </li>
      ))}
    </ul>
  );
}
```

Chat reply with a mouth and a whirl. Use when the assistant's avatar should read clearly as "busy" while a reply streams.

```tsx
<BotAvatar type="clover" face="mouth" state={streaming ? 'working' : 'default'} size={32} whirl={1} />
```

Calm avatar for dense dashboards. Use when many avatars share a screen and motion must stay quiet.

```tsx
<BotAvatar type="pill" size={24} turn={0} jumpEvery={0} interactive={false} speed={0.75} />
```

Mascot for an empty or success state. Use when the bot is the illustration and should feel playful.

```tsx
<BotAvatar
  type="cat" face="mouth" size={160} whirl={1}
  jumpHeight={34} jumpTime={0.8} jumpSquash={1.4}
  jumpSquashEase="bouncy" jumpRiseEase="bouncy" jumpGroundTime={0.2} jumpEvery={4}
/>
```

Vector look for small icons. Use at 16 to 32 px, in toolbars or mentions, where the glossy material reads as noise.

```tsx
<BotAvatar type="hexagon" size={20} shading="crisp" rim={1.2} depth={0.4} />
```

Dark brand bot. Use for a monochrome or dark brand; the ink turns light on a dark body by itself.

```tsx
<BotAvatar type="droid" color="#111418" brightness={1.1} saturation={1} highlight={1.6} light={315} />
```

Two avatars in step. Use for a "pair" of agents (planner and executor) that should move together.

```tsx
<BotAvatar type="star" seed={0.42} state="working" />
<BotAvatar type="circle" seed={0.42} state="working" />
```

Match the UI's light. Use when the product's shadows fall to the bottom right (light from the top left).

```tsx
<BotAvatar type="blob" light={315} shadow={0.6} highlight={1.1} spread={1.2} />
```

## Accessibility & performance

- `role="img"` with a per-state `aria-label` ("Clover bot, idle", "Clover bot, working", "Clover bot, sleeping"). Pass `aria-label` with the agent's name and status; it replaces the default. Also available: `data-bot-avatar`, `data-face`, `data-state` on the canvas.
- `prefers-reduced-motion: reduce`: no loop; the still pose of the state is drawn. Checked at render time, not subscribed to changes.
- `paused`, or `speed` of 0 or less, stops the loop and the click hop.
- One shared `requestAnimationFrame` loop for every avatar. Each unsubscribes when offscreen (IntersectionObserver); the loop stops while the tab is hidden and while nobody is subscribed.
- Device pixel ratio capped at 2. A hidden ancestor that measures 0 keeps the last size.
- `plastic` is the expensive mode: a per-pixel lit material with a baked height field per type. The texture tier is 64, 96 or 128 texels for device widths up to 100, 224 and above. Up to 48 forms are cached, then the cache clears. Each new type (and each new rounded `depth` at that tier) bakes once on idle time (`requestIdleCallback`, or `setTimeout` on Safari); `smooth` stands in until then.
- On WebKit (Safari, every iOS browser) plastic side slices are blitted from sprites, because conic-gradient fills are far slower there. `crisp`, `smooth` and `flat` precompute slice colours and are cheaper still.
- Lighting rebuilds only when the light or view moves a whole bin, and cross-fades between rebuilds. Changing `shadow`, `highlight`, `rim`, `spread`, `light` or `color` every frame forces rebuilds; do not animate them.
- `whirl` adds two extra draws per frame while a spin is under way only.
- Hydration: the server output is an empty canvas with stable attributes; no mismatch.

## Common mistakes

- Unmapped statuses. An unknown `state` falls back to `"default"` silently. Map app statuses: `running` / `streaming` / `pending` / `busy` to `"working"`; `idle` / `ready` / `online` to `"default"`; `offline` / `away` / `disabled` to `"sleeping"`.
- Double announcements. Every prop other than the documented ones is passed to the `<canvas>` (`className`, `style`, `data-*`, `aria-*`, handlers). When the name and status are already visible as text, add `aria-hidden` to the avatar.

- Clipping the hop. The canvas overscans 1.5x (more room above than below) and pulls back with negative margins. `overflow: hidden` on a tight parent crops jumps, especially with `jumpHeight` above the default or `size` above 96.
- Sizing with CSS. Use `size`. `style` is spread after the component's own `width`, `height` and margins, so setting any of them breaks the overscan.
- Importing into a Server Component. Add a `"use client"` boundary.
- Unknown `state` strings fall back to `default` silently. Map app statuses yourself.
- Assuming `saturation` defaults to 1. It is `1.5`; `saturation={1}` gives the flatter palette colour exactly.
- Picking the Studio's "Dark ink" swatch and expecting the default. The swatch is `#1F1B2E`, the auto ink is `#1E1A33`, so the Studio writes an explicit `ink` prop.
- Tuning `rim` in `smooth`, `spread` in `crisp`, or any lighting knob in `flat`. They have no effect there, and the Studio drops them from the snippet.
- Fractional `jumpSpin`. It is rounded to a whole number of turns.
- Expecting `jumpEvery={0}` to stop all jumps. It stops idle jumps only; clicks still hop unless `interactive={false}` or the avatar is paused.
- Relying on `theme` to change the drawing. In 0.1.1 nothing drawn depends on it.
- Many different types plus custom `depth` values on one page. Each (type, tier, depth) pair bakes its own plastic form; call `warmBotAvatarPlastic(type, new Path2D(botAvatarShapes[type]), devicePx, depth)` ahead of time for a big grid, or use `crisp`.
- A custom renderer reusing a `typeKey` for a different outline. The cached form of the first outline is drawn.

## Detecting a fit in a codebase

| Signal to grep for | Suggest |
| --- | --- |
| `role === 'assistant'`, `message.role`, `AssistantMessage`, `BotMessage` | `BotAvatar` beside assistant turns, `working` while `isStreaming` / `isLoading`, optionally `face="mouth"`. |
| `Thinking…`, `Working…`, `Generating`, typing indicators, three-dot loaders | `state="working"` on the reply avatar next to the text. |
| Icon imports used as an assistant avatar: `Bot` / `BotIcon` (lucide-react), `FaRobot`, `RiRobotLine`, `CpuChipIcon`, `Sparkles`, the robot emoji (U+1F916) | `<BotAvatar size={32} />`, colour set from the brand. |
| `agents.map(`, `AgentList`, `AgentCard`, `workers`, `assistants` | Roster: one `type` and `color` per agent. |
| `status: 'offline' \| 'paused' \| 'scheduled'`, `lastSeen`, "Back at", "Snoozed" | `state="sleeping"` for those agents. |
| `status === 'running'`, `job.status`, `isPending`, `inProgress` near an agent or task header | `state={running ? 'working' : 'default'}`. |
| `<Avatar` fed a placeholder for bots (`src="/bot.png"`, `fallback="AI"`) | Swap in `BotAvatar` for the bot case. |
| Brand tokens (`--brand`, `theme.colors.primary`) | Pass the brand colour as `color`; check ink contrast. |
| Empty states for agent pages ("No runs yet", "Create your first agent") | Mascot recipe at 96 to 160 px. |
| OG image or email templates showing an agent | Pre-render a PNG with the still-render helper. |
