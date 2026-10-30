/** Small pure helpers shared by the drive, the documents inbox and the inbox settings. */

/** Human file size: 512 B, 1.4 KB, 2.3 MB. */
export function formatBytes(bytes: number | null | undefined): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function amount(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * True when an invoice's amounts do not add up: HT + TVA differs from TTC by more than a cent.
 * Missing amounts are not a mismatch (there is nothing to compare yet).
 */
export function totalsMismatch(subtotal: unknown, tax: unknown, total: unknown): boolean {
  const ht = amount(subtotal);
  const tva = amount(tax);
  const ttc = amount(total);
  if (ht === null || tva === null || ttc === null) return false;
  return Math.abs(Math.round((ht + tva) * 100) - Math.round(ttc * 100)) > 1;
}

/**
 * A trusted sender as typed by a person: a full address (billing@acme.ma) or a whole domain
 * (@acme.ma). Returns the normalised value, or null when it is neither.
 */
export function normaliseSender(raw: string): string | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (/^@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v)) return v;
  if (/^[^\s@]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v)) return v;
  return null;
}

/** A share link as the API returns it, made absolute for copying. */
export function absoluteUrl(url: string, origin: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return origin.replace(/\/$/, '') + (url.startsWith('/') ? url : `/${url}`);
}

/** Whether a file can be shown inline in the preview (PDF or an image). */
export function previewKind(contentType: string | null | undefined): 'pdf' | 'image' | null {
  const t = (contentType ?? '').toLowerCase();
  if (t === 'application/pdf') return 'pdf';
  if (t.startsWith('image/')) return 'image';
  return null;
}
