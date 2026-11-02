import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import {
  BankAccount, BankApi, BankJournalLine, BankJournalSummary, JournalStatus, ValidateResult,
} from '../../services/domains/bank.service';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import { amountClass, formatMoney, maskAccountNumber, shortDate } from '../../shared/bank.util';
import { categoryLabel, errorDetail } from './bank-labels';

const PAGE_SIZE = 100;
const SUSPENSE = '4497';

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Bank → Bank journal: the statement lines waiting for validation, with the account each one will
 * hit (red when it is 4497 suspense), its match and partner. Validating posts them; a validated line
 * can be unvalidated (its postings are reversed). Also the statement balance against the ledger.
 */
@Component({
  selector: 'app-bank-journal',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      @if (onImport()) {
        <div class="alert alert-info text-sm"><mat-icon>info</mat-icon><span>{{ 'bank.journal.onImportMode' | translate }}</span></div>
      }

      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'bank.tx.account' | translate }}</span>
          <select class="input-field" [ngModel]="accountId()" (ngModelChange)="setAccount($event)">
            @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }} · {{ mask(a.accountNumber) }}</option> }
          </select></label>
        <div class="segmented" role="group" [attr.aria-label]="'bank.tx.status' | translate">
          @for (s of statuses; track s) {
            <button type="button" class="segmented__item" [class.is-active]="status() === s" [attr.aria-pressed]="status() === s" (click)="setStatus(s)">
              {{ ('bank.journal.status.' + s) | translate }}
            </button>
          }
        </div>
        <label class="block"><span class="field-label">{{ 'bank.tx.from' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="from()" (ngModelChange)="from.set($event); reload()" /></label>
        <label class="block"><span class="field-label">{{ 'bank.tx.to' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="to()" (ngModelChange)="to.set($event); reload()" /></label>
      </div>

      @if (summary(); as s) {
        <div class="card">
          <div class="card-body grid gap-4 sm:grid-cols-4 text-sm">
            <div><div class="text-ink-3 text-xs">{{ 'bank.journal.toValidate' | translate }}</div><div class="text-lg num text-ink">{{ s.toValidate }}</div></div>
            <div><div class="text-ink-3 text-xs">{{ 'bank.journal.statementBalance' | translate }}</div><div class="text-lg num text-ink">{{ money(s.statementBalance) }}</div></div>
            <div><div class="text-ink-3 text-xs">{{ 'bank.journal.ledgerBalance' | translate }}</div><div class="text-lg num text-ink">{{ money(s.ledgerBalance) }}</div></div>
            <div><div class="text-ink-3 text-xs">{{ 'bank.journal.difference' | translate }}</div>
              <div class="text-lg num" [class.text-danger-ink]="!isZero(s.difference)" [class.text-ink]="isZero(s.difference)">{{ money(s.difference) }}</div></div>
          </div>
        </div>
      }

      @if (status() === 'TO_VALIDATE' && canWrite()) {
        <div class="flex flex-wrap items-end gap-3">
          <button class="btn-primary" [disabled]="busy() || !selected().size" (click)="validateSelected()">
            <mat-icon>task_alt</mat-icon>{{ 'bank.journal.validateSelected' | translate: { n: selected().size } }}</button>
          <label class="block"><span class="field-label">{{ 'bank.journal.upTo' | translate }}</span>
            <input type="date" class="input-field" [ngModel]="upTo()" (ngModelChange)="upTo.set($event)" /></label>
          <button class="btn-secondary" [disabled]="busy() || !upTo() || !accountId()" (click)="validateUpTo()">
            <mat-icon>done_all</mat-icon>{{ 'bank.journal.validateUpTo' | translate }}</button>
        </div>
      }

      @if (result(); as r) {
        <div class="alert text-sm" [class.alert-success]="!r.warnings?.length" [class.alert-warning]="!!r.warnings?.length">
          <div>
            <div>{{ 'bank.journal.validatedN' | translate: { validated: r.validated, posted: r.posted } }}</div>
            @for (w of r.warnings ?? []; track w.transactionId) {
              <div class="text-xs mt-1">{{ lineLabel(w.transactionId) }} — {{ w.message }}</div>
            }
          </div>
        </div>
      }

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              @if (status() === 'TO_VALIDATE' && canWrite()) {
                <th class="w-8"><input type="checkbox" [checked]="allSelected()" (change)="toggleAll()" [attr.aria-label]="'bank.journal.selectAll' | translate" /></th>
              }
              <th>{{ 'bank.tx.date' | translate }}</th>
              <th>{{ 'bank.tx.label' | translate }}</th>
              <th class="col-num">{{ 'bank.tx.amount' | translate }}</th>
              <th>{{ 'bank.journal.account' | translate }}</th>
              <th>{{ 'bank.tx.matchedTo' | translate }}</th>
              <th>{{ 'bank.journal.partner' | translate }}</th>
              @if (status() === 'VALIDATED') { <th class="col-actions"></th> }
            </tr></thead>
            <tbody>
              @for (l of lines(); track l.id) {
                <tr>
                  @if (status() === 'TO_VALIDATE' && canWrite()) {
                    <td><input type="checkbox" [checked]="selected().has(l.id)" (change)="toggle(l.id)" [attr.aria-label]="l.description || l.id" /></td>
                  }
                  <td class="cell-muted whitespace-nowrap">
                    @if (l.validatedAt) { <mat-icon class="icon-sm text-success-ink align-middle" [title]="'bank.journal.validatedOn' | translate: { date: date(l.validatedAt) }">check_circle</mat-icon> }
                    {{ date(l.date) }}</td>
                  <td class="max-w-80"><div class="cell-title truncate">{{ l.description || '—' }}</div>
                    @if (l.category) { <div class="cell-sub">{{ category(l.category) }}</div> }</td>
                  <td class="col-num num whitespace-nowrap font-medium" [class]="amountClass(l.amount)">{{ money(l.amount) }}</td>
                  <td class="whitespace-nowrap">
                    @if (l.proposedAccountCode) {
                      <span class="num" [class.text-danger-ink]="isSuspense(l)" [class.text-ink]="!isSuspense(l)">{{ l.proposedAccountCode }}</span>
                      <div class="cell-sub truncate max-w-48" [class.text-danger-ink]="isSuspense(l)">{{ l.proposedAccountName || '' }}</div>
                    } @else { <span class="cell-muted">—</span> }
                  </td>
                  <td class="max-w-56">
                    @if (l.advance) { <span class="badge badge-info">{{ 'bank.journal.advance' | translate }}</span> }
                    @if (l.invoiceNumber) { <div class="text-sm text-ink truncate">{{ l.invoiceNumber }}</div> }
                    @else if (l.expenseId) { <div class="text-sm text-ink">{{ 'bank.candidate.EXPENSE' | translate }}</div> }
                    @else if (l.paymentId) { <div class="text-sm text-ink">{{ 'bank.candidate.PAYMENT' | translate }}</div> }
                    @else if (!l.advance) { <span class="badge" [class]="l.status === 'MATCHED' ? 'badge-success' : 'badge-warning'">{{ ('bank.tx.statusName.' + l.status) | translate }}</span> }
                  </td>
                  <td class="text-sm text-ink truncate max-w-40">{{ l.partnerName || '—' }}</td>
                  @if (status() === 'VALIDATED') {
                    <td class="col-actions">
                      @if (canWrite()) {
                        <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="unvalidate(l)"><mat-icon>undo</mat-icon>{{ 'bank.journal.unvalidate' | translate }}</button>
                      }
                    </td>
                  }
                </tr>
              } @empty {
                <tr><td colspan="8" class="row-empty">
                  <app-empty-state icon="fact_check" [title]="(status() === 'TO_VALIDATE' ? 'bank.journal.emptyTitle' : 'bank.journal.emptyValidated') | translate"
                                   [text]="status() === 'TO_VALIDATE' ? ('bank.journal.emptyText' | translate) : ''" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (totalPages() > 1) {
          <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-line">
            <span class="text-xs text-ink-3 me-auto">{{ 'bank.tx.count' | translate: { n: total() } }}</span>
            <button class="btn-icon btn-sm" [disabled]="page() === 0" (click)="goPage(page() - 1)" [attr.aria-label]="'drive.previous' | translate"><mat-icon class="icon-sm rtl:rotate-180">chevron_left</mat-icon></button>
            <span class="text-xs text-ink-2 num">{{ 'drive.pageOf' | translate: { page: page() + 1, pages: totalPages() } }}</span>
            <button class="btn-icon btn-sm" [disabled]="page() + 1 >= totalPages()" (click)="goPage(page() + 1)" [attr.aria-label]="'drive.next' | translate"><mat-icon class="icon-sm rtl:rotate-180">chevron_right</mat-icon></button>
          </div>
        }
      </div>
    </div>
  `,
})
export class BankJournalComponent implements OnInit {
  private api = inject(BankApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);
  private groups = inject(LedgerGroupsStore);

  readonly statuses: JournalStatus[] = ['TO_VALIDATE', 'VALIDATED'];

  accounts = signal<BankAccount[]>([]);
  accountId = signal('');
  status = signal<JournalStatus>('TO_VALIDATE');
  from = signal('');
  to = signal('');
  upTo = signal(isoDate(new Date()));
  lines = signal<BankJournalLine[]>([]);
  summary = signal<BankJournalSummary | null>(null);
  selected = signal<Set<string>>(new Set());
  result = signal<ValidateResult | null>(null);
  total = signal(0);
  totalPages = signal(1);
  page = signal(0);
  busy = signal(false);

  allSelected = computed(() => this.lines().length > 0 && this.lines().every(l => this.selected().has(l.id)));
  /** The organization posts bank lines on import: nothing waits here (known only to ledger readers). */
  onImport = computed(() => this.groups.setup()?.bankPostingMode === 'ON_IMPORT');

  canWrite(): boolean { return this.state.hasAuthority('PAYMENTS_WRITE'); }

  ngOnInit(): void {
    this.groups.ensure();
    this.api.accounts().subscribe({
      next: a => {
        const list = (a ?? []).filter(x => x.active !== false);
        this.accounts.set(list);
        if (list.length && !this.accountId()) {
          this.accountId.set(list[0].id);
          this.load();
        }
      },
      error: e => this.fail(e),
    });
  }

  setAccount(id: string): void {
    this.accountId.set(id);
    this.reload();
  }

  setStatus(s: JournalStatus): void {
    this.status.set(s);
    this.reload();
  }

  reload(): void {
    this.page.set(0);
    this.load();
  }

  goPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  load(): void {
    const bankAccountId = this.accountId();
    if (!bankAccountId) return;
    this.selected.set(new Set());
    this.api.journal({ bankAccountId, status: this.status(), from: this.from() || null, to: this.to() || null }, this.page(), PAGE_SIZE).subscribe({
      next: p => {
        this.lines.set(p?.content ?? []);
        this.summary.set(p?.summary ?? null);
        this.total.set(p?.total_elements ?? (p?.content ?? []).length);
        this.totalPages.set(Math.max(1, p?.total_pages ?? 1));
      },
      error: e => this.fail(e),
    });
  }

  toggle(id: string): void {
    this.selected.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  toggleAll(): void {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.lines().map(l => l.id)));
  }

  validateSelected(): void {
    const ids = [...this.selected()];
    if (ids.length) this.validate({ bankAccountId: this.accountId(), transactionIds: ids });
  }

  async validateUpTo(): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('bank.journal.validateUpToTitle'),
      message: this.i18n.t('bank.journal.validateUpToText', { date: shortDate(this.upTo()) }),
      confirmLabel: this.i18n.t('bank.journal.validate'),
    });
    if (ok) this.validate({ bankAccountId: this.accountId(), upTo: this.upTo() });
  }

  private validate(body: { bankAccountId: string; transactionIds?: string[]; upTo?: string }): void {
    this.busy.set(true);
    this.result.set(null);
    const known = new Map(this.lines().map(l => [l.id, l]));
    this.api.validate(body).subscribe({
      next: r => {
        this.busy.set(false);
        this.lastLines = known;
        this.result.set({ validated: r?.validated ?? 0, posted: r?.posted ?? 0, warnings: r?.warnings ?? [] });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  async unvalidate(l: BankJournalLine): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('bank.journal.unvalidateTitle'),
      message: this.i18n.t('bank.journal.unvalidateText'),
      confirmLabel: this.i18n.t('bank.journal.unvalidate'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.unvalidate(l.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('bank.journal.unvalidated'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  /** The lines listed when the warnings came, so a warning names its line after the reload. */
  private lastLines = new Map<string, BankJournalLine>();

  lineLabel(id: string): string {
    const l = this.lastLines.get(id);
    return l ? `${shortDate(l.date)} · ${l.description || '—'} · ${formatMoney(l.amount)}` : id.slice(0, 8);
  }

  isSuspense(l: BankJournalLine): boolean { return (l.proposedAccountCode ?? '').startsWith(SUSPENSE); }
  isZero(v: number | null | undefined): boolean { return Math.abs(Number(v) || 0) < 0.005; }
  money(v: number | null | undefined): string { return formatMoney(v); }
  amountClass(v: number | null | undefined): string { return amountClass(v); }
  mask(n: string | null | undefined): string { return maskAccountNumber(n); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
  category(c: string | null | undefined): string { return categoryLabel(this.i18n, c); }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
