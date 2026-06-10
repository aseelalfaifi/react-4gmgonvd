/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["'Newsreader'", "Georgia", "serif"],
      },
      // Remap Tailwind's palette onto the "Clinical Calm" design tokens used by
      // wm.css, so the AmbuScribe (Tailwind) tool matches the Warfarin tool.
      colors: {
        slate: {
          50: "#f1f3f5",   // --page
          100: "#eaedf0",  // quiet fill (chips)
          200: "#e3e6e9",  // --line (borders / dividers)
          300: "#d2d7dc",  // input borders
          400: "#939aa0",  // --faint (placeholders, meta)
          500: "#6e7780",  // --muted (help text)
          600: "#5c656e",
          700: "#48505a",  // --ink-soft (labels)
          800: "#2a3138",  // --ink (strong text)
          900: "#1f262c",
        },
        teal: {
          50: "#eaf3f4",
          100: "#cfe7ea",  // --teal-100
          200: "#c1dde0",  // focus rings
          300: "#a6ccd0",
          400: "#5f8f99",
          500: "#2a6f80",  // --teal-600
          600: "#2a6f80",  // --teal-600 (accent dot, focus border)
          700: "#205c6b",  // --teal-700 (primary)
          800: "#1a4a57",  // --teal-800 (hover)
          900: "#143a45",  // --teal-900 (text on tint)
        },
        amber: {
          50: "#f8f1dd",   // --amber-bg
          100: "#f4ead0",  // --amber-bg2
          200: "#dcc89a",  // --amber-line
          500: "#b07d12",
          800: "#7a521f",  // --amber-strong
          900: "#6b4a1d",
        },
        rose: { 300: "#d99c97", 500: "#d12f4a" },  // --crimson
        red: { 500: "#d12f4a" },                   // --crimson
      },
      boxShadow: {
        // match wm.css --shadow-soft so AmbuScribe cards float like the Warfarin cards
        sm: "0 1px 2px oklch(0.3 0.04 220 / 0.05), 0 6px 18px -12px oklch(0.3 0.05 220 / 0.16)",
      },
      borderRadius: {
        md: "9px",
        lg: "11px",   // inputs/buttons → matches wm.css inputs
        xl: "13px",   // --r-md
        "2xl": "16px",
      },
    },
  },
  plugins: [],
};
