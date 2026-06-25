import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'The Lawn Pack Companion',
        short_name: 'Lawn Pack',
        description:
          'Data-driven lawn care workflow — seasonal packs, mowing, watering, and weather-aware reminders.',
        theme_color: '#14532d',
        background_color: '#f3f4f6',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'en-GB',
        categories: ['lifestyle', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jfif,woff2}'],
        // Let /public PDFs and DOCXs bypass SPA fallback (fixes broken guide links in PWA).
        navigateFallbackDenylist: [/^\/api\//, /\.pdf$/i, /\.docx$/i],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo-forecast',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /\.(pdf|docx)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'lawn-pack-guides',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/guides\/masterclass\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lawn-masterclass-images',
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
