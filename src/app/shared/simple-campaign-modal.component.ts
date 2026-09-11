import { Component, effect, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CampaignsService, Campaign } from '../services/domains';

/**
 * Lightweight create/edit form for Email and SMS campaigns. There is no SMTP or
 * SMS-provider integration on the backend (only WhatsApp has a real send path via
 * `WhatsAppCampaignModalComponent`), so this only creates/updates a Draft campaign
 * record — it does not send anything.
 */
@Component({
  selector: 'app-simple-campaign-modal',
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-zinc-100 animate-in zoom-in-95 duration-200">
          <div class="flex justify-between items-center p-6 pb-4 border-b border-zinc-100">
            <h3 class="text-lg font-bold text-zinc-950">{{ campaign() ? 'Edit' : 'New' }} {{ channel() }} Campaign</h3>
            <button (click)="onClose()" title="Close" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
            </button>
          </div>

          <div class="p-6 space-y-4">
            @if (!campaign()) {
              <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                <mat-icon class="text-amber-600 text-[18px] w-4.5 h-4.5 shrink-0">info</mat-icon>
                <p class="text-xs text-amber-800">Saved as a draft — {{ channel() }} sending isn't wired up yet.</p>
              </div>
            }

            <div>
              <label for="campaign_title" class="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Campaign title</label>
              <input id="campaign_title" [(ngModel)]="title" type="text" placeholder="Q3 newsletter"
                     class="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 transition-all placeholder:text-zinc-400" />
            </div>

            <div>
              <label for="target_audience" class="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Target audience</label>
              <input id="target_audience" [(ngModel)]="targetAudience" type="text" placeholder="All active customers"
                     class="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 transition-all placeholder:text-zinc-400" />
            </div>

            <div>
              <label for="status" class="block text-xs font-semibold text-zinc-500 uppercase mb-1.5">Status</label>
              <select id="status" [(ngModel)]="status"
                      class="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 transition-all">
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2 px-6 py-4 border-t border-zinc-100">
            <button (click)="onClose()" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">
              Cancel
            </button>
            <button (click)="save()" [disabled]="!title.trim()"
                    class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">
              {{ campaign() ? 'Save Changes' : 'Create Draft' }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SimpleCampaignModalComponent {
  private campaignsService = inject(CampaignsService);

  open = input<boolean>(false);
  channel = input<'Email' | 'SMS'>('Email');
  campaign = input<Campaign | null>(null);
  closeEmitted = output<void>();
  saved = output<void>();

  title = '';
  targetAudience = '';
  status: Campaign['status'] = 'Draft';

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const c = this.campaign();
      this.title = c?.title ?? '';
      this.targetAudience = c?.targetAudience ?? '';
      this.status = c?.status ?? 'Draft';
    });
  }

  onClose(): void {
    this.closeEmitted.emit();
  }

  save(): void {
    if (!this.title.trim()) return;
    const existing = this.campaign();
    if (existing) {
      // patchCampaign merges onto the stored campaign — the backend's PATCH re-validates the
      // whole record (channel is @NotNull), and this form never collects a channel to send.
      this.campaignsService.patchCampaign(existing.id, {
        title: this.title.trim(),
        targetAudience: this.targetAudience.trim(),
        status: this.status
      });
    } else {
      this.campaignsService.addCampaign({
        title: this.title.trim(),
        type: this.channel(),
        status: this.status,
        targetAudience: this.targetAudience.trim(),
        sentCount: 0
      });
    }
    this.saved.emit();
    this.closeEmitted.emit();
  }
}
