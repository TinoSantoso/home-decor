// @vitest-environment happy-dom

/**
 * Sanity check for the component-test infrastructure (plan §17).
 *
 * Proves that:
 *   - happy-dom is loaded for files with the per-file environment pragma
 *   - `@testing-library/react` renders React 19 components
 *   - `@testing-library/jest-dom` matchers (toBeInTheDocument, toHaveTextContent)
 *     work via the vitest setup file
 *   - `@testing-library/user-event` dispatches synthetic events that React processes
 *
 * Uses inline components rather than importing Phase 1 UI so the sample
 * doesn't accidentally retrofit untested production components.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

describe('component test infrastructure', () => {
  it('renders a component and queries the DOM by role', () => {
    render(<button type="button">hello world</button>);
    expect(
      screen.getByRole('button', { name: /hello world/i }),
    ).toBeInTheDocument();
  });

  it('dispatches user events and asserts on resulting state', async () => {
    function Counter() {
      const [n, setN] = useState(0);
      return (
        <button type="button" onClick={() => setN((x) => x + 1)}>
          count: {n}
        </button>
      );
    }

    const user = userEvent.setup();
    render(<Counter />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('count: 0');

    await user.click(button);
    await user.click(button);
    expect(button).toHaveTextContent('count: 2');
  });
});
