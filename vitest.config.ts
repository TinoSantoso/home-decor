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
    // Vitest's default include matches `*.spec.ts` too; exclude the
    // Playwright dir so e2e specs aren't run by the unit runner.
    // `.worktrees/**` keeps subagent-driven dev branches (see CLAUDE.md
    // and .gitignore) invisible to the main checkout's test discovery —
    // without it, vitest picks up nested `tests-e2e/*.spec.ts` from
    // sibling worktrees and crashes on the duplicate Playwright import.
    // `.claude/worktrees/**` covers the native EnterWorktree path used by
    // the harness, which creates worktrees under that hidden subdirectory.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests-e2e/**',
      '.worktrees/**',
      '.claude/worktrees/**',
    ],
  },
});
