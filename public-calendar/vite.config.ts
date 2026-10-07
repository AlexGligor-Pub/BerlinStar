import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

// base './' — aceeasi build merge la orice domeniu si sub orice cale
// (testservice.ro/, professorprime.ro/public-calendar/), fara rebuild.
export default defineConfig({
  base: './',
  plugins: [solid()],
  server: {
    port: 2100,
    // In dev, proxy-ul de productie (nginx) nu exista: trimitem direct la
    // backend, cu cheia din mediu.
    proxy: {
      '/api': {
        target: process.env.BERLINSTAR_URL ?? 'http://localhost:4000',
        rewrite: (p) => p.replace(/^\/api/, '/api/public/v1'),
        headers: { 'X-Api-Key': process.env.BERLINSTAR_API_KEY ?? '' },
      },
    },
  },
})
