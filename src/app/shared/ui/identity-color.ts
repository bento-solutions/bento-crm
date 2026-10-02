/**
 * Identity colours: a stable hue per person/team, for avatars and calendar markers.
 * These are *data* colours (each one meets 4.5:1 against white text), so they are the one place
 * hex values are allowed outside styles.css. Everything else must use semantic tokens.
 */
export const IDENTITY_PALETTE = [
  '#4F46E5', '#047857', '#B45309', '#B91C1C', '#6D28D9',
  '#BE185D', '#0F766E', '#C2410C', '#1D4ED8', '#4D7C0F',
] as const;

export function identityColor(seed: string): string {
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return IDENTITY_PALETTE[hash % IDENTITY_PALETTE.length];
}
