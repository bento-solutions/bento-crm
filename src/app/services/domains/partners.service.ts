import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { Partner, CustomerCard } from '../crm-state.service';

export type { Partner };

@Injectable({
  providedIn: 'root'
})
export class PartnersService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  partners = signal<Partner[]>([]);
  isLoaded = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  allPartners = computed(() => this.partners());
  isLoading$ = computed(() => this.isLoading());
  error$ = computed(() => this.error());

  load(): void {
    if (this.isLoaded()) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getPartners().subscribe({
      next: (partners) => {
        if (partners && partners.length > 0) {
          this.partners.set(partners);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load partners from API:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        this.error.set('Failed to load partners from the server.');
      }
    });
  }

  addPartner(partner: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.api.createPartner(partner as unknown).subscribe({
      next: (created) => {
        this.partners.update(partners => [...partners, created]);
        this.toast.show(`Partner <strong>${created.name}</strong> created`);
      },
      error: () => this.toast.show('Failed to create partner', { type: 'error' })
    });
  }

  updatePartner(id: string, partner: Partial<Partner>): void {
    this.api.updatePartner(id, partner as unknown).subscribe({
      next: (updated) => {
        this.partners.update(partners =>
          partners.map(p => p.id === id ? updated : p)
        );
        this.toast.show(`Partner updated`);
      },
      error: () => this.toast.show('Failed to update partner', { type: 'error' })
    });
  }

  deletePartner(id: string): void {
    const deleted = this.partners().find(p => p.id === id);
    this.api.deletePartner(id).subscribe({
      next: () => {
        this.partners.update(partners => partners.filter(p => p.id !== id));
        this.toast.show(`Partner <strong>${deleted?.name || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.partners.update(partners => [...partners, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete partner', { type: 'error' })
    });
  }

  getPartnerById(id: string): Partner | undefined {
    return this.partners().find(p => p.id === id);
  }

  convertToCustomer(partnerId: string): void {
    const partner = this.getPartnerById(partnerId);
    if (partner) {
      this.updatePartner(partnerId, { ...partner, type: 'Customer' });
    }
  }

  generateAccountId(): string {
    return 'ACC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  saveCustomerCard(_card: Partial<CustomerCard>): void {
    // Stub method for saving customer card
  }

  customerCards(): CustomerCard[] {
    // Stub method for getting customer cards
    return [];
  }

  customers(): Partner[] {
    return this.partners().filter((p: Partner) => p.type === 'Customer');
  }

  vendors(): Partner[] {
    return this.partners().filter((p: Partner) => p.type === 'Vendor');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createPartnerAwaitingId(_partialPartner: unknown, _onCreated?: (id: string) => void): void {
    // Stub method for creating a partner awaiting ID assignment
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  convertLeadToProspect(_leadId: string): void {
    // Stub method for converting lead to prospect
  }
}
