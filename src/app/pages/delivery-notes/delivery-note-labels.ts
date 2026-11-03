import type { DeliveryNoteStatus } from '../../services/domains/delivery-notes.service';

export function deliveryNoteBadge(s: DeliveryNoteStatus | string | null | undefined): string {
  switch (s) {
    case 'DELIVERED': return 'badge-info';
    case 'INVOICED': return 'badge-success';
    case 'CANCELLED': return 'badge-neutral';
    default: return 'badge-warning';
  }
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Saves a blob under a file name. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
