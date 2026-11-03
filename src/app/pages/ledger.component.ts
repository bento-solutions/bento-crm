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
import { LedgerSetupComponent } from './ledger/ledger-setup.component';
import { LedgerClosingComponent } from './ledger/ledger-closing.component';
import { LedgerVatComponent } from './ledger/ledger-vat.component';
import { LedgerCutoffComponent } from './ledger/ledger-cutoff.component';
import { LedgerPayrollComponent } from './ledger/ledger-payroll.component';
import { LedgerRangeRequest, LedgerStatementsComponent } from './ledger/ledger-statements.component';
import { LedgerExportDialogComponent } from './ledger/ledger-export-dialog.component';
import type { GeneralLedgerFilter } from '../services/domains/ledger.service';

type Tab = 'accounts' | 'entries' | 'ledger' | 'trial' | 'statements' | 'cost-centers' | 'setup' | 'closing' | 'vat' | 'payroll' | 'cutoff';
// 'payroll' is built but hidden until its API ships (postponed by the user).
const TABS: Tab[] = ['accounts', 'entries', 'ledger', 'trial', 'statements', 'cost-centers', 'setup', 'closing', 'vat', 'cutoff'];

/**
 * General Ledger: the chart of accounts (PCGE), journal entries, the general ledger, the trial
 * balance, the financial statements (phase 4), the cost centers, the posting setup, and the closing, VAT, payroll and cut-off tabs (phase 3).
 * ?tab=entries&entry=<id> opens one entry (the "View journal entry" link of invoices, bills, payments and expenses);
 * ?tab=ledger&accountFrom=&accountTo=&from=&to= opens the general ledger on an account range (a rubric of the statements).
 * The header's "Export for accountant" opens the export dialog.
 */
@Component({
  selector: 'app-ledger',
  imports: [MatIconModule, TranslatePipe, PageHeaderComponent, LedgerAccountsComponent, LedgerEntriesComponent,
    LedgerGeneralComponent, LedgerTrialComponent, LedgerCostCentersComponent, LedgerSetupComponent,
    LedgerClosingComponent, LedgerVatComponent, LedgerCutoffComponent, LedgerPayrollComponent, LedgerStatementsComponent,
    LedgerExportDialogComponent],
  template: `
    <div class="page">
      <app-page-header class="no-print" [title]="'ledger.title' | translate" [subtitle]="'ledger.subtitle' | translate">
        <button actions class="btn-secondary" (click)="exportOpen.set(true)"><mat-icon>ios_share</mat-icon>{{ 'ledger.export.button' | translate }}</button>
      </app-page-header>

      <div class="tabs no-print" role="tablist">
        @for (t of tabs; track t.key) {
          <button role="tab" class="tab" [class.is-active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="setTab(t.key)">
            <mat-icon>{{ t.icon }}</mat-icon>{{ t.label | translate }}
          </button>
        }
      </div>

      @switch (tab()) {
        @case ('accounts') { <app-ledger-accounts /> }
        @case ('entries') { <app-ledger-entries [openEntryId]="entryId()" (closed)="entryClosed()" /> }
        @case ('ledger') { <app-ledger-general [preset]="glPreset()" (openEntry)="openEntry($event)" /> }
        @case ('trial') { <app-ledger-trial /> }
        @case ('statements') { <app-ledger-statements (openLedger)="openLedgerRange($event)" /> }
        @case ('cost-centers') { <app-ledger-cost-centers /> }
        @case ('setup') { <app-ledger-setup /> }
        @case ('closing') { <app-ledger-closing /> }
        @case ('vat') { <app-ledger-vat /> }
        @case ('payroll') { <app-ledger-payroll /> }
        @case ('cutoff') { <app-ledger-cutoff /> }
      }
    </div>

    @if (exportOpen()) { <app-ledger-export-dialog (closed)="exportOpen.set(false)" /> }
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
    { key: 'statements', label: 'ledger.tab.statements', icon: 'account_balance' },
    { key: 'cost-centers', label: 'ledger.tab.costCenters', icon: 'hub' },
    { key: 'setup', label: 'ledger.tab.setup', icon: 'tune' },
    { key: 'closing', label: 'ledger.tab.closing', icon: 'event_available' },
    { key: 'vat', label: 'ledger.tab.vat', icon: 'percent' },
    { key: 'cutoff', label: 'ledger.tab.cutoff', icon: 'content_cut' },
  ];

  tab = signal<Tab>('accounts');
  /** An entry to open when switching to the Journal entries tab from the general ledger. */
  entryId = signal<string | null>(null);
  /** Filters the general ledger tab opens with (a rubric clicked on the statements, or ?accountFrom=…). */
  glPreset = signal<Partial<GeneralLedgerFilter> | null>(null);
  exportOpen = signal(false);

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('ledger.title'));
  }

  constructor() {
    // The sidebar opens tabs through ?tab=, also while this page is already open.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const q = params.get('tab') as Tab | null;
      const t = q && TABS.includes(q) ? q : 'accounts';
      const entry = t === 'entries' ? params.get('entry') : null;
      if (t === 'ledger' && (params.get('accountFrom') || params.get('accountTo'))) {
        this.glPreset.set({
          accountFrom: params.get('accountFrom'), accountTo: params.get('accountTo'),
          ...(params.get('from') ? { from: params.get('from') } : {}), ...(params.get('to') ? { to: params.get('to') } : {}),
        });
      }
      if (t !== this.tab()) {
        this.entryId.set(entry);
        this.tab.set(t);
      } else if (entry && entry !== this.entryId()) {
        this.entryId.set(entry);
      }
    });
  }

  setTab(t: Tab): void {
    this.entryId.set(null);
    this.glPreset.set(null);
    this.tab.set(t);
    this.router.navigate([], { queryParams: { tab: t === 'accounts' ? null : t }, replaceUrl: true });
  }

  /** A rubric of the statements: the general ledger on its accounts, over the statement's period. */
  openLedgerRange(r: LedgerRangeRequest): void {
    this.entryId.set(null);
    this.glPreset.set({ from: r.from, to: r.to, accountFrom: r.accountFrom, accountTo: r.accountTo });
    this.tab.set('ledger');
    this.router.navigate([], { queryParams: { tab: 'ledger', ...r }, replaceUrl: false });
  }

  openEntry(id: string): void {
    this.setTab('entries');
    this.entryId.set(id);
  }

  /** The entry's panel was closed: drop ?entry= so a reload does not open it again. */
  entryClosed(): void {
    this.entryId.set(null);
    if (this.route.snapshot.queryParamMap.get('entry')) {
      this.router.navigate([], { queryParams: { entry: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }
}
