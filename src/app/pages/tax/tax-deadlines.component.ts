import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import {
  DEADLINE_STATUSES, DeadlineStatus, DeadlineUpdate, TaxApi, TaxDeadline, TaxProfile,
} from '../../services/domains/tax.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { RangePreset, daysLeft, deadlineRange, groupByMonth, isoDate, monthLabel } from '../../shared/practice.util';
import { errorDetail } from '../bank/bank-labels';

/** "" is everyone, COMPANY the organization's own deadlines, anything else a client's id. */
const COMPANY = 'COMPANY';

interface DoneForm {
  deadline: TaxDeadline;
  amount: number | null;
  note: string;
}

/**
 * Tax calendar → Deadlines: what is due, month by month, for the company and its clients, with
 * "done" (and what was paid), "not applicable" and "reopen".
 */
@Component({
  selector: 'app-tax-deadlines',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <label class="block min-w-0"><span class="field-label">{{ 'tax.filter.who' | translate }}</span>
          <select class="input-field" [ngModel]="who()" (ngModelChange)="who.set($event); load()">
            <option value="">{{ 'tax.filter.everyone' | translate }}</option>
            <option [value]="company">{{ 'tax.ourCompany' | translate }}</option>
            @for (p of clientProfiles(); track p.id) { <option [value]="p.partnerId">{{ p.partnerName || '—' }}</option> }
          </select></label>
        <label class="block min-w-0"><span class="field-label">{{ 'tax.filter.status' | translate }}</span>
          <select class="input-field" [ngModel]="status()" (ngModelChange)="status.set($event); load()">
            <option value="">{{ 'tax.filter.allStatuses' | translate }}</option>
            @for (s of statuses; track s) { <option [value]="s">{{ ('tax.status.' + s) | translate }}</option> }
          </select></label>
        <label class="block min-w-0 col-span-2 sm:col-span-1"><span class="field-label">{{ 'tax.filter.period' | translate }}</span>
          <select class="input-field" [ngModel]="range()" (ngModelChange)="range.set($event); load()">
            <option value="default">{{ 'tax.filter.rangeDefault' | translate }}</option>
            <option value="next12">{{ 'tax.filter.rangeNext12' | translate }}</option>
          </select></label>
        @if (overdueCount() > 0) {
          <span class="badge badge-danger col-span-2 justify-self-start sm:ms-auto"><mat-icon class="icon-xs">warning</mat-icon>{{ 'tax.overdueCount' | translate: { n: overdueCount() } }}</span>
        }
      </div>

      @if (loading() && !deadlines().length) {
        <p class="text-sm text-ink-3">{{ 'bank.loading' | translate }}</p>
      } @else if (profilesLoaded() && !profiles().length) {
        <div class="card">
          <app-empty-state icon="event" [title]="'tax.deadlines.noProfileTitle' | translate" [text]="'tax.deadlines.noProfileText' | translate">
            <button class="btn-primary" (click)="setup.emit()"><mat-icon>tune</mat-icon>{{ 'tax.deadlines.setUp' | translate }}</button>
          </app-empty-state>
        </div>
      } @else {
        @for (g of groups(); track g.month) {
          <section class="space-y-2">
            <h2 class="section-title">{{ month(g.month) }}</h2>
            <div class="table-card">
              <div class="overflow-x-auto">
                <table class="data-table lg:table-fixed">
                  <thead><tr>
                    <th class="lg:w-1/4">{{ 'tax.col.declaration' | translate }}</th>
                    <th class="hidden md:table-cell">{{ 'tax.col.for' | translate }}</th>
                    <th class="lg:w-40">{{ 'tax.col.due' | translate }}</th>
                    <th class="hidden sm:table-cell lg:w-32">{{ 'tax.col.status' | translate }}</th>
                    <th class="col-num hidden lg:table-cell lg:w-36">{{ 'tax.col.amount' | translate }}</th>
                    <th class="col-actions lg:w-72"></th>
                  </tr></thead>
                  <tbody>
                    @for (d of g.items; track d.id) {
                      <tr [class.bg-danger-soft/40]="d.overdue">
                        <td class="min-w-0">
                          <div class="cell-title">{{ ('tax.kind.' + d.kind) | translate }}</div>
                          <div class="cell-sub">{{ d.periodLabel }}<span class="md:hidden"> · {{ d.partnerName || ('tax.ourCompany' | translate) }}</span></div>
                          <div class="sm:hidden mt-1"><span class="badge" [class]="statusBadge(d)">{{ statusLabel(d) | translate }}</span></div>
                          @if (d.note) { <div class="cell-sub truncate max-w-56" [title]="d.note">{{ d.note }}</div> }
                        </td>
                        <td class="hidden md:table-cell max-w-48 truncate">
                          @if (d.partnerId) { {{ d.partnerName || '—' }} } @else { <span class="cell-muted">{{ 'tax.ourCompany' | translate }}</span> }
                        </td>
                        <td class="whitespace-nowrap">
                          <div class="num">{{ date(d.dueDate) }}</div>
                          @if (d.status === 'TODO') {
                            <div class="text-xs" [class]="d.overdue ? 'text-danger-ink font-medium' : 'text-ink-3'">{{ left(d).key | translate: { n: left(d).n } }}</div>
                          } @else if (d.doneAt) {
                            <div class="text-xs text-ink-3">{{ 'tax.doneOn' | translate: { date: date(d.doneAt) } }}</div>
                          }
                        </td>
                        <td class="hidden sm:table-cell"><span class="badge" [class]="statusBadge(d)">{{ statusLabel(d) | translate }}</span></td>
                        <td class="col-num num whitespace-nowrap hidden lg:table-cell">{{ d.amount !== null && d.amount !== undefined ? money(d.amount) : '—' }}</td>
                        <td class="col-actions whitespace-nowrap">
                          @if (canWrite()) {
                            @if (d.status === 'TODO') {
                              <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="openDone(d)" [attr.aria-label]="'tax.markDone' | translate">
                                <mat-icon>check</mat-icon><span class="hidden sm:inline">{{ 'tax.markDone' | translate }}</span></button>
                              <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="setStatus(d, 'NOT_APPLICABLE')" [attr.aria-label]="'tax.notApplicable' | translate" [title]="'tax.notApplicable' | translate">
                                <mat-icon>block</mat-icon><span class="hidden lg:inline">{{ 'tax.notApplicable' | translate }}</span></button>
                            } @else {
                              <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="setStatus(d, 'TODO')" [attr.aria-label]="'tax.reopen' | translate">
                                <mat-icon>undo</mat-icon><span class="hidden sm:inline">{{ 'tax.reopen' | translate }}</span></button>
                            }
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        } @empty {
          <div class="card">
            <app-empty-state icon="event_available" [title]="'tax.deadlines.emptyTitle' | translate" [text]="'tax.deadlines.emptyText' | translate" />
          </div>
        }
      }
    </div>

    @if (doneForm(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="tax-done-title">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 id="tax-done-title" class="modal-title">{{ 'tax.doneTitle' | translate }}</h3>
              <p class="modal-subtitle truncate">{{ ('tax.kind.' + f.deadline.kind) | translate }} · {{ f.deadline.periodLabel }} · {{ f.deadline.partnerName || ('tax.ourCompany' | translate) }}</p>
            </div>
            <button class="btn-icon btn-sm" (click)="doneForm.set(null)" [attr.aria-label]="'bank.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="space-y-3" [disabled]="busy()">
            <label class="block"><span class="field-label">{{ 'tax.amountPaid' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field num" [(ngModel)]="f.amount" />
              <span class="field-hint">{{ 'tax.amountHint' | translate }}</span></label>
            <label class="block"><span class="field-label">{{ 'tax.note' | translate }}</span>
              <textarea class="input-field" rows="3" maxlength="500" [(ngModel)]="f.note" [placeholder]="'tax.notePlaceholder' | translate"></textarea></label>
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="doneForm.set(null)">{{ 'bank.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || (f.amount !== null && f.amount < 0)" (click)="saveDone(f)"><mat-icon>check</mat-icon>{{ 'tax.markDone' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TaxDeadlinesComponent implements OnInit {
  private api = inject(TaxApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);

  /** Asks the page to open the Profiles tab (no profile yet). */
  setup = output<void>();

  readonly statuses = DEADLINE_STATUSES;
  readonly company = COMPANY;

  deadlines = signal<TaxDeadline[]>([]);
  profiles = signal<TaxProfile[]>([]);
  profilesLoaded = signal(false);
  loading = signal(false);
  busy = signal(false);
  who = signal('');
  status = signal<DeadlineStatus | ''>('');
  range = signal<RangePreset>('default');
  doneForm = signal<DoneForm | null>(null);

  private readonly today = isoDate(new Date());

  clientProfiles = computed(() => this.profiles().filter(p => !!p.partnerId)
    .sort((a, b) => (a.partnerName ?? '').localeCompare(b.partnerName ?? '')));
  groups = computed(() => groupByMonth(this.deadlines(), d => d.dueDate));
  overdueCount = computed(() => this.deadlines().filter(d => d.overdue).length);

  canWrite(): boolean { return this.state.hasAuthority('INVOICES_WRITE') || this.state.hasAuthority('PAYMENTS_WRITE'); }

  ngOnInit(): void {
    this.api.profiles().subscribe({
      next: p => { this.profiles.set(p ?? []); this.profilesLoaded.set(true); },
      error: () => this.profilesLoaded.set(true),
    });
    this.load();
  }

  load(): void {
    const { from, to } = deadlineRange(this.range(), this.today);
    const who = this.who();
    this.loading.set(true);
    this.api.deadlines({
      from, to,
      companyOnly: who === COMPANY,
      partnerId: who && who !== COMPANY ? who : null,
      status: this.status() || null,
    }).subscribe({
      next: d => { this.deadlines.set(d ?? []); this.loading.set(false); },
      error: e => { this.loading.set(false); this.fail(e); },
    });
  }

  openDone(d: TaxDeadline): void {
    this.doneForm.set({ deadline: d, amount: d.amount ?? null, note: d.note ?? '' });
  }

  saveDone(f: DoneForm): void {
    const body: DeadlineUpdate = { status: 'DONE' };
    if (f.amount !== null && f.amount !== undefined && String(f.amount) !== '') body.amount = Number(f.amount);
    if (f.note.trim() || f.deadline.note) body.note = f.note.trim();
    this.update(f.deadline, body, 'tax.markedDone');
  }

  setStatus(d: TaxDeadline, status: DeadlineStatus): void {
    this.update(d, { status }, status === 'TODO' ? 'tax.reopened' : 'tax.markedNotApplicable');
  }

  private update(d: TaxDeadline, body: DeadlineUpdate, messageKey: string): void {
    this.busy.set(true);
    this.api.updateDeadline(d.id, body).subscribe({
      next: updated => {
        this.busy.set(false);
        this.doneForm.set(null);
        this.toast.show(this.i18n.t(messageKey), { type: 'success' });
        // Keep the row in place (unless a status filter now excludes it).
        const filter = this.status();
        this.deadlines.update(rows => rows
          .map(r => (r.id === updated.id ? updated : r))
          .filter(r => !filter || r.status === filter));
      },
      error: e => this.fail(e),
    });
  }

  // Display
  left(d: TaxDeadline) { return daysLeft(d.dueDate, this.today); }

  statusLabel(d: TaxDeadline): string {
    return d.status === 'TODO' && d.overdue ? 'tax.status.OVERDUE' : `tax.status.${d.status}`;
  }

  statusBadge(d: TaxDeadline): string {
    if (d.status === 'DONE') return 'badge-success';
    if (d.status === 'NOT_APPLICABLE') return 'badge-neutral';
    return d.overdue ? 'badge-danger' : 'badge-warning';
  }

  month(m: string): string { return monthLabel(m, this.i18n.currentLang()); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
  money(v: number | null | undefined): string { return formatMoney(v); }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
