/** @type {import('tailwindcss').Config} */
// Populated from /design.md — do NOT hand-type hex values in components.
// Usage notes:
//   label-caps: always pair with `uppercase` — e.g. `text-label-caps uppercase`
//   data-mono:  always pair with `font-mono`  — e.g. `text-data-mono font-mono`
//   Tier badges: use `rounded` (4px) never `rounded-full`
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surface
        surface: "#f9f9ff",
        "surface-dim": "#cedbf2",
        "surface-bright": "#f9f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f0f3ff",
        "surface-container": "#e7eeff",
        "surface-container-high": "#dee9ff",
        "surface-container-highest": "#d7e3fb",
        "on-surface": "#101c2d",
        "on-surface-variant": "#434654",
        "inverse-surface": "#253143",
        "inverse-on-surface": "#ebf1ff",
        outline: "#737685",
        "outline-variant": "#c3c6d6",
        "surface-tint": "#0c56d0",
        // Primary
        primary: "#003d9b",
        "on-primary": "#ffffff",
        "primary-container": "#0052cc",
        "on-primary-container": "#c4d2ff",
        "inverse-primary": "#b2c5ff",
        // Secondary
        secondary: "#5c5f60",
        "on-secondary": "#ffffff",
        "secondary-container": "#dee0e2",
        "on-secondary-container": "#606365",
        // Tertiary
        tertiary: "#7b2600",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#a33500",
        "on-tertiary-container": "#ffc6b2",
        // Error
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        // Background
        background: "#f9f9ff",
        "on-background": "#101c2d",
        "surface-variant": "#d7e3fb",
        // Fixed variants
        "primary-fixed": "#dae2ff",
        "primary-fixed-dim": "#b2c5ff",
        "on-primary-fixed": "#001848",
        "on-primary-fixed-variant": "#0040a2",
        "secondary-fixed": "#e1e2e4",
        "secondary-fixed-dim": "#c5c6c8",
        "on-secondary-fixed": "#191c1e",
        "on-secondary-fixed-variant": "#444749",
        // Tier recipe colors (from design.md body — exact values for compliance badges)
        "tier-1-border": "#DFE1E6",
        "tier-2-bg": "#F4F5F7",
        // tier-3 uses primary-container (#0052cc)
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Named type scales from design.md
        display: ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "600" }],
        h1: ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        h2: ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        // label-caps: always add `uppercase` class alongside — text-transform not in fontSize
        "label-caps": ["11px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "700" }],
        // data-mono: always add `font-mono` class alongside
        "data-mono": ["13px", { lineHeight: "20px", fontWeight: "400" }],
      },
      borderRadius: {
        // All values from design.md rounded tokens. DEFAULT (4px) is the canonical shape.
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
        // Compliance badges, status tags, and cards all use DEFAULT (4px). Never use full.
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "40px",
        gutter: "24px",
      },
      maxWidth: {
        "container-max": "1440px",
      },
      boxShadow: {
        // Modal/flyout: 1px border + soft high-dispersion shadow
        modal: "0px 4px 12px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [],
};
