import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { CrmStateService } from '../../services/crm-state.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PartnerSide, PartnerStatement } from '../../services/domains/statements.service';
import { PartnerStatementComponent } from './partner-statement.component';

/** /receivables/balances/:partnerId and /payables/balances/:partnerId: one partner's statement as a page. */
@Component({
  selector: 'app-partner-statement-page',
  imports: [TranslatePipe, PageHeaderComponent, PartnerStatementComponent],
  template: `
    <div class="page">
      <app-page-header [title]="title()" [subtitle]="subtitle()"
                       [backLink]="isCustomer() ? '/receivables/balances' : '/payables/balances'"
                       [backLabel]="(isCustomer() ? 'partnerBalances.customersTitle' : 'partnerBalances.suppliersTitle') | translate" />
      @if (partnerId(); as id) {
        <app-partner-statement [partnerId]="id" [type]="type" [initialFrom]="from()" [initialTo]="to()" (loaded)="onLoaded($event)" />
      }
    </div>
  `,
})
export class PartnerStatementPageComponent {
  private route = inject(ActivatedRoute);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);

  readonly type: PartnerSide = this.route.snapshot.data['type'] === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER';
  partnerId = toSignal(this.route.paramMap.pipe(map(p => p.get('partnerId'))), { initialValue: null });
  from = toSignal(this.route.queryParamMap.pipe(map(p => p.get('from'))), { initialValue: null });
  to = toSignal(this.route.queryParamMap.pipe(map(p => p.get('to'))), { initialValue: null });

  private partner = signal<PartnerStatement['partner'] | null>(null);
  isCustomer = computed(() => this.type === 'CUSTOMER');
  title = computed(() => this.partner()?.name || this.i18n.t('partnerStatement.title'));
  subtitle = computed(() => {
    const p = this.partner();
    const kind = this.i18n.t(this.isCustomer() ? 'partnerStatement.customerStatement' : 'partnerStatement.supplierStatement');
    return [kind, p?.ice ? `ICE ${p.ice}` : '', p?.address ?? ''].filter(Boolean).join(' · ');
  });

  onLoaded(s: PartnerStatement): void {
    this.partner.set(s.partner ?? null);
    if (s.partner?.name) this.state.breadcrumbLabel.set(s.partner.name);
  }
}
