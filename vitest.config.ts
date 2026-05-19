import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./tests/setup.ts'],
    // `globals: true` exposes vitest's afterEach as a global so
    // @testing-library/react can register its auto-cleanup (unmount between
    // tests). Without this, rendered components leak across test cases.
    globals: true,
    // Default environment is `node` to keep pure-logic tests fast.
    // Component tests opt in to happy-dom via a `@vitest-environment happy-dom`
    // pragma at the top of each .test.tsx file. See plan §17.
  },
});
