import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { Partner, CustomerCard } from '../crm-state.service';

export type { Partner };

// Backend Partner.type/source are Java enums matched by exact name (see api.service.ts's
// Proposal translation for the general pattern); this service posts/patches Partner objects
// directly, so it needs its own copy of the same casing translation CrmStateService applies
// via partnerToApiPayload/partnerFromDto for its own partner-writing paths.
const PARTNER_TYPE_TO_BACKEND: Record<string, string> = {
  Lead: 'LEAD', Prospect: 'PROSPECT', Customer: 'CUSTOMER', Vendor: 'VENDOR'
};
const PARTNER_TYPE_FROM_BACKEND: Record<string, string> = {
  LEAD: 'Lead', PROSPECT: 'Prospect', CUSTOMER: 'Customer', VENDOR: 'Vendor'
};
const PARTNER_SOURCE_TO_BACKEND: Record<string, string> = {
  'Website form': 'WEBSITE', 'Trade show': 'TRADE_SHOW', 'LinkedIn': 'LINKEDIN',
  'Marketing campaign': 'CAMPAIGN', 'Referral': 'REFERRAL'
};
const PARTNER_SOURCE_FROM_BACKEND: Record<string, string> = {
  WEBSITE: 'Website form', TRADE_SHOW: 'Trade show', LINKEDIN: 'LinkedIn',
  CAMPAIGN: 'Marketing campaign', REFERRAL: 'Referral'
};

function toBackendPartner(partner: unknown): unknown {
  const payload = { ...(partner as Record<string, unknown>) };
  if (typeof payload['type'] === 'string') {
    payload['type'] = PARTNER_TYPE_TO_BACKEND[payload['type'] as string] ?? payload['type'];
  }
  if (typeof payload['source'] === 'string') {
    payload['source'] = PARTNER_SOURCE_TO_BACKEND[payload['source'] as string] ?? payload['source'];
  }
  return payload;
}

function fromBackendPartner(partner: Partner): Partner {
  const type = partner.type as unknown as string;
  const source = partner.source as unknown as string | undefined;
  return {
    ...partner,
    type: (PARTNER_TYPE_FROM_BACKEND[type] ?? type) as Partner['type'],
    source: source ? (PARTNER_SOURCE_FROM_BACKEND[source] ?? source) as Partner['source'] : partner.source
  };
}

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
          this.partners.set(partners.map(fromBackendPartner));
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
    this.api.createPartner(toBackendPartner(partner)).subscribe({
      next: (created) => {
        const partner = fromBackendPartner(created);
        this.partners.update(partners => [...partners, partner]);
        this.toast.show(`Partner <strong>${partner.name}</strong> created`);
      },
      error: () => this.toast.show('Failed to create partner', { type: 'error' })
    });
  }

  updatePartner(id: string, partner: Partial<Partner>): void {
    this.api.updatePartner(id, toBackendPartner(partner)).subscribe({
      next: (updated) => {
        const partner = fromBackendPartner(updated);
        this.partners.update(partners =>
          partners.map(p => p.id === id ? partner : p)
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
