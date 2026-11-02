import { Component, OnInit, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';

/**
 * The optional accounting fields of a partner form: its customer and/or supplier posting group and
 * its business group. Empty means the default group. Only for users who can read the ledger.
 */
@Component({
  selector: 'app-ledger-partner-groups',
  imports: [FormsModule, TranslatePipe],
  template: `
    @if (store.enabled()) {
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <p class="eyebrow sm:col-span-2">{{ 'ledger.groups.title' | translate }}</p>
        @if (side() !== 'SUPPLIER') {
          <label class="block"><span class="field-label">{{ 'ledger.groups.customer' | translate }}</span>
            <select class="input-field w-full" [ngModelOptions]="{ standalone: true }" [disabled]="disabled()" [ngModel]="customerGroupId() ?? null" (ngModelChange)="customerGroupId.set($event)">
              <option [ngValue]="null">{{ store.defaultLabel(store.customerGroups()) }}</option>
              @for (g of store.customerGroups(); track g.id) { <option [ngValue]="g.id">{{ g.code }} · {{ g.name }}</option> }
            </select></label>
        }
        @if (side() !== 'CUSTOMER') {
          <label class="block"><span class="field-label">{{ 'ledger.groups.supplier' | translate }}</span>
            <select class="input-field w-full" [ngModelOptions]="{ standalone: true }" [disabled]="disabled()" [ngModel]="supplierGroupId() ?? null" (ngModelChange)="supplierGroupId.set($event)">
              <option [ngValue]="null">{{ store.defaultLabel(store.supplierGroups()) }}</option>
              @for (g of store.supplierGroups(); track g.id) { <option [ngValue]="g.id">{{ g.code }} · {{ g.name }}</option> }
            </select></label>
        }
        <label class="block"><span class="field-label">{{ 'ledger.groups.business' | translate }}</span>
          <select class="input-field w-full" [ngModelOptions]="{ standalone: true }" [disabled]="disabled()" [ngModel]="businessGroupId() ?? null" (ngModelChange)="businessGroupId.set($event)">
            <option [ngValue]="null">{{ store.defaultLabel(store.businessGroups()) }}</option>
            @for (g of store.businessGroups(); track g.id) { <option [ngValue]="g.id">{{ g.code }} · {{ g.name }}</option> }
          </select></label>
        <p class="text-xs text-ink-3 sm:col-span-2">{{ 'ledger.groups.hint' | translate }}</p>
      </div>
    }
  `,
})
export class LedgerPartnerGroupsComponent implements OnInit {
  store = inject(LedgerGroupsStore);

  /** Which partner group(s) to offer: a customer, a supplier, or both. */
  side = input<'CUSTOMER' | 'SUPPLIER' | 'BOTH'>('BOTH');
  disabled = input(false);
  customerGroupId = model<string | null | undefined>(null);
  supplierGroupId = model<string | null | undefined>(null);
  businessGroupId = model<string | null | undefined>(null);

  ngOnInit(): void {
    this.store.ensure();
  }
}
