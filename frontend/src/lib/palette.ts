// Brainbow: neuroscientists label neurons with distinct fluorescent proteins so each one glows in
// its own colour under the microscope. Each cluster gets one of these hues. The interface itself
// stays neutral: colour belongs to the data.
export const FLUORESCENT = [
  '#35d6f2', // cyan (CFP)
  '#8cf06e', // green (GFP)
  '#f5df4d', // yellow (YFP)
  '#ff6b6b', // red (mCherry)
  '#c77dff', // violet
  '#ff9f43', // orange (mOrange)
  '#5b8cff', // blue (BFP)
  '#ff73c6', // magenta
  '#3ce0b0', // teal
  '#c5f74f', // lime
  '#ffb59e', // salmon
  '#e6e9ef', // white, for whatever is left
] as const;

export const colorForIndex = (i: number): string => FLUORESCENT[i % FLUORESCENT.length] ?? '#e6e9ef';

/** Blends a #rrggbb colour toward black. WebGL materials ignore alpha in colour strings, so dimming is a mix. */
export function dim(hex: string, keep: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * keep).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** #rrggbb plus an alpha in [0, 1] to an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
