import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function quietProxyErrors(proxy: {
  on: (event: string, listener: (...args: never[]) => void) => void;
}) {
  proxy.on('error', ((error: NodeJS.ErrnoException) => {
    const code = error.code ?? '';
    if (
      code === 'EPIPE' ||
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'ECONNABORTED'
    ) {
      return;
    }
    console.warn('[vite] proxy error:', error.message);
  }) as (...args: never[]) => void);

  proxy.on('proxyReqWs', ((
    _proxyReq,
    _req,
    socket: { on: (event: string, cb: () => void) => void },
  ) => {
    socket.on('error', () => undefined);
  }) as (...args: never[]) => void);
}

export default defineConfig({
  assetsInclude: ['**/*.glb'],
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'brand/codeteak-logo.svg',
        'icons/pwa-192.png',
        'icons/pwa-512.png',
        'icons/pwa-512-maskable.png',
      ],
      manifest: {
        name: 'Teakflow',
        short_name: 'Teakflow',
        description: 'Daily work, chat, and Google Meet for Codeteak.',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en',
        icons: [
          {
            src: '/icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Keep shell assets under the default 2 MiB when possible; allow room for
        // vendor chunks (three.js) without failing the production build.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Lanyard/three.js is lazy-loaded on Home only — do not force it into SW install.
        globIgnores: ['**/*.glb', '**/card-*.glb', '**/three-*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io/],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/three-.*\.js$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'teakflow-three',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-styles',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/api\/v1\/(?!auth\/)(?!sales\/).*/i,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'teakflow-api-get',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }
          if (
            id.includes('/three/') ||
            id.includes('\\three\\') ||
            id.includes('@react-three') ||
            id.includes('@dimforge') ||
            id.includes('meshline') ||
            id.includes('maath')
          ) {
            return 'three';
          }
          if (
            id.includes('socket.io') ||
            id.includes('zustand') ||
            id.includes('@tanstack')
          ) {
            return 'realtime';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
  optimizeDeps: {
    include: ['workbox-window'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
        configure: quietProxyErrors,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3005',
        ws: true,
        changeOrigin: true,
        configure: quietProxyErrors,
      },
    },
  },
});
