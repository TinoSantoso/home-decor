/**
 * Vitest setup file (referenced from vitest.config.ts).
 * Installs `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument`,
 * `toHaveTextContent`) on vitest's `expect`. Loaded for all test files
 * regardless of environment; harmless for pure-logic tests.
 */
import '@testing-library/jest-dom/vitest';
