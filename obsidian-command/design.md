# Obsidian Command: The Neural Interface Design System

## 1. Creative North Star: "The Mission Control Desk"

The Obsidian Command aesthetic is a high-fidelity, enterprise-grade environment designed for managing complex voice AI. It avoids the "airy" look of standard SaaS in favor of a **high-density, editorial dark mode**.

### Key Principles:
- **Intentional Depth**: Treat the UI as a series of physical, illuminated glass panels floating in a void.
- **Backlit Intelligence**: Use "light-leak" edges and vibrant amber/emerald accents to draw the eye toward critical data.
- **Kinetic Feedback**: Every interaction should feel tactile and responsive through subtle 3D movements and staggered animations.

---

## 2. Color Foundation: Pitch & Glow

The palette is rooted in absolute depth, using `#050608` as the primary void.

### Core Tokens
| Token | Dark Hex | Light Hex | Usage |
| :--- | :--- | :--- | :--- |
| **bg-background** | `#050608` | `#fdf8f5` | Main application canvas |
| **bg-surface-lowest** | `#0d0e11` | `#ffffff` | Primary panel backgrounds |
| **bg-surface-low** | `#1a1c1e` | `#f7f3f1` | Secondary containers / Sidebars |
| **primary** | `#ffb77b` | `#8f4e00` | Main action color (Amber Glow) |
| **emerald-500** | `#10b981` | `#059669` | Success / Online / Operational |
| **blue-500** | `#3b82f6` | `#2563eb` | Inference / Processing / Logic |

### The "No-Border" Rule
Layout boundaries are defined through **Tonal Transitions** and **Glass Elevation** rather than solid lines.
- Use `border-outline-variant/10` for subtle separation.
- Use `.premium-forge-border` for high-end cards.

---

## 3. Typography: Editorial Authority

We use **Manrope** for headlines to provide a geometric, AI-native feel, and **Inter** for data density.

- **Display (Total Stats)**: `font-headline font-extrabold tracking-tight`. Large metrics use negative letter-spacing for an authoritative look.
- **Technical Labels**: `text-[10px] font-bold uppercase tracking-[0.3em] text-outline`. 
- **Metadata**: `text-[9px] font-black uppercase tracking-widest`.
- **Contrast**: Pair large, bold metrics with tiny, wide-letter-spaced labels.

---

## 4. Interaction & Motion: Kinetic Triggers

We use `framer-motion` to make the interface feel alive.

### 1. The Dynamic Tilt (3D Hover)
All interactive cards (`StatCard`, `ChartContainer`) must implement cursor-tracking rotation:
- **Perspective**: `1000px`.
- **Hover**: Tilt 2-5 degrees toward the mouse.
- **Scaling**: `scale: 1.02` on hover, `scale: 0.98` on click.

### 2. Neural Stagger (Entrance)
Grids should animate items in sequence:
- **Initial**: `opacity: 0, y: 20, scale: 0.95`.
- **Animate**: `opacity: 1, y: 0, scale: 1`.
- **Stagger**: `0.1s` delay between children.

### 3. Ambient Drift (Background)
The `.studio-mesh-gradient` includes floating radial glows moving along organic paths over 20-30s intervals with periodic scaling (0.9x to 1.3x).

---

## 5. Component Patterns

### The Stat Card
- **Background**: `bg-surface-lowest` with `backdrop-blur-xl`.
- **Icon**: Nested in `bg-surface-low` with a subtle amber glow on hover.
- **Shine**: An absolute-positioned overflow-hidden overlay with a linear-gradient "sweep" on hover.

### Data Visualization
- **Charts**: Use `AreaChart` with `linearGradient` fills. 
- **Success Rate**: Colors transition from `#fb8c00` to `#10b981` based on value.
- **Tooltips**: Custom glassmorphic containers with `backdrop-filter: blur(10px)` and white bold text.

### Buttons (Kinetic Buttons)
- **Primary**: `bg-primary` text-on-primary-fixed. High saturation, shadow-lg, and scale-up on hover.
- **Ghost**: Transparent background with `premium-forge-border` and text-primary.

---

## 6. Implementation Checklist

- [ ] Use `NeuralBackground` for all major landing pages.
- [ ] Wrap main content grids in `motion.div` with staggered children.
- [ ] Ensure all cards have the `.premium-forge-border` utility.
- [ ] Use `font-headline` (Manrope) for all headers.
- [ ] Add `studio-glow-amber` to primary call-to-action buttons.
