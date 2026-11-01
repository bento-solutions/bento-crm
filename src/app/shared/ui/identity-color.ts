/**
 * Identity colours: a stable hue per person/team, for avatars and calendar markers.
 * These are *data* colours (each one meets 4.5:1 against white text), so they are the one place
 * hex values are allowed outside styles.css. Everything else must use semantic tokens.
 */
export const IDENTITY_PALETTE = [
  '#3B4BA8', '#2F6B4F', '#93591C', '#A2423B', '#5E4A99',
  '#97436B', '#2C6B6B', '#9C5228', '#2F5A9E', '#56662A',
] as const;

export function identityColor(seed: string): string {
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return IDENTITY_PALETTE[hash % IDENTITY_PALETTE.length];
}

/** Default accent of generated invoice PDFs; mirrors the backend's fallback. */
export const DEFAULT_INVOICE_ACCENT = '#1F2937';
