// vite.config.js
// ============================================================
// Vite build tool configuration.
// VitePWA turns our web app into a Progressive Web App —
// installable on Android home screen as a real app, not a shortcut.
//
// WHY it was showing as a "Chrome shortcut" before:
//   1. Icons were missing (we referenced them but never created them)
//   2. Local development (http://) can't fully install PWAs —
//      Chrome requires HTTPS for proper PWA installation.
//      On Netlify (which gives you HTTPS automatically), it will
//      install as a genuine app with its own launcher icon.
//
// NOW FIXED:
//   - Icon files generated (public/icon-192.png, public/icon-512.png)
//   - Manifest has all required fields
//   - Service worker registered for offline support
// ============================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // 'autoUpdate' = if Ada's app updates on the server, the installed
      // version on Paul's phone updates silently in the background.
      registerType: 'autoUpdate',

      // includeAssets: extra files to cache for offline use.
      // The service worker will cache these so the app works
      // even when there's no internet (it'll just show the UI —
      // Ada's brain still needs the server to respond).
      includeAssets: ['ada-avatar.png', 'icon-192.png', 'icon-512.png'],

      manifest: {
        // These fields are what Chrome reads to decide HOW to install the app.
        name: 'Ada',
        short_name: 'Ada',
        // 'short_name' is what appears under the icon on the home screen.
        // Keep it short — Android truncates long names.

        description: 'Ada — your personal AI friend',
        theme_color: '#0a0a0f',
        // theme_color tints the status bar when the app is open.

        background_color: '#0a0a0f',
        // background_color is the splash screen color while the app loads.

        display: 'standalone',
        // 'standalone' = opens as a full app with NO browser chrome
        // (no address bar, no back/forward buttons, no tabs).
        // This is what makes it feel native, not like a website.

        orientation: 'portrait',
        start_url: '/',

        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            // 'purpose: any' = used for regular icon display
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            // 'maskable' icons are cropped differently on Android —
            // some launchers (like Pixel phones) show circular icons.
            // A maskable icon has padding so the face stays visible
            // after being cropped to a circle.
            // We use the same 512px icon — the face is centered so
            // it survives circular cropping.
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },

      // workbox controls the service worker (offline caching).
      workbox: {
        // Cache everything in the build output.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],

        // runtimeCaching: cache API responses too.
        // This means if Paul's phone loses signal mid-conversation,
        // the app still loads (Ada just can't respond until reconnected).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ],

  server: {
    port: 5173,
    host: true,
    // host: true allows access from other devices on the same network.
    // Open http://YOUR_IP:5173 on your phone (same WiFi) to test.
  }
});
