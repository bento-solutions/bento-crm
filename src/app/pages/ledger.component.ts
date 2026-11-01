import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { LedgerAccountsComponent } from './ledger/ledger-accounts.component';
import { LedgerEntriesComponent } from './ledger/ledger-entries.component';
import { LedgerGeneralComponent } from './ledger/ledger-general.component';
import { LedgerTrialComponent } from './ledger/ledger-trial.component';
import { LedgerCostCentersComponent } from './ledger/ledger-cost-centers.component';

type Tab = 'accounts' | 'entries' | 'ledger' | 'trial' | 'cost-centers';
const TABS: Tab[] = ['accounts', 'entries', 'ledger', 'trial', 'cost-centers'];

/**
 * General Ledger: the chart of accounts (PCGE), journal entries, the general ledger, the trial
 * balance and the cost centers.
 */
@Component({
  selector: 'app-ledger',
  imports: [MatIconModule, TranslatePipe, PageHeaderComponent, LedgerAccountsComponent, LedgerEntriesComponent,
    LedgerGeneralComponent, LedgerTrialComponent, LedgerCostCentersComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'ledger.title' | translate" [subtitle]="'ledger.subtitle' | translate" />

      <div class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button role="tab" class="tab" [class.is-active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="setTab(t.key)">
            <mat-icon>{{ t.icon }}</mat-icon>{{ t.label | translate }}
          </button>
        }
      </div>

      @switch (tab()) {
        @case ('accounts') { <app-ledger-accounts /> }
        @case ('entries') { <app-ledger-entries [openEntryId]="entryId()" /> }
        @case ('ledger') { <app-ledger-general (openEntry)="openEntry($event)" /> }
        @case ('trial') { <app-ledger-trial /> }
        @case ('cost-centers') { <app-ledger-cost-centers /> }
      }
    </div>
  `,
})
export class LedgerComponent implements OnInit {
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'accounts', label: 'ledger.tab.accounts', icon: 'account_tree' },
    { key: 'entries', label: 'ledger.tab.entries', icon: 'receipt_long' },
    { key: 'ledger', label: 'ledger.tab.ledger', icon: 'menu_book' },
    { key: 'trial', label: 'ledger.tab.trial', icon: 'balance' },
    { key: 'cost-centers', label: 'ledger.tab.costCenters', icon: 'hub' },
  ];

  tab = signal<Tab>('accounts');
  /** An entry to open when switching to the Journal entries tab from the general ledger. */
  entryId = signal<string | null>(null);

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('ledger.title'));
  }

  constructor() {
    // The sidebar opens tabs through ?tab=, also while this page is already open.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const q = params.get('tab') as Tab | null;
      const t = q && TABS.includes(q) ? q : 'accounts';
      if (t !== this.tab()) {
        this.entryId.set(null);
        this.tab.set(t);
      }
    });
  }

  setTab(t: Tab): void {
    this.entryId.set(null);
    this.tab.set(t);
    this.router.navigate([], { queryParams: { tab: t === 'accounts' ? null : t }, replaceUrl: true });
  }

  openEntry(id: string): void {
    this.setTab('entries');
    this.entryId.set(id);
  }
}
