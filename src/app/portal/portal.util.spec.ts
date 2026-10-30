import { describe, it, expect } from 'vitest';
import { checklistProgress, contentTypeFromName, invoiceBadge, itemBadge, needsFile } from './portal.util';
import { pushPlatform, pushRoute } from '../core/services/native.service';

describe('portal helpers', () => {
  it('asks for a file only when an item is missing or was refused', () => {
    expect(needsFile({ status: 'MISSING' })).toBe(true);
    expect(needsFile({ status: 'REJECTED' })).toBe(true);
    expect(needsFile({ status: 'RECEIVED' })).toBe(false);
    expect(needsFile({ status: 'ACCEPTED' })).toBe(false);
  });

  it('colours item statuses', () => {
    expect(itemBadge('ACCEPTED')).toBe('badge-success');
    expect(itemBadge('REJECTED')).toBe('badge-danger');
    expect(itemBadge('RECEIVED')).toBe('badge-info');
    expect(itemBadge('MISSING')).toBe('badge-warning');
    expect(invoiceBadge('OVERDUE')).toBe('badge-danger');
    expect(invoiceBadge('SENT')).toBe('badge-warning');
  });

  it('measures progress by accepted items', () => {
    expect(checklistProgress({ accepted: 0, items: 0 })).toBe(0);
    expect(checklistProgress({ accepted: 1, items: 3 })).toBe(33);
    expect(checklistProgress({ accepted: 4, items: 4 })).toBe(100);
  });

  it('guesses a previewable content type from the file name', () => {
    expect(contentTypeFromName('Relevé.PDF')).toBe('application/pdf');
    expect(contentTypeFromName('photo.jpg')).toBe('image/jpeg');
    expect(contentTypeFromName('scan.png')).toBe('image/png');
    expect(contentTypeFromName('book.xlsx')).toBeNull();
    expect(contentTypeFromName(null)).toBeNull();
  });
});

describe('push notifications', () => {
  it('opens the page of the record a notification is about', () => {
    expect(pushRoute('DOCUMENT_REQUEST', 'a1')).toBe('/checklists?open=a1');
    expect(pushRoute('TAX_DEADLINE', 't1')).toBe('/tax-calendar');
    expect(pushRoute('INBOUND_DOCUMENT', 'd1')).toBe('/inbox-documents');
    expect(pushRoute('ticket', 'k1')).toBe('/tickets/k1');
    expect(pushRoute('SOMETHING_ELSE', 'x')).toBe('/');
    expect(pushRoute(undefined, undefined)).toBe('/');
  });

  it('registers only Android and iOS devices', () => {
    expect(pushPlatform('android')).toBe('android');
    expect(pushPlatform('ios')).toBe('ios');
    expect(pushPlatform('web')).toBeNull();
  });
});
