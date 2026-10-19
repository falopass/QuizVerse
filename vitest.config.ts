import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // emit-title-overrides-*.test.mjs are vitest suites; other .test.mjs files
    // (e.g. tests/emit-title-overrides.test.mjs) are plain `node --test` files.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/emit-title-overrides-*.test.mjs'],
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
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/server-only.ts'),
    },
  },
});
