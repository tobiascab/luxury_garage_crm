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
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'Luxury Garage',
        short_name: 'Luxury',
        description: 'Luxury Garage - App',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        // La PWA arranca en la raíz; el RootGate (App.jsx) detecta que corre como
        // app instalada (standalone) y salta directo a /login o a la cuenta,
        // SIN mostrar nunca la landing de marketing (esa es solo para el navegador).
        id: '/',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Handlers de Web Push (push + notificationclick) inyectados al SW generado.
        importScripts: ['push-sw.js'],
        // NO precachear el 3D (three ~1MB) ni la landing: son solo-web y pesados.
        // Así la instalación de la PWA/app móvil no carga código que nunca usa.
        // (Se sirven por red cuando hacen falta; el browser igual los cachea por HTTP.)
        globIgnores: ['**/Scene3D-*.js', '**/Landing-*.js'],
        // Cachear assets estáticos en runtime para cargas instantáneas en visitas repetidas.
        // OJO: NO cacheamos /api (respuestas autenticadas/por-usuario) para evitar datos cruzados o viejos.
        runtimeCaching: [
          {
            // Fuentes de Google (CSS + woff2)
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Imágenes propias sin hash (logo, favicon, iconos de /public): StaleWhileRevalidate
            // para que un cambio de branding se refleje en la próxima carga (CacheFirst las
            // dejaría congeladas hasta 30 días, mostrando el logo viejo a usuarios recurrentes).
            urlPattern: ({ url, request }) => request.destination === 'image' && url.origin === self.location.origin,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'app-images', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Imágenes remotas (avatares de Unsplash, etc.): CacheFirst, cambian poco.
            urlPattern: ({ url, request }) => request.destination === 'image' && url.origin !== self.location.origin,
            handler: 'CacheFirst',
            options: { cacheName: 'remote-images', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  build: {
    // No se borra dist/ en cada build A PROPÓSITO. Vite genera los chunks con un hash en el
    // nombre; al vaciar la carpeta, cualquier pestaña que ya estaba abierta pide archivos que
    // dejaron de existir y la app muestra "No se pudo cargar esta sección". Dejando los
    // anteriores, quien tenga la app abierta sigue navegando hasta que recargue.
    // Los assets que quedan sin uso se limpian con `npm run limpiar-assets`.
    emptyOutDir: false,
    // Navegadores modernos / WebView de Capacitor → menos transpilación y bundle más chico.
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Solo forzamos chunk para lo que SÍ está en el camino crítico y es compartido
        // por casi todas las vistas (react, framer-motion/lucide del layout, axios).
        // recharts, html5-qrcode, date-fns NO se fuerzan: rolldown los deja
        // en el chunk async de la página lazy que los usa → solo se descargan al entrar
        // a esa vista (el cliente final nunca baja recharts ni el lector QR del admin).
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react'
          if (id.includes('framer-motion') || id.includes('lucide-react')) return 'vendor-ui'
          if (id.includes('axios')) return 'vendor-utils'
        },
      },
    },
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
      '0.0.0.0',
    ],
  },
})
