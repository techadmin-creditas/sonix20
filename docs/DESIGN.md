# Design System Specification: The Obsidian Command

## 1. Overview & Creative North Star
The North Star for this design system is **"The Obsidian Command."** 

We are moving away from the "SaaS-standard" white-and-grey box layouts. This system is designed to feel like a high-end, cinematic mission control center—authoritative, deep, and precision-engineered. We achieve this through a "Curated Depth" approach: breaking the rigid, flat grid with intentional asymmetry, overlapping glass layers, and high-contrast typography scales that mirror a premium editorial spread. This isn't just a dashboard; it is a tool for high-stakes decision-making where focus is the ultimate currency.

---

## 2. Colors & Surface Philosophy
The palette is designed for high-contrast legibility and cinematic depth, available in two primary configurations.

### Configuration A: The Obsidian Command (Dark Mode)
The default state, rooted in the depth of `Deep Black (#050608)` and energized by amber glows.
*   **Core Canvas:** `#050608`. Subtle mesh gradients in corners using `Dark Amber (#1C0D02)`.
*   **Hierarchy:** 
    *   `surface-lowest`: `#0d0e11`
    *   `surface`: `#121316`
    *   `surface-low`: `#1a1c1e`
    *   `surface-high`: `#292a2d`
    *   `surface-highest`: `#343538`
*   **Glass:** `bg-surface/70` with `backdrop-blur-3xl`.

### Configuration B: The Alabaster Signal (Light Mode)
A high-clarity alternative, using warm off-whites and soft amber shadows to maintain the premium feel.
*   **Core Canvas:** `Sand (#fdf8f5)`. Subtle warm glows using `Soft Amber (#fff1e6)`.
*   **Hierarchy:** 
    *   `surface-lowest`: `#ffffff`
    *   `surface`: `#fffbff`
    *   `surface-low`: `#f7f3f1`
    *   `surface-high`: `#f1edeb`
    *   `surface-highest`: `#ebe7e5`
*   **Glass:** `bg-surface/40` with `backdrop-blur-2xl`.

### The "No-Line" Rule
Explicitly prohibit the use of 1px solid borders for sectioning or layout containment in BOTH themes. Structural boundaries must be defined solely through background color shifts or subtle box-shadow layering.

### Signature Textures
*   **Glassmorphism:** Use `glass-blur-3xl` for floating panels. In Dark Mode, these allow underlying amber mesh to bleed through. In Light Mode, they create a soft depth without weighing down the interface.
*   **The Ember Gradient:** Main CTAs use a 135-degree linear gradient from `primary-container` to a deeper amber. This provides a tactile, glowing "soul" that works as a light-source in Dark Mode and a high-contrast accent in Light Mode.

---

## 3. Typography
We utilize a dual-font strategy to balance technical precision with high-end editorial flair.

*   **Display & Headlines (Manrope):** Chosen for its geometric performance and modern character. Use `display-lg (3.5rem)` and `headline-md (1.75rem)` with tight letter spacing (-0.02em) to create an authoritative presence.
*   **Performance Data (Inter):** For body text, titles, and labels. Inter provides unparalleled legibility at small sizes.
*   **The Editorial Scale:** Create visual drama by pairing a very large `display-md` headline with a tiny, uppercase `label-sm` (tracking +10%) for metadata. This "Big/Small" contrast is the hallmark of premium design.

---

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering** rather than structural lines.

*   **The Layering Principle:** Stacking tiers (e.g., a `surface-container-highest` card on a `surface-container-low` section) creates a natural lift.
*   **Ambient Shadows:** For floating elements, use extra-diffused shadows (32px to 64px blur). The shadow must not be black; it should be a 10% opacity tint of the `primary` color to mimic the "glow" of the ember interface.
*   **The Ghost Border:** If containment is required for accessibility, use the "Ghost Border" fallback: a 1px stroke of `outline-variant (#564334)` at **10% opacity**. Never use 100% opaque borders.

---

## 5. Components

### Buttons
*   **Primary:** 135° Gradient (`#FB8C00` to `#B45309`). Text is `on-primary-fixed (#2e1500)`.
*   **Secondary:** `surface-container-highest` background with a Ghost Border.
*   **Tertiary:** Ghost Border only, no background fill, with a subtle hover "glow" (4% primary tint).

### Input Fields
*   **Style:** No bottom lines or full borders. Use `surface-container-highest` as a solid block with `rounded-md (0.375rem)`.
*   **Active State:** A 1px Ghost Border at 20% opacity of the `primary` color.

### Cards & Lists
*   **The Divider Ban:** Dividers are strictly forbidden. To separate list items, use a vertical spacing of `1.5 (0.375rem)` or a 1% background shift on hover. 
*   **Cards:** Use `surface-container-low` with a `glass-blur-3xl` effect for any card that sits over the mesh gradient areas.

### Data Visualization (The Pulse)
*   **Glow Traces:** Use `secondary (#ffb68e)` for line graphs, but apply a 5px gaussian blur "drop shadow" of the same color to create a neon-tube effect.

---

## 6. Do’s and Don’ts

### Do
*   **Use Intentional Asymmetry:** Align the primary navigation to the left but allow the data widgets to vary in width (e.g., 60/40 splits) to avoid a "bootstrap" look.
*   **Embrace Breathing Room:** Use `spacing-16 (4rem)` between major sections to let the deep black background provide visual relief.
*   **Layer Glass:** Overlap glass panels slightly (5-10px) to showcase the `glass-blur-3xl` effect.

### Don’t
*   **No Pure White:** Never use `#FFFFFF`. Use `on-surface (#e3e2e5)` for text to maintain the cinematic, low-light aesthetic.
*   **No Solid Dividers:** Do not use lines to separate content. If it feels cluttered, increase the `spacing-scale` or shift the surface tier.
*   **No Default Shadows:** Avoid standard "drop shadows." If it doesn't have a color-tinted ambient glow, it doesn't belong in this system.