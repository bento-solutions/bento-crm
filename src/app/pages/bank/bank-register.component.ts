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
import { StatCardComponent } from '../../shared/ui/stat-card.component';
import { PartnersService } from '../../services/domains/partners.service';
import { LedgerGroupsStore } from '../../services/domains/ledger-groups.store';
import { CashApi, CashKind, CashMovement, CashMovementRequest, CashRegister } from '../../services/domains/cash.service';
import { isoDay } from '../../services/domains/closing.service';
import { round2 } from '../../services/domains/vat';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { LedgerPickerComponent, PickerOption } from '../ledger/ledger-picker.component';
import { categoryLabel, errorDetail } from './bank-labels';

const PAGE_SIZE = 50;
/** The bank categories a cash movement can use; TRANSFER is a deposit to the bank, CASH (in) a withdrawal from it. */
const CATEGORIES = ['SALES', 'SUPPLIERS', 'SALARIES', 'SOCIAL_CHARGES', 'TAXES', 'RENT', 'UTILITIES', 'TELECOM', 'FUEL', 'TRAVEL',
  'MEALS', 'OFFICE', 'SOFTWARE', 'MARKETING', 'FEES', 'BANK_FEES', 'LOAN', 'TRANSFER', 'CASH', 'OTHER'];

interface Form {
  date: string;
  kind: CashKind;
  amount: number;
  label: string;
  category: string;
  partnerId: string | null;
  costCenterId: string;
}

/**
 * Cash & Bank → Cash register (caisse, 5161): its balance, the movements read from the ledger
 * lines on the cash account, and "New movement", which posts in the CA journal.
 */
@Component({
  selector: 'app-bank-register',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe, EmptyStateComponent, StatCardComponent, LedgerPickerComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-56">
          <app-stat-card [label]="'cash.balance' | translate" [value]="money(register()?.balance)" icon="point_of_sale" tone="slate"
                         [hint]="register()?.accountCode ? ('cash.account' | translate: { code: register()?.accountCode ?? '' }) : ''" />
        </div>
        <label class="block"><span class="field-label">{{ 'bank.tx.from' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="from()" (ngModelChange)="from.set($event); reload()" /></label>
        <label class="block"><span class="field-label">{{ 'bank.tx.to' | translate }}</span>
          <input type="date" class="input-field" [ngModel]="to()" (ngModelChange)="to.set($event); reload()" /></label>
        @if (canWrite()) {
          <button class="btn-primary ms-auto" (click)="openNew()"><mat-icon>add</mat-icon>{{ 'cash.new' | translate }}</button>
        }
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'bank.tx.date' | translate }}</th>
              <th>{{ 'bank.tx.label' | translate }}</th>
              <th>{{ 'bank.journal.partner' | translate }}</th>
              <th>{{ 'cash.source' | translate }}</th>
              <th class="col-num">{{ 'cash.in' | translate }}</th>
              <th class="col-num">{{ 'cash.out' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (m of movements(); track m.id) {
                <tr>
                  <td class="cell-muted whitespace-nowrap">{{ date(m.date) }}</td>
                  <td class="max-w-80"><div class="cell-title truncate">{{ m.label || '—' }}</div>
                    @if (m.category) { <div class="cell-sub">{{ category(m.category) }}</div> }</td>
                  <td class="text-sm text-ink truncate max-w-40">{{ m.partnerName || '—' }}</td>
                  <td class="text-sm text-ink-2">{{ source(m.sourceType) }}</td>
                  <td class="col-num num text-success-ink">{{ m.kind === 'IN' ? money(m.amount) : '' }}</td>
                  <td class="col-num num text-danger-ink">{{ m.kind === 'OUT' ? money(m.amount) : '' }}</td>
                  <td class="col-actions">
                    <div class="inline-flex items-center gap-1">
                      @if (m.entryId) {
                        <a class="btn-icon btn-sm" routerLink="/ledger" [queryParams]="{ tab: 'entries', entry: m.entryId }"
                           [attr.title]="'ledger.viewEntry' | translate" [attr.aria-label]="'ledger.viewEntry' | translate"><mat-icon class="icon-sm">menu_book</mat-icon></a>
                      }
                      @if (canWrite() && m.sourceType === 'CASH') {
                        <button class="btn-icon btn-sm btn-danger-hover" [disabled]="busy()" (click)="remove(m)" [attr.aria-label]="'cash.delete' | translate"><mat-icon class="icon-sm">delete</mat-icon></button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="row-empty">
                  <app-empty-state icon="point_of_sale" [title]="'cash.emptyTitle' | translate" [text]="'cash.emptyText' | translate" />
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

    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="cash-new-title">
          <div class="modal-header">
            <h3 id="cash-new-title" class="modal-title">{{ 'cash.newTitle' | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'assets.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="space-y-3" [disabled]="busy()">
            <div class="segmented" role="group" [attr.aria-label]="'cash.kind' | translate">
              @for (k of kinds; track k) {
                <button type="button" class="segmented__item" [class.is-active]="f.kind === k" [attr.aria-pressed]="f.kind === k" (click)="patch({ kind: k })">
                  {{ ('cash.kindName.' + k) | translate }}</button>
              }
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label class="block"><span class="field-label">{{ 'bank.tx.date' | translate }} *</span>
                <input type="date" class="input-field" [ngModel]="f.date" (ngModelChange)="patch({ date: $event })" /></label>
              <label class="block"><span class="field-label">{{ 'bank.tx.amount' | translate }} *</span>
                <input type="number" min="0" step="0.01" class="input-field" [ngModel]="f.amount" (ngModelChange)="patch({ amount: +$event || 0 })" /></label>
            </div>
            <label class="block"><span class="field-label">{{ 'bank.tx.label' | translate }} *</span>
              <input class="input-field" maxlength="255" [ngModel]="f.label" (ngModelChange)="patch({ label: $event })" /></label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block"><span class="field-label">{{ 'cash.category' | translate }}</span>
                <select class="input-field" [ngModel]="f.category" (ngModelChange)="patch({ category: $event })">
                  <option value="">—</option>
                  @for (c of categories; track c) { <option [value]="c">{{ category(c) }}</option> }
                </select></label>
              <div><span class="field-label">{{ 'bank.journal.partner' | translate }}</span>
                <app-ledger-picker [items]="partnerOptions()" [value]="f.partnerId" (valueChange)="patch({ partnerId: $event })"
                                   [allowClear]="true" [placeholder]="'bank.tx.pickPartner' | translate" [ariaLabel]="'bank.journal.partner' | translate" /></div>
            </div>
            @if (f.category === 'TRANSFER' || f.category === 'CASH') {
              <p class="text-xs text-ink-3">{{ ('cash.categoryHint.' + f.category) | translate }}</p>
            }
            @if (groups.costCenters().length) {
              <label class="block"><span class="field-label">{{ 'assets.costCenter' | translate }}</span>
                <select class="input-field" [ngModel]="f.costCenterId" (ngModelChange)="patch({ costCenterId: $event })">
                  <option value="">—</option>
                  @for (c of groups.costCenters(); track c.id) { <option [value]="c.id">{{ c.code }} · {{ c.name }}</option> }
                </select></label>
            }
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'assets.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !valid()" (click)="save()">{{ 'cash.save' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class BankRegisterComponent implements OnInit {
  private api = inject(CashApi);
  private partners = inject(PartnersService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);
  groups = inject(LedgerGroupsStore);

  readonly kinds: CashKind[] = ['IN', 'OUT'];
  readonly categories = CATEGORIES;

  register = signal<CashRegister | null>(null);
  movements = signal<CashMovement[]>([]);
  from = signal('');
  to = signal('');
  page = signal(0);
  total = signal(0);
  totalPages = signal(1);
  busy = signal(false);
  form = signal<Form | null>(null);

  partnerOptions = computed<PickerOption[]>(() => this.partners.allPartners().map(p => ({ id: p.id, label: p.name, hint: p.type })));

  canWrite(): boolean { return this.state.hasAuthority('PAYMENTS_WRITE'); }

  ngOnInit(): void {
    this.groups.ensure(true);
    this.partners.load();
    this.load();
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
    this.api.register().subscribe({ next: r => this.register.set(r ?? null), error: e => this.fail(e) });
    this.api.movements({ from: this.from() || null, to: this.to() || null }, this.page(), PAGE_SIZE).subscribe({
      next: p => {
        this.movements.set(p?.content ?? []);
        this.total.set(p?.total_elements ?? (p?.content ?? []).length);
        this.totalPages.set(Math.max(1, p?.total_pages ?? 1));
      },
      error: e => this.fail(e),
    });
  }

  openNew(): void {
    this.form.set({ date: isoDay(new Date()), kind: 'OUT', amount: 0, label: '', category: '', partnerId: null, costCenterId: '' });
  }

  patch(change: Partial<Form>): void {
    this.form.update(f => (f ? { ...f, ...change } : f));
  }

  valid(): boolean {
    const f = this.form();
    return !!f && !!f.date && f.amount > 0 && !!f.label.trim();
  }

  save(): void {
    const f = this.form();
    if (!f || !this.valid()) return;
    const body: CashMovementRequest = { date: f.date, kind: f.kind, amount: round2(f.amount), label: f.label.trim() };
    if (f.category) body.category = f.category;
    if (f.partnerId) body.partnerId = f.partnerId;
    if (f.costCenterId) body.costCenterId = f.costCenterId;
    this.busy.set(true);
    this.api.create(body).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t('cash.saved'), { type: 'success' });
        this.reload();
      },
      error: e => this.fail(e),
    });
  }

  async remove(m: CashMovement): Promise<void> {
    const ok = await this.confirm.ask({ title: this.i18n.t('cash.deleteTitle'), message: this.i18n.t('ledger.closing.reverseText'), danger: true });
    if (!ok) return;
    this.busy.set(true);
    this.api.remove(m.id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: e => this.fail(e),
    });
  }

  source(s: string | null | undefined): string {
    if (!s) return '—';
    const key = `ledger.source.${s}`;
    const label = this.i18n.t(key);
    return label === key ? s : label;
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
  category(c: string | null | undefined): string { return categoryLabel(this.i18n, c); }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('cash.error'), { type: 'error' });
  }
}
