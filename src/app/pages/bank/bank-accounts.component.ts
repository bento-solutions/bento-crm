import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { InboundApi } from '../../services/domains/inbound.service';
import {
  BANK_CODES, BankAccount, BankApi, BankCode, BankImport, ImportResult,
} from '../../services/domains/bank.service';
import { amountClass, formatMoney, maskAccountNumber, shortDate } from '../../shared/bank.util';
import { bankLabel, errorDetail } from './bank-labels';

interface AccountForm {
  id?: string;
  name: string;
  bank: BankCode | null;
  accountNumber: string;
  currency: string;
  openingBalance: number | null;
  openingDate: string;
  active: boolean;
}

/**
 * Bank → Accounts: the company's bank accounts, statement imports (CSV, Excel, PDF or a picture)
 * and the history of what was imported into each.
 */
@Component({
  selector: 'app-bank-accounts',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      @if (statementsAddress()) {
        <div class="alert alert-info text-sm flex flex-wrap items-center gap-1">
          <mat-icon>alternate_email</mat-icon>
          <span>{{ 'bank.accounts.inboxHint' | translate }}</span>
          <span class="font-medium t-mono break-all">{{ statementsAddress() }}</span>
        </div>
      }

      <div class="flex flex-wrap items-center gap-2">
        <h2 class="section-title me-auto">{{ 'bank.accounts.title' | translate }}</h2>
        @if (canWrite()) {
          <button class="btn-primary" (click)="openForm()"><mat-icon>add</mat-icon>{{ 'bank.accounts.add' | translate }}</button>
        }
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'bank.accounts.name' | translate }}</th>
              <th>{{ 'bank.accounts.number' | translate }}</th>
              <th class="col-num">{{ 'bank.accounts.balance' | translate }}</th>
              <th>{{ 'bank.accounts.lastLine' | translate }}</th>
              <th class="col-num">{{ 'bank.accounts.toReconcile' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (a of accounts(); track a.id) {
                <tr>
                  <td><div class="cell-title">{{ a.name }}
                      @if (!a.active) { <span class="badge badge-neutral ms-1">{{ 'bank.accounts.inactive' | translate }}</span> }</div>
                    <div class="cell-sub">{{ bank(a.bank) }} · {{ a.currency || 'MAD' }}</div></td>
                  <td class="num cell-muted whitespace-nowrap">{{ mask(a.accountNumber) }}</td>
                  <td class="col-num num whitespace-nowrap font-medium" [class]="amountClass(a.balance)">{{ money(a.balance, a.currency) }}</td>
                  <td class="cell-muted whitespace-nowrap">{{ date(a.lastTransactionDate) }}</td>
                  <td class="col-num num">{{ a.unmatched ?? 0 }}</td>
                  <td class="col-actions whitespace-nowrap">
                    <button class="btn-ghost btn-sm" (click)="showStatements(a.id)">{{ 'bank.accounts.statements' | translate }}</button>
                    @if (canWrite()) {
                      <button class="btn-secondary btn-sm" (click)="openImport(a)"><mat-icon>upload</mat-icon>{{ 'bank.accounts.import' | translate }}</button>
                      <button class="btn-ghost btn-sm" (click)="openForm(a)">{{ 'bank.edit' | translate }}</button>
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="remove(a)">{{ 'bank.delete' | translate }}</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="row-empty">
                  <app-empty-state icon="account_balance" [title]="'bank.cash.noAccountsTitle' | translate" [text]="'bank.cash.noAccountsText' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Statement history -->
      <div class="table-card">
        <div class="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-line">
          <h3 class="text-sm font-semibold text-ink me-auto">{{ 'bank.accounts.history' | translate }}</h3>
          <select class="input-field w-auto" [ngModel]="historyAccount()" (ngModelChange)="showStatements($event)" [attr.aria-label]="'bank.tx.account' | translate">
            <option [ngValue]="null">{{ 'bank.tx.allAccounts' | translate }}</option>
            @for (a of accounts(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'bank.accounts.period' | translate }}</th>
              <th>{{ 'bank.tx.account' | translate }}</th>
              <th>{{ 'bank.accounts.format' | translate }}</th>
              <th class="col-num">{{ 'bank.accounts.imported' | translate }}</th>
              <th class="col-num">{{ 'bank.accounts.skipped' | translate }}</th>
              <th>{{ 'bank.accounts.check' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (s of statements(); track s.id) {
                <tr>
                  <td class="whitespace-nowrap">{{ date(s.periodStart) }} → {{ date(s.periodEnd) }}
                    <div class="cell-sub">{{ 'bank.accounts.importedOn' | translate: { date: date(s.createdAt) } }}</div></td>
                  <td class="cell-muted">{{ accountName(s.bankAccountId) }}</td>
                  <td class="cell-muted whitespace-nowrap">{{ (s.format || '—').toUpperCase() }}@if (s.parser) { · {{ s.parser }} }</td>
                  <td class="col-num num">{{ s.rowsImported }}</td>
                  <td class="col-num num cell-muted">{{ s.rowsSkipped }}</td>
                  <td>
                    @if (s.balanceMismatch) {
                      <span class="badge badge-warning"><mat-icon class="icon-xs">warning</mat-icon>{{ 'bank.accounts.mismatch' | translate }}</span>
                    } @else {
                      <span class="badge badge-success">{{ 'bank.accounts.balanced' | translate }}</span>
                    }
                  </td>
                  <td class="col-actions">
                    @if (canWrite()) {
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="removeStatement(s)">{{ 'bank.delete' | translate }}</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="row-empty text-sm text-ink-3">{{ 'bank.accounts.noStatements' | translate }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create / edit -->
    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">{{ (f.id ? 'bank.accounts.editTitle' : 'bank.accounts.add') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'bank.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3" [disabled]="busy()">
            <label class="block sm:col-span-2"><span class="field-label">{{ 'bank.accounts.name' | translate }}</span>
              <input class="input-field" maxlength="120" [(ngModel)]="f.name" [placeholder]="'bank.accounts.namePlaceholder' | translate" /></label>
            <label class="block"><span class="field-label">{{ 'bank.accounts.bank' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.bank">
                <option [ngValue]="null">—</option>
                @for (b of banks; track b) { <option [ngValue]="b">{{ bank(b) }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'bank.accounts.currency' | translate }}</span>
              <input class="input-field uppercase" maxlength="3" [(ngModel)]="f.currency" /></label>
            <label class="block sm:col-span-2"><span class="field-label">{{ 'bank.accounts.rib' | translate }}</span>
              <input class="input-field num" maxlength="40" inputmode="numeric" [(ngModel)]="f.accountNumber" />
              <span class="field-hint">{{ 'bank.accounts.ribHint' | translate }}</span></label>
            <label class="block"><span class="field-label">{{ 'bank.accounts.openingBalance' | translate }}</span>
              <input type="number" step="0.01" class="input-field num" [(ngModel)]="f.openingBalance" /></label>
            <label class="block"><span class="field-label">{{ 'bank.accounts.openingDate' | translate }}</span>
              <input type="date" class="input-field" [(ngModel)]="f.openingDate" /></label>
            <label class="choice-row sm:col-span-2">
              <input type="checkbox" [(ngModel)]="f.active" />
              <span class="text-sm text-ink">{{ 'bank.accounts.active' | translate }}</span>
            </label>
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'bank.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !f.name.trim() || !f.accountNumber.trim()" (click)="save(f)">{{ 'bank.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Import a statement -->
    @if (importFor(); as a) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 class="modal-title">{{ 'bank.accounts.importTitle' | translate }}</h3>
              <p class="modal-subtitle truncate">{{ a.name }} · {{ mask(a.accountNumber) }}</p>
            </div>
            <button class="btn-icon btn-sm" (click)="closeImport()" [attr.aria-label]="'bank.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          @if (importResult(); as r) {
            <div class="space-y-3">
              <div class="alert alert-success text-sm">{{ 'bank.accounts.importDone' | translate }}</div>
              <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt class="text-ink-3">{{ 'bank.accounts.period' | translate }}</dt>
                <dd class="text-ink">{{ date(r.importSummary.periodStart) }} → {{ date(r.importSummary.periodEnd) }}</dd>
                <dt class="text-ink-3">{{ 'bank.accounts.linesImported' | translate }}</dt><dd class="text-ink num">{{ r.importSummary.rowsImported }}</dd>
                <dt class="text-ink-3">{{ 'bank.accounts.linesSkipped' | translate }}</dt><dd class="text-ink num">{{ r.importSummary.rowsSkipped }}</dd>
                <dt class="text-ink-3">{{ 'bank.accounts.autoMatched' | translate }}</dt><dd class="text-ink num">{{ r.autoMatched }}</dd>
              </dl>
              @if (r.importSummary.balanceMismatch) {
                <div class="alert alert-warning text-sm">{{ 'bank.accounts.mismatchWarning' | translate }}</div>
              }
            </div>
            <div class="modal-footer">
              <button class="btn-primary" (click)="closeImport()">{{ 'bank.close' | translate }}</button>
            </div>
          } @else {
            <label class="block"><span class="field-label">{{ 'bank.accounts.file' | translate }}</span>
              <input type="file" class="input-field" accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf,image/*"
                     (change)="onPick($event)" /></label>
            <p class="text-xs text-ink-3">{{ 'bank.accounts.importHint' | translate }}</p>
            <div class="modal-footer">
              <button class="btn-secondary" (click)="closeImport()">{{ 'bank.cancel' | translate }}</button>
              <button class="btn-primary" [disabled]="busy() || !importFile()" (click)="upload(a)">{{ (busy() ? 'bank.accounts.reading' : 'bank.accounts.import') | translate }}</button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class BankAccountsComponent implements OnInit {
  private api = inject(BankApi);
  private inbound = inject(InboundApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  readonly banks = BANK_CODES;

  accounts = signal<BankAccount[]>([]);
  statements = signal<BankImport[]>([]);
  historyAccount = signal<string | null>(null);
  statementsAddress = signal<string | null>(null);
  busy = signal(false);
  form = signal<AccountForm | null>(null);
  importFor = signal<BankAccount | null>(null);
  importFile = signal<File | null>(null);
  importResult = signal<ImportResult | null>(null);

  canWrite(): boolean { return this.state.hasAuthority('PAYMENTS_WRITE'); }

  ngOnInit(): void {
    this.load();
    this.loadStatements();
    // Only shown when this user may read the inbox settings; otherwise silently left out.
    this.inbound.settings().subscribe({
      next: s => {
        const box = (s?.mailboxes ?? []).find(m => m.kind === 'BANK_STATEMENTS' && m.active !== false);
        this.statementsAddress.set(box?.address ?? null);
      },
      error: () => this.statementsAddress.set(null),
    });
  }

  load(): void {
    this.api.accounts().subscribe({ next: a => this.accounts.set(a ?? []), error: e => this.fail(e) });
  }

  loadStatements(): void {
    this.api.statements(this.historyAccount()).subscribe({ next: s => this.statements.set(s ?? []), error: e => this.fail(e) });
  }

  showStatements(accountId: string | null): void {
    this.historyAccount.set(accountId);
    this.loadStatements();
  }

  // Account form
  openForm(a?: BankAccount): void {
    this.form.set(a ? {
      id: a.id, name: a.name, bank: a.bank ?? null, accountNumber: a.accountNumber, currency: a.currency || 'MAD',
      openingBalance: a.openingBalance ?? null, openingDate: a.openingDate ?? '', active: a.active,
    } : { name: '', bank: null, accountNumber: '', currency: 'MAD', openingBalance: null, openingDate: '', active: true });
  }

  save(f: AccountForm): void {
    this.busy.set(true);
    this.api.saveAccount({
      name: f.name.trim(), bank: f.bank, accountNumber: f.accountNumber.trim(),
      currency: (f.currency || 'MAD').trim().toUpperCase(), openingBalance: f.openingBalance,
      openingDate: f.openingDate || null, active: f.active,
    }, f.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t('bank.accounts.saved'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  async remove(a: BankAccount): Promise<void> {
    if (!(await this.confirm.ask({ title: this.i18n.t('bank.accounts.confirmDelete', { name: a.name }), danger: true }))) return;
    this.busy.set(true);
    this.api.deleteAccount(a.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('bank.accounts.deleted'), { type: 'success' });
        if (this.historyAccount() === a.id) this.historyAccount.set(null);
        this.load();
        this.loadStatements();
      },
      error: e => this.fail(e),
    });
  }

  // Import
  openImport(a: BankAccount): void {
    this.importFor.set(a);
    this.importFile.set(null);
    this.importResult.set(null);
  }

  closeImport(): void {
    this.importFor.set(null);
    this.importFile.set(null);
    this.importResult.set(null);
  }

  onPick(event: Event): void {
    this.importFile.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  upload(a: BankAccount): void {
    const file = this.importFile();
    if (!file) return;
    this.busy.set(true);
    this.api.uploadStatement(a.id, file).subscribe({
      next: r => {
        this.busy.set(false);
        this.importResult.set(r);
        this.load();
        this.historyAccount.set(a.id);
        this.loadStatements();
      },
      error: e => this.fail(e),
    });
  }

  async removeStatement(s: BankImport): Promise<void> {
    if (!(await this.confirm.ask({
      title: this.i18n.t('bank.accounts.confirmDeleteStatement'),
      message: this.i18n.t('bank.accounts.confirmDeleteStatementText', { n: s.rowsImported }),
      danger: true,
    }))) return;
    this.busy.set(true);
    this.api.deleteStatement(s.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('bank.accounts.statementDeleted'), { type: 'success' });
        this.load();
        this.loadStatements();
      },
      error: e => this.fail(e),
    });
  }

  // Display
  accountName(id: string): string {
    return this.accounts().find(a => a.id === id)?.name ?? '—';
  }

  money(v: number | null | undefined, currency?: string | null): string { return formatMoney(v, currency); }
  amountClass(v: number | null | undefined): string { return amountClass(v); }
  mask(n: string | null | undefined): string { return maskAccountNumber(n); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
  bank(b: string | null | undefined): string { return bankLabel(this.i18n, b); }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
