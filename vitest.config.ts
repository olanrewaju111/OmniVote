import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'web-vitals': path.resolve(__dirname, './src/__mocks__/web-vitals.ts')
    }
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/hooks/**', 'src/components/dashboard/empty-state.tsx', 'src/components/dashboard/confirm-dialog.tsx', 'src/components/dashboard/notification-center.tsx'],
      exclude: ['**/__tests__/**', '**/*.test.*', '**/*.config.*']
    },
    projects: [{
      extends: true,
      test: {
        include: ['src/**/*.test.{ts,tsx}'],
        exclude: ['src/**/*.stories.{ts,tsx}', 'src/stories/**'],
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        globals: true
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});