import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Optimizaciones de producción
    target: 'es2015',
    rollupOptions: {
      output: {
        // Mejora code splitting para cargar solo lo necesario
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            if (id.includes('axios')) {
              return 'vendor-utils';
            }
            return 'vendor';
          }
        },
      },
    },
    // Incrementa el límite de warnings de chunk size
    chunkSizeWarningLimit: 1000,
  },
  server: {
    hmr: {
      overlay: false, // Desactiva overlay de errores para mejor performance en dev
    },
  },
})

