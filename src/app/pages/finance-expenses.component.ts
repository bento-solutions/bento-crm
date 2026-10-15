import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { StatCardComponent } from '../shared/ui/stat-card.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { AttachmentsComponent } from '../shared/attachments.component';
import { ConfirmService } from '../shared/ui/confirm.service';
import { Expense, ExpenseSummary, ExpensesApi, PaymentMethod } from '../services/domains/expenses.service';

interface ExpenseForm {
  id?: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number | null;
  vatAmount: number | null;
  paymentMethod: PaymentMethod;
  vendorName: string;
  reference: string;
}

const DEFAULT_CATEGORIES = ['TRAVEL', 'FUEL', 'MEALS', 'OFFICE', 'RENT', 'UTILITIES', 'TELECOM', 'SOFTWARE',
  'MARKETING', 'FEES', 'SALARIES', 'TAXES', 'OTHER'];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Finance → Expenses: day-to-day spending (fuel, rent, software...) with its receipt, filtered by
 * period and category, and totals per category for the period.
 */
@Component({
  selector: 'app-finance-expenses',
  imports: [FormsModule, MatIconModule, TranslatePipe, StatCardComponent, EmptyStateComponent, AttachmentsComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="block"><span class="field-label">{{ 'expenses.from' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="from()" (ngModelChange)="from.set($event); load()" /></label>
        <label class="block"><span class="field-label">{{ 'expenses.to' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="to()" (ngModelChange)="to.set($event); load()" /></label>
        <label class="block"><span class="field-label">{{ 'expenses.category' | translate }}</span>
          <select class="input-field" [ngModel]="category()" (ngModelChange)="category.set($event); load()">
            <option value="">{{ 'expenses.allCategories' | translate }}</option>
            @for (c of categories(); track c) { <option [value]="c">{{ categoryLabel(c) }}</option> }
          </select></label>
        @if (canCreate()) {
          <button class="btn-primary ms-auto" (click)="openForm()"><mat-icon>add</mat-icon>{{ 'expenses.add' | translate }}</button>
        }
      </div>

      @if (summary(); as s) {
        <div class="stat-grid">
          <app-stat-card [label]="'expenses.total' | translate" [value]="money(s.total)" icon="payments" tone="rose"
                         [hint]="'expenses.count' | translate: { n: s.count }" />
          <app-stat-card [label]="'expenses.vat' | translate" [value]="money(s.vat)" icon="percent" tone="violet"
                         [hint]="'expenses.vatHint' | translate" />
          <app-stat-card [label]="'expenses.topCategory' | translate" [value]="topCategory() ? categoryLabel(topCategory()!.category) : '—'"
                         icon="category" tone="amber" [hint]="topCategory() ? money(topCategory()!.amount) : ''" />
        </div>
      }

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="card overflow-x-auto lg:col-span-2">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ 'expenses.date' | translate }}</th>
                <th>{{ 'expenses.category' | translate }}</th>
                <th>{{ 'expenses.description' | translate }}</th>
                <th class="col-num">{{ 'expenses.amount' | translate }}</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              @for (e of expenses(); track e.id) {
                <tr>
                  <td class="cell-muted whitespace-nowrap">{{ shortDate(e.expenseDate) }}</td>
                  <td><span class="badge badge-neutral">{{ categoryLabel(e.category) }}</span></td>
                  <td><div class="cell-title">{{ e.description || e.vendorName || '—' }}</div>
                    <div class="cell-sub">{{ ('expenses.method.' + e.paymentMethod) | translate }}@if (e.vendorName && e.description) { · {{ e.vendorName }} }@if (e.reference) { · {{ e.reference }} }</div></td>
                  <td class="col-num num">{{ money(e.amount) }}
                    @if (e.vatAmount) { <div class="cell-sub">{{ 'expenses.vatShort' | translate }} {{ money(e.vatAmount) }}</div> }</td>
                  <td class="col-actions whitespace-nowrap">
                    <button class="btn-ghost btn-sm" (click)="openForm(e)">{{ (canWrite() ? 'expenses.edit' : 'expenses.view') | translate }}</button>
                    @if (canDelete()) {
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="remove(e)">{{ 'expenses.delete' | translate }}</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5">
                  <app-empty-state icon="payments" [title]="'expenses.emptyTitle' | translate" [text]="'expenses.emptyText' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="text-sm font-semibold text-ink">{{ 'expenses.byCategory' | translate }}</h3></div>
          <div class="card-body space-y-3">
            @for (row of summary()?.byCategory ?? []; track row.category) {
              <div>
                <div class="flex justify-between text-sm">
                  <span class="text-ink">{{ categoryLabel(row.category) }}</span>
                  <span class="num text-ink">{{ money(row.amount) }}</span>
                </div>
                <div class="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                  <div class="h-full rounded-full bg-primary" [style.width.%]="share(row.amount)"></div>
                </div>
              </div>
            } @empty {
              <p class="text-sm text-ink-3">{{ 'expenses.noData' | translate }}</p>
            }
          </div>
        </div>
      </div>
    </div>

    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">{{ (f.id ? 'expenses.editTitle' : 'expenses.add') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'expenses.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="grid grid-cols-2 gap-3" [disabled]="f.id ? !canWrite() : !canCreate()">
            <label class="block"><span class="field-label">{{ 'expenses.date' | translate }}</span>
              <input type="date" class="input-field" [(ngModel)]="f.expenseDate" /></label>
            <label class="block"><span class="field-label">{{ 'expenses.category' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.category">
                @for (c of categories(); track c) { <option [value]="c">{{ categoryLabel(c) }}</option> }
              </select></label>
            <label class="block col-span-2"><span class="field-label">{{ 'expenses.description' | translate }}</span>
              <input class="input-field" maxlength="255" [(ngModel)]="f.description" /></label>
            <label class="block"><span class="field-label">{{ 'expenses.amountTtc' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field" [(ngModel)]="f.amount" /></label>
            <label class="block"><span class="field-label">{{ 'expenses.vatIncluded' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field" [(ngModel)]="f.vatAmount" /></label>
            <label class="block"><span class="field-label">{{ 'expenses.paidBy' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.paymentMethod">
                @for (m of methods; track m) { <option [value]="m">{{ ('expenses.method.' + m) | translate }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'expenses.vendor' | translate }}</span>
              <input class="input-field" maxlength="255" [(ngModel)]="f.vendorName" /></label>
            <label class="block col-span-2"><span class="field-label">{{ 'expenses.reference' | translate }}</span>
              <input class="input-field" maxlength="100" [(ngModel)]="f.reference" /></label>
          </fieldset>
          <div class="mt-4">
            <span class="field-label">{{ 'expenses.receipt' | translate }}</span>
            @if (f.id) {
              <app-attachments ownerEntityType="EXPENSE" [ownerEntityId]="f.id" [canWrite]="canWrite()" />
            } @else {
              <p class="text-xs text-ink-3">{{ 'expenses.receiptAfterSave' | translate }}</p>
            }
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ (f.id ? 'expenses.close' : 'expenses.cancel') | translate }}</button>
            @if (f.id ? canWrite() : canCreate()) {
              <button class="btn-primary" [disabled]="busy() || !valid(f)" (click)="save(f)">{{ 'expenses.save' | translate }}</button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class FinanceExpensesComponent implements OnInit {
  private api = inject(ExpensesApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  readonly methods: PaymentMethod[] = ['CARD', 'CASH', 'BANK_TRANSFER', 'CHECK', 'DIRECT_DEBIT', 'OTHER'];

  from = signal(isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  to = signal(isoDate(new Date()));
  category = signal('');
  expenses = signal<Expense[]>([]);
  summary = signal<ExpenseSummary | null>(null);
  form = signal<ExpenseForm | null>(null);
  busy = signal(false);

  categories = computed(() => this.summary()?.categories ?? DEFAULT_CATEGORIES);
  topCategory = computed(() => {
    const rows = this.summary()?.byCategory ?? [];
    return rows.length ? rows.reduce((a, b) => (b.amount > a.amount ? b : a)) : null;
  });

  canCreate(): boolean { return this.state.hasAuthority('PAYMENTS_CREATE'); }
  canWrite(): boolean { return this.state.hasAuthority('PAYMENTS_WRITE'); }
  canDelete(): boolean { return this.state.hasAuthority('PAYMENTS_DELETE'); }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.from() || !this.to()) return;
    this.api.list(this.from(), this.to(), this.category() || null).subscribe({
      next: page => this.expenses.set(page.content ?? []),
      error: e => this.fail(e),
    });
    this.api.summary(this.from(), this.to()).subscribe({
      next: s => this.summary.set(s),
      error: e => this.fail(e),
    });
  }

  openForm(e?: Expense): void {
    this.form.set(e ? {
      id: e.id, expenseDate: e.expenseDate, category: e.category, description: e.description ?? '',
      amount: e.amount, vatAmount: e.vatAmount ?? null, paymentMethod: e.paymentMethod,
      vendorName: e.vendorName ?? '', reference: e.reference ?? '',
    } : {
      expenseDate: isoDate(new Date()), category: this.category() || 'OTHER', description: '', amount: null,
      vatAmount: null, paymentMethod: 'CARD', vendorName: '', reference: '',
    });
  }

  valid(f: ExpenseForm): boolean {
    return !!f.expenseDate && !!f.category && f.amount !== null && f.amount > 0
      && (f.vatAmount === null || (f.vatAmount >= 0 && f.vatAmount <= f.amount));
  }

  save(f: ExpenseForm): void {
    this.busy.set(true);
    const isNew = !f.id;
    this.api.save({
      expenseDate: f.expenseDate, category: f.category, description: f.description.trim() || null,
      amount: f.amount!, vatAmount: f.vatAmount, paymentMethod: f.paymentMethod,
      vendorName: f.vendorName.trim() || null, reference: f.reference.trim() || null,
    }, f.id).subscribe({
      next: saved => {
        this.busy.set(false);
        // A new expense stays open so its receipt can be attached right away.
        this.form.set(isNew ? { ...f, id: saved.id } : null);
        this.toast.show(this.i18n.t(isNew ? 'expenses.savedAddReceipt' : 'expenses.saved'), { type: 'success' });
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  async remove(e: Expense): Promise<void> {
    if (!(await this.confirm.ask({ title: this.i18n.t('expenses.confirmDelete'), danger: true }))) return;
    this.busy.set(true);
    this.api.remove(e.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('expenses.deleted'), { type: 'success' });
        this.load();
      },
      error: err => this.fail(err),
    });
  }

  categoryLabel(c: string): string {
    const key = `expenses.cat.${c}`;
    const label = this.i18n.t(key);
    return label === key ? c.charAt(0) + c.slice(1).toLowerCase() : label;
  }

  share(amount: number): number {
    const total = this.summary()?.total ?? 0;
    return total > 0 ? Math.round((amount / total) * 100) : 0;
  }

  money(value: number): string {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(value ?? 0);
  }

  shortDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    const err = e as { error?: { detail?: string } };
    this.toast.show(err?.error?.detail || this.i18n.t('expenses.error'), { type: 'error' });
  }
}
