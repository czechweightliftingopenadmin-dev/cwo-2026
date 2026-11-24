import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { prodStartlist } from './scripts/prod-startlist'

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // npm run dev:prod — the start list from live production data, read-only.
    command === 'serve' &&
      mode === 'prod-data' &&
      prodStartlist(loadEnv(mode, process.cwd(), '').SUPABASE_DB_PASSWORD_PROD),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts', 'supabase/**/*.test.ts'],
    clearMocks: true,
  },
}))
