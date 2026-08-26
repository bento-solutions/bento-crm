import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';

export type RecipientStatus =
  | 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'REPLIED'
  | 'FAILED' | 'SKIPPED' | 'OPTED_OUT';

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  partnerId: string;
  partnerName: string;
  conversationId?: string;
  phone?: string;
  status: RecipientStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  repliedAt?: string;
  failedAt?: string;
  errorCode?: string;
  errorTitle?: string;
  followupCount: number;
  lastFollowupAt?: string;
  /** When the queued relance is due; absent when none is pending. */
  followupDueAt?: string;
}

export interface CampaignStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  skipped: number;
  optedOut: number;
  followupsPending: number;
  followupsSent: number;
  replyRate: number;
}

export interface WhatsAppAccount {
  id: string;
  provider: 'MOCK' | 'META';
  phoneNumberId: string;
  displayPhoneNumber?: string;
  status: string;
  qualityRating?: string;
  hasAccessToken: boolean;
}

export interface WhatsAppCampaignDraft {
  title: string;
  templateName: string;
  templateLang?: string;
  templateParams?: string[];
  bodyPreview?: string;
  partnerIds: string[];
  followupEnabled: boolean;
  followupDelayDays?: number;
  followupTemplateName?: string;
  /** Test override: schedules the relance in minutes rather than days. */
  followupDelayMinutes?: number;
  launchNow?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WhatsAppCampaignsService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  account = signal<WhatsAppAccount | null>(null);
  recipients = signal<CampaignRecipient[]>([]);
  stats = signal<CampaignStats | null>(null);
  isSending = signal<boolean>(false);
  isLoadingRecipients = signal<boolean>(false);

  hasAccount = computed(() => this.account() !== null);
  isMock = computed(() => this.account()?.provider === 'MOCK');

  loadAccount(): void {
    this.api.getWhatsAppAccount().subscribe({
      next: (account) => this.account.set(account ?? null),
      error: () => this.account.set(null),
    });
  }

  connectMock(): void {
    this.api.connectMockWhatsAppAccount().subscribe({
      next: (account) => {
        this.account.set(account);
        this.toast.show('Simulated WhatsApp number connected — campaigns can be tested end to end');
      },
      error: () => this.toast.show('Failed to connect a simulated number', { type: 'error' }),
    });
  }

  /**
   * Creates and (optionally) launches a campaign. Dispatch continues server-side
   * after this returns, so the caller should poll for status rather than assume
   * everything has been sent.
   */
  create(draft: WhatsAppCampaignDraft, onDone?: (campaignId: string) => void): void {
    this.isSending.set(true);
    this.api.createWhatsAppCampaign(draft).subscribe({
      next: (campaign) => {
        this.isSending.set(false);
        this.toast.show(
          draft.launchNow
            ? `Campaign <strong>${campaign.title}</strong> is sending to ${draft.partnerIds.length} contact(s)`
            : `Campaign <strong>${campaign.title}</strong> saved as draft`
        );
        onDone?.(campaign.id);
      },
      error: (err) => {
        this.isSending.set(false);
        this.toast.show(this.readError(err, 'Failed to create the campaign'), { type: 'error' });
      },
    });
  }

  launch(campaignId: string, onDone?: () => void): void {
    this.api.launchCampaign(campaignId).subscribe({
      next: () => {
        this.toast.show('Campaign is sending');
        onDone?.();
      },
      error: (err) => this.toast.show(this.readError(err, 'Failed to launch the campaign'), { type: 'error' }),
    });
  }

  loadRecipients(campaignId: string): void {
    this.isLoadingRecipients.set(true);
    this.api.getCampaignRecipients(campaignId).subscribe({
      next: (rows) => {
        this.recipients.set(rows ?? []);
        this.isLoadingRecipients.set(false);
      },
      error: () => {
        this.recipients.set([]);
        this.isLoadingRecipients.set(false);
      },
    });
  }

  loadStats(campaignId: string): void {
    this.api.getCampaignStats(campaignId).subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => this.stats.set(null),
    });
  }

  cancelFollowups(campaignId: string, onDone?: () => void): void {
    this.api.cancelCampaignFollowups(campaignId).subscribe({
      next: (res) => {
        this.toast.show(`${res.cancelled} pending relance(s) cancelled`);
        onDone?.();
      },
      error: () => this.toast.show('Failed to cancel relances', { type: 'error' }),
    });
  }

  /** Mock-provider only: pretend a contact answered, to exercise the reply flow. */
  simulateReply(phone: string, text: string, onDone?: () => void): void {
    this.api.simulateWhatsAppReply(phone, text).subscribe({
      next: () => {
        this.toast.show(`Simulated reply from ${phone}`);
        onDone?.();
      },
      error: () => this.toast.show('Failed to simulate a reply', { type: 'error' }),
    });
  }

  /**
   * Surfaces the backend's own message where there is one. Launch failures are
   * almost always actionable ("no WhatsApp number connected", "no template
   * selected"), so replacing them with a generic string would hide the fix.
   */
  private readError(err: any, fallback: string): string {
    return err?.error?.message || err?.error?.error || fallback;
  }
}
