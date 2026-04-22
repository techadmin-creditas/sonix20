# Sonix Studio — Design System Reference

> **Purpose:** This document is the single source of truth for every visual, layout, and animation decision in the Obsidian Command UI. Any developer or AI model working on this codebase **must** follow these rules to produce consistent, premium output. Do not reach for arbitrary Tailwind colors (`blue-500`, `zinc-800`, etc.) — always use the semantic token classes listed here.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Color Token System](#2-color-token-system)
3. [CSS Variable → Tailwind Class Reference](#3-css-variable--tailwind-class-reference)
4. [Available Themes](#4-available-themes)
5. [How to Add a New Theme](#5-how-to-add-a-new-theme)
6. [Typography System](#6-typography-system)
7. [Spacing & Layout](#7-spacing--layout)
8. [Component Patterns](#8-component-patterns)
9. [Animation System](#9-animation-system)
10. [Dark / Light Mode Rules](#10-dark--light-mode-rules)
11. [Anti-Patterns](#11-anti-patterns)

---

## 1. Architecture Overview

```
themeConfig.ts
  └─ brand.mode (e.g. neuralSlate.dark)
       └─ color tokens (primary, surface, ...)
            │
            ▼  (ThemeSynchronizer.tsx on every theme change)
       CSS variables on :root
       (--primary, --surface, --outline-variant, ...)
            │
            ▼  (index.css @theme block)
       Tailwind semantic color tokens
       (bg-primary, text-on-surface, border-outline-variant, ...)
            │
            ▼
       All components — always use Tailwind semantic classes
```

**Key files:**

| File | Role |
|------|------|
| `src/themeConfig.ts` | **Edit here to change/add themes.** All color tokens in one place. |
| `src/components/ThemeSynchronizer.tsx` | Maps `themeConfig` tokens → CSS vars at runtime. Mount once in `App.tsx`. |
| `src/index.css` | `@theme` block bridges CSS vars to Tailwind semantic classes. |
| `src/lib/theme.tsx` | `ThemeProvider` + `useTheme()` hook. Persists to localStorage. |

---

## 2. Color Token System

Every theme defines **exactly these 16 tokens** (camelCase in TS → kebab-case CSS var):

### Surface Tokens (backgrounds, cards, layers)

| Token | CSS Var | Description | Typical use |
|-------|---------|-------------|-------------|
| `background` | `--background` | Page-level background | `bg-background` on `<html>` or fullscreen wrappers |
| `surface` | `--surface` | Default card / panel surface | Primary cards, modals, dialogs |
| `surfaceLowest` | `--surface-lowest` | Darkest surface (dark) / white (light) | Nested code blocks, deepest elevation |
| `surfaceLow` | `--surface-low` | Slightly elevated surface | Sidebars, secondary panels, inputs |
| `surfaceHigh` | `--surface-high` | Elevated surface | Hover states on cards, headers within panels |
| `surfaceHighest` | `--surface-highest` | Most elevated surface | Tooltips, active selection backgrounds |

**Elevation rule (dark mode):** `surfaceLowest < background < surface < surfaceLow < surfaceHigh < surfaceHighest`  
**Elevation rule (light mode):** `background ≈ surfaceLow < surface = surfaceLowest (white) < surfaceHigh < surfaceHighest`

### Brand / Accent Tokens

| Token | CSS Var | Description | Typical use |
|-------|---------|-------------|-------------|
| `primary` | `--primary` | Main brand accent | CTAs, active states, links, focus rings, progress bars |
| `primaryContainer` | `--primary-container` | Tinted container for primary content | Pill badges with primary content, icon backgrounds |
| `onPrimaryFixed` | `--on-primary-fixed` | Text/icon ON a filled primary background | Text inside filled primary buttons |
| `secondary` | `--secondary` | Secondary accent | Secondary actions, charts series 2, progress |
| `secondaryContainer` | `--secondary-container` | Tinted container for secondary | Secondary badge backgrounds |
| `tertiary` | `--tertiary` | Third accent / highlight | Charts series 3, waveform second track, special callouts |

### Content / Ink Tokens

| Token | CSS Var | Description | Typical use |
|-------|---------|-------------|-------------|
| `onSurface` | `--on-surface` | Primary text color | Headings, body copy, icons on surfaces |
| `onSurfaceVariant` | `--on-surface-variant` | Secondary text color | Labels, captions, placeholder text, muted copy |
| `outline` | `--outline` | Strong border / divider | Visible dividers, strong borders |
| `outlineVariant` | `--outline-variant` | Subtle border | Default card borders, input borders, hairlines |

### Input Token

| Token | CSS Var | Description |
|-------|---------|-------------|
| `inputBg` | `--input-bg` | `<input>`, `<textarea>`, `<select>` background |

---

## 3. CSS Variable → Tailwind Class Reference

All classes below respond **automatically** to theme changes via CSS vars. Never use hardcoded Tailwind palette colors in place of these.

### Background / Surface

```
bg-background         → var(--background)
bg-surface            → var(--surface)
bg-surface-lowest     → var(--surface-lowest)
bg-surface-low        → var(--surface-low)
bg-surface-high       → var(--surface-high)
bg-surface-highest    → var(--surface-highest)
```

### Brand Accents

```
bg-primary            → var(--primary)
bg-primary-container  → var(--primary-container)
bg-secondary          → var(--secondary)
bg-secondary-container→ var(--secondary-container)
bg-tertiary           → var(--tertiary)
```

### Text Colors

```
text-on-surface           → var(--on-surface)
text-on-surface-variant   → var(--on-surface-variant)
text-primary              → var(--primary)
text-secondary            → var(--secondary)
text-tertiary             → var(--tertiary)
text-on-primary-fixed     → var(--on-primary-fixed)
```

### Borders

```
border-outline         → var(--outline)
border-outline-variant → var(--outline-variant)
border-primary         → var(--primary)
border-secondary       → var(--secondary)
```

### Opacity Modifiers (safe to use)

Tailwind opacity modifiers work with all semantic tokens:

```
bg-primary/10   → primary at 10% opacity
bg-primary/20   → primary at 20% opacity
border-primary/25
shadow-primary/30
text-primary/80
```

---

## 4. Available Themes

Switch brand in `themeConfig.ts` → `selectedBrand`:

| Brand key | Light feel | Dark feel | Best for |
|-----------|-----------|----------|----------|
| `amber` | Warm cream, burnt orange | Deep charcoal, amber glow | Finance, classic enterprise |
| `nocturnal` | Soft periwinkle, cool white | Deep navy, lavender | Analytics, dashboards |
| `neuralSlate` | Indigo/violet, clean white | Slate-black, electric cyan | AI products, developer tools |
| `prismatic` | Deep violet + cyan + amber | Dark violet, vivid accents | Premium AI, creative tools |

### Active theme selection

```typescript
// src/themeConfig.ts
export const themeConfig = {
  selectedBrand: 'neuralSlate',  // ← change this
  selectedMode: 'dark',           // ← initial mode ('dark' | 'light')
  ...
}
```

The selected mode is only the **default** — users can toggle via `ThemeToggle` which calls `useTheme().toggleTheme()`.

### neuralSlate — Token Values

**Dark** (primary use — electric cyan on slate-black):

| Token | Value | Notes |
|-------|-------|-------|
| `primary` | `#38bdf8` | Sky blue — electric, highly visible |
| `secondary` | `#94a3b8` | Slate-400 — muted blue-gray |
| `tertiary` | `#0ea5e9` | Sky-500 — deeper sky |
| `background` | `#020617` | Near-black slate |
| `surface` | `#0f172a` | Slate-900 |
| `surfaceLow` | `#1e293b` | Slate-800 |
| `surfaceHigh` | `#334155` | Slate-700 |
| `surfaceHighest` | `#475569` | Slate-600 |

**Light** (indigo/violet, white-based):

| Token | Value |
|-------|-------|
| `primary` | `#6366f1` — indigo-500 |
| `secondary` | `#8b5cf6` — violet-500 |
| `tertiary` | `#a78bfa` — violet-400 |
| `background` | `#f8f9ff` |
| `surface` | `#ffffff` |

### prismatic — Token Values

**Light** (violet + cyan + amber — rich tri-color):

| Token | Value | Notes |
|-------|-------|-------|
| `primary` | `#7c3aed` | Violet-700 — deep, authoritative |
| `primaryContainer` | `#ede9fe` | Violet-100 |
| `onPrimaryFixed` | `#ffffff` | |
| `secondary` | `#0891b2` | Cyan-600 — sharp contrast |
| `secondaryContainer` | `#cffafe` | Cyan-100 |
| `tertiary` | `#d97706` | Amber-600 — warm accent |
| `background` | `#faf9ff` | Near-white, faint violet blush |
| `surface` | `#ffffff` | |
| `surfaceLow` | `#f5f3ff` | Violet-50 |
| `surfaceHigh` | `#ede9fe` | Violet-100 |
| `surfaceHighest` | `#ddd6fe` | Violet-200 |
| `onSurface` | `#0f0a1e` | Near-black with violet undertone |
| `onSurfaceVariant` | `#4c4068` | Muted purple-gray |
| `outline` | `#a99ec4` | Soft purple-gray |
| `outlineVariant` | `#e8e4f7` | Very subtle lavender |
| `inputBg` | `#f5f3ff` | Violet-50 |

**Dark** (deep violet space, vivid accents):

| Token | Value | Notes |
|-------|-------|-------|
| `primary` | `#a78bfa` | Violet-400 — bright on dark |
| `secondary` | `#22d3ee` | Cyan-400 — electric |
| `tertiary` | `#fbbf24` | Amber-400 — warm highlight |
| `background` | `#0d0b18` | Deep dark violet |
| `surface` | `#160f2e` | Dark violet |
| `surfaceLow` | `#1e1540` | Slightly lighter |
| `surfaceHigh` | `#2d2154` | Medium elevation |
| `surfaceHighest` | `#3d2e6e` | Highest elevation |
| `onSurface` | `#ede9ff` | Lavender-white |
| `onSurfaceVariant` | `#b0a4d4` | Muted lavender |

---

## 5. How to Add a New Theme

### Step 1 — Add tokens to `themeConfig.ts`

```typescript
// src/themeConfig.ts

export const themeConfig = {
  selectedBrand: 'myTheme' as 'amber' | 'nocturnal' | 'neuralSlate' | 'prismatic' | 'myTheme',

  // ... existing themes ...

  myTheme: {
    light: {
      primary: '#YOUR_COLOR',
      primaryContainer: '#...',
      onPrimaryFixed: '#ffffff',     // always white or near-white
      secondary: '#...',
      secondaryContainer: '#...',
      tertiary: '#...',
      background: '#...',            // page bg — very light or very dark
      surface: '#...',               // card bg
      surfaceLow: '#...',            // slightly darker than surface
      surfaceHigh: '#...',           // slightly lighter than surface
      surfaceHighest: '#...',        // lightest surface elevation
      surfaceLowest: '#...',         // darkest surface elevation
      onSurface: '#...',             // primary text — high contrast vs surface
      onSurfaceVariant: '#...',      // secondary text — medium contrast
      outline: '#...',               // visible borders
      outlineVariant: '#...',        // subtle borders
      inputBg: '#...',               // form field backgrounds
    },
    dark: {
      // same 16 keys, dark-mode values
    },
  },
};
```

**Token design checklist:**
- [ ] `primary` has ≥ 4.5:1 contrast against `surface` (WCAG AA)
- [ ] `onSurface` has ≥ 7:1 contrast against `surface` (WCAG AAA)
- [ ] `onPrimaryFixed` has ≥ 4.5:1 contrast against `primary`
- [ ] `onSurfaceVariant` has ≥ 3:1 against `surface`
- [ ] Surface elevation steps are clearly distinct (test side-by-side)
- [ ] `outline` is visible against both `surface` and `background`

### Step 2 — No other files need changes

`ThemeSynchronizer.tsx` reads `themeConfig[brand][mode]` dynamically — it auto-picks up the new brand. The Tailwind classes are already wired to CSS vars.

### Step 3 — Expose in UI (optional)

If adding a brand picker UI, add the brand key to the switcher's options array. The `useTheme()` hook only handles `light`/`dark` — brand switching must call `themeConfig.selectedBrand = newBrand` and re-trigger `ThemeSynchronizer`.

---

## 6. Typography System

### Font Families

```css
font-headline  → "Manrope", sans-serif   (headings, labels, UIchrome)
font-body      → "Inter", sans-serif     (paragraphs, descriptions)
```

Default `body` uses `font-body`. Override with `font-headline` on headings and UI elements that need strong visual weight.

### Size Scale (use Tailwind defaults)

| Class | Size | Use |
|-------|------|-----|
| `text-[7px]` — `text-[9px]` | 7–9px | Micro labels, tags, rail captions |
| `text-xs` | 12px | Secondary labels, captions, form hints |
| `text-sm` | 14px | Body copy, card descriptions, nav items |
| `text-base` | 16px | Default body, button labels |
| `text-lg` | 18px | Lead text, large descriptions |
| `text-xl` — `text-2xl` | 20–24px | Card headings, section subtitles |
| `text-3xl` — `text-4xl` | 30–36px | Section headings |
| `text-5xl` — `text-6xl` | 48–60px | Hero headlines |

### Weight Scale

| Class | Weight | Use |
|-------|--------|-----|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Sub-labels, muted headings |
| `font-semibold` | 600 | Card titles, button text |
| `font-bold` | 700 | Section headings |
| `font-black` | 900 | Micro uppercase labels (`text-[9px] font-black uppercase tracking-[0.2em]`) |

### Gradient Text Pattern

For hero headlines and accent text:

```tsx
<h1 className="bg-linear-to-r from-primary via-secondary to-tertiary bg-clip-text text-transparent">
  Your headline
</h1>
```

Use `bg-linear-to-r` (not `bg-gradient-to-r` — Tailwind v4 syntax).

### Micro-label Pattern

Used for section headers inside panels, stat labels, category badges:

```tsx
<p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
  SECTION HEADER
</p>
```

---

## 7. Spacing & Layout

### Container widths

| Context | Max width |
|---------|-----------|
| Full-page sections | `max-w-6xl` |
| Focused content (how-it-works, pricing) | `max-w-5xl` |
| CTA cards, centered content | `max-w-4xl` |
| Modals, small panels | `max-w-2xl` or `max-w-sm` |

Always center with `mx-auto` and add horizontal padding `px-6`.

### Section padding

- Full-viewport sections: `pt-20` (clears the fixed header) + `space-y-12` or `space-y-16` between sub-blocks
- Demo overlay panels: `p-4` — `p-6`
- Cards: `p-4` — `p-6`
- Compact cards / list items: `p-3`
- Micro elements: `p-2` — `p-2.5`

### Border radius scale

| Size | Class | Use |
|------|-------|-----|
| Small | `rounded-lg` | Buttons, inputs, tags |
| Default | `rounded-xl` | Small cards, avatars |
| Medium | `rounded-2xl` | Panel cards, modals |
| Large | `rounded-3xl` | Hero CTA cards |
| Full | `rounded-full` | Pills, avatars, icon circles |

### Gap / spacing scale

Use Tailwind gap utilities consistently:
- `gap-2` — tight icon + label
- `gap-3` — standard row items
- `gap-4` — card grid columns
- `gap-6` — section grid columns
- `gap-8` — `gap-12` — large section spacing

---

## 8. Component Patterns

### 8.1 Card

Standard card for content panels:

```tsx
// Light-mode-aware card
const cardCls = `rounded-2xl border ${
  isDark
    ? 'bg-surface/70 border-outline'
    : 'bg-surface/80 border-outline-variant shadow-sm'
}`;

// Glass card (for overlays / CTA sections)
const glassCls = `rounded-2xl border backdrop-blur-xl ${
  isDark
    ? 'bg-surface/40 border-primary/20'
    : 'bg-white/70 border-primary/15 shadow-2xl shadow-primary/8'
}`;
```

### 8.2 Button

**Primary (filled):**
```tsx
<button className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-on-primary-fixed font-semibold shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all">
  Label
</button>
```

**Secondary (outlined):**
```tsx
<button className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-outline-variant text-on-surface font-semibold hover:border-primary/50 hover:text-primary transition-all">
  Label
</button>
```

**Ghost / icon button:**
```tsx
<button className="size-9 rounded-xl flex items-center justify-center text-on-surface-variant border border-transparent hover:border-outline-variant hover:text-on-surface transition-all">
  <Icon className="size-4" />
</button>
```

**Compact action button (inside panels):**
```tsx
<button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/8 text-[10px] font-semibold text-primary hover:bg-primary/15 transition-all">
  <Icon className="size-3" /> Label
</button>
```

### 8.3 Badge / Pill

**Brand pill:**
```tsx
<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25">
  <div className="size-1.5 rounded-full bg-primary animate-pulse" />
  <span className="text-xs font-semibold text-primary uppercase tracking-widest">Label</span>
</div>
```

**Status chip (live indicator):**
```tsx
<div className="flex items-center gap-1.5">
  <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">LIVE</span>
</div>
```

**Tag (use-case / category):**
```tsx
<span className="text-[8px] font-medium text-on-surface-variant bg-surface-high border border-outline-variant px-1.5 py-0.5 rounded-full">
  Tag name
</span>
```

**Primary-tinted tag:**
```tsx
<span className="text-[10px] font-medium text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-full">
  Tag name
</span>
```

### 8.4 Metric / Stat tile

```tsx
<div className="text-center px-4 py-2 rounded-xl bg-primary/8 border border-primary/15">
  <div className="text-lg font-bold text-primary">35%</div>
  <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">DSO reduction</div>
</div>
```

### 8.5 Progress bar (intel bar)

```tsx
// Static
<div className="h-1 w-full rounded-full bg-outline-variant overflow-hidden">
  <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
</div>

// Animated (Framer Motion)
<div className="h-1 w-full rounded-full bg-outline-variant overflow-hidden">
  <motion.div
    className="h-full rounded-full bg-primary intel-bar"
    initial={{ scaleX: 0 }}
    animate={{ scaleX: value / 100 }}
    style={{ transformOrigin: 'left' }}
    transition={{ duration: 0.7, ease: 'easeOut' }}
  />
</div>
```

### 8.6 Toggle switch (spring pill)

```tsx
<button
  onClick={onToggle}
  className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors ${
    on ? 'bg-primary border-primary' : 'bg-outline-variant border-outline-variant'
  }`}
>
  <motion.span
    className="inline-block size-2.5 rounded-full bg-white shadow-sm"
    animate={{ x: on ? 14 : 1 }}
    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
  />
</button>
```

### 8.7 Dropdown

- Trigger: `rounded-lg border border-outline-variant bg-surface-low text-[10px]`
- Menu: `bg-surface/95 backdrop-blur-xl border border-outline-variant rounded-xl shadow-xl`
- Item hover: `hover:bg-primary/8`
- Selected item: `text-primary bg-primary/5`
- Use `AnimatePresence` + `initial={{ opacity:0, y:-4, scale:0.97 }}` for open/close

### 8.8 Section divider (connected steps line)

```tsx
// Animated connecting line between step cards
<motion.div
  className="absolute top-12 left-[16.66%] right-[16.66%] h-px bg-linear-to-r from-transparent via-primary/40 to-transparent pointer-events-none"
  initial={{ scaleX: 0 }}
  animate={{ scaleX: 1 }}
  style={{ transformOrigin: 'left' }}
  transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
/>
```

### 8.9 System / compliance message chip (in transcript views)

```tsx
// Neutral system event
<div className="px-3 py-1 rounded-full text-[9px] font-medium border bg-surface-high border-outline text-on-surface-variant">
  Cross-referencing logs...
</div>

// Compliance / success event
<div className="px-3 py-1 rounded-full text-[9px] font-medium border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
  ✓ PTP Recorded — ₹12,400
</div>
```

---

## 9. Animation System

### 9.1 Framer Motion — standard entrance patterns

**Fade + rise (default entrance):**
```tsx
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.2, duration: 0.5 }}
```

**Spring pop (cards, modals):**
```tsx
initial={{ opacity: 0, scale: 0.96 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ type: 'spring', stiffness: 200, damping: 22 }}
```

**Slide in from left (rail items, list items):**
```tsx
initial={{ opacity: 0, x: -20 }}
animate={{ opacity: 1, x: 0 }}
transition={{ delay: index * 0.07, type: 'spring', stiffness: 200, damping: 22 }}
```

**Slide in from right (detail panels, tooltips):**
```tsx
initial={{ opacity: 0, x: -16, scale: 0.97 }}
animate={{ opacity: 1, x: 0, scale: 1 }}
exit={{ opacity: 0, x: -10, scale: 0.98 }}
transition={{ type: 'spring', stiffness: 300, damping: 28 }}
```

**Stagger children:**
```tsx
// Parent
<motion.div>
  {items.map((item, i) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 20 }}
    />
  ))}
</motion.div>
```

### 9.2 AnimatePresence rules

Always wrap conditional renders with `<AnimatePresence>`:
```tsx
<AnimatePresence>
  {isVisible && (
    <motion.div key="unique-key" initial={...} animate={...} exit={...}>
      {/* content */}
    </motion.div>
  )}
</AnimatePresence>
```

For switching between two states (e.g. live call → intelligence report), use `mode="wait"`:
```tsx
<AnimatePresence mode="wait">
  {callEnded ? (
    <motion.div key="report" ...>...</motion.div>
  ) : (
    <motion.div key="live" ...>...</motion.div>
  )}
</AnimatePresence>
```

### 9.3 GSAP — snap-scroll sections

Used in `HomeNew.tsx` for full-viewport section transitions:
```typescript
// Register plugin
gsap.registerPlugin(Observer);

// Section transition
const tl = gsap.timeline({ onComplete: () => { animatingRef.current = false; } });
gsap.set(incoming, { zIndex: 20, visibility: 'visible', opacity: 0 });
gsap.set(outgoing, { zIndex: 10, pointerEvents: 'none' });
tl.to(outgoing,  { y: -150, scale: 0.88, opacity: 0, duration: 0.5, ease: 'power4.inOut' }, 0);
tl.fromTo(incoming, { y: 150, scale: 1.1, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'power4.inOut' }, 0);

// Observer (replaces scroll events)
Observer.create({
  target: window, type: 'wheel,touch,pointer',
  onDown: () => gotoSection(current + 1),
  onUp:   () => gotoSection(current - 1),
  wheelSpeed: 1, tolerance: 100, preventDefault: true,
});
```

### 9.4 GSAP — counter animation

For animating numeric values (latency, stats):
```typescript
gsap.timeline()
  .from('.pipe-latency', {
    textContent: 0,
    snap: { textContent: 1 },
    duration: 1.2,
    stagger: 0.15,
  });
```

### 9.5 rAF-driven SVG waveform

Pattern used in `LiveWaveform` and `DemoPanelWaveform`:
```typescript
const tick = () => {
  ampRef.current += (targetAmp - ampRef.current) * 0.05;  // lerp to target
  phaseRef.current += isActive ? 0.065 : 0.012;           // phase advance
  path.setAttribute('d', buildPath(phaseRef.current, ampRef.current));
  rafRef.current = requestAnimationFrame(tick);
};
rafRef.current = requestAnimationFrame(tick);
return () => cancelAnimationFrame(rafRef.current);
```

Colors: always read from CSS vars so they theme-switch correctly:
```typescript
const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
path.setAttribute('stroke', color);
```

### 9.6 Background mesh / orb patterns

`BackgroundMesh`: blurred radial gradient orbs at corners, `pointer-events-none`, `z-0`.

`GradientOrb`: animated blob group with CSS keyframes, specular highlight overlay.

Both are exported from `LiveAgentStudio.tsx` and reusable:
```tsx
import { GradientOrb, BackgroundMesh } from '../components/LiveAgentStudio';
```

---

## 10. Dark / Light Mode Rules

### Theme context

```tsx
import { useTheme } from '../lib/theme';

const { theme, toggleTheme } = useTheme();
const isDark = theme === 'dark';
```

### When to use `isDark` conditionals

**DO use `isDark` for:**
- Shadow colors (`shadow-black/20` dark vs `shadow-primary/5` light)
- Decorative blob/orb colors (cyan in dark, violet in light)
- Background overlays that need different opacity levels
- Inlined `style` gradients that reference explicit hex colors

**DO NOT use `isDark` for:**
- Card borders → always `border-outline-variant` (auto-themes)
- Text colors → always `text-on-surface` / `text-on-surface-variant`
- Card backgrounds → always `bg-surface` / `bg-surface-low`
- Button fill → `bg-primary text-on-primary-fixed`

### Standard `isDark` conditional patterns

```tsx
// Card background (only when needing backdrop-blur + explicit opacity)
const cardCls = `rounded-2xl border ${
  isDark
    ? 'bg-surface/70 border-outline'
    : 'bg-surface/80 border-outline-variant shadow-sm'
}`;

// Section card (glass effect)
const glassCls = isDark
  ? 'bg-surface/40 border-primary/20 backdrop-blur-xl'
  : 'bg-white/70 border-primary/15 backdrop-blur-xl shadow-2xl shadow-primary/8';

// Inline gradient (must reference explicit colors)
style={{ background: isDark
  ? 'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, var(--surface) 100%)'
  : 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, #ffffff 100%)'
}}
```

### Theme persistence

`useTheme()` persists to `localStorage` key `obsidian-command-theme`. `ThemeProvider` reads it on mount. The active brand (`selectedBrand`) is **not** persisted to localStorage — it is a compile-time config.

---

## 11. Anti-Patterns

### ❌ Never use raw Tailwind palette colors on themed surfaces

```tsx
// WRONG — hard-coded, won't theme-switch
<div className="bg-zinc-900 text-white border-zinc-700">

// CORRECT — semantic, themes automatically
<div className="bg-surface text-on-surface border-outline-variant">
```

### ❌ Never use `bg-gradient-to-r` (Tailwind v3 syntax)

```tsx
// WRONG — deprecated in this codebase's Tailwind v4
<div className="bg-gradient-to-r from-blue-500 to-purple-500">

// CORRECT — Tailwind v4 syntax
<div className="bg-linear-to-r from-primary via-secondary to-tertiary">
```

### ❌ Never use `z-[100]` bracket syntax when named class exists

```tsx
// WRONG
className="z-[100]"

// CORRECT
className="z-100"
```

### ❌ Never add arbitrary color tokens to individual components

All colors must be in `themeConfig.ts`. If a component needs a color that doesn't exist, add it as a token to the theme — not as a one-off class.

### ❌ Never import `LiveAgentStudio` for the entire studio when only needing sub-components

```tsx
// Subcomponents are exported individually:
import { GradientOrb, BackgroundMesh } from '../components/LiveAgentStudio';
```

### ❌ Never skip `AnimatePresence` on conditional renders that use Framer Motion `exit`

The `exit` prop is a no-op without a parent `AnimatePresence`. Wrap any element with conditional rendering that has an `exit` animation.

### ❌ Never read `--primary` without `.trim()`

```typescript
// WRONG — may include leading/trailing whitespace
const color = getComputedStyle(root).getPropertyValue('--primary');

// CORRECT
const color = getComputedStyle(root).getPropertyValue('--primary').trim();
```

---

## Quick-Reference Cheat Sheet

```
BACKGROUNDS          BORDERS                TEXT
bg-background        border-outline         text-on-surface
bg-surface           border-outline-variant text-on-surface-variant
bg-surface-low       border-primary         text-primary
bg-surface-high      border-primary/25      text-secondary
bg-surface-highest   border-secondary       text-tertiary
                                            text-on-primary-fixed

FILLS                SHADOWS                OPACITY MODIFIERS
bg-primary           shadow-primary/30      bg-primary/8
bg-secondary         shadow-black/20        bg-primary/10
bg-tertiary          shadow-primary/5       border-primary/25
bg-primary-container                        bg-surface/80

FONTS                MICRO LABEL PATTERN
font-headline        text-[9px] font-black uppercase tracking-[0.2em] text-primary
font-body            text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest
```
