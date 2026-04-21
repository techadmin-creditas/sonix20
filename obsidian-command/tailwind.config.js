/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      fontSize: {
        'display-hero': ['clamp(3rem, 7vw, 5rem)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-section': ['clamp(2rem, 4.5vw, 3.5rem)', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        'body-xl': ['clamp(1.125rem, 1.4vw, 1.375rem)', { lineHeight: '1.6' }],
        'body-lg': ['clamp(1rem, 1.1vw, 1.125rem)', { lineHeight: '1.5' }],
        'body-base': ['clamp(0.875rem, 1vw, 1rem)', { lineHeight: '1.5' }],
        'label-sm': ['clamp(0.8125rem, 0.9vw, 0.875rem)', { lineHeight: '1.4', fontWeight: '600' }],
        'label-xs': ['clamp(0.6875rem, 0.75vw, 0.75rem)', { lineHeight: '1.4', fontWeight: '700' }],
      },
      spacing: {
        'section-padding': 'clamp(2rem, 6vw, 6rem)',
        'card-gap': 'clamp(1rem, 2.5vw, 2.5rem)',
        'hero-gap': 'clamp(2rem, 5vw, 5rem)',
      },
    },
  },
  plugins: [],
}
