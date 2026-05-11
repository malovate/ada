// vite.config.js
// ============================================================
// Vite is our build tool. Think of it as the engine that:
//   - Serves the app locally during development
//   - Bundles all files into optimised HTML/JS/CSS for production
//
// VitePWA turns our web app into a Progressive Web App.
// That means Android users can tap "Add to Home Screen" and
// Ada opens full-screen with no browser bar — just like a native app.
// ============================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA plugin — makes the app installable on Android.
    VitePWA({
      registerType: 'autoUpdate',
      // 'autoUpdate' means: if Ada's app gets a new version deployed,
      // it updates silently in the background. No "please refresh" prompts.

      manifest: {
        // The manifest is a JSON file browsers read to know how to
        // install the app. Like an app's store listing, but in code.
        name: 'Ada',
        short_name: 'Ada',
        description: 'Ada — your personal AI friend',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        // 'standalone' = opens without browser UI. Feels native.
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  server: {
    port: 5173,
    // Allow access from other devices on the same network.
    // This means you can also open http://YOUR_IP:5173 on your phone.
    host: true,
  }
});
