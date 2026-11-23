import { Component, OnInit, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslationService } from '../services/translation.service';
import { DimensionValues } from '../services/domains/dimensions';
import { DimensionsStore } from '../services/domains/dimensions.store';

/**
 * The dimensions of a line as small chips: mission and deal, and with `all` also customer and vendor.
 * Renders nothing when the line has none.
 */
@Component({
  selector: 'app-dimension-chips',
  imports: [MatIconModule],
  template: `
    @for (c of chips(); track c.key) {
      <span class="chip inline-flex items-center gap-1 max-w-48" [attr.title]="c.title">
        <mat-icon class="icon-xs shrink-0">{{ c.icon }}</mat-icon><span class="truncate">{{ c.label }}</span>
      </span>
    }
  `,
  styles: [`:host { display: inline-flex; flex-wrap: wrap; gap: 0.25rem; vertical-align: middle; }`],
})
export class DimensionChipsComponent implements OnInit {
  private store = inject(DimensionsStore);
  private i18n = inject(TranslationService);

  value = input<Partial<DimensionValues> | null | undefined>(null);
  all = input(false);

  chips = computed(() => {
    const d = this.value();
    if (!d) return [];
    const out: { key: string; icon: string; label: string; title: string }[] = [];
    const add = (key: string, icon: string, label: string | null, i18nKey: string) => {
      if (label) out.push({ key, icon, label, title: `${this.i18n.t(i18nKey)}: ${label}` });
    };
    add('m', 'work_outline', this.store.missionLabel(d), 'dimensions.mission');
    add('d', 'handshake', this.store.dealLabel(d), 'dimensions.deal');
    if (this.all()) {
      add('c', 'person_outline', this.store.customerLabel(d), 'dimensions.customer');
      add('v', 'storefront', this.store.vendorLabel(d), 'dimensions.vendor');
    }
    return out;
  });

  ngOnInit(): void {
    this.store.ensure();
  }
}
