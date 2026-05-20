import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// Producția rulează in spatele reverse proxy-ului la /berlinstar/.
// În dev (vite serve), base ramane '/' pentru a rula direct pe localhost.
function resolveBase(mode: string): string {
  if (process.env.VITE_BASE_PATH) return process.env.VITE_BASE_PATH
  return mode === 'production' ? '/berlinstar/' : '/'
}

export default defineConfig(({ mode }) => ({
  base: resolveBase(mode),
  plugins: [solid()],
  server: {
    port: 2000,
    proxy: {
      '/api': 'http://localhost:4000',
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        manualChunks: {
          'solid-vendor': ['solid-js', '@solidjs/router'],
        },
      },
    },
  },
}))
