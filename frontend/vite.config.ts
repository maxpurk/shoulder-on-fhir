import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    // Proxy FHIR requests to avoid CORS issues in development
    proxy: {
      '/fhir': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Validator sidecar (ADR-0051) — strict client pre-flight.
      '/validate-sidecar': {
        target: 'http://localhost:3500',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/validate-sidecar/, '/validate'),
      },
      // tx.fhir.org SNOMED expansion (ADR-0062). Routed same-origin to
      // sidestep tx.fhir.org's duplicate CORS headers, which Chromium
      // rejects with "Failed to fetch" even though the HTTP request returns
      // 200 (ADR-0062 amendment 2026-05-23).
      '/tx-fhir': {
        target: 'https://tx.fhir.org',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/tx-fhir/, '/r4'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
