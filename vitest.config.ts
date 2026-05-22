import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['libs/**/*.spec.ts', 'libs/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@parchis/engine': path.resolve(__dirname, 'libs/engine/src'),
      '@parchis/shared': path.resolve(__dirname, 'libs/shared/src'),
      '@parchis/supabase': path.resolve(__dirname, 'libs/supabase/src'),
    },
  },
});
