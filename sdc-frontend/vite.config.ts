import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
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
      // SNOMED implicit-VS typeahead (comorbidity picker, ADR-0137) — mirrors
      // the unified frontend's identical proxy; HAPI cannot walk the SNOMED
      // hierarchy locally, so `isa/` implicit-VS expansion goes straight to
      // tx.fhir.org (ADR-0062).
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
