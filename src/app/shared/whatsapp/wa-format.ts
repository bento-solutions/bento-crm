import { WaConversation, WaMessage } from '../../services/domains/whatsapp-inbox.service';

/** The name to show for a conversation: linked partner, then WhatsApp profile name, then number. */
export function conversationTitle(c: Pick<WaConversation, 'partnerName' | 'displayName' | 'phone'>): string {
  return c.partnerName || c.displayName || formatPhone(c.phone);
}

export function initials(name: string): string {
  const letters = name.replace(/^\+/, '').trim().split(/\s+/).filter(Boolean);
  if (letters.length === 0) return '?';
  if (/^\d/.test(letters[0])) return '#';
  return (letters[0][0] + (letters.length > 1 ? letters[letters.length - 1][0] : '')).toUpperCase();
}

/** +212612345678 → +212 6 12 34 56 78; other countries are grouped loosely in threes. */
export function formatPhone(e164: string | undefined): string {
  if (!e164) return '';
  const digits = e164.replace(/\D/g, '');
  if (digits.startsWith('212') && digits.length === 12) {
    return `+212 ${digits[3]} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  return '+' + digits.replace(/(\d{3})(?=\d)/g, '$1 ');
}

/** Time for the list: HH:mm today, weekday this week, date otherwise. */
export function listTime(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString(locale, { weekday: 'short' });
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function bubbleTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** Messages still waiting on the outbox (shown with a clock). */
export function isPending(m: WaMessage): boolean {
  return m.status === 'QUEUED' || m.status === 'SENDING';
}
