import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // relative asset URLs, so the build can be mounted under any path prefix
  base: './',
  plugins: [react()],
  server: {
    port: 3002,
    host: true,
    proxy: {
      '/fhir': { target: 'http://localhost:8080', changeOrigin: true },
      '/validate-sidecar': {
        target: 'http://localhost:3500',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/validate-sidecar/, '/validate'),
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
})
