/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/client/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta ALANBREX — derivada de los logos oficiales
        void: '#050805', // fondo principal (negro profundo)
        carbon: '#0A0D0A', // fondo secundario
        panel: '#0E130E', // superficie de tarjetas
        panel2: '#131A13', // superficie elevada
        line: '#1E2C1E', // bordes
        neon: {
          DEFAULT: '#39FF14', // verde neón principal
          bright: '#00FF41', // verde neón eléctrico
          acid: '#A8FF3E', // verde lima (secundario)
          dim: '#1FA30C', // verde apagado (bordes activos)
        },
        silver: '#E8F0E8', // texto principal (blanco plateado)
        ash: '#8FA08F', // texto secundario
      },
      fontFamily: {
        display: ['"Exo 2"', 'system-ui', 'sans-serif'], // títulos racing itálicos
        tech: ['Rajdhani', 'system-ui', 'sans-serif'], // UI general
        mono: ['"Share Tech Mono"', 'ui-monospace', 'monospace'], // datos/crono
      },
      boxShadow: {
        neon: '0 0 10px rgba(57,255,20,.55), 0 0 34px rgba(57,255,20,.22)',
        'neon-sm': '0 0 6px rgba(57,255,20,.45)',
        'neon-lg': '0 0 14px rgba(57,255,20,.65), 0 0 60px rgba(57,255,20,.30)',
        'neon-inset': 'inset 0 0 18px rgba(57,255,20,.14)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 1.6s ease-in-out infinite',
        'pulse-live': 'pulseLive 1.4s ease-in-out infinite',
        flicker: 'flicker 4s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(57,255,20,.55), 0 0 34px rgba(57,255,20,.22)' },
          '50%': { boxShadow: '0 0 20px rgba(57,255,20,.85), 0 0 60px rgba(57,255,20,.45)' },
        },
        pulseLive: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '3%': { opacity: '0.4' },
          '6%': { opacity: '1' },
          '52%': { opacity: '1' },
          '54%': { opacity: '0.5' },
          '56%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
