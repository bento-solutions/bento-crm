import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { TransactionFilter } from '../services/domains/bank.service';
import { BankCashComponent } from './bank/bank-cash.component';
import { BankTransactionsComponent } from './bank/bank-transactions.component';
import { BankAccountsComponent } from './bank/bank-accounts.component';
import { BankRulesComponent } from './bank/bank-rules.component';

type Tab = 'cash' | 'transactions' | 'accounts' | 'rules';
const TABS: Tab[] = ['cash', 'transactions', 'accounts', 'rules'];

/**
 * Bank: cash position and forecast, statement lines and their reconciliation, the bank accounts
 * with their statement imports, and the categorization rules.
 */
@Component({
  selector: 'app-bank',
  imports: [MatIconModule, TranslatePipe, PageHeaderComponent, BankCashComponent, BankTransactionsComponent, BankAccountsComponent, BankRulesComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'bank.title' | translate" [subtitle]="'bank.subtitle' | translate" />

      <div class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button role="tab" class="tab" [class.is-active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="setTab(t.key)">
            <mat-icon>{{ t.icon }}</mat-icon>{{ t.label | translate }}
          </button>
        }
      </div>

      @switch (tab()) {
        @case ('cash') { <app-bank-cash (openLines)="openLines($event)" /> }
        @case ('transactions') { <app-bank-transactions [initialFilter]="txFilter()" /> }
        @case ('accounts') { <app-bank-accounts /> }
        @case ('rules') { <app-bank-rules /> }
      }
    </div>
  `,
})
export class BankComponent implements OnInit {
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'cash', label: 'bank.tab.cash', icon: 'savings' },
    { key: 'transactions', label: 'bank.tab.transactions', icon: 'receipt_long' },
    { key: 'accounts', label: 'bank.tab.accounts', icon: 'account_balance' },
    { key: 'rules', label: 'bank.tab.rules', icon: 'rule' },
  ];

  tab = signal<Tab>('cash');
  txFilter = signal<TransactionFilter | null>(null);

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('bank.title'));
    const t = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (t && TABS.includes(t)) this.tab.set(t);
  }

  setTab(t: Tab): void {
    this.txFilter.set(null);
    this.tab.set(t);
    this.router.navigate([], { queryParams: { tab: t === 'cash' ? null : t }, replaceUrl: true });
  }

  /** From the Cash tab's counters: the Transactions tab, already filtered. */
  openLines(filter: TransactionFilter): void {
    this.setTab('transactions');
    this.txFilter.set(filter);
  }
}
