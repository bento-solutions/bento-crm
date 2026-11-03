import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ApiService } from '../../services/api.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ClosingApi, FiscalYear } from '../../services/domains/closing.service';
import {
  Bilan, BilanSection, Cpc, StatementsApi, fiscalYearOf, fiscalYearRange, plainAmount, rubricRange, yearChoices,
} from '../../services/domains/statements.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { isoDate } from '../../shared/ledger.util';
import { errorDetail } from './ledger-labels';

type Kind = 'bilan' | 'cpc';

/** What a click on a rubric asks the page for: the general ledger on that account range. */
export interface LedgerRangeRequest {
  from: string;
  to: string;
  accountFrom: string;
  accountTo: string;
}

/** One displayed line of a bilan side. */
interface BilanLine {
  kind: 'section' | 'row' | 'total';
  code?: string | null;
  label: string;
  gross?: number | null;
  amortProv?: number | null;
  net?: number | null;
  netPrior?: number | null;
  range: { from: string; to: string } | null;
}

/** One displayed line of the CPC: a section heading, a rubric, a section total, or a result (III, VI…). */
interface CpcLine {
  kind: 'section' | 'row' | 'total' | 'result';
  code?: string | null;
  label: string;
  current?: number | null;
  prior?: number | null;
  range: { from: string; to: string } | null;
}

const num = (v: unknown): number => Number(v) || 0;

function bilanLines(sections: BilanSection[] | null | undefined): BilanLine[] {
  const out: BilanLine[] = [];
  for (const s of sections ?? []) {
    const rows = s.rows ?? [];
    const t = s.total ?? {
      gross: s.totalGross ?? rows.reduce((a, r) => a + num(r.gross), 0),
      amortProv: s.totalAmortProv ?? rows.reduce((a, r) => a + num(r.amortProv), 0),
      net: s.totalNet ?? rows.reduce((a, r) => a + num(r.net), 0),
      netPrior: s.totalNetPrior ?? rows.reduce((a, r) => a + num(r.netPrior), 0),
    };
    if (!rows.length) {
      out.push({ kind: 'row', code: s.code, label: s.label, ...t, range: rubricRange(s.code) });
      continue;
    }
    out.push({ kind: 'section', code: s.code, label: s.label, range: rubricRange(s.code) });
    for (const r of rows) out.push({ kind: 'row', ...r, range: rubricRange(r.code) });
    out.push({ kind: 'total', label: s.label, ...t, range: null });
  }
  return out;
}

function cpcLines(c: Cpc | null): CpcLine[] {
  if (!c) return [];
  const out: CpcLine[] = [];
  if (c.sections?.length) {
    for (const s of c.sections) {
      const rows = s.rows ?? [];
      const current = s.total ?? s.current ?? rows.reduce((a, r) => a + num(r.current), 0);
      const prior = s.totalPrior ?? s.prior ?? rows.reduce((a, r) => a + num(r.prior), 0);
      if (!rows.length) {
        out.push({ kind: 'result', code: s.code, label: s.label, current, prior, range: null });
        continue;
      }
      out.push({ kind: 'section', code: s.code, label: s.label, range: null });
      for (const r of rows) out.push({ kind: 'row', code: r.code, label: r.label, current: r.current, prior: r.prior, range: rubricRange(r.code) });
      out.push({ kind: 'total', code: s.code, label: s.label, current, prior, range: null });
    }
    return out;
  }
  for (const r of c.rows ?? []) {
    const k = (r.kind ?? 'ROW').toUpperCase();
    const kind: CpcLine['kind'] = k === 'RESULT' || k === 'SUBTOTAL' ? 'result' : k === 'SECTION' || k === 'TOTAL' ? 'total' : 'row';
    out.push({ kind, code: r.code, label: r.label, current: r.current, prior: r.prior, range: kind === 'row' ? rubricRange(r.code) : null });
  }
  return out;
}

/**
 * General Ledger → Financial statements: the bilan (Actif / Passif) and the CPC in the CGNC
 * format, for a fiscal year, with the prior year beside it. Rubric labels come from the API in
 * French and stay as they are in every language. A rubric opens the general ledger on its accounts.
 */
@Component({
  selector: 'app-ledger-statements',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  styles: [`
    .fs-bilan { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); align-items: start; }
    @media (min-width: 1280px) { .fs-bilan { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
    .fs-section td { padding-top: 14px; }
    .fs-total td { font-weight: 600; }
    .fs-result td { font-weight: 600; background: var(--color-surface-hover); }
    .fs-grand td { font-weight: 600; border-top: 2px solid var(--color-border-strong, var(--color-border)); }
    .fs-link { text-align: start; color: inherit; }
    .fs-link:hover { text-decoration: underline; }
    .fs-print-head { display: none; }
    @media print {
      .fs-bilan { grid-template-columns: minmax(0, 1fr); }
      .fs-print-head { display: block; margin-bottom: 12px; }
      .fs-block { break-inside: avoid; }
      .fs-link { text-decoration: none; }
    }
  `],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3 no-print">
        <label class="block"><span class="field-label">{{ 'ledger.statements.year' | translate }}</span>
          <select class="input-field" [ngModel]="year()" (ngModelChange)="setYear($event)">
            @for (y of years(); track y.year) { <option [ngValue]="y.year">{{ yearLabel(y) }}</option> }
          </select></label>
        <div class="block">
          <span class="field-label">{{ 'ledger.statements.statement' | translate }}</span>
          <div class="segmented" role="group" [attr.aria-label]="'ledger.statements.statement' | translate">
            <button class="segmented__item" [class.is-active]="kind() === 'bilan'" [attr.aria-pressed]="kind() === 'bilan'" (click)="setKind('bilan')">{{ 'ledger.statements.bilan' | translate }}</button>
            <button class="segmented__item" [class.is-active]="kind() === 'cpc'" [attr.aria-pressed]="kind() === 'cpc'" (click)="setKind('cpc')">{{ 'ledger.statements.cpc' | translate }}</button>
          </div>
        </div>
        @if (kind() === 'bilan') {
          <label class="block"><span class="field-label">{{ 'ledger.statements.asOf' | translate }}</span>
            <input type="date" class="input-field" [ngModel]="asOf()" (ngModelChange)="asOf.set($event || ''); load()" /></label>
        } @else {
          <label class="block"><span class="field-label">{{ 'ledger.from' | translate }}</span>
            <input type="date" class="input-field" [ngModel]="cpcFrom()" (ngModelChange)="cpcFrom.set($event || ''); load()" /></label>
          <label class="block"><span class="field-label">{{ 'ledger.to' | translate }}</span>
            <input type="date" class="input-field" [ngModel]="cpcTo()" (ngModelChange)="cpcTo.set($event || ''); load()" /></label>
        }
        <label class="flex items-center gap-2 text-sm text-ink h-9">
          <input type="checkbox" [ngModel]="comparative()" (ngModelChange)="comparative.set($event); load()" />
          {{ 'ledger.statements.compare' | translate }}
        </label>
        <div class="flex gap-2 ms-auto">
          <button class="btn-secondary" [disabled]="busy() || !hasData()" (click)="downloadExcel()"><mat-icon>download</mat-icon>{{ 'ledger.statements.downloadExcel' | translate }}</button>
          <button class="btn-secondary" [disabled]="!hasData()" (click)="print()"><mat-icon>print</mat-icon>{{ 'ledger.statements.print' | translate }}</button>
        </div>
      </div>

      <div class="fs-print-head">
        <div class="text-sm text-ink-3">{{ orgName() }}</div>
        <h2 class="text-xl font-semibold text-ink">{{ title() }}</h2>
      </div>

      @if (kind() === 'bilan' && bilan(); as b) {
        @if (!b.balanced) {
          <div class="alert alert-danger text-sm"><mat-icon>error</mat-icon>
            <span>{{ 'ledger.statements.unbalanced' | translate: { actif: money(b.totalActif), passif: money(b.totalPassif) } }}</span></div>
        }
        @if (b.warnings?.length) {
          <div class="alert alert-warning text-sm"><mat-icon>warning</mat-icon>
            <div class="min-w-0">
              <div class="font-medium">{{ 'ledger.statements.warningsTitle' | translate }}</div>
              <ul class="mt-1 space-y-0.5">
                @for (w of b.warnings; track w.accountCode) {
                  <li><span class="num">{{ w.accountCode }}</span>@if (w.accountName) { · {{ w.accountName }} } · <span class="num">{{ money(w.balance) }}</span> — {{ w.message }}</li>
                }
              </ul>
            </div>
          </div>
        }

        <div class="fs-bilan">
          <!-- Actif -->
          <section class="table-card fs-block">
            <div class="px-5 py-3 border-b border-line flex items-baseline gap-3">
              <h3 class="card-title">{{ 'ledger.statements.actif' | translate }}</h3>
              <span class="text-xs text-ink-3 ms-auto">{{ 'ledger.statements.asOfDate' | translate: { date: date(b.asOf) } }} · {{ 'ledger.statements.inMad' | translate }}</span>
            </div>
            <div class="overflow-x-auto">
              <table class="data-table is-dense">
                <thead><tr>
                  <th>{{ 'ledger.statements.rubric' | translate }}</th>
                  <th class="col-num">{{ 'ledger.statements.gross' | translate }}</th>
                  <th class="col-num">{{ 'ledger.statements.amortProv' | translate }}</th>
                  <th class="col-num">{{ 'ledger.statements.net' | translate }}</th>
                  @if (b.priorAsOf || comparative()) { <th class="col-num">{{ 'ledger.statements.netPrior' | translate }}</th> }
                </tr></thead>
                <tbody>
                  @for (l of actif(); track $index) {
                    <tr [class.fs-section]="l.kind === 'section'" [class.fs-total]="l.kind === 'total'" [class.bg-subtle]="l.kind === 'total'">
                      @if (l.kind === 'section') {
                        <td [attr.colspan]="actifCols()" class="text-ink font-medium">{{ l.label }}</td>
                      } @else {
                        <td class="min-w-48" [class.ps-6]="l.kind === 'row'">
                          @if (l.kind === 'total') { {{ 'ledger.statements.totalOf' | translate: { label: l.label } }} }
                          @else if (l.range) {
                            <button type="button" class="fs-link" (click)="openRange(l.range)" [title]="'ledger.statements.openLedger' | translate">
                              @if (l.code) { <span class="num text-ink-3 me-1">{{ l.code }}</span> }{{ l.label }}</button>
                          } @else { @if (l.code) { <span class="num text-ink-3 me-1">{{ l.code }}</span> }{{ l.label }} }
                        </td>
                        <td class="col-num num whitespace-nowrap">{{ amount(l.gross) }}</td>
                        <td class="col-num num whitespace-nowrap">{{ amount(l.amortProv) }}</td>
                        <td class="col-num num whitespace-nowrap">{{ amount(l.net) }}</td>
                        @if (b.priorAsOf || comparative()) { <td class="col-num num whitespace-nowrap text-ink-2">{{ amount(l.netPrior) }}</td> }
                      }
                    </tr>
                  }
                  <tr class="fs-grand bg-subtle">
                    <td>{{ 'ledger.statements.totalActif' | translate }}</td>
                    <td class="col-num"></td><td class="col-num"></td>
                    <td class="col-num num whitespace-nowrap">{{ amount(b.totalActif) }}</td>
                    @if (b.priorAsOf || comparative()) { <td class="col-num num whitespace-nowrap">{{ amount(b.totalActifPrior) }}</td> }
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Passif -->
          <section class="table-card fs-block">
            <div class="px-5 py-3 border-b border-line flex items-baseline gap-3">
              <h3 class="card-title">{{ 'ledger.statements.passif' | translate }}</h3>
              <span class="text-xs text-ink-3 ms-auto">{{ 'ledger.statements.asOfDate' | translate: { date: date(b.asOf) } }} · {{ 'ledger.statements.inMad' | translate }}</span>
            </div>
            <div class="overflow-x-auto">
              <table class="data-table is-dense">
                <thead><tr>
                  <th>{{ 'ledger.statements.rubric' | translate }}</th>
                  <th class="col-num">{{ 'ledger.statements.net' | translate }}</th>
                  @if (b.priorAsOf || comparative()) { <th class="col-num">{{ 'ledger.statements.netPrior' | translate }}</th> }
                </tr></thead>
                <tbody>
                  @for (l of passif(); track $index) {
                    <tr [class.fs-section]="l.kind === 'section'" [class.fs-total]="l.kind === 'total'" [class.bg-subtle]="l.kind === 'total'">
                      @if (l.kind === 'section') {
                        <td [attr.colspan]="passifCols()" class="text-ink font-medium">{{ l.label }}</td>
                      } @else {
                        <td class="min-w-48" [class.ps-6]="l.kind === 'row'">
                          @if (l.kind === 'total') { {{ 'ledger.statements.totalOf' | translate: { label: l.label } }} }
                          @else if (l.range) {
                            <button type="button" class="fs-link" (click)="openRange(l.range)" [title]="'ledger.statements.openLedger' | translate">
                              @if (l.code) { <span class="num text-ink-3 me-1">{{ l.code }}</span> }{{ l.label }}</button>
                          } @else { @if (l.code) { <span class="num text-ink-3 me-1">{{ l.code }}</span> }{{ l.label }} }
                        </td>
                        <td class="col-num num whitespace-nowrap">{{ amount(l.net) }}</td>
                        @if (b.priorAsOf || comparative()) { <td class="col-num num whitespace-nowrap text-ink-2">{{ amount(l.netPrior) }}</td> }
                      }
                    </tr>
                  }
                  <tr class="fs-grand bg-subtle">
                    <td>{{ 'ledger.statements.totalPassif' | translate }}</td>
                    <td class="col-num num whitespace-nowrap">{{ amount(b.totalPassif) }}</td>
                    @if (b.priorAsOf || comparative()) { <td class="col-num num whitespace-nowrap">{{ amount(b.totalPassifPrior) }}</td> }
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      } @else if (kind() === 'cpc' && cpc(); as c) {
        <section class="table-card fs-block">
          <div class="px-5 py-3 border-b border-line flex flex-wrap items-baseline gap-3">
            <h3 class="card-title">{{ 'ledger.statements.cpcTitle' | translate }}</h3>
            <span class="text-xs text-ink-3 ms-auto">{{ date(c.from) }} – {{ date(c.to) }} · {{ 'ledger.statements.inMad' | translate }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table is-dense">
              <thead><tr>
                <th>{{ 'ledger.statements.rubric' | translate }}</th>
                <th class="col-num">{{ 'ledger.statements.current' | translate }}</th>
                @if (showPrior()) { <th class="col-num">{{ 'ledger.statements.prior' | translate }}</th> }
              </tr></thead>
              <tbody>
                @for (l of cpcRows(); track $index) {
                  <tr [class.fs-section]="l.kind === 'section'" [class.fs-total]="l.kind === 'total'" [class.bg-subtle]="l.kind === 'total'" [class.fs-result]="l.kind === 'result'">
                    @if (l.kind === 'section') {
                      <td [attr.colspan]="showPrior() ? 3 : 2" class="text-ink font-medium">@if (l.code) { <span class="me-1">{{ l.code }}.</span> }{{ l.label }}</td>
                    } @else {
                      <td class="min-w-48" [class.ps-6]="l.kind === 'row'">
                        @if (l.kind === 'total') { {{ 'ledger.statements.totalOf' | translate: { label: (l.code ? l.code + '. ' : '') + l.label } }} }
                        @else if (l.range) {
                          <button type="button" class="fs-link" (click)="openRange(l.range)" [title]="'ledger.statements.openLedger' | translate">
                            @if (l.code) { <span class="num text-ink-3 me-1">{{ l.code }}</span> }{{ l.label }}</button>
                        } @else { @if (l.code) { <span class="me-1" [class.num]="l.kind === 'row'" [class.text-ink-3]="l.kind === 'row'">{{ l.code }}@if (l.kind === 'result') {.}</span> }{{ l.label }} }
                      </td>
                      <td class="col-num num whitespace-nowrap" [class.text-danger-ink]="l.kind === 'result' && (l.current ?? 0) < 0">{{ amount(l.current) }}</td>
                      @if (showPrior()) { <td class="col-num num whitespace-nowrap text-ink-2">{{ amount(l.prior) }}</td> }
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else {
        <div class="table-card">
          <app-empty-state icon="account_balance" [title]="(loading() ? 'ledger.loading' : 'ledger.statements.emptyTitle') | translate"
                           [text]="loading() ? '' : ('ledger.statements.emptyText' | translate)" />
        </div>
      }
    </div>
  `,
})
export class LedgerStatementsComponent implements OnInit {
  private api = inject(StatementsApi);
  private closing = inject(ClosingApi);
  private files = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);

  /** A rubric was clicked: the page opens the general ledger on its account range. */
  openLedger = output<LedgerRangeRequest>();

  kind = signal<Kind>('bilan');
  years = signal<FiscalYear[]>([]);
  startMonth = signal(1);
  year = signal(new Date().getFullYear());
  asOf = signal('');
  cpcFrom = signal('');
  cpcTo = signal('');
  comparative = signal(true);

  bilan = signal<Bilan | null>(null);
  cpc = signal<Cpc | null>(null);
  loading = signal(true);
  busy = signal(false);

  actif = computed(() => bilanLines(this.bilan()?.actif));
  passif = computed(() => bilanLines(this.bilan()?.passif));
  cpcRows = computed(() => cpcLines(this.cpc()));
  actifCols = computed(() => (this.bilan()?.priorAsOf || this.comparative()) ? 5 : 4);
  passifCols = computed(() => (this.bilan()?.priorAsOf || this.comparative()) ? 3 : 2);
  showPrior = computed(() => this.comparative() || !!this.cpc()?.priorFrom);
  hasData = computed(() => this.kind() === 'bilan' ? !!this.bilan() : !!this.cpc());
  orgName = computed(() => this.state.organization()?.name ?? '');
  /** The fiscal year's first and last days. */
  range = computed(() => fiscalYearRange(this.year(), this.startMonth(), this.years().find(y => y.year === this.year())));
  title = computed(() => {
    if (this.kind() === 'bilan') {
      return this.i18n.t('ledger.statements.bilanTitle', { date: this.date(this.bilan()?.asOf ?? (this.asOf() || this.range().to)) });
    }
    const c = this.cpc();
    return `${this.i18n.t('ledger.statements.cpcTitle')} — ${this.date(c?.from ?? this.range().from)} – ${this.date(c?.to ?? this.range().to)}`;
  });

  ngOnInit(): void {
    const today = isoDate(new Date());
    this.closing.settings().subscribe({
      next: s => {
        this.startMonth.set(s?.fiscalYearStartMonth || 1);
        this.loadYears(today);
      },
      error: () => this.loadYears(today),
    });
  }

  private loadYears(today: string): void {
    this.closing.years().subscribe({
      next: list => this.initYears(list, today),
      error: () => this.initYears([], today),
    });
  }

  private initYears(list: FiscalYear[] | null, today: string): void {
    const current = fiscalYearOf(today, this.startMonth(), list ?? []);
    this.years.set(yearChoices(list, current));
    this.year.set(current);
    this.load();
  }

  yearLabel(y: FiscalYear): string {
    const r = fiscalYearRange(y.year, this.startMonth(), y);
    const label = r.from.slice(5) === '01-01' ? String(y.year) : `${y.year}/${y.year + 1}`;
    return y.status === 'CLOSED' ? `${label} · ${this.i18n.t('ledger.closing.yearStatusName.CLOSED')}` : label;
  }

  setYear(y: number): void {
    this.year.set(Number(y));
    this.asOf.set('');
    this.cpcFrom.set('');
    this.cpcTo.set('');
    this.load();
  }

  setKind(k: Kind): void {
    if (k === this.kind()) return;
    this.kind.set(k);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const done = () => this.loading.set(false);
    if (this.kind() === 'bilan') {
      this.bilan.set(null);
      this.api.bilan(this.year(), this.asOf() || null, this.comparative()).subscribe({
        next: b => { this.bilan.set(b); done(); },
        error: e => { done(); this.fail(e); },
      });
    } else {
      this.cpc.set(null);
      this.api.cpc(this.year(), this.cpcFrom() || null, this.cpcTo() || null, this.comparative()).subscribe({
        next: c => { this.cpc.set(c); done(); },
        error: e => { done(); this.fail(e); },
      });
    }
  }

  downloadExcel(): void {
    this.busy.set(true);
    const bilan = this.kind() === 'bilan';
    const call = bilan
      ? this.api.bilanXlsx(this.year(), this.asOf() || null, this.comparative())
      : this.api.cpcXlsx(this.year(), this.cpcFrom() || null, this.cpcTo() || null, this.comparative());
    const name = bilan
      ? `bilan-${this.bilan()?.asOf ?? this.year()}.xlsx`
      : `cpc-${this.cpc()?.from ?? this.year()}-${this.cpc()?.to ?? ''}.xlsx`.replace('-.xlsx', '.xlsx');
    call.subscribe({
      next: blob => { this.busy.set(false); this.files.downloadBlob(blob, name); },
      error: e => { this.busy.set(false); this.fail(e); },
    });
  }

  print(): void {
    window.print();
  }

  /** The general ledger on a rubric's accounts, over the statement's period. */
  openRange(r: { from: string; to: string }): void {
    const period = this.kind() === 'bilan'
      ? { from: this.range().from, to: this.bilan()?.asOf ?? this.range().to }
      : { from: this.cpc()?.from ?? this.range().from, to: this.cpc()?.to ?? this.range().to };
    this.openLedger.emit({ ...period, accountFrom: r.from, accountTo: r.to });
  }

  /** A statement amount: blank when the API left it out, so liability rows show no gross column. */
  amount(v: number | null | undefined): string {
    return plainAmount(v);
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  date(iso: string | null | undefined): string { return shortDate(iso); }

  private fail(e: unknown): void {
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' });
  }
}
