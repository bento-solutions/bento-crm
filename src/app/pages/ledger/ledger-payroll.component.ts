import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import { PayrollApi, PayrollRun, PayrollRunRequest, monthEnd, payrollNet } from '../../services/domains/payroll.service';
import { round2 } from '../../services/domains/vat';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { errorDetail } from './ledger-labels';

interface SplitRow { uid: number; costCenterId: string | null; percent: number | null }

interface PayrollForm {
  id?: string;
  period: string;
  date: string;
  /** The date was typed by hand, so a new period does not overwrite it. */
  dateManual: boolean;
  grossSalaries: number | null;
  employeeSocial: number | null;
  incomeTax: number | null;
  otherDeductions: number | null;
  employerSocial: number | null;
  notes: string;
  splits: SplitRow[];
}

interface PreviewLine { account: string; label: string; costCenter?: string | null; debit: number; credit: number }

let nextUid = 0;

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * General Ledger → Payroll: the month's payroll totals as the payroll provider gives them (no
 * payroll calculation). Each run posts one OD entry: 6171 and 6174 debited (split by cost center
 * when asked), 4441, 4452 and 4432 credited. The bank transfers then clear those accounts.
 */
@Component({
  selector: 'app-ledger-payroll',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'ledger.vat.year' | translate }}</span>
          <select class="input-field" [ngModel]="year()" (ngModelChange)="year.set(+$event); load()">
            @for (y of yearOptions; track y) { <option [ngValue]="y">{{ y }}</option> }
          </select></label>
        @if (canWrite()) {
          <button class="btn-primary ms-auto" (click)="openForm()"><mat-icon>add</mat-icon>{{ 'ledger.payroll.new' | translate }}</button>
        }
      </div>

      <div class="alert alert-info text-sm">
        <mat-icon>info</mat-icon>
        <span>{{ 'ledger.payroll.help' | translate }}</span>
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'ledger.payroll.period' | translate }}</th>
              <th class="col-num">{{ 'ledger.payroll.gross' | translate }}</th>
              <th class="col-num">{{ 'ledger.payroll.net' | translate }}</th>
              <th class="col-num hidden md:table-cell">{{ 'ledger.payroll.employeeSocial' | translate }}</th>
              <th class="col-num hidden md:table-cell">{{ 'ledger.payroll.employerSocial' | translate }}</th>
              <th class="col-num hidden sm:table-cell">{{ 'ledger.payroll.incomeTax' | translate }}</th>
              <th>{{ 'ledger.payroll.entry' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (r of runs(); track r.id) {
                <tr>
                  <td>
                    <div class="cell-title">{{ periodLabel(r.period) }}</div>
                    <div class="cell-sub">{{ date(r.date) }}</div>
                  </td>
                  <td class="col-num num whitespace-nowrap">{{ money(r.grossSalaries) }}</td>
                  <td class="col-num num whitespace-nowrap">{{ money(r.netPay) }}</td>
                  <td class="col-num num whitespace-nowrap hidden md:table-cell">{{ money(r.employeeSocial) }}</td>
                  <td class="col-num num whitespace-nowrap hidden md:table-cell">{{ money(r.employerSocial) }}</td>
                  <td class="col-num num whitespace-nowrap hidden sm:table-cell">{{ money(r.incomeTax) }}</td>
                  <td>
                    @if (r.entryId) {
                      <a class="text-accent-ink hover:underline text-sm" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: r.entryId }">{{ 'ledger.payroll.viewEntry' | translate }}</a>
                    } @else { — }
                  </td>
                  <td class="col-actions whitespace-nowrap">
                    @if (canWrite()) {
                      <button class="btn-icon btn-sm" (click)="openForm(r)" [attr.aria-label]="'bank.edit' | translate"><mat-icon class="icon-sm">edit</mat-icon></button>
                      <button class="btn-icon btn-sm" [disabled]="busy()" (click)="remove(r)" [attr.aria-label]="'bank.delete' | translate"><mat-icon class="icon-sm">delete</mat-icon></button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="row-empty">
                  <app-empty-state icon="badge" [title]="'ledger.payroll.emptyTitle' | translate" [text]="'ledger.payroll.emptyText' | translate" />
                </td></tr>
              }
            </tbody>
            @if (runs().length) {
              <tfoot><tr class="font-semibold">
                <td>{{ 'ledger.payroll.total' | translate }}</td>
                <td class="col-num num whitespace-nowrap">{{ money(totals().gross) }}</td>
                <td class="col-num num whitespace-nowrap">{{ money(totals().net) }}</td>
                <td class="col-num num whitespace-nowrap hidden md:table-cell">{{ money(totals().employeeSocial) }}</td>
                <td class="col-num num whitespace-nowrap hidden md:table-cell">{{ money(totals().employerSocial) }}</td>
                <td class="col-num num whitespace-nowrap hidden sm:table-cell">{{ money(totals().incomeTax) }}</td>
                <td colspan="2"></td>
              </tr></tfoot>
            }
          </table>
        </div>
      </div>
    </div>

    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="payroll-form-title">
          <div class="modal-header">
            <h3 id="payroll-form-title" class="modal-title">{{ (f.id ? 'ledger.payroll.editTitle' : 'ledger.payroll.new') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'bank.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>

          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3" [disabled]="busy()">
            <label class="block"><span class="field-label">{{ 'ledger.payroll.period' | translate }}</span>
              <input type="month" class="input-field" [ngModel]="f.period" (ngModelChange)="setPeriod(f, $event)" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.payroll.date' | translate }}</span>
              <input type="date" class="input-field" [ngModel]="f.date" (ngModelChange)="f.date = $event; f.dateManual = true; touch()" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.payroll.gross' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field num" [ngModel]="f.grossSalaries" (ngModelChange)="f.grossSalaries = num($event); touch()" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.payroll.employeeSocial' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field num" [ngModel]="f.employeeSocial" (ngModelChange)="f.employeeSocial = num($event); touch()" />
              <span class="text-xs text-ink-3">{{ 'ledger.payroll.employeeSocialHint' | translate }}</span></label>
            <label class="block"><span class="field-label">{{ 'ledger.payroll.incomeTax' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field num" [ngModel]="f.incomeTax" (ngModelChange)="f.incomeTax = num($event); touch()" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.payroll.otherDeductions' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field num" [ngModel]="f.otherDeductions" (ngModelChange)="f.otherDeductions = num($event); touch()" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.payroll.employerSocial' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field num" [ngModel]="f.employerSocial" (ngModelChange)="f.employerSocial = num($event); touch()" />
              <span class="text-xs text-ink-3">{{ 'ledger.payroll.employerSocialHint' | translate }}</span></label>
            <div class="block">
              <span class="field-label">{{ 'ledger.payroll.net' | translate }}</span>
              <div class="input-field num bg-subtle" [class.text-danger-ink]="net() < 0">{{ money(net()) }}</div>
              <span class="text-xs text-ink-3">{{ 'ledger.payroll.netHint' | translate }}</span>
            </div>
          </fieldset>
          @if (net() < 0) { <p class="field-error">{{ 'ledger.payroll.negativeNet' | translate }}</p> }

          <!-- Cost center split -->
          <section class="space-y-2 border-t border-line pt-3">
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="text-sm font-semibold text-ink me-auto">{{ 'ledger.payroll.split' | translate }}</h4>
              <button class="btn-ghost btn-sm" [disabled]="busy() || !groups.costCenters().length" (click)="addSplit(f)"><mat-icon>add</mat-icon>{{ 'ledger.payroll.addSplit' | translate }}</button>
            </div>
            <p class="text-xs text-ink-3">{{ 'ledger.payroll.splitHint' | translate }}</p>
            @for (s of f.splits; track s.uid) {
              <div class="flex items-center gap-2">
                <select class="input-field flex-1 min-w-0" [ngModel]="s.costCenterId" (ngModelChange)="s.costCenterId = $event; touch()" [attr.aria-label]="'ledger.costCenter' | translate">
                  <option [ngValue]="null">{{ 'ledger.payroll.pickCostCenter' | translate }}</option>
                  @for (c of groups.costCenters(); track c.id) { <option [ngValue]="c.id">{{ c.code }} · {{ c.name }}</option> }
                </select>
                <input type="number" min="0" max="100" step="0.01" class="input-field w-24 text-end" [ngModel]="s.percent" (ngModelChange)="s.percent = num($event); touch()" [attr.aria-label]="'ledger.payroll.percent' | translate" />
                <span class="text-sm text-ink-3">%</span>
                <button class="btn-icon btn-sm" (click)="removeSplit(f, s)" [attr.aria-label]="'ledger.cutoff.remove' | translate"><mat-icon class="icon-sm">delete</mat-icon></button>
              </div>
            }
            @if (f.splits.length) {
              <p class="text-xs" [class.text-danger-ink]="splitTotal() > 100" [class.text-ink-3]="splitTotal() <= 100">{{ 'ledger.payroll.splitTotal' | translate: { n: splitTotal() } }}</p>
            }
          </section>

          <label class="block"><span class="field-label">{{ 'ledger.payroll.notes' | translate }}</span>
            <textarea class="input-field" rows="2" maxlength="2000" [(ngModel)]="f.notes"></textarea></label>

          <!-- Entry preview -->
          <section class="space-y-2 border-t border-line pt-3">
            <h4 class="text-sm font-semibold text-ink">{{ 'ledger.payroll.preview' | translate }}</h4>
            <div class="overflow-x-auto">
              <table class="data-table is-dense">
                <thead><tr>
                  <th>{{ 'ledger.account' | translate }}</th>
                  <th class="hidden sm:table-cell">{{ 'ledger.costCenter' | translate }}</th>
                  <th class="col-num">{{ 'ledger.debit' | translate }}</th>
                  <th class="col-num">{{ 'ledger.credit' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (l of preview(); track $index) {
                    <tr>
                      <td><span class="num">{{ l.account }}</span> <span class="text-ink-2">{{ l.label }}</span></td>
                      <td class="hidden sm:table-cell cell-muted">{{ l.costCenter || '' }}</td>
                      <td class="col-num num whitespace-nowrap">{{ l.debit ? money(l.debit) : '' }}</td>
                      <td class="col-num num whitespace-nowrap">{{ l.credit ? money(l.credit) : '' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="row-empty text-sm text-ink-3">{{ 'ledger.payroll.previewEmpty' | translate }}</td></tr>
                  }
                  @if (preview().length) {
                    <tr class="font-semibold">
                      <td>{{ 'ledger.payroll.total' | translate }}</td>
                      <td class="hidden sm:table-cell"></td>
                      <td class="col-num num whitespace-nowrap">{{ money(previewTotals().debit) }}</td>
                      <td class="col-num num whitespace-nowrap">{{ money(previewTotals().credit) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'bank.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !valid()" (click)="save(f)">{{ (f.id ? 'ledger.payroll.saveRepost' : 'ledger.payroll.post') | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LedgerPayrollComponent implements OnInit {
  private api = inject(PayrollApi);
  private state = inject(CrmStateService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private confirm = inject(ConfirmService);
  readonly groups = inject(LedgerGroupsStore);

  readonly yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  year = signal(new Date().getFullYear());
  runs = signal<PayrollRun[]>([]);
  busy = signal(false);
  form = signal<PayrollForm | null>(null);
  /** Bumped on each form edit, so the computed preview follows the plain form object. */
  private version = signal(0);

  totals = computed(() => this.runs().reduce((t, r) => ({
    gross: t.gross + (Number(r.grossSalaries) || 0),
    net: t.net + (Number(r.netPay) || 0),
    employeeSocial: t.employeeSocial + (Number(r.employeeSocial) || 0),
    employerSocial: t.employerSocial + (Number(r.employerSocial) || 0),
    incomeTax: t.incomeTax + (Number(r.incomeTax) || 0),
  }), { gross: 0, net: 0, employeeSocial: 0, employerSocial: 0, incomeTax: 0 }));

  net = computed(() => {
    this.version();
    const f = this.form();
    return f ? payrollNet({
      grossSalaries: f.grossSalaries ?? 0, employeeSocial: f.employeeSocial ?? 0,
      incomeTax: f.incomeTax ?? 0, otherDeductions: f.otherDeductions ?? 0,
    }) : 0;
  });

  splitTotal = computed(() => {
    this.version();
    return round2((this.form()?.splits ?? []).reduce((s, r) => s + (Number(r.percent) || 0), 0));
  });

  /** The entry the run will post, as the contract's table lays it out. */
  preview = computed<PreviewLine[]>(() => {
    this.version();
    const f = this.form();
    if (!f) return [];
    const gross = Number(f.grossSalaries) || 0;
    const employer = Number(f.employerSocial) || 0;
    const employee = Number(f.employeeSocial) || 0;
    const ir = Number(f.incomeTax) || 0;
    const other = Number(f.otherDeductions) || 0;
    const net = this.net();
    const t = (k: string) => this.i18n.t(k);
    const splits = f.splits.filter(s => s.costCenterId && (Number(s.percent) || 0) > 0);
    const out: PreviewLine[] = [];
    const debit = (account: string, label: string, amount: number) => {
      if (!amount) return;
      let rest = amount;
      for (const s of splits) {
        const part = round2(amount * (Number(s.percent) || 0) / 100);
        if (!part) continue;
        rest = round2(rest - part);
        out.push({ account, label, costCenter: this.centerCode(s.costCenterId), debit: part, credit: 0 });
      }
      if (rest) out.push({ account, label, debit: rest, credit: 0 });
    };
    debit('6171', t('ledger.payroll.acc6171'), gross);
    debit('6174', t('ledger.payroll.acc6174'), employer);
    const credit = (account: string, label: string, amount: number) => { if (amount) out.push({ account, label, debit: 0, credit: amount }); };
    credit('4441', t('ledger.payroll.acc4441'), round2(employee + employer));
    credit('4452', t('ledger.payroll.acc4452'), ir);
    credit('4432', t('ledger.payroll.accOther'), other);
    credit('4432', t('ledger.payroll.acc4432'), net);
    return out;
  });

  previewTotals = computed(() => this.preview().reduce((t, l) => ({ debit: round2(t.debit + l.debit), credit: round2(t.credit + l.credit) }), { debit: 0, credit: 0 }));

  ngOnInit(): void {
    this.groups.ensure(true);
    this.load();
  }

  canWrite(): boolean { return this.state.hasAuthority('LEDGER_WRITE'); }

  load(): void {
    const year = this.year();
    this.api.list(year).subscribe({
      next: list => { if (this.year() === year) this.runs.set([...(list ?? [])].sort((a, b) => a.period.localeCompare(b.period))); },
      error: e => this.fail(e),
    });
  }

  openForm(r?: PayrollRun): void {
    const period = r?.period ?? this.nextPeriod();
    this.form.set({
      id: r?.id, period, date: r?.date ?? monthEnd(period), dateManual: !!r?.date && r.date !== monthEnd(period),
      grossSalaries: r?.grossSalaries ?? null, employeeSocial: r?.employeeSocial ?? null, incomeTax: r?.incomeTax ?? null,
      otherDeductions: r?.otherDeductions ?? 0, employerSocial: r?.employerSocial ?? null, notes: r?.notes ?? '',
      splits: (r?.costCenterAllocations ?? []).map(a => ({ uid: ++nextUid, costCenterId: a.costCenterId, percent: a.percent })),
    });
    this.touch();
  }

  /** The month after the last run of the year shown, or this month. */
  private nextPeriod(): string {
    const last = this.runs().at(-1)?.period;
    if (!last) return this.year() === new Date().getFullYear() ? currentPeriod() : `${this.year()}-01`;
    const [y, m] = last.split('-').map(Number);
    return m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }

  setPeriod(f: PayrollForm, period: string): void {
    f.period = period;
    if (!f.dateManual && period) f.date = monthEnd(period);
    this.touch();
  }

  addSplit(f: PayrollForm): void {
    f.splits = [...f.splits, { uid: ++nextUid, costCenterId: null, percent: null }];
    this.touch();
  }

  removeSplit(f: PayrollForm, s: SplitRow): void {
    f.splits = f.splits.filter(x => x.uid !== s.uid);
    this.touch();
  }

  touch(): void { this.version.update(v => v + 1); }

  num(v: unknown): number | null { return v === '' || v === null || v === undefined ? null : Number(v); }

  valid(): boolean {
    this.version();
    const f = this.form();
    if (!f || !/^\d{4}-\d{2}$/.test(f.period)) return false;
    if (!(Number(f.grossSalaries) > 0)) return false;
    if (this.net() < 0 || this.splitTotal() > 100) return false;
    // A split row needs both a cost center and a percentage, or neither (it is then ignored).
    return f.splits.every(s => !!s.costCenterId === Number(s.percent) > 0);
  }

  save(f: PayrollForm): void {
    const body: PayrollRunRequest = {
      period: f.period,
      date: f.date || null,
      grossSalaries: round2(Number(f.grossSalaries) || 0),
      employeeSocial: round2(Number(f.employeeSocial) || 0),
      incomeTax: round2(Number(f.incomeTax) || 0),
      otherDeductions: round2(Number(f.otherDeductions) || 0),
      employerSocial: round2(Number(f.employerSocial) || 0),
      costCenterAllocations: f.splits.filter(s => s.costCenterId && Number(s.percent) > 0)
        .map(s => ({ costCenterId: s.costCenterId!, percent: round2(Number(s.percent)) })),
      notes: f.notes.trim() || null,
    };
    this.busy.set(true);
    this.api.save(body, f.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t('ledger.payroll.saved'), { type: 'success' });
        const y = Number(body.period.slice(0, 4));
        if (y !== this.year()) this.year.set(y);
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  async remove(r: PayrollRun): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.payroll.confirmDelete', { period: this.periodLabel(r.period) }),
      message: this.i18n.t('ledger.payroll.confirmDeleteText'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.remove(r.id).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('ledger.payroll.deleted'), { type: 'success' }); this.load(); },
      error: e => this.fail(e),
    });
  }

  private centerCode(id: string | null): string | null {
    const c = id ? this.groups.costCenters().find(x => x.id === id) : null;
    return c ? `${c.code} · ${c.name}` : null;
  }

  periodLabel(p: string): string {
    const [y, m] = (p || '').split('-').map(Number);
    if (!y || !m) return p || '—';
    try {
      return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(this.i18n.currentLang(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return p;
    }
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  date(v: string | null | undefined): string { return v ? shortDate(v) : '—'; }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.closing.error'), { type: 'error' });
  }
}
