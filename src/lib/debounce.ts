export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number,
): {
  (...args: TArgs): void;
  cancel: () => void;
  flush: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  const debounced = (...args: TArgs) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
    }, ms);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      if (lastArgs) fn(...lastArgs);
    }
  };

  return debounced;
}
