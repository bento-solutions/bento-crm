import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import {
  BankAccount, BankApi, BankTransaction, BankTxStatus, MatchCandidate, TransactionFilter,
} from '../../services/domains/bank.service';
import { amountClass, formatMoney, maskAccountNumber, shortDate } from '../../shared/bank.util';
import { categoryLabel, errorDetail } from './bank-labels';

const PAGE_SIZE = 50;

interface CategoryForm {
  category: string;
  remember: boolean;
  containsText: string;
}

/**
 * Bank → Transactions: the statement lines, filtered, and their reconciliation. A selected line
 * opens a side panel to match it to an invoice, payment or expense, ignore it, or set its category.
 */
@Component({
  selector: 'app-bank-transactions',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'bank.tx.account' | translate }}</span>
          <select class="input-field" [ngModel]="filter().accountId ?? ''" (ngModelChange)="setFilter({ accountId: $event || null })">
            <option value="">{{ 'bank.tx.allAccounts' | translate }}</option>
            @for (a of accounts(); track a.id) { <option [value]="a.id">{{ a.name }} · {{ mask(a.accountNumber) }}</option> }
          </select></label>
        <label class="block"><span class="field-label">{{ 'bank.tx.status' | translate }}</span>
          <select class="input-field" [ngModel]="filter().status ?? ''" (ngModelChange)="setFilter({ status: $event || null })">
            <option value="">{{ 'bank.tx.allStatuses' | translate }}</option>
            @for (s of statuses; track s) { <option [value]="s">{{ ('bank.tx.statusName.' + s) | translate }}</option> }
          </select></label>
        <label class="block"><span class="field-label">{{ 'bank.tx.category' | translate }}</span>
          <select class="input-field" [ngModel]="filter().category ?? ''" (ngModelChange)="setFilter({ category: $event || null })">
            <option value="">{{ 'bank.tx.allCategories' | translate }}</option>
            <option value="NONE">{{ category('NONE') }}</option>
            @for (c of categories(); track c) { <option [value]="c">{{ category(c) }}</option> }
          </select></label>
        <label class="block"><span class="field-label">{{ 'bank.tx.direction' | translate }}</span>
          <select class="input-field" [ngModel]="filter().direction ?? ''" (ngModelChange)="setFilter({ direction: $event || null })">
            <option value="">{{ 'bank.tx.bothDirections' | translate }}</option>
            <option value="IN">{{ 'bank.dir.IN' | translate }}</option>
            <option value="OUT">{{ 'bank.dir.OUT' | translate }}</option>
          </select></label>
        <label class="block"><span class="field-label">{{ 'bank.tx.from' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="filter().from ?? ''" (ngModelChange)="setFilter({ from: $event || null })" /></label>
        <label class="block"><span class="field-label">{{ 'bank.tx.to' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="filter().to ?? ''" (ngModelChange)="setFilter({ to: $event || null })" /></label>
        <label class="block"><span class="field-label">{{ 'bank.tx.search' | translate }}</span>
          <input class="input-field w-56" [placeholder]="'bank.tx.searchHint' | translate" [ngModel]="q()" (ngModelChange)="q.set($event)"
                 (keyup.enter)="applySearch()" (blur)="applySearch()" /></label>
        <div class="flex gap-2 ms-auto">
          @if (hasFilter()) {
            <button class="btn-ghost" (click)="clearFilter()">{{ 'bank.tx.clear' | translate }}</button>
          }
          @if (canWrite()) {
            <button class="btn-secondary" [disabled]="busy()" (click)="categorizeAll()"><mat-icon>category</mat-icon>{{ 'bank.tx.categorizeAll' | translate }}</button>
          }
        </div>
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'bank.tx.date' | translate }}</th>
              <th>{{ 'bank.tx.label' | translate }}</th>
              <th>{{ 'bank.tx.reference' | translate }}</th>
              <th class="col-num">{{ 'bank.tx.amount' | translate }}</th>
              <th>{{ 'bank.tx.category' | translate }}</th>
              <th>{{ 'bank.tx.status' | translate }}</th>
              <th>{{ 'bank.tx.matchedTo' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (t of lines(); track t.id) {
                <tr [class.bg-subtle]="selected()?.id === t.id">
                  <td class="cell-muted whitespace-nowrap">{{ date(t.bookingDate) }}</td>
                  <td class="max-w-80">
                    <button type="button" class="text-start block w-full min-w-0" (click)="select(t)">
                      <span class="cell-title block truncate hover:underline">{{ t.description || '—' }}</span>
                    </button>
                    <div class="cell-sub truncate">{{ accountName(t.bankAccountId) }}</div>
                  </td>
                  <td class="cell-muted max-w-40 truncate">{{ t.reference || '—' }}</td>
                  <td class="col-num num whitespace-nowrap font-medium" [class]="amountClass(t.amount)">{{ money(t.amount) }}</td>
                  <td class="whitespace-nowrap">
                    <span class="chip">{{ category(t.category) }}</span>
                    @if (t.category && t.categorySource) { <div class="text-meta text-ink-3 mt-0.5">{{ ('bank.source.' + t.categorySource) | translate }}</div> }
                  </td>
                  <td><span class="badge" [class]="statusBadge(t.status)">{{ ('bank.tx.statusName.' + t.status) | translate }}</span></td>
                  <td class="max-w-56">
                    @if (t.status === 'MATCHED') {
                      <div class="text-sm text-ink truncate">{{ t.invoiceNumber || t.matchLabel || '—' }}</div>
                      @if (t.invoiceNumber && t.matchLabel) { <div class="cell-sub truncate">{{ t.matchLabel }}</div> }
                    } @else { <span class="cell-muted">—</span> }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="row-empty">
                  <app-empty-state icon="receipt_long" [title]="'bank.tx.emptyTitle' | translate" [text]="'bank.tx.emptyText' | translate" />
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

    @if (selected(); as t) {
      <aside class="drawer-panel" role="dialog" aria-modal="false" aria-labelledby="bank-line-title">
        <header class="flex items-start justify-between gap-2 px-5 py-4 border-b border-line shrink-0">
          <div class="min-w-0">
            <h2 id="bank-line-title" class="section-title break-words">{{ t.description || '—' }}</h2>
            <p class="text-xs text-ink-3">{{ date(t.bookingDate) }} · {{ accountName(t.bankAccountId) }}</p>
          </div>
          <button class="btn-icon btn-sm shrink-0" (click)="close()" [attr.aria-label]="'bank.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-2xl font-semibold num" [class]="amountClass(t.amount)">{{ money(t.amount) }}</span>
            <span class="badge" [class]="statusBadge(t.status)">{{ ('bank.tx.statusName.' + t.status) | translate }}</span>
          </div>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt class="text-ink-3">{{ 'bank.tx.reference' | translate }}</dt><dd class="text-ink break-words">{{ t.reference || '—' }}</dd>
            <dt class="text-ink-3">{{ 'bank.tx.valueDate' | translate }}</dt><dd class="text-ink">{{ date(t.valueDate) }}</dd>
            @if (t.balanceAfter !== null && t.balanceAfter !== undefined) {
              <dt class="text-ink-3">{{ 'bank.tx.balanceAfter' | translate }}</dt><dd class="text-ink num">{{ money(t.balanceAfter) }}</dd>
            }
          </dl>

          <!-- Reconciliation -->
          @if (t.status === 'UNMATCHED') {
            <section class="space-y-2">
              <h3 class="text-sm font-semibold text-ink">{{ 'bank.tx.candidates' | translate }}</h3>
              @if (candidatesLoading()) {
                <p class="text-sm text-ink-3">{{ 'bank.loading' | translate }}</p>
              } @else {
                @for (c of candidates(); track c.kind + c.id) {
                  <div class="card p-3 space-y-1">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <span class="badge badge-neutral">{{ ('bank.candidate.' + c.kind) | translate }}</span>
                        <div class="text-sm font-medium text-ink mt-1 break-words">{{ c.label || '—' }}</div>
                        <div class="text-xs text-ink-3">{{ c.partnerName || '—' }} · {{ date(c.date) }}</div>
                      </div>
                      <div class="text-end shrink-0">
                        <div class="num text-sm text-ink">{{ money(c.amount) }}</div>
                        @if (c.outstanding !== null && c.outstanding !== undefined && c.outstanding !== c.amount) {
                          <div class="text-meta text-ink-3">{{ 'bank.tx.outstanding' | translate: { amount: money(c.outstanding) } }}</div>
                        }
                      </div>
                    </div>
                    @if (c.reason) { <p class="text-xs text-ink-2">{{ c.reason }}</p> }
                    @if (canWrite()) {
                      <div class="flex justify-end"><button class="btn-primary btn-sm" [disabled]="busy()" (click)="match(t, c)">{{ 'bank.tx.match' | translate }}</button></div>
                    }
                  </div>
                } @empty {
                  <p class="text-sm text-ink-3">{{ 'bank.tx.noCandidates' | translate }}</p>
                }
              }
              @if (canWrite()) {
                <!-- Match by hand when the right invoice is not suggested. -->
                <form class="flex gap-2 pt-1" (submit)="$event.preventDefault(); searchInvoices(t)">
                  <input class="input-field flex-1 min-w-0" type="search" name="invoiceQuery" [ngModel]="invoiceQuery()"
                         (ngModelChange)="invoiceQuery.set($event)" [placeholder]="'bank.tx.findInvoice' | translate"
                         [attr.aria-label]="'bank.tx.findInvoice' | translate" />
                  <button class="btn-secondary btn-sm" type="submit" [disabled]="searching() || invoiceQuery().trim().length < 2">
                    <mat-icon>search</mat-icon>{{ 'bank.tx.search' | translate }}</button>
                </form>
                @if (searched()) {
                  @for (c of searchResults(); track c.id) {
                    <div class="card p-3 flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="text-sm font-medium text-ink break-words">{{ c.label || '—' }}</div>
                        <div class="text-xs text-ink-3">{{ c.partnerName || '—' }} · {{ date(c.date) }}</div>
                        @if (c.outstanding !== null && c.outstanding !== undefined) {
                          <div class="text-meta text-ink-3">{{ 'bank.tx.outstanding' | translate: { amount: money(c.outstanding) } }}</div>
                        }
                      </div>
                      <button class="btn-primary btn-sm shrink-0" [disabled]="busy()" (click)="match(t, c)">{{ 'bank.tx.match' | translate }}</button>
                    </div>
                  } @empty {
                    <p class="text-sm text-ink-3">{{ 'bank.tx.noInvoiceFound' | translate }}</p>
                  }
                }
                <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="ignore(t)"><mat-icon>visibility_off</mat-icon>{{ 'bank.tx.ignore' | translate }}</button>
              }
            </section>
          } @else if (t.status === 'MATCHED') {
            <section class="space-y-2">
              <h3 class="text-sm font-semibold text-ink">{{ 'bank.tx.matchedTo' | translate }}</h3>
              <div class="alert alert-success text-sm">
                <div>
                  @if (t.invoiceNumber) { <div class="font-medium">{{ 'bank.tx.invoice' | translate: { number: t.invoiceNumber } }}</div> }
                  @else if (t.expenseId) { <div class="font-medium">{{ 'bank.candidate.EXPENSE' | translate }}</div> }
                  @else if (t.paymentId) { <div class="font-medium">{{ 'bank.candidate.PAYMENT' | translate }}</div> }
                  @if (t.matchLabel) { <div>{{ t.matchLabel }}</div> }
                  @if (t.paymentCreated) { <div class="text-xs mt-1">{{ 'bank.tx.paymentCreated' | translate }}</div> }
                </div>
              </div>
              @if (canWrite()) {
                <button class="btn-danger-soft btn-sm" [disabled]="busy()" (click)="unmatch(t)"><mat-icon>link_off</mat-icon>{{ 'bank.tx.unmatch' | translate }}</button>
              }
            </section>
          } @else {
            <section class="space-y-2">
              <p class="text-sm text-ink-2">{{ 'bank.tx.ignoredText' | translate }}</p>
              @if (canWrite()) {
                <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="restore(t)"><mat-icon>undo</mat-icon>{{ 'bank.tx.restore' | translate }}</button>
              }
            </section>
          }

          <!-- Category -->
          <section class="space-y-2 border-t border-line pt-4">
            <h3 class="text-sm font-semibold text-ink">{{ 'bank.tx.category' | translate }}</h3>
            @if (t.category && t.categorySource) {
              <p class="text-xs text-ink-3">{{ 'bank.tx.setBy' | translate: { source: (('bank.source.' + t.categorySource) | translate) } }}</p>
            }
            @if (catForm(); as f) {
              <fieldset class="space-y-2" [disabled]="busy() || !canWrite()">
                <label class="block"><span class="field-label">{{ 'bank.tx.category' | translate }}</span>
                  <select class="input-field" [(ngModel)]="f.category">
                    <option value="">{{ category('NONE') }}</option>
                    @for (c of categories(); track c) { <option [value]="c">{{ category(c) }}</option> }
                  </select></label>
                @if (f.category) {
                  <label class="choice-row">
                    <input type="checkbox" [(ngModel)]="f.remember" />
                    <span class="text-sm text-ink">{{ 'bank.tx.remember' | translate }}</span>
                  </label>
                  @if (f.remember) {
                    <label class="block"><span class="field-label">{{ 'bank.tx.containsText' | translate }}</span>
                      <input class="input-field" maxlength="120" [(ngModel)]="f.containsText" /></label>
                  }
                }
              </fieldset>
              @if (canWrite()) {
                <div class="flex justify-end">
                  <button class="btn-primary btn-sm" [disabled]="busy() || (f.remember && f.category && f.containsText.trim().length < 2)" (click)="saveCategory(t, f)">{{ 'bank.save' | translate }}</button>
                </div>
              }
            }
          </section>
        </div>
      </aside>
    }
  `,
})
export class BankTransactionsComponent implements OnInit {
  private api = inject(BankApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  /** Filter to open with (from the Cash tab's counters). */
  initialFilter = input<TransactionFilter | null>(null);

  readonly statuses: BankTxStatus[] = ['UNMATCHED', 'MATCHED', 'IGNORED'];

  filter = signal<TransactionFilter>({});
  q = signal('');
  accounts = signal<BankAccount[]>([]);
  categories = signal<string[]>([]);
  lines = signal<BankTransaction[]>([]);
  total = signal(0);
  totalPages = signal(1);
  page = signal(0);
  busy = signal(false);

  selected = signal<BankTransaction | null>(null);
  candidates = signal<MatchCandidate[]>([]);
  candidatesLoading = signal(false);
  invoiceQuery = signal('');
  searchResults = signal<MatchCandidate[]>([]);
  searching = signal(false);
  searched = signal(false);
  catForm = signal<CategoryForm | null>(null);

  canWrite(): boolean { return this.state.hasAuthority('PAYMENTS_WRITE'); }

  ngOnInit(): void {
    const initial = this.initialFilter();
    if (initial) {
      this.filter.set({ ...initial });
      this.q.set(initial.q ?? '');
    }
    this.api.accounts().subscribe({ next: a => this.accounts.set(a ?? []), error: () => { /* names fall back to "—" */ } });
    this.api.categories().subscribe({ next: c => this.categories.set(c ?? []), error: e => this.fail(e) });
    this.load();
  }

  load(): void {
    this.api.transactions(this.filter(), this.page(), PAGE_SIZE).subscribe({
      next: p => {
        this.lines.set(p.content ?? []);
        this.total.set(p.total_elements ?? (p.content ?? []).length);
        this.totalPages.set(Math.max(1, p.total_pages ?? 1));
      },
      error: e => this.fail(e),
    });
  }

  setFilter(patch: Partial<TransactionFilter>): void {
    this.filter.update(f => ({ ...f, ...patch }));
    this.page.set(0);
    this.load();
  }

  applySearch(): void {
    const q = this.q().trim();
    if (q !== (this.filter().q ?? '')) this.setFilter({ q: q || null });
  }

  hasFilter(): boolean {
    return Object.values(this.filter()).some(v => v !== null && v !== undefined && v !== '');
  }

  clearFilter(): void {
    this.filter.set({});
    this.q.set('');
    this.page.set(0);
    this.load();
  }

  goPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  // Panel
  select(t: BankTransaction): void {
    this.selected.set(t);
    this.catForm.set({ category: t.category ?? '', remember: false, containsText: t.description ?? '' });
    this.candidates.set([]);
    this.resetSearch();
    if (t.status === 'UNMATCHED') this.loadCandidates(t);
  }

  private resetSearch(): void {
    this.invoiceQuery.set('');
    this.searchResults.set([]);
    this.searched.set(false);
  }

  searchInvoices(t: BankTransaction): void {
    const q = this.invoiceQuery().trim();
    if (q.length < 2) return;
    this.searching.set(true);
    this.api.candidates(t.id, q).subscribe({
      next: c => { this.searchResults.set(c ?? []); this.searching.set(false); this.searched.set(true); },
      error: e => { this.searching.set(false); this.fail(e); },
    });
  }

  close(): void {
    this.selected.set(null);
    this.catForm.set(null);
    this.candidates.set([]);
    this.resetSearch();
  }

  private loadCandidates(t: BankTransaction): void {
    this.candidatesLoading.set(true);
    this.api.candidates(t.id).subscribe({
      next: c => { this.candidates.set(c ?? []); this.candidatesLoading.set(false); },
      error: e => { this.candidatesLoading.set(false); this.fail(e); },
    });
  }

  match(t: BankTransaction, c: MatchCandidate): void {
    this.busy.set(true);
    this.api.match(t.id, c.kind, c.id).subscribe({
      next: updated => this.done(updated, 'bank.tx.matched'),
      error: e => this.fail(e),
    });
  }

  async unmatch(t: BankTransaction): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('bank.tx.unmatchTitle'),
      message: this.i18n.t(t.paymentCreated ? 'bank.tx.unmatchPaymentText' : 'bank.tx.unmatchText'),
      confirmLabel: this.i18n.t('bank.tx.unmatch'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.unmatch(t.id).subscribe({
      next: updated => this.done(updated, 'bank.tx.unmatched'),
      error: e => this.fail(e),
    });
  }

  ignore(t: BankTransaction): void {
    this.busy.set(true);
    this.api.ignore(t.id).subscribe({
      next: updated => this.done(updated, 'bank.tx.ignored'),
      error: e => this.fail(e),
    });
  }

  restore(t: BankTransaction): void {
    this.busy.set(true);
    this.api.restore(t.id).subscribe({
      next: updated => this.done(updated, 'bank.tx.restored'),
      error: e => this.fail(e),
    });
  }

  saveCategory(t: BankTransaction, f: CategoryForm): void {
    this.busy.set(true);
    const remember = !!f.category && f.remember;
    this.api.setCategory(t.id, f.category || null, remember, remember ? f.containsText.trim() : null).subscribe({
      next: updated => this.done(updated, remember ? 'bank.tx.categorySavedRule' : 'bank.tx.categorySaved'),
      error: e => this.fail(e),
    });
  }

  categorizeAll(): void {
    this.busy.set(true);
    this.api.categorize().subscribe({
      next: r => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('bank.tx.categorizedN', { n: r?.categorized ?? 0 }), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  /** After an action: show the line as it is now, and refresh the list (it may leave the filter). */
  private done(updated: BankTransaction, messageKey: string): void {
    this.busy.set(false);
    this.toast.show(this.i18n.t(messageKey), { type: 'success' });
    this.lines.update(rows => rows.map(r => (r.id === updated.id ? updated : r)));
    this.select(updated);
    this.load();
  }

  // Display
  accountName(id: string): string {
    return this.accounts().find(a => a.id === id)?.name ?? '—';
  }

  statusBadge(s: BankTxStatus): string {
    return s === 'MATCHED' ? 'badge-success' : s === 'UNMATCHED' ? 'badge-warning' : 'badge-neutral';
  }

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
