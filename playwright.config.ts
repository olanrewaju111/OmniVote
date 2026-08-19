import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for OmniVote election monitoring platform.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
    // Wait for a 200 response on the health endpoint
    healthcheck: {
      url: 'http://localhost:3000/api/health',
      retries: 30,
      interval: 3_000,
      timeout: 10_000,
    },
  },
});
