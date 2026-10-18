/** Pure helpers of the client portal and the checklist screens, kept apart so they can be unit-tested. */
import { ChecklistItem, ChecklistItemStatus, ChecklistSummary } from '../services/domains/checklist.service';

/** Files a client may send for a checklist item: PDFs and photos or scans. */
export const UPLOAD_ACCEPT = 'application/pdf,image/*';

/** A client (or staff on their behalf) sends a file for an item that is missing or was refused. */
export function needsFile(item: Pick<ChecklistItem, 'status'>): boolean {
  return item.status === 'MISSING' || item.status === 'REJECTED';
}

export function itemBadge(s: ChecklistItemStatus): string {
  switch (s) {
    case 'ACCEPTED': return 'badge-success';
    case 'RECEIVED': return 'badge-info';
    case 'REJECTED': return 'badge-danger';
    default: return 'badge-warning';
  }
}

/** Share of the checklist's items already accepted, 0–100. */
export function checklistProgress(c: Pick<ChecklistSummary, 'accepted' | 'items'>): number {
  if (!c.items) return 0;
  return Math.round((Math.min(c.accepted, c.items) / c.items) * 100);
}

export function invoiceBadge(status: string): string {
  switch (status) {
    case 'PAID': return 'badge-success';
    case 'OVERDUE': return 'badge-danger';
    case 'PARTIALLY_PAID': return 'badge-info';
    case 'CANCELLED': return 'badge-neutral';
    default: return 'badge-warning';
  }
}

/** The content type a stored file most likely has, from its name (for the inline preview). */
export function contentTypeFromName(name: string | null | undefined): string | null {
  const ext = (name ?? '').toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'application/pdf';
  if (['png', 'gif', 'webp', 'bmp'].includes(ext)) return `image/${ext}`;
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return null;
}
