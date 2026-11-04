/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#070a0f',
          900: '#0d121c',
          850: '#131a27',
          800: '#1a2333',
          700: '#263349',
          600: '#3d4f6d',
          500: '#5e7399',
          400: '#8ca1c2',
        },
        electric: {
          amber: '#f59e0b',
          orange: '#ea580c',
          red: '#ef4444',
          cyan: '#06b6d4',
          emerald: '#10b981'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
