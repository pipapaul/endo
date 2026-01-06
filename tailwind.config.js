/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: 'var(--endo-accent)',
        // Override rose palette to use CSS variables with fallbacks
        // This allows theme switching without changing component classes
        rose: {
          50: 'var(--tw-rose-50, #fff1f2)',
          100: 'var(--tw-rose-100, #ffe4e6)',
          200: 'var(--tw-rose-200, #fecdd3)',
          300: 'var(--tw-rose-300, #fda4af)',
          400: 'var(--tw-rose-400, #fb7185)',
          500: 'var(--tw-rose-500, #f43f5e)',
          600: 'var(--tw-rose-600, #e11d48)',
          700: 'var(--tw-rose-700, #be123c)',
          800: 'var(--tw-rose-800, #9f1239)',
          900: 'var(--tw-rose-900, #881337)',
          950: 'var(--tw-rose-950, #4c0519)',
        },
      },
    },
  },
  plugins: [],
};
