import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { Proposal, ProposalLine } from '../crm-state.service';

export type { Proposal, ProposalLine };

@Injectable({
  providedIn: 'root'
})
export class ProposalsService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  proposals = signal<Proposal[]>([]);
  isLoaded = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  allProposals = computed(() => this.proposals());
  isLoading$ = computed(() => this.isLoading());
  error$ = computed(() => this.error());

  load(): void {
    if (this.isLoaded()) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getProposals().subscribe({
      next: (proposals) => {
        if (proposals && proposals.length > 0) {
          this.proposals.set(proposals);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load proposals from API:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        this.error.set('Failed to load proposals from the server.');
      }
    });
  }

  addProposal(proposal: Omit<Proposal, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.api.createProposal(proposal as unknown).subscribe({
      next: (created) => {
        this.proposals.update(proposals => [...proposals, created]);
        this.toast.show(`Proposal <strong>${created.title}</strong> created`);
      },
      error: () => this.toast.show('Failed to create proposal', { type: 'error' })
    });
  }

  updateProposal(id: string, proposal: Partial<Proposal>): void {
    this.api.updateProposal(id, proposal as unknown).subscribe({
      next: (updated) => {
        this.proposals.update(proposals =>
          proposals.map(p => p.id === id ? updated : p)
        );
        this.toast.show(`Proposal updated`);
      },
      error: () => this.toast.show('Failed to update proposal', { type: 'error' })
    });
  }

  deleteProposal(id: string): void {
    const deleted = this.proposals().find(p => p.id === id);
    this.api.deleteProposal(id).subscribe({
      next: () => {
        this.proposals.update(proposals => proposals.filter(p => p.id !== id));
        this.toast.show(`Proposal <strong>${deleted?.title || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.proposals.update(proposals => [...proposals, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete proposal', { type: 'error' })
    });
  }

  getProposalById(id: string): Proposal | undefined {
    return this.proposals().find(p => p.id === id);
  }

  updateStatus(id: string, status: string): void {
    const proposal = this.getProposalById(id);
    if (proposal) {
      this.updateProposal(id, { ...proposal, status: status as unknown });
    }
  }
}
