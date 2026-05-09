import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Luxury Garage',
        short_name: 'Luxury',
        description: 'Luxury Garage - App',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
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
    port: 5175,
    host: '0.0.0.0',
    hmr: {
      host: 'luxurygarage.arizar-ia.cloud',
      port: 443,
      protocol: 'wss',
    },
    middlewareMode: false,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'luxurygarage.arizar-ia.cloud',
      '0.0.0.0'
    ],
  },
})

