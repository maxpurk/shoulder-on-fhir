import { defineConfig } from 'vitest/config'

// Pure-function unit tests (calc engine + QR serialization). No DOM needed, so
// the default `node` environment is used and the React/proxy vite.config is not
// loaded. See ADR-0090: calc bugs are invisible to tsc/lint — these tests plus
// live click-through are the real safety net.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
