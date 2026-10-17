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
        brand: {
          DEFAULT: '#A5E548',
          hover: '#94D638',
          light: '#B5EE5E',
          dark: '#7BB828',
          muted: 'rgba(165, 229, 72, 0.15)',
        },
        surface: {
          dark: {
            bg: '#0B0F10',
            secondary: '#151A1C',
            card: '#1D2326',
            input: '#252C2E',
            bubbleIn: '#292F32',
            border: '#252C2E',
            text: '#F5F7F7',
            muted: '#9BA5A8',
          },
          light: {
            bg: '#F7F9F5',
            secondary: '#FFFFFF',
            card: '#F0F3ED',
            input: '#E8EDE5',
            bubbleIn: '#E9EDE8',
            border: '#E0E6DD',
            text: '#171B18',
            muted: '#68716B',
          }
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'pulse-subtle': 'pulseSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        }
      }
    },
  },
  plugins: [],
}
