import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
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

  /**
   * The backend's PATCH /campaigns/{id} re-validates the whole campaign (title and channel are
   * both @NotNull on the shared create/update DTO), so a partial body such as `{ status }` alone
   * is rejected with 400. Callers that only mean to change one field (the edit modal, bulk
   * actions) go through here: the change is merged onto the stored campaign and the full record
   * is sent.
   */
  patchCampaign(id: string, changes: Partial<Campaign>): void {
    const current = this.getCampaignById(id);
    if (!current) return;
    this.updateCampaign(id, { ...current, ...changes });
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

  /**
   * Fetches one campaign by id and merges it into the store — for a deep link to a campaign's
   * detail page before (or instead of) the full list being loaded.
   */
  fetchCampaign(id: string): Observable<Campaign> {
    return this.api.getCampaign(id).pipe(
      tap(campaign => this.campaigns.update(list =>
        list.some(c => c.id === id) ? list.map(c => c.id === id ? campaign : c) : [...list, campaign]))
    );
  }
}
