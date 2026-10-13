/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // QuickShare design tokens
        ink: { DEFAULT: 'oklch(0.21 0.01 260)', soft: 'oklch(0.32 0.01 260)' },
        paper: 'oklch(0.985 0.002 260)',
        bar: 'oklch(0.995 0.001 260)',
        line: { DEFAULT: 'oklch(0.93 0.004 260)', soft: 'oklch(0.95 0.003 260)', strong: 'oklch(0.86 0.006 260)' },
        fill: { DEFAULT: 'oklch(0.97 0.003 260)', 2: 'oklch(0.96 0.003 260)' },
        mute: { DEFAULT: 'oklch(0.5 0.01 260)', 2: 'oklch(0.45 0.01 260)' },
        blue: {
          DEFAULT: 'oklch(0.58 0.2 262)',
          link: 'oklch(0.52 0.2 262)',
          tint: 'oklch(0.95 0.03 262)',
          wash: 'oklch(0.97 0.02 262)',
          ink: 'oklch(0.45 0.18 262)',
        },
        ok: 'oklch(0.7 0.16 150)',
        danger: { DEFAULT: 'oklch(0.55 0.2 25)', wash: 'oklch(0.96 0.03 25)' },

        border: 'oklch(0.93 0.004 260)',
        input: 'oklch(0.9 0.005 260)',
        ring: 'oklch(0.58 0.2 262)',
        background: 'oklch(0.985 0.002 260)',
        foreground: 'oklch(0.21 0.01 260)',
        primary: { DEFAULT: 'oklch(0.58 0.2 262)', foreground: 'white' },
        secondary: { DEFAULT: 'oklch(0.95 0.003 260)', foreground: 'oklch(0.21 0.01 260)' },
        destructive: { DEFAULT: 'oklch(0.55 0.2 25)', foreground: 'white' },
        muted: { DEFAULT: 'oklch(0.97 0.003 260)', foreground: 'oklch(0.5 0.01 260)' },
        accent: { DEFAULT: 'oklch(0.96 0.003 260)', foreground: 'oklch(0.21 0.01 260)' },
        popover: { DEFAULT: 'white', foreground: 'oklch(0.21 0.01 260)' },
        card: { DEFAULT: 'white', foreground: 'oklch(0.21 0.01 260)' },
      },
      borderRadius: { lg: '12px', md: '10px', sm: '8px' },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
