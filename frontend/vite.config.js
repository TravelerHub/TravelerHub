import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ViteImageOptimizer({
      jpg: { quality: 72, mozjpeg: true },
      jpeg: { quality: 72, mozjpeg: true },
      png: { quality: 80 },
      webp: { quality: 78 },
      svg: {
        multipass: true,
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeViewBox: false,
              },
            },
          },
        ],
      },
    }),
  ],

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true
      }
    }
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mapbox: ['mapbox-gl', 'supercluster', '@mapbox/polyline'],
          fullcalendar: ['@fullcalendar/react', '@fullcalendar/daygrid', '@fullcalendar/timegrid', '@fullcalendar/interaction'],
          dnd: ['@hello-pangea/dnd'],
          lottie: ['lottie-react'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
