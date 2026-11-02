import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // emit-title-overrides*.test.mjs are vitest suites; other .test.mjs files
    // are plain `node --test` files.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/emit-title-overrides*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
      ],
      // Medido el 2026-11-02 (v8): global 66.35 líneas / 80.58 ramas / 77.69 funciones;
      // lib/quiz 89.42, lib/seo 95.78, lib/data 92.29. Los umbrales quedan por debajo
      // con margen para que no bloqueen por ruido, pero impidan retrocesos grandes.
      thresholds: {
        lines: 60,
        branches: 75,
        functions: 70,
        statements: 60,
        'src/lib/quiz/**': { lines: 85, branches: 85, functions: 95, statements: 85 },
        'src/lib/seo/**': { lines: 90, branches: 88, functions: 90, statements: 90 },
        'src/lib/data/**': { lines: 88, branches: 80, functions: 85, statements: 88 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/server-only.ts'),
    },
  },
});
