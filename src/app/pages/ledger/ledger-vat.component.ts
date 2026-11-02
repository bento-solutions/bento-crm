import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import { ClosingApi, VatPeriod, VatSummary, VatSummaryLine, isoDay, lastMonthEnd } from '../../services/domains/closing.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { errorDetail } from './ledger-labels';

/**
 * General Ledger → VAT: the VAT of a month or quarter (as the settings say), collected and
 * recoverable per code, the credit carried in and the amount due or the credit; posts or cancels
 * the settlement entry, and links to the tax calendar's TVA deadline.
 */
@Component({
  selector: 'app-ledger-vat',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'ledger.vat.year' | translate }}</span>
          <select class="input-field" [ngModel]="year()" (ngModelChange)="year.set(+$event); load()">
            @for (y of yearOptions; track y) { <option [ngValue]="y">{{ y }}</option> }
          </select></label>
        <label class="block"><span class="field-label">{{ (period() === 'QUARTERLY' ? 'ledger.vat.quarter' : 'ledger.vat.month') | translate }}</span>
          <select class="input-field" [ngModel]="slot()" (ngModelChange)="slot.set(+$event); load()">
            @for (o of slotOptions(); track o.value) { <option [ngValue]="o.value">{{ o.label }}</option> }
          </select></label>
        <span class="text-xs text-ink-3 pb-2">{{ date(range().from) }} – {{ date(range().to) }}
          @if (summary(); as s) { · {{ ('ledger.closing.regime.' + s.regime) | translate }} }</span>
      </div>

      @if (summary(); as s) {
        <div class="grid gap-4 lg:grid-cols-2">
          @for (side of sides; track side) {
            <div class="table-card">
              <div class="px-5 py-3 border-b border-line"><h3 class="card-title">{{ ('ledger.vat.' + side) | translate }}</h3></div>
              <div class="overflow-x-auto">
                <table class="data-table is-dense">
                  <thead><tr>
                    <th>{{ 'ledger.vat.code' | translate }}</th>
                    <th class="col-num">{{ 'ledger.vat.base' | translate }}</th>
                    <th class="col-num">{{ 'ledger.vat.vat' | translate }}</th>
                  </tr></thead>
                  <tbody>
                    @for (l of lines(s, side); track l.vatCode) {
                      <tr>
                        <td class="text-ink">{{ groups.vatLabel(l.vatCode) }}</td>
                        <td class="col-num num">{{ money(l.base) }}</td>
                        <td class="col-num num">{{ money(l.vat) }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="3" class="row-empty text-sm text-ink-3">{{ 'ledger.vat.none' | translate }}</td></tr>
                    }
                    <tr class="font-semibold">
                      <td>{{ 'ledger.vat.total' | translate }}</td><td></td>
                      <td class="col-num num">{{ money(side === 'collected' ? s.totalCollected : s.totalRecoverable) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>

        <div class="card">
          <div class="card-body grid gap-4 sm:grid-cols-4 text-sm">
            <div><div class="text-ink-3 text-xs">{{ 'ledger.vat.collected' | translate }}</div><div class="text-lg num text-ink">{{ money(s.totalCollected) }}</div></div>
            <div><div class="text-ink-3 text-xs">{{ 'ledger.vat.recoverable' | translate }}</div><div class="text-lg num text-ink">− {{ money(s.totalRecoverable) }}</div></div>
            <div><div class="text-ink-3 text-xs">{{ 'ledger.vat.creditCarriedIn' | translate }}</div><div class="text-lg num text-ink">− {{ money(s.creditCarriedIn) }}</div></div>
            <div>
              @if (s.due > 0) {
                <div class="text-ink-3 text-xs">{{ 'ledger.vat.due' | translate }}</div><div class="text-lg num font-semibold text-danger-ink">{{ money(s.due) }}</div>
              } @else {
                <div class="text-ink-3 text-xs">{{ 'ledger.vat.credit' | translate }}</div><div class="text-lg num font-semibold text-success-ink">{{ money(s.credit) }}</div>
              }
            </div>
          </div>
          <div class="card-footer flex flex-wrap items-center gap-2">
            @if (s.settlementEntryId) {
              <span class="badge badge-success"><mat-icon class="icon-sm">check</mat-icon>{{ 'ledger.vat.settled' | translate }}</span>
              <a class="btn-ghost btn-sm" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: s.settlementEntryId }"><mat-icon>menu_book</mat-icon>{{ 'ledger.viewEntry' | translate }}</a>
            } @else {
              <span class="badge badge-warning">{{ 'ledger.vat.notSettled' | translate }}</span>
            }
            <a class="btn-ghost btn-sm" routerLink="/tax-calendar">
              <mat-icon>event_note</mat-icon>{{ (s.taxDeadlineId ? 'ledger.vat.deadline' : 'ledger.vat.taxCalendar') | translate }}</a>
            <span class="me-auto"></span>
            @if (canClose()) {
              @if (s.settlementEntryId) {
                <button class="btn-secondary" [disabled]="busy()" (click)="cancel()"><mat-icon>undo</mat-icon>{{ 'ledger.vat.cancelSettlement' | translate }}</button>
              } @else {
                <button class="btn-primary" [disabled]="busy()" (click)="settle()"><mat-icon>task_alt</mat-icon>{{ 'ledger.vat.postSettlement' | translate }}</button>
              }
            }
          </div>
        </div>
      } @else if (loading()) {
        <div class="py-10 text-center"><div class="w-6 h-6 mx-auto border-2 border-line border-t-accent rounded-full animate-spin"></div></div>
      }
    </div>
  `,
})
export class LedgerVatComponent implements OnInit {
  private api = inject(ClosingApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  groups = inject(LedgerGroupsStore);

  readonly sides: ('collected' | 'recoverable')[] = ['collected', 'recoverable'];
  readonly yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  period = signal<VatPeriod>('MONTHLY');
  year = signal(new Date().getFullYear());
  /** The month (0-11) or quarter (0-3) of the year. */
  slot = signal(0);
  summary = signal<VatSummary | null>(null);
  loading = signal(false);
  busy = signal(false);

  slotOptions = computed(() => {
    if (this.period() === 'QUARTERLY') return [0, 1, 2, 3].map(q => ({ value: q, label: `T${q + 1}` }));
    const lang = this.i18n.currentLang();
    return Array.from({ length: 12 }, (_, m) => ({ value: m, label: new Date(2000, m, 1).toLocaleDateString(lang, { month: 'long' }) }));
  });

  range = computed(() => {
    const y = this.year();
    const q = this.period() === 'QUARTERLY';
    const start = q ? this.slot() * 3 : this.slot();
    return { from: isoDay(new Date(y, start, 1)), to: isoDay(new Date(y, start + (q ? 3 : 1), 0)) };
  });

  canClose(): boolean { return this.state.hasAuthority('LEDGER_CLOSE'); }

  ngOnInit(): void {
    this.groups.ensure();
    const d = this.route.snapshot.queryParamMap.get('date') || lastMonthEnd();
    this.api.settings().subscribe({
      next: s => { this.period.set(s?.vatPeriod ?? 'MONTHLY'); this.pick(d); },
      error: () => this.pick(d),
    });
  }

  /** Selects the period holding a date. */
  private pick(iso: string): void {
    const [y, m] = iso.split('-').map(Number);
    this.year.set(y);
    this.slot.set(this.period() === 'QUARTERLY' ? Math.floor((m - 1) / 3) : m - 1);
    this.load();
  }

  load(): void {
    const { from, to } = this.range();
    this.loading.set(true);
    this.summary.set(null);
    this.api.vat(from, to).subscribe({
      next: s => { this.loading.set(false); this.summary.set(s ?? null); },
      error: e => { this.loading.set(false); this.fail(e); },
    });
  }

  lines(s: VatSummary, side: 'collected' | 'recoverable'): VatSummaryLine[] {
    return (side === 'collected' ? s.collected : s.recoverable) ?? [];
  }

  async settle(): Promise<void> {
    const { from, to } = this.range();
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.vat.settleTitle'),
      message: this.i18n.t('ledger.vat.settleText', { date: this.date(to) }),
      confirmLabel: this.i18n.t('ledger.vat.postSettlement'),
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.settleVat(from, to).subscribe({
      next: () => { this.busy.set(false); this.toast.show(this.i18n.t('ledger.vat.settledToast'), { type: 'success' }); this.load(); },
      error: e => this.fail(e),
    });
  }

  async cancel(): Promise<void> {
    const { from, to } = this.range();
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.vat.cancelTitle'),
      message: this.i18n.t('ledger.closing.reverseText'),
      confirmLabel: this.i18n.t('ledger.vat.cancelSettlement'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.cancelVatSettlement(from, to).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: e => this.fail(e),
    });
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  date(iso: string | null | undefined): string { return iso ? shortDate(iso) : '—'; }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.closing.error'), { type: 'error' });
  }
}
