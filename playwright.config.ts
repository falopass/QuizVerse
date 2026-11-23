import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4510';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {
    baseURL,
    browserName: 'firefox',
  },
  webServer: {
    command: 'npm start -- --hostname 127.0.0.1 --port 4510',
    url: `${baseURL}/favicon.ico`,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4511',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: 'e2e-public-placeholder',
    },
  },
});
