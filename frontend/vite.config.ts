/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const api = process.env.VITE_DEV_API ?? 'http://localhost:4000'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // Element Plus components are imported on demand; their CSS is loaded once in a cascade layer (main.css).
    Components({ dts: 'src/components.d.ts', dirs: [], resolvers: [ElementPlusResolver({ importStyle: false })] })
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: api, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
      '/uploads': { target: api, changeOrigin: true },
      '/socket.io': { target: api, ws: true, changeOrigin: true }
    }
  },
  build: {
    target: 'es2022',
    // MapLibre (~1 MB, ~270 KB gzip) is loaded only on object pages that show a map.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks (id) {
          if (!id.includes('node_modules')) return
          if (id.includes('socket.io') || id.includes('engine.io')) return 'realtime'
          if (/[\\/](vue|@vue|vue-router|pinia)[\\/]/.test(id)) return 'framework'
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts']
  }
})
