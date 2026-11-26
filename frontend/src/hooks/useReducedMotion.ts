import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
};

/** True when the visitor asked the OS for less motion. Camera flights become cuts. */
export const useReducedMotion = () => useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
