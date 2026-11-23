import { Injectable, computed, inject, signal } from '@angular/core';
import { CrmStateService } from '../crm-state.service';
import { MissionApi, MissionSummary } from './mission.service';
import { DimensionKey, Dimensions, DimensionValues } from './dimensions';

/** An option of a dimension picker (same shape as the ledger picker's). */
export interface DimensionOption {
  id: string;
  code?: string | null;
  label: string;
  hint?: string | null;
}

/**
 * The missions, deals and partners the dimension pickers offer, loaded once on first use from the
 * existing missions, deals and partners APIs, and the auto-fill between them.
 */
@Injectable({ providedIn: 'root' })
export class DimensionsStore {
  private missionsApi = inject(MissionApi);
  private state = inject(CrmStateService);

  readonly missions = signal<MissionSummary[]>([]);
  private missionsLoaded = false;

  readonly missionOptions = computed<DimensionOption[]>(() =>
    this.missions()
      .map(m => ({ id: m.id, label: m.name, hint: m.partnerName ?? null }))
      .sort((a, b) => a.label.localeCompare(b.label)));

  readonly dealOptions = computed<DimensionOption[]>(() =>
    this.state.deals()
      .map(d => ({ id: d.id, code: d.dealNumber || null, label: d.title || d.dealNumber || d.id, hint: this.partnerName(d.partnerId) }))
      .sort((a, b) => a.label.localeCompare(b.label)));

  /** Every partner, customers (and prospects) first for the Customer picker, vendors first for the Vendor one. */
  readonly customerOptions = computed<DimensionOption[]>(() => this.partnerOptions(p => p.type !== 'Vendor'));
  readonly vendorOptions = computed<DimensionOption[]>(() => this.partnerOptions(p => p.type === 'Vendor'));

  /** Loads the lists the first time a form or filter needs them. */
  ensure(): void {
    this.state.loadPartners();
    this.state.loadDeals();
    if (!this.missionsLoaded) {
      this.missionsLoaded = true;
      this.missionsApi.list().subscribe({
        next: m => this.missions.set(m ?? []),
        error: () => { this.missionsLoaded = false; },
      });
    }
  }

  /**
   * Sets one dimension and fills the ones it implies: a mission fills its deal and customer,
   * a deal fills its customer.
   */
  apply(d: Dimensions, key: DimensionKey, id: string | null): Dimensions {
    const next: Dimensions = { ...d, [key]: id };
    if (!id) return next;
    if (key === 'missionId') {
      const m = this.missions().find(x => x.id === id);
      if (m?.dealId) next.dealId = m.dealId;
      if (m?.partnerId) next.customerId = m.partnerId;
    } else if (key === 'dealId') {
      const deal = this.state.deals().find(x => x.id === id);
      if (deal?.partnerId) next.customerId = deal.partnerId;
    }
    return next;
  }

  /** Display names, from the loaded lists or else from the names the API sent. */
  missionLabel(d: Partial<DimensionValues>): string | null {
    if (!d.missionId) return null;
    return this.missions().find(m => m.id === d.missionId)?.name ?? d.missionName ?? null;
  }

  dealLabel(d: Partial<DimensionValues>): string | null {
    if (!d.dealId) return null;
    const deal = this.state.deals().find(x => x.id === d.dealId);
    return deal ? (deal.dealNumber || deal.title) : (d.dealName ?? null);
  }

  customerLabel(d: Partial<DimensionValues>): string | null {
    if (!d.customerId) return null;
    return this.partnerName(d.customerId) ?? d.customerName ?? null;
  }

  vendorLabel(d: Partial<DimensionValues>): string | null {
    if (!d.vendorId) return null;
    return this.partnerName(d.vendorId) ?? d.vendorName ?? null;
  }

  private partnerName(id: string | null | undefined): string | null {
    if (!id) return null;
    return this.state.partners().find(p => p.id === id)?.name ?? null;
  }

  private partnerOptions(keep: (p: { type: string }) => boolean): DimensionOption[] {
    return this.state.partners()
      .map(p => ({ id: p.id, label: p.name, hint: String(p.type ?? ''), first: keep(p as { type: string }) }))
      .sort((a, b) => (a.first === b.first ? a.label.localeCompare(b.label) : a.first ? -1 : 1))
      .map(({ first, ...o }) => o);
  }
}
