import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'] });

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Resets rate-limit counters and ingests the fixture lesson.
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  // Login rate limiting is per username (Section 9.2), so parallel workers
  // hitting the same account would lock each other out.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  /*
   * The suite runs against `next dev`, which compiles each route the first time
   * it is requested. The first navigation to a given page therefore costs
   * several seconds — long enough that the 5s default made the first login test
   * fail while the later ones passed, purely because the route was already
   * warm. The timeout is generous for that reason, not to paper over slowness.
   */
  expect: { timeout: 20_000 },
  timeout: 90_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    /*
     * Dev mode on purpose. The production build marks the session cookie
     * `Secure`, which a browser refuses to store over plain http://localhost,
     * so a production server here would fail every login for the wrong reason.
     */
    command: `pnpm dev --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
