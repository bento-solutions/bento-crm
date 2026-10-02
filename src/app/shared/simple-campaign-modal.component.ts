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
      <div class="modal-backdrop">
        <div class="modal modal-lg modal-flush">
          <div class="flex justify-between items-center p-6 pb-4 border-b border-line-soft">
            <h3 class="modal-title">{{ campaign() ? 'Edit' : 'New' }} {{ channel() }} Campaign</h3>
            <button (click)="onClose()" title="Close" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>

          <div class="p-6 space-y-4">
            @if (!campaign()) {
              <div class="p-3 rounded-xl bg-warning-soft border border-warning-line flex items-start gap-2.5">
                <mat-icon class="text-warning-ink shrink-0 icon-md">info</mat-icon>
                <p class="text-xs text-warning-ink">Saved as a draft — {{ channel() }} sending isn't wired up yet.</p>
              </div>
            }

            <div>
              <label for="campaign_title" class="field-label mb-1.5">Campaign title</label>
              <input id="campaign_title" [(ngModel)]="title" type="text" placeholder="Q3 newsletter"
                     class="input-field w-full" />
            </div>

            <div>
              <label for="target_audience" class="field-label mb-1.5">Target audience</label>
              <input id="target_audience" [(ngModel)]="targetAudience" type="text" placeholder="All active customers"
                     class="input-field w-full" />
            </div>

            <div>
              <label for="status" class="field-label mb-1.5">Status</label>
              <select id="status" [(ngModel)]="status"
                      class="input-field w-full">
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2 px-6 py-4 border-t border-line-soft">
            <button (click)="onClose()" class="btn-secondary">
              Cancel
            </button>
            <button (click)="save()" [disabled]="!title.trim()"
                    class="btn-primary">
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
