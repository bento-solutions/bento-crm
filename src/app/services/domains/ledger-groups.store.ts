import { Injectable, computed, inject, signal } from '@angular/core';
import { CrmStateService } from '../crm-state.service';
import { TranslationService } from '../translation.service';
import { CostCenter, LedgerApi, PartnerGroup, PostingGroup, PostingSetup } from './ledger.service';

/**
 * The posting groups and cost centers that business forms (partner, product, invoice line,
 * expense) offer as optional fields. Loaded once, on first use, for users who can read the
 * ledger; a failed load leaves the lists empty and the forms still work (null = default group).
 */
@Injectable({ providedIn: 'root' })
export class LedgerGroupsStore {
  private api = inject(LedgerApi);
  private state = inject(CrmStateService);
  private i18n = inject(TranslationService);

  readonly setup = signal<PostingSetup | null>(null);
  readonly costCenters = signal<CostCenter[]>([]);

  readonly customerGroups = computed<PartnerGroup[]>(() => (this.setup()?.partnerGroups ?? []).filter(g => g.side === 'CUSTOMER'));
  readonly supplierGroups = computed<PartnerGroup[]>(() => (this.setup()?.partnerGroups ?? []).filter(g => g.side === 'SUPPLIER'));
  readonly businessGroups = computed<PostingGroup[]>(() => this.setup()?.businessGroups ?? []);
  readonly productGroups = computed<PostingGroup[]>(() => this.setup()?.productGroups ?? []);

  private setupLoaded = false;
  private centersLoaded = false;

  /** The user can see ledger fields on business forms. */
  enabled(): boolean {
    return this.state.hasAuthority('LEDGER_READ');
  }

  /** Loads the groups (and cost centers when asked) the first time a form needs them. */
  ensure(withCostCenters = false): void {
    if (!this.enabled()) return;
    if (!this.setupLoaded) {
      this.setupLoaded = true;
      this.api.postingSetup().subscribe({
        next: s => this.setup.set(s ?? null),
        error: () => { this.setupLoaded = false; /* phase 2 not on the server yet: no group to offer */ },
      });
    }
    if (withCostCenters && !this.centersLoaded) {
      this.centersLoaded = true;
      this.api.costCenters().subscribe({
        next: c => this.costCenters.set(c ?? []),
        error: () => { this.centersLoaded = false; },
      });
    }
  }

  /** The empty choice of a group select: "Default (Services)". */
  defaultLabel(groups: { name: string; isDefault: boolean }[]): string {
    const d = groups.find(g => g.isDefault);
    const label = this.i18n.t('ledger.groups.default');
    return d ? `${label} (${d.name})` : label;
  }

  /** The setup page saved a change: forms opened later see it. */
  replace(s: PostingSetup | null): void {
    this.setup.set(s);
    this.setupLoaded = !!s;
  }
}
