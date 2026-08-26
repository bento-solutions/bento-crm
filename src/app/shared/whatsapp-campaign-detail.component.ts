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
      <div class="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-xs flex justify-end">
        <div class="bg-white w-full max-w-3xl h-full shadow-xl flex flex-col animate-in slide-in-from-right duration-200">

          <div class="flex justify-between items-center p-6 pb-4 border-b border-zinc-100">
            <div>
              <h3 class="text-lg font-bold text-zinc-950">{{ campaignTitle() }}</h3>
              <p class="text-xs text-zinc-500 mt-0.5">Live delivery and reply status</p>
            </div>
            <button (click)="close.emit()" title="Close" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
            </button>
          </div>

          @if (wa.stats(); as s) {
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-px bg-zinc-100 border-b border-zinc-100">
              <div class="bg-white p-3 text-center">
                <div class="text-lg font-semibold text-zinc-900">{{ s.total }}</div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total</div>
              </div>
              <div class="bg-white p-3 text-center">
                <div class="text-lg font-semibold text-sky-700">{{ s.sent + s.delivered + s.read }}</div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sent</div>
              </div>
              <div class="bg-white p-3 text-center">
                <div class="text-lg font-semibold text-emerald-700">{{ s.replied }}</div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Replied</div>
              </div>
              <div class="bg-white p-3 text-center">
                <div class="text-lg font-semibold text-red-700">{{ s.failed }}</div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Failed</div>
              </div>
              <div class="bg-white p-3 text-center">
                <div class="text-lg font-semibold text-amber-700">{{ s.followupsPending }}</div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Relances due</div>
              </div>
              <div class="bg-white p-3 text-center">
                <div class="text-lg font-semibold text-zinc-900">{{ s.replyRate }}%</div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Reply rate</div>
              </div>
            </div>
          }

          <div class="flex items-center justify-between px-6 py-3 border-b border-zinc-100">
            <span class="text-xs text-zinc-500">
              @if (wa.isLoadingRecipients()) { Refreshing… } @else { Auto-refreshing every 5s }
            </span>
            @if ((wa.stats()?.followupsPending ?? 0) > 0) {
              <button (click)="cancelFollowups()"
                      class="text-xs px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg font-medium transition-colors">
                Cancel all pending relances
              </button>
            }
          </div>

          <div class="flex-1 overflow-y-auto">
            <table class="min-w-full divide-y divide-zinc-100">
              <thead class="bg-zinc-50 sticky top-0">
                <tr>
                  <th class="px-6 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Contact</th>
                  <th class="px-6 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Relance</th>
                  @if (wa.isMock()) {
                    <th class="px-6 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Test</th>
                  }
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-zinc-100">
                @for (r of wa.recipients(); track r.id) {
                  <tr class="hover:bg-zinc-50 transition-colors">
                    <td class="px-6 py-3">
                      <div class="text-sm font-medium text-zinc-900">{{ r.partnerName }}</div>
                      <div class="text-xs text-zinc-500 font-mono">{{ r.phone || '—' }}</div>
                    </td>
                    <td class="px-6 py-3">
                      <span [class]="statusClass(r.status)" class="px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap">
                        {{ statusLabel(r.status) }}
                      </span>
                      @if (r.errorTitle) {
                        <div class="text-[11px] text-red-600 mt-1 max-w-xs">{{ r.errorCode }}: {{ r.errorTitle }}</div>
                      }
                    </td>
                    <td class="px-6 py-3 text-xs text-zinc-600">
                      @if (r.followupDueAt) {
                        <span class="text-amber-700">Due {{ r.followupDueAt | date:'d MMM, HH:mm' }}</span>
                      } @else if (r.followupCount > 0) {
                        <span class="text-zinc-500">Sent {{ r.lastFollowupAt | date:'d MMM, HH:mm' }}</span>
                      } @else if (r.status === 'REPLIED') {
                        <span class="text-emerald-700">Not needed — replied</span>
                      } @else {
                        <span class="text-zinc-400">—</span>
                      }
                    </td>
                    @if (wa.isMock()) {
                      <td class="px-6 py-3">
                        @if (r.phone && r.status !== 'REPLIED' && r.status !== 'FAILED') {
                          <button (click)="simulateReply(r)"
                                  class="text-xs px-2.5 py-1 border border-zinc-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 text-zinc-600 rounded-lg transition-colors whitespace-nowrap">
                            Simulate reply
                          </button>
                        }
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="wa.isMock() ? 4 : 3" class="px-6 py-10 text-center text-sm text-zinc-500">
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
  close = output<void>();

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
      case 'REPLIED': return 'bg-emerald-50 text-emerald-700';
      case 'READ': return 'bg-sky-50 text-sky-700';
      case 'DELIVERED': return 'bg-sky-50 text-sky-600';
      case 'SENT': return 'bg-zinc-100 text-zinc-700';
      case 'FAILED': return 'bg-red-50 text-red-700';
      case 'OPTED_OUT': return 'bg-orange-50 text-orange-700';
      case 'SKIPPED': return 'bg-amber-50 text-amber-700';
      default: return 'bg-zinc-100 text-zinc-600';
    }
  }
}
