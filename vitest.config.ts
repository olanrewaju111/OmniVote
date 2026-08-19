import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/hooks/**', 'src/components/dashboard/empty-state.tsx', 'src/components/dashboard/confirm-dialog.tsx', 'src/components/dashboard/notification-center.tsx'],
      exclude: ['**/__tests__/**', '**/*.test.*', '**/*.config.*'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'web-vitals': path.resolve(__dirname, './src/__mocks__/web-vitals.ts'),
    },
  },
});
