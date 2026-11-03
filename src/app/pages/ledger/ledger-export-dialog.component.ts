import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { ApiService } from '../../services/api.service';
import { ClosingApi, FiscalYear } from '../../services/domains/closing.service';
import { ExportFormat, StatementsApi, fiscalYearOf, fiscalYearRange, yearChoices } from '../../services/domains/statements.service';
import { isoDate } from '../../shared/ledger.util';
import { errorDetail } from './ledger-labels';

/**
 * "Export for accountant": one workbook (entries in FEC-style columns, trial balance, customer and
 * supplier balances, bilan, CPC, VAT, chart of accounts) or the entries alone as CSV, for a fiscal
 * year or custom dates. Opened from the General Ledger header and from the closing checklist.
 */
@Component({
  selector: 'app-ledger-export-dialog',
  imports: [FormsModule, MatIconModule, TranslatePipe],
  template: `
    <div class="modal-backdrop no-print">
      <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="ledger-export-title">
        <div class="modal-header">
          <div>
            <h3 id="ledger-export-title" class="modal-title">{{ 'ledger.export.title' | translate }}</h3>
            <p class="modal-subtitle">{{ 'ledger.export.subtitle' | translate }}</p>
          </div>
          <button class="btn-icon btn-sm" (click)="closed.emit()" [attr.aria-label]="'ledger.export.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
        </div>

        <fieldset class="space-y-4" [disabled]="busy()">
          <div class="block">
            <span class="field-label">{{ 'ledger.export.period' | translate }}</span>
            <div class="segmented" role="group" [attr.aria-label]="'ledger.export.period' | translate">
              <button class="segmented__item" [class.is-active]="mode() === 'year'" [attr.aria-pressed]="mode() === 'year'" (click)="setMode('year')">{{ 'ledger.export.fiscalYear' | translate }}</button>
              <button class="segmented__item" [class.is-active]="mode() === 'custom'" [attr.aria-pressed]="mode() === 'custom'" (click)="setMode('custom')">{{ 'ledger.export.customDates' | translate }}</button>
            </div>
          </div>

          @if (mode() === 'year') {
            <label class="block"><span class="field-label">{{ 'ledger.statements.year' | translate }}</span>
              <select class="input-field" [ngModel]="year()" (ngModelChange)="setYear($event)">
                @for (y of years(); track y.year) { <option [ngValue]="y.year">{{ yearLabel(y) }}</option> }
              </select></label>
          } @else {
            <div class="grid grid-cols-2 gap-3">
              <label class="block"><span class="field-label">{{ 'ledger.from' | translate }}</span>
                <input type="date" class="input-field" [ngModel]="from()" (ngModelChange)="from.set($event || '')" /></label>
              <label class="block"><span class="field-label">{{ 'ledger.to' | translate }}</span>
                <input type="date" class="input-field" [ngModel]="to()" (ngModelChange)="to.set($event || '')" /></label>
            </div>
          }

          <div class="block">
            <span class="field-label">{{ 'ledger.export.format' | translate }}</span>
            <div class="space-y-2">
              <label class="flex items-start gap-2 text-sm text-ink">
                <input type="radio" name="ledger-export-format" value="xlsx" [ngModel]="format()" (ngModelChange)="format.set($event)" class="mt-1" />
                <span><span class="font-medium">{{ 'ledger.export.xlsx' | translate }}</span>
                  <span class="block text-xs text-ink-3">{{ 'ledger.export.xlsxHint' | translate }}</span></span>
              </label>
              <label class="flex items-start gap-2 text-sm text-ink">
                <input type="radio" name="ledger-export-format" value="csv" [ngModel]="format()" (ngModelChange)="format.set($event)" class="mt-1" />
                <span><span class="font-medium">{{ 'ledger.export.csv' | translate }}</span>
                  <span class="block text-xs text-ink-3">{{ 'ledger.export.csvHint' | translate }}</span></span>
              </label>
            </div>
          </div>
          @if (invalid()) { <p class="text-xs text-danger-ink">{{ 'ledger.export.invalidPeriod' | translate }}</p> }
        </fieldset>

        <div class="modal-footer">
          <button class="btn-secondary" (click)="closed.emit()">{{ 'ledger.export.cancel' | translate }}</button>
          <button class="btn-primary" [disabled]="busy() || invalid()" (click)="download()">
            <mat-icon>download</mat-icon>{{ (busy() ? 'ledger.export.preparing' : 'ledger.export.download') | translate }}</button>
        </div>
      </div>
    </div>
  `,
})
export class LedgerExportDialogComponent implements OnInit {
  private api = inject(StatementsApi);
  private closing = inject(ClosingApi);
  private files = inject(ApiService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);

  /** A date in the fiscal year offered first (the closing date); today by default. */
  date = input<string | null>(null);
  closed = output<void>();

  mode = signal<'year' | 'custom'>('year');
  years = signal<FiscalYear[]>([]);
  startMonth = signal(1);
  year = signal(new Date().getFullYear());
  from = signal('');
  to = signal('');
  format = signal<ExportFormat>('xlsx');
  busy = signal(false);

  invalid = computed(() => !this.from() || !this.to() || this.from() > this.to());

  ngOnInit(): void {
    const day = this.date() || isoDate(new Date());
    this.closing.settings().subscribe({
      next: s => { this.startMonth.set(s?.fiscalYearStartMonth || 1); this.loadYears(day); },
      error: () => this.loadYears(day),
    });
  }

  private loadYears(day: string): void {
    const init = (list: FiscalYear[] | null) => {
      const y = fiscalYearOf(day, this.startMonth(), list ?? []);
      this.years.set(yearChoices(list, y));
      this.setYear(y);
    };
    this.closing.years().subscribe({ next: init, error: () => init([]) });
  }

  yearLabel(y: FiscalYear): string {
    const r = fiscalYearRange(y.year, this.startMonth(), y);
    return r.from.slice(5) === '01-01' ? String(y.year) : `${y.year}/${y.year + 1}`;
  }

  setMode(m: 'year' | 'custom'): void {
    this.mode.set(m);
    if (m === 'year') this.setYear(this.year());
  }

  setYear(y: number): void {
    this.year.set(Number(y));
    const r = fiscalYearRange(Number(y), this.startMonth(), this.years().find(x => x.year === Number(y)));
    this.from.set(r.from);
    this.to.set(r.to);
  }

  download(): void {
    if (this.invalid()) return;
    this.busy.set(true);
    const fmt = this.format();
    this.api.exportForAccountant(this.from(), this.to(), fmt).subscribe({
      next: blob => {
        this.busy.set(false);
        this.files.downloadBlob(blob, `bento-export-${this.from()}-${this.to()}.${fmt}`);
        this.toast.show(this.i18n.t('ledger.export.done'), { type: 'success' });
        this.closed.emit();
      },
      error: e => {
        this.busy.set(false);
        this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' });
      },
    });
  }
}
