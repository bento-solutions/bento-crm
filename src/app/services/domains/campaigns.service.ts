import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { Campaign } from '../crm-state.service';

export type { Campaign };

@Injectable({
  providedIn: 'root'
})
export class CampaignsService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  campaigns = signal<Campaign[]>([]);
  isLoaded = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  allCampaigns = computed(() => this.campaigns());
  isLoading$ = computed(() => this.isLoading());
  error$ = computed(() => this.error());

  load(): void {
    if (this.isLoaded()) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getCampaigns().subscribe({
      next: (campaigns) => {
        if (campaigns && campaigns.length > 0) {
          this.campaigns.set(campaigns);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load campaigns from API:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        this.error.set('Failed to load campaigns from the server.');
      }
    });
  }

  addCampaign(campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.api.createCampaign(campaign as unknown).subscribe({
      next: (created) => {
        this.campaigns.update(campaigns => [...campaigns, created]);
        this.toast.show(`Campaign <strong>${created.title}</strong> created`);
      },
      error: () => this.toast.show('Failed to create campaign', { type: 'error' })
    });
  }

  updateCampaign(id: string, campaign: Partial<Campaign>): void {
    this.api.updateCampaign(id, campaign as unknown).subscribe({
      next: (updated) => {
        this.campaigns.update(campaigns =>
          campaigns.map(c => c.id === id ? updated : c)
        );
        this.toast.show(`Campaign updated`);
      },
      error: () => this.toast.show('Failed to update campaign', { type: 'error' })
    });
  }

  deleteCampaign(id: string): void {
    const deleted = this.campaigns().find(c => c.id === id);
    this.api.deleteCampaign(id).subscribe({
      next: () => {
        this.campaigns.update(campaigns => campaigns.filter(c => c.id !== id));
        this.toast.show(`Campaign <strong>${deleted?.title || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.campaigns.update(campaigns => [...campaigns, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete campaign', { type: 'error' })
    });
  }

  getCampaignById(id: string): Campaign | undefined {
    return this.campaigns().find(c => c.id === id);
  }
}
