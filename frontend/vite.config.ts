import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
    port: 2000,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
