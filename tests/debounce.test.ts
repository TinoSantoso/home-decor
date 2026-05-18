import { describe, expect, it, vi } from 'vitest';
import { debounce } from '../src/lib/debounce';

describe('debounce', () => {
  it('calls the function once after the trailing delay', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 50);

    d('a');
    d('b');
    d('c');
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
    vi.useRealTimers();
  });

  it('cancel() drops the pending call', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d('a');
    d.cancel();
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('flush() invokes immediately with the latest args', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d('a');
    d('b');
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
    vi.useRealTimers();
  });
});
