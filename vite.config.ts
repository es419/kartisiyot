import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// באתר GitHub Pages הכתובת היא /שם-הריפו/, לכן הבילד מקבל VITE_BASE. מקומית זה '/'
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'כרטיסיות',
        short_name: 'כרטיסיות',
        description: 'כרטיסיות לימוד, חזרה מרווחת ויומן למידה',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#F3F6FB',
        theme_color: '#F3F6FB',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: base + 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    })
  ]
})
