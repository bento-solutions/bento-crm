import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { ApiService } from '../../services/api.service';
import {
  AGING_KEYS, PartnerSide, PartnerStatement, StatementLine, StatementsApi, agingBucket,
} from '../../services/domains/statements.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { defaultPeriod } from '../../shared/ledger.util';
import { errorDetail, sideAmount, sourceLabel, sourceRoute } from '../ledger/ledger-labels';

/**
 * A customer's or supplier's statement from the ledger: the period's opening balance, its lines
 * with a running balance (each linking to its document and journal entry), the closing balance,
 * the open documents with their aging, and the advances. "Download PDF" gives the "Relevé de
 * compte" to send to the partner. Used on the balances pages and on the partner page.
 */
@Component({
  selector: 'app-partner-statement',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3 no-print">
        @if (heading()) {
          <div class="me-auto min-w-0">
            <h3 class="card-title">{{ 'partnerStatement.title' | translate }}</h3>
            <p class="text-xs text-ink-3">{{ (type() === 'CUSTOMER' ? 'partnerStatement.hintCustomer' : 'partnerStatement.hintSupplier') | translate }}</p>
          </div>
        }
        <label class="block"><span class="field-label">{{ 'ledger.from' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="from()" (ngModelChange)="setPeriod($event, to())" /></label>
        <label class="block"><span class="field-label">{{ 'ledger.to' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="to()" (ngModelChange)="setPeriod(from(), $event)" /></label>
        <button class="btn-secondary" [class.ms-auto]="!heading()" [disabled]="busy() || !statement()" (click)="downloadPdf()">
          <mat-icon>picture_as_pdf</mat-icon>{{ 'partnerStatement.downloadPdf' | translate }}</button>
      </div>

      @if (statement(); as s) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-surface border border-line rounded-xl p-3">
            <span class="eyebrow block">{{ 'partnerStatement.opening' | translate }}</span>
            <span class="text-lg num text-ink">{{ money(s.opening) }}</span>
            <span class="block text-xs text-ink-3">{{ date(s.from) }}</span>
          </div>
          <div class="bg-surface border border-line rounded-xl p-3">
            <span class="eyebrow block">{{ 'partnerStatement.closing' | translate }}</span>
            <span class="text-lg num" [class.text-ink]="s.closing >= 0" [class.text-danger-ink]="s.closing < 0">{{ money(s.closing) }}</span>
            <span class="block text-xs text-ink-3">{{ closingHint(s.closing) | translate }}</span>
          </div>
          <div class="bg-surface border border-line rounded-xl p-3">
            <span class="eyebrow block">{{ 'partnerStatement.openDocuments' | translate }}</span>
            <span class="text-lg num text-ink">{{ money(openDue()) }}</span>
            <span class="block text-xs text-ink-3">{{ 'partnerStatement.documentsCount' | translate: { n: (s.openDocuments ?? []).length } }}</span>
          </div>
          <div class="bg-surface border border-line rounded-xl p-3">
            <span class="eyebrow block">{{ 'partnerStatement.advances' | translate }}</span>
            <span class="text-lg num text-ink">{{ money(s.advances?.closing ?? 0) }}</span>
            <span class="block text-xs text-ink-3">{{ (type() === 'CUSTOMER' ? 'partnerStatement.advancesHintCustomer' : 'partnerStatement.advancesHintSupplier') | translate }}</span>
          </div>
        </div>

        <!-- Lines -->
        <div class="table-card">
          <div class="overflow-x-auto">
            <table class="data-table is-dense">
              <thead><tr>
                <th>{{ 'ledger.date' | translate }}</th>
                <th>{{ 'partnerStatement.document' | translate }}</th>
                <th>{{ 'ledger.label' | translate }}</th>
                <th>{{ 'partnerStatement.entry' | translate }}</th>
                <th class="col-num">{{ 'ledger.debit' | translate }}</th>
                <th class="col-num">{{ 'ledger.credit' | translate }}</th>
                <th class="col-num">{{ 'ledger.balance' | translate }}</th>
              </tr></thead>
              <tbody>
                <tr class="bg-subtle">
                  <td class="cell-muted whitespace-nowrap">{{ date(s.from) }}</td>
                  <td colspan="5" class="text-ink-2">{{ 'partnerStatement.opening' | translate }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(s.opening) }}</td>
                </tr>
                @for (l of s.lines ?? []; track $index) {
                  <tr>
                    <td class="cell-muted whitespace-nowrap">{{ date(l.date) }}</td>
                    <td class="whitespace-nowrap">
                      @if (docRoute(l); as r) {
                        <a class="text-accent-ink hover:underline" [routerLink]="r.path" [queryParams]="r.query">{{ l.documentNumber || source(l.sourceType) }}</a>
                      } @else { <span class="text-ink">{{ l.documentNumber || source(l.sourceType) }}</span> }
                    </td>
                    <td class="min-w-48 text-ink">{{ l.label || '—' }}</td>
                    <td class="whitespace-nowrap">
                      @if (l.entryId) {
                        <a class="num text-ink hover:underline" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: l.entryId }">{{ l.entryNumber || ('ledger.viewEntry' | translate) }}</a>
                        @if (l.journalCode) { <span class="chip ms-1">{{ l.journalCode }}</span> }
                      } @else { <span class="cell-muted">—</span> }
                    </td>
                    <td class="col-num num whitespace-nowrap">{{ side(l.debit) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ side(l.credit) }}</td>
                    <td class="col-num num whitespace-nowrap">{{ money(l.balance) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="text-sm text-ink-3 text-center py-6">{{ 'partnerStatement.noLines' | translate }}</td></tr>
                }
                <tr class="bg-subtle font-medium">
                  <td class="whitespace-nowrap">{{ date(s.to) }}</td>
                  <td colspan="3" class="text-ink">{{ 'partnerStatement.closing' | translate }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(totalDebit()) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(totalCredit()) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(s.closing) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Open documents -->
        @if (s.openDocuments?.length) {
          <section class="table-card">
            <div class="px-5 py-3 border-b border-line flex flex-wrap items-baseline gap-3">
              <h4 class="text-sm font-semibold text-ink">{{ 'partnerStatement.openDocuments' | translate }}</h4>
              <div class="flex flex-wrap gap-1.5 ms-auto">
                @for (k of agingKeys; track k) {
                  @if (agingTotals()[k]) {
                    <span class="badge" [class]="agingClass(k)">{{ ('partnerBalances.aging.' + k) | translate }} · <span class="num">{{ money(agingTotals()[k]) }}</span></span>
                  }
                }
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="data-table is-dense">
                <thead><tr>
                  <th>{{ 'partnerStatement.document' | translate }}</th>
                  <th>{{ 'ledger.date' | translate }}</th>
                  <th>{{ 'partnerStatement.dueDate' | translate }}</th>
                  <th class="col-num">{{ 'partnerStatement.total' | translate }}</th>
                  <th class="col-num">{{ 'partnerStatement.due' | translate }}</th>
                  <th>{{ 'partnerStatement.aging' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (d of s.openDocuments; track d.id) {
                    <tr>
                      <td class="whitespace-nowrap">
                        @if (docTypeRoute(d.type); as r) {
                          <a class="cell-title text-accent-ink hover:underline" [routerLink]="r.path" [queryParams]="r.query">{{ d.number || source(d.type) }}</a>
                        } @else { <span class="cell-title">{{ d.number || source(d.type) }}</span> }
                      </td>
                      <td class="cell-muted whitespace-nowrap">{{ date(d.date) }}</td>
                      <td class="cell-muted whitespace-nowrap">{{ date(d.dueDate) }}</td>
                      <td class="col-num num whitespace-nowrap">{{ money(d.total) }}</td>
                      <td class="col-num num whitespace-nowrap">{{ money(d.due) }}</td>
                      <td class="whitespace-nowrap">
                        <span class="badge" [class]="agingClass(bucket(d.daysOverdue))">
                          @if (d.daysOverdue > 0) { {{ 'partnerStatement.daysOverdue' | translate: { n: d.daysOverdue } }} }
                          @else { {{ 'partnerBalances.aging.current' | translate }} }
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- Advances -->
        @if (s.advances && (s.advances.lines?.length || s.advances.opening || s.advances.closing)) {
          <section class="table-card">
            <div class="px-5 py-3 border-b border-line">
              <h4 class="text-sm font-semibold text-ink">{{ 'partnerStatement.advancesTitle' | translate }}</h4>
              <p class="text-xs text-ink-3">{{ (type() === 'CUSTOMER' ? 'partnerStatement.advancesHintCustomer' : 'partnerStatement.advancesHintSupplier') | translate }}</p>
            </div>
            <div class="overflow-x-auto">
              <table class="data-table is-dense">
                <thead><tr>
                  <th>{{ 'ledger.date' | translate }}</th>
                  <th>{{ 'partnerStatement.document' | translate }}</th>
                  <th>{{ 'ledger.label' | translate }}</th>
                  <th class="col-num">{{ 'ledger.debit' | translate }}</th>
                  <th class="col-num">{{ 'ledger.credit' | translate }}</th>
                  <th class="col-num">{{ 'ledger.balance' | translate }}</th>
                </tr></thead>
                <tbody>
                  <tr class="bg-subtle">
                    <td class="cell-muted whitespace-nowrap">{{ date(s.from) }}</td>
                    <td colspan="4" class="text-ink-2">{{ 'partnerStatement.opening' | translate }}</td>
                    <td class="col-num num whitespace-nowrap">{{ money(s.advances.opening) }}</td>
                  </tr>
                  @for (l of s.advances.lines ?? []; track $index) {
                    <tr>
                      <td class="cell-muted whitespace-nowrap">{{ date(l.date) }}</td>
                      <td class="whitespace-nowrap">
                        @if (l.entryId) {
                          <a class="text-accent-ink hover:underline" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: l.entryId }">{{ l.documentNumber || l.entryNumber || source(l.sourceType) }}</a>
                        } @else { {{ l.documentNumber || source(l.sourceType) }} }
                      </td>
                      <td class="min-w-48 text-ink">{{ l.label || '—' }}</td>
                      <td class="col-num num whitespace-nowrap">{{ side(l.debit) }}</td>
                      <td class="col-num num whitespace-nowrap">{{ side(l.credit) }}</td>
                      <td class="col-num num whitespace-nowrap">{{ money(l.balance) }}</td>
                    </tr>
                  }
                  <tr class="bg-subtle font-medium">
                    <td class="whitespace-nowrap">{{ date(s.to) }}</td>
                    <td colspan="4" class="text-ink">{{ 'partnerStatement.closing' | translate }}</td>
                    <td class="col-num num whitespace-nowrap">{{ money(s.advances.closing) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        }
      } @else {
        <p class="text-sm text-ink-3 py-6 text-center">{{ (loading() ? 'ledger.loading' : 'partnerStatement.unavailable') | translate }}</p>
      }
    </div>
  `,
})
export class PartnerStatementComponent {
  private api = inject(StatementsApi);
  private files = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);

  partnerId = input.required<string>();
  type = input.required<PartnerSide>();
  /** The period to open with; the current year to date by default. */
  initialFrom = input<string | null>(null);
  initialTo = input<string | null>(null);
  /** Shows the "Statement" title and hint (on the partner page). */
  heading = input(false);
  /** The statement was loaded (the page uses the partner's name as its title). */
  loaded = output<PartnerStatement>();

  readonly agingKeys = AGING_KEYS;

  from = signal(defaultPeriod().from);
  to = signal(defaultPeriod().to);
  statement = signal<PartnerStatement | null>(null);
  loading = signal(true);
  busy = signal(false);

  totalDebit = computed(() => (this.statement()?.lines ?? []).reduce((a, l) => a + (Number(l.debit) || 0), 0));
  totalCredit = computed(() => (this.statement()?.lines ?? []).reduce((a, l) => a + (Number(l.credit) || 0), 0));
  openDue = computed(() => (this.statement()?.openDocuments ?? []).reduce((a, d) => a + (Number(d.due) || 0), 0));
  agingTotals = computed(() => {
    const t: Record<string, number> = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
    for (const d of this.statement()?.openDocuments ?? []) t[agingBucket(d.daysOverdue)] += Number(d.due) || 0;
    return t;
  });

  constructor() {
    effect(() => {
      const id = this.partnerId();
      const type = this.type();
      const f = this.initialFrom();
      const t = this.initialTo();
      untracked(() => {
        if (f) this.from.set(f);
        if (t) this.to.set(t);
        if (id && type) this.load();
      });
    });
  }

  setPeriod(from: string, to: string): void {
    if (!from || !to || from > to) {
      this.from.set(from || this.from());
      this.to.set(to || this.to());
      return;
    }
    this.from.set(from);
    this.to.set(to);
    this.load();
  }

  load(): void {
    const id = this.partnerId();
    this.loading.set(true);
    this.api.statement(id, this.type(), this.from(), this.to()).subscribe({
      next: s => {
        if (id !== this.partnerId()) return;
        this.statement.set(s);
        this.loading.set(false);
        if (s) this.loaded.emit(s);
      },
      error: e => {
        this.statement.set(null);
        this.loading.set(false);
        this.fail(e);
      },
    });
  }

  downloadPdf(): void {
    const s = this.statement();
    this.busy.set(true);
    this.api.statementPdf(this.partnerId(), this.type(), this.from(), this.to()).subscribe({
      next: blob => {
        this.busy.set(false);
        const name = (s?.partner?.name ?? 'partenaire').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
        this.files.downloadBlob(blob, `releve-${name || 'partenaire'}-${this.from()}-${this.to()}.pdf`);
      },
      error: e => { this.busy.set(false); this.fail(e); },
    });
  }

  /** The closing balance in words: who owes whom. */
  closingHint(v: number): string {
    const n = Math.round((Number(v) || 0) * 100);
    if (n === 0) return 'partnerStatement.settled';
    if (this.type() === 'CUSTOMER') return n > 0 ? 'partnerStatement.owesUs' : 'partnerStatement.weOweCustomer';
    return n > 0 ? 'partnerStatement.weOwe' : 'partnerStatement.owesUsSupplier';
  }

  docRoute(l: StatementLine): { path: string; query: Record<string, string> } | null {
    return sourceRoute(l.sourceType);
  }

  docTypeRoute(type: string): { path: string; query: Record<string, string> } | null {
    return sourceRoute((type ?? '').toUpperCase());
  }

  bucket(days: number): string { return agingBucket(days); }

  agingClass(k: string): string {
    switch (k) {
      case 'current': return 'badge-neutral';
      case 'd30': return 'badge-info';
      case 'd60': return 'badge-warning';
      default: return 'badge-danger';
    }
  }

  source(s: string | null | undefined): string { return sourceLabel(this.i18n, s); }
  money(v: number | null | undefined): string { return formatMoney(v); }
  side(v: number | null | undefined): string { return sideAmount(v); }
  date(iso: string | null | undefined): string { return shortDate(iso); }

  private fail(e: unknown): void {
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' });
  }
}
