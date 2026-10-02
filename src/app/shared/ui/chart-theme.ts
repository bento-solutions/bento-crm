/**
 * Chart.js reads colours at construction time, so the theme tokens are resolved from the live
 * document and charts are rebuilt on theme change. One palette, one font, one grid colour —
 * every chart in the app should be configured from here.
 */
export interface ChartTheme {
  text: string;
  textStrong: string;
  grid: string;
  surface: string;
  font: string;
  series: string[];
}

export function readChartTheme(): ChartTheme {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    text: v('--color-text-secondary'),
    textStrong: v('--color-text-primary'),
    grid: v('--color-border-light'),
    surface: v('--color-surface'),
    font: v('--font-sans') || 'Inter, system-ui, sans-serif',
    series: [1, 2, 3, 4, 5, 6].map(i => v(`--chart-${i}`)),
  };
}

/** `#RRGGBB` / `rgb()` → `rgba()` with the given alpha (for area fills). */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = color.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map(x => x.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/** Calls `cb` whenever the app theme changes (explicit toggle or OS scheme in "system" mode). Returns a stop function. */
export function onThemeChange(cb: () => void): () => void {
  const observer = new MutationObserver(() => cb());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', cb);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', cb);
  };
}
