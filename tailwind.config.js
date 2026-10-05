/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "#E2E8F0",
        input: "#E2E8F0",
        ring: "#059669",
        background: "#F8FAFC",
        foreground: "#0F172A",
        primary: {
          DEFAULT: "#059669",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#F1F5F9",
          foreground: "#1E293B",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F1F5F9",
          foreground: "#64748B",
        },
        accent: {
          DEFAULT: "#E2E8F0",
          foreground: "#0F172A",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#0F172A",
        },
        pos: {
          lightBg: "#F8FAFC",
          panel: "#FFFFFF",
          border: "#E2E8F0",
          text: "#0F172A",
          mutedText: "#64748B",
          brand: "#059669",
          brandHover: "#047857",
          warning: "#D97706",
          danger: "#DC2626",
          blue: "#2563EB",
        }
      },
    },
  },
  plugins: [],
}
