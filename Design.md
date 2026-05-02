---
name: Architectural Utility
colors:
  surface: '#f9f9ff'
  surface-dim: '#cedbf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee9ff'
  surface-container-highest: '#d7e3fb'
  on-surface: '#101c2d'
  on-surface-variant: '#434654'
  inverse-surface: '#253143'
  inverse-on-surface: '#ebf1ff'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#5c5f60'
  on-secondary: '#ffffff'
  secondary-container: '#dee0e2'
  on-secondary-container: '#606365'
  tertiary: '#7b2600'
  on-tertiary: '#ffffff'
  tertiary-container: '#a33500'
  on-tertiary-container: '#ffc6b2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#e1e2e4'
  secondary-fixed-dim: '#c5c6c8'
  on-secondary-fixed: '#191c1e'
  on-secondary-fixed-variant: '#444749'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59b'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#812800'
  background: '#f9f9ff'
  on-background: '#101c2d'
  surface-variant: '#d7e3fb'
typography:
  display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: monospace
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style

The brand personality is rooted in **structural integrity, liability-focused precision, and high-trust transparency.** This design system facilitates high-stakes decision-making by removing visual noise and emphasizing verification hierarchies.

The style is a blend of **Architectural Minimalism** and **Institutional Modernism**. It prioritizes a clear information hierarchy where the "weight" of an element corresponds directly to its compliance status. The UI should feel like a blueprint: deliberate, organized, and essential. Every pixel serves a functional purpose, evoking a sense of calm authority for property managers navigating complex vendor data.

## Colors

The palette is restricted to a functional triad designed to communicate the "Level of Trust" at a glance. 

- **Primary Blue:** Used exclusively for "Verified" states and primary calls to action. It represents the highest tier of compliance and safety.
- **Neutrals:** A spectrum of cool grays. Mid-range grays define "Self-Verified" states, while light strokes define "Unverified" boundaries.
- **Backgrounds:** Off-whites are utilized to separate the workspace from the canvas, reducing glare during extended usage periods. 
- **Surface Logic:** Tier 1 (Unverified) uses a `#DFE1E6` outline. Tier 2 (Self-Verified) uses a `#F4F5F7` solid fill. Tier 3 (Verified) uses a `#0052CC` fill or high-contrast accent.

## Typography

This design system utilizes **Inter** for its exceptional legibility in data-dense environments and neutral character. 

- **Scale:** The type scale is compact to allow for maximum data density without sacrificing readability.
- **Rhythm:** Standard body text is set at 14px for optimal scanning of vendor rosters.
- **Labels:** Uppercase labels with slight letter-spacing are used for table headers and section categorizations to distinguish metadata from user data.
- **Data Mono:** For technical identifiers like ID numbers or insurance policy codes, a monospace fallback is permitted to ensure character alignment.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid Grid**. Sidebars and navigation are fixed, while the primary data workspace expands within a max-width container to prevent line-lengths from becoming unreadable on ultra-wide monitors.

- **Rhythm:** A 4px baseline grid governs all spacing.
- **Density:** Use "md" (16px) for standard padding within cards and "lg" (24px) for margins between major layout blocks. 
- **Alignment:** All elements must align to the architectural grid. Vertical lines are encouraged to create a sense of columns and rows, reinforcing the "spreadsheet-as-a-dashboard" utility.

## Elevation & Depth

To maintain an "aggressively simple" aesthetic, this design system eschews traditional shadows in favor of **Tonal Layering and Low-Contrast Outlines.**

- **Flat Hierarchy:** Depth is communicated through surface color changes rather than Z-axis elevation.
- **Borders:** Subtle 1px borders in `#DFE1E6` define the perimeter of interactive modules.
- **Stacking:** Modals and fly-outs do not use heavy blurs; instead, they use a solid 1px border with a very soft, high-dispersion shadow (0px 4px 12px rgba(0,0,0,0.05)) to separate from the background without breaking the minimalist aesthetic.

## Shapes

The shape language is **Soft-Square**. A consistent 4px (0.25rem) radius is applied to all components to strike a balance between the precision of a sharp corner and the approachability of a modern SaaS tool.

- **Buttons & Inputs:** Use the base 4px radius.
- **Status Tags:** Use the same 4px radius to maintain the architectural "block" feel; do not use pill shapes (rounded-full).
- **Cards:** Large containers follow the 4px rule to ensure the grid feels tight and engineered.

## Components

### Verification Tiers (The Compliance Logic)
- **Tier 1 (Unverified):** Components use a transparent background with a 1px `#DFE1E6` dashed or solid border. Text is neutral.
- **Tier 2 (Self-Verified):** Components use a solid `#F4F5F7` background with no border. Text is dark gray.
- **Tier 3 (Verified):** Components use a solid `#0052CC` background or a heavy 2px left-border accent in the same color. Text is white or primary blue.

### Buttons
- **Primary:** Solid Professional Blue. No gradients.
- **Secondary:** Light gray fill with dark gray text.
- **Tertiary:** Text-only with an underline on hover, for low-priority actions.

### Data Tables
- Header rows use `label-caps` typography with a subtle bottom border.
- Row hovering should use a simple `#F9FAFB` tint change.
- Status icons (Checkmarks, Shields) are restricted to Tier 3 elements only.

### Input Fields
- Clean, 1px bordered boxes. 
- On focus, the border transitions to Professional Blue with no outer glow.
- Error states use a high-visibility red, but only for validation failures, never for "Unverified" status.

### Compliance Badges
Small, rectangular tags used in rosters to show a vendor's current standing. These must strictly follow the Tier 1-3 color logic defined in the Colors section.