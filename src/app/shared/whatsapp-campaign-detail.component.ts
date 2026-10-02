import { Component, DestroyRef, effect, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WhatsAppCampaignsService, CampaignRecipient } from '../services/domains/whatsapp-campaigns.service';

/**
 * Live per-recipient view of a WhatsApp campaign.
 *
 * <p>Dispatch and relances happen server-side, so this polls while the drawer is
 * open rather than assuming the state it loaded once is still current.
 */
@Component({
  selector: 'app-whatsapp-campaign-detail',
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    @if (campaignId()) {
      <div class="fixed inset-0 z-40 bg-scrim flex justify-end">
        <div class="bg-surface w-full max-w-3xl h-full shadow-xl flex flex-col duration-200">

          <div class="flex justify-between items-center p-6 pb-4 border-b border-line-soft">
            <div>
              <h3 class="modal-title">{{ campaignTitle() }}</h3>
              <p class="text-xs text-ink-3 mt-0.5">Live delivery and reply status</p>
            </div>
            <button (click)="closed.emit()" title="Close" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>

          @if (wa.stats(); as s) {
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-px bg-muted border-b border-line-soft">
              <div class="bg-surface p-3 text-center">
                <div class="text-lg font-semibold text-ink">{{ s.total }}</div>
                <div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Total</div>
              </div>
              <div class="bg-surface p-3 text-center">
                <div class="text-lg font-semibold text-info-ink">{{ s.sent + s.delivered + s.read }}</div>
                <div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Sent</div>
              </div>
              <div class="bg-surface p-3 text-center">
                <div class="text-lg font-semibold text-success-ink">{{ s.replied }}</div>
                <div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Replied</div>
              </div>
              <div class="bg-surface p-3 text-center">
                <div class="text-lg font-semibold text-danger-ink">{{ s.failed }}</div>
                <div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Failed</div>
              </div>
              <div class="bg-surface p-3 text-center">
                <div class="text-lg font-semibold text-warning-ink">{{ s.followupsPending }}</div>
                <div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Relances due</div>
              </div>
              <div class="bg-surface p-3 text-center">
                <div class="text-lg font-semibold text-ink">{{ s.replyRate }}%</div>
                <div class="text-meta font-semibold uppercase tracking-wider text-ink-3">Reply rate</div>
              </div>
            </div>
          }

          <div class="flex items-center justify-between px-6 py-3 border-b border-line-soft">
            <span class="text-xs text-ink-3">
              @if (wa.isLoadingRecipients()) { Refreshing… } @else { Auto-refreshing every 5s }
            </span>
            @if ((wa.stats()?.followupsPending ?? 0) > 0) {
              <button (click)="cancelFollowups()"
                      class="btn-secondary btn-sm">
                Cancel all pending relances
              </button>
            }
          </div>

          <div class="flex-1 overflow-y-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Relance</th>
                  @if (wa.isMock()) {
                    <th>Test</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (r of wa.recipients(); track r.id) {
                  <tr>
                    <td>
                      <div class="text-sm font-medium text-ink">{{ r.partnerName }}</div>
                      <div class="text-xs text-ink-3 font-mono">{{ r.phone || '—' }}</div>
                    </td>
                    <td>
                      <span [class]="statusClass(r.status)" class="badge">
                        {{ statusLabel(r.status) }}
                      </span>
                      @if (r.errorTitle) {
                        <div class="text-meta text-danger-ink mt-1 max-w-xs">{{ r.errorCode }}: {{ r.errorTitle }}</div>
                      }
                    </td>
                    <td class="text-ink-2">
                      @if (r.followupDueAt) {
                        <span class="text-warning-ink">Due {{ r.followupDueAt | date:'d MMM, HH:mm' }}</span>
                      } @else if (r.followupCount > 0) {
                        <span class="text-ink-3">Sent {{ r.lastFollowupAt | date:'d MMM, HH:mm' }}</span>
                      } @else if (r.status === 'REPLIED') {
                        <span class="text-success-ink">Not needed — replied</span>
                      } @else {
                        <span class="text-ink-3">—</span>
                      }
                    </td>
                    @if (wa.isMock()) {
                      <td>
                        @if (r.phone && r.status !== 'REPLIED' && r.status !== 'FAILED') {
                          <button (click)="simulateReply(r)"
                                  class="btn-secondary btn-sm">
                            Simulate reply
                          </button>
                        }
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="wa.isMock() ? 4 : 3" class="text-center text-ink-3">
                      No recipients yet.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    }
  `,
})
export class WhatsAppCampaignDetailComponent {
  campaignId = input<string | null>(null);
  campaignTitle = input<string>('Campaign');
  closed = output<void>();

  wa = inject(WhatsAppCampaignsService);
  private destroyRef = inject(DestroyRef);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const id = this.campaignId();
      this.stopPolling();
      if (!id) return;

      this.refresh(id);
      // The backend dispatches asynchronously and relances fire on their own
      // schedule, so a single load would show a snapshot that is already stale.
      this.timer = setInterval(() => this.refresh(id), 5000);
    });

    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  private refresh(id: string): void {
    this.wa.loadRecipients(id);
    this.wa.loadStats(id);
  }

  private stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  cancelFollowups(): void {
    const id = this.campaignId();
    if (id) this.wa.cancelFollowups(id, () => this.refresh(id));
  }

  simulateReply(r: CampaignRecipient): void {
    const id = this.campaignId();
    if (!r.phone || !id) return;
    this.wa.simulateReply(r.phone, 'Oui, ça m\'intéresse', () => this.refresh(id));
  }

  statusLabel(status: string): string {
    return status === 'OPTED_OUT' ? 'Opted out' : status.charAt(0) + status.slice(1).toLowerCase();
  }

  statusClass(status: string): string {
    switch (status) {
      case 'REPLIED': return 'badge-success';
      case 'READ': return 'badge-info';
      case 'DELIVERED': return 'badge-info';
      case 'SENT': return 'bg-muted text-ink-2';
      case 'FAILED': return 'badge-danger';
      case 'OPTED_OUT': return 'badge-warning';
      case 'SKIPPED': return 'badge-warning';
      default: return 'bg-muted text-ink-2';
    }
  }
}
