import { Component, OnInit, computed, inject, input, model, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { LedgerPickerComponent } from '../pages/ledger/ledger-picker.component';
import { DimensionKey, Dimensions, DimensionValues } from '../services/domains/dimensions';
import { DimensionOption, DimensionsStore } from '../services/domains/dimensions.store';

/**
 * The "Dimensions" group of a form: Mission, Deal, Customer and Vendor, four optional searchable
 * pickers. Picking a mission fills the deal and the customer; picking a deal fills the customer.
 * `compact` folds the group behind a small toggle (one per supplier bill line).
 */
@Component({
  selector: 'app-dimension-fields',
  imports: [MatIconModule, TranslatePipe, LedgerPickerComponent],
  template: `
    @if (compact()) {
      <button type="button" class="btn-ghost btn-sm" [attr.aria-expanded]="open()" (click)="open.set(!open())">
        <mat-icon class="icon-sm">{{ open() ? 'expand_less' : 'expand_more' }}</mat-icon>{{ 'dimensions.title' | translate }}
        @if (count()) { <span class="badge badge-neutral">{{ count() }}</span> }
      </button>
    }
    @if (!compact() || open()) {
      <fieldset class="dimension-group" [disabled]="disabled()">
        @if (!compact()) {
          <legend class="field-label">{{ 'dimensions.title' | translate }}</legend>
          <p class="text-meta text-ink-3 mb-2">{{ 'dimensions.hint' | translate }}</p>
        }
        <div class="grid gap-3 sm:grid-cols-2" [class.lg:grid-cols-4]="compact()">
          @for (f of fields; track f.key) {
            <div class="block min-w-0"><span class="field-label">{{ f.label | translate }}</span>
              <app-ledger-picker [items]="options(f.key)" [value]="value()[f.key]" (valueChange)="set(f.key, $event)"
                                 [allowClear]="true" [clearLabel]="'dimensions.none' | translate"
                                 [placeholder]="(f.key === 'vendorId' && vendorPlaceholder() ? vendorPlaceholder() : ('dimensions.none' | translate))"
                                 [emptyLabel]="'dimensions.noMatch' | translate" [ariaLabel]="f.label | translate" [disabled]="disabled()" /></div>
          }
        </div>
      </fieldset>
    }
  `,
  styles: [`:host { display: block; min-width: 0; } .dimension-group { border: 0; padding: 0; margin: 0; min-width: 0; }`],
})
export class DimensionFieldsComponent implements OnInit {
  private store = inject(DimensionsStore);
  private i18n = inject(TranslationService);

  value = model<Dimensions>({ missionId: null, dealId: null, customerId: null, vendorId: null });
  /** Names the API sent with the values, for an id the loaded lists do not have. */
  names = input<Partial<DimensionValues> | null>(null);
  compact = input(false);
  disabled = input(false);
  /** The empty Vendor choice, e.g. "The bill's supplier". */
  vendorPlaceholder = input('');

  open = signal(false);
  count = computed(() => Object.values(this.value()).filter(v => !!v).length);

  readonly fields: { key: DimensionKey; label: string }[] = [
    { key: 'missionId', label: 'dimensions.mission' },
    { key: 'dealId', label: 'dimensions.deal' },
    { key: 'customerId', label: 'dimensions.customer' },
    { key: 'vendorId', label: 'dimensions.vendor' },
  ];

  private lists = computed<Record<DimensionKey, DimensionOption[]>>(() => ({
    missionId: this.store.missionOptions(),
    dealId: this.store.dealOptions(),
    customerId: this.store.customerOptions(),
    vendorId: this.store.vendorOptions(),
  }));

  ngOnInit(): void {
    this.store.ensure();
    if (this.compact() && this.count()) this.open.set(true);
  }

  /** The list, plus the current value when the list does not have it (a name the API sent). */
  options(key: DimensionKey): DimensionOption[] {
    const list = this.lists()[key];
    const id = this.value()[key];
    if (!id || list.some(o => o.id === id)) return list;
    const n = this.names();
    const name = key === 'missionId' ? n?.missionName : key === 'dealId' ? n?.dealName : key === 'customerId' ? n?.customerName : n?.vendorName;
    return [{ id, label: name || this.i18n.t('dimensions.' + key.replace('Id', '')) }, ...list];
  }

  set(key: DimensionKey, id: string | null): void {
    this.value.set(this.store.apply(this.value(), key, id));
  }
}
