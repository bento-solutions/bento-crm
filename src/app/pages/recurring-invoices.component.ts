import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { ConfirmService } from '../shared/ui/confirm.service';
import { PartnersService } from '../services/domains/partners.service';
import {
  GeneratedInvoice,
  RecurringFrequency,
  RecurringInvoice,
  RecurringInvoiceInput,
  RecurringInvoicesApi,
  RecurringLine,
} from '../services/domains/recurring-invoices.service';

const VAT_RATES = [0, 0.07, 0.1, 0.14, 0.2];
const FREQUENCIES: RecurringFrequency[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyForm(): RecurringInvoiceInput {
  return {
    partnerId: '',
    name: '',
    frequency: 'MONTHLY',
    intervalCount: 1,
    startDate: today(),
    endDate: null,
    paymentTermsDays: 30,
    autoSend: true,
    lines: [{ description: '', qty: 1, unitPrice: 0, vatRate: 0.2 }],
  };
}

/**
 * Finance → Recurring invoices: templates that bill a customer every week, month, quarter or
 * year. The backend generates each invoice on its date and, when the customer has an email,
 * sends it with the PDF attached.
 */
@Component({
  selector: 'app-recurring-invoices',
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent, EmptyStateComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'recurring.title' | translate" [subtitle]="'recurring.subtitle' | translate"
                       backLink="/finance" [backLabel]="'recurring.back' | translate">
        @if (!editing() && canCreate()) {
          <button actions type="button" class="btn-primary" (click)="startCreate()">
            <mat-icon>add</mat-icon>{{ 'recurring.new' | translate }}
          </button>
        }
      </app-page-header>

      @if (editing()) {
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">{{ (editingId() ? 'recurring.editTitle' : 'recurring.newTitle') | translate }}</h2>
          </div>
          <div class="card-body space-y-5">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="field-label">{{ 'recurring.customer' | translate }}</span>
                <select class="input-field" [ngModel]="form().partnerId" (ngModelChange)="patch({ partnerId: $event })">
                  <option value="" disabled>{{ 'recurring.pickCustomer' | translate }}</option>
                  @for (c of customers(); track c.id) {
                    <option [value]="c.id">{{ c.name }}{{ c.email ? '' : ' (' + ('recurring.noEmail' | translate) + ')' }}</option>
                  }
                </select>
              </label>
              <label class="block">
                <span class="field-label">{{ 'recurring.name' | translate }}</span>
                <input class="input-field" maxlength="255" [placeholder]="'recurring.namePlaceholder' | translate"
                       [ngModel]="form().name" (ngModelChange)="patch({ name: $event })" />
              </label>
            </div>

            <div class="grid gap-4 sm:grid-cols-4">
              <label class="block">
                <span class="field-label">{{ 'recurring.every' | translate }}</span>
                <input type="number" min="1" max="24" class="input-field" [disabled]="scheduleLocked()"
                       [ngModel]="form().intervalCount" (ngModelChange)="patch({ intervalCount: +$event || 1 })" />
              </label>
              <label class="block">
                <span class="field-label">{{ 'recurring.frequency' | translate }}</span>
                <select class="input-field" [disabled]="scheduleLocked()"
                        [ngModel]="form().frequency" (ngModelChange)="patch({ frequency: $event })">
                  @for (f of frequencies; track f) {
                    <option [value]="f">{{ ('recurring.freq.' + f) | translate }}</option>
                  }
                </select>
              </label>
              <label class="block">
                <span class="field-label">{{ 'recurring.startDate' | translate }}</span>
                <input type="date" class="input-field" [disabled]="scheduleLocked()"
                       [ngModel]="form().startDate" (ngModelChange)="patch({ startDate: $event })" />
              </label>
              <label class="block">
                <span class="field-label">{{ 'recurring.endDate' | translate }}</span>
                <input type="date" class="input-field"
                       [ngModel]="form().endDate ?? ''" (ngModelChange)="patch({ endDate: $event || null })" />
              </label>
            </div>
            @if (scheduleLocked()) {
              <p class="text-xs text-ink-3 -mt-2">{{ 'recurring.scheduleLocked' | translate }}</p>
            }

            <div class="grid gap-4 sm:grid-cols-2 items-end">
              <label class="block">
                <span class="field-label">{{ 'recurring.terms' | translate }}</span>
                <input type="number" min="0" max="365" class="input-field"
                       [ngModel]="form().paymentTermsDays" (ngModelChange)="patch({ paymentTermsDays: +$event || 0 })" />
              </label>
              <div class="flex items-start gap-3 pb-1">
                <button type="button" role="switch" class="switch mt-0.5 shrink-0" [attr.aria-checked]="form().autoSend"
                        [attr.aria-label]="'recurring.autoSend' | translate" (click)="patch({ autoSend: !form().autoSend })"></button>
                <span>
                  <span class="text-sm font-medium text-ink block">{{ 'recurring.autoSend' | translate }}</span>
                  <span class="text-xs text-ink-3">{{ 'recurring.autoSendHint' | translate }}</span>
                </span>
              </div>
            </div>

            <div>
              <p class="field-label">{{ 'recurring.lines' | translate }}</p>
              <div class="space-y-2">
                @for (line of form().lines; track $index; let i = $index) {
                  <div class="grid gap-2 grid-cols-12 items-center">
                    <input class="input-field col-span-12 sm:col-span-5" [placeholder]="'recurring.lineDescription' | translate"
                           [ngModel]="line.description" (ngModelChange)="setLine(i, { description: $event })" />
                    <input type="number" min="0" step="any" class="input-field col-span-3 sm:col-span-2" [attr.aria-label]="'recurring.qty' | translate"
                           [ngModel]="line.qty" (ngModelChange)="setLine(i, { qty: +$event })" />
                    <input type="number" min="0" step="any" class="input-field col-span-4 sm:col-span-2" [attr.aria-label]="'recurring.unitPrice' | translate"
                           [ngModel]="line.unitPrice" (ngModelChange)="setLine(i, { unitPrice: +$event })" />
                    <select class="input-field col-span-3 sm:col-span-2" [attr.aria-label]="'recurring.vat' | translate"
                            [ngModel]="line.vatRate" (ngModelChange)="setLine(i, { vatRate: +$event })">
                      @for (r of vatRates; track r) {
                        <option [ngValue]="r">TVA {{ r * 100 }} %</option>
                      }
                    </select>
                    <button type="button" class="btn-icon col-span-2 sm:col-span-1 justify-self-center" [disabled]="form().lines.length === 1"
                            (click)="removeLine(i)" [attr.aria-label]="'recurring.removeLine' | translate">
                      <mat-icon class="icon-sm">delete</mat-icon>
                    </button>
                  </div>
                }
              </div>
              <div class="flex flex-wrap items-center justify-between gap-2 mt-3">
                <button type="button" class="btn-ghost btn-sm" (click)="addLine()">
                  <mat-icon class="icon-sm">add</mat-icon>{{ 'recurring.addLine' | translate }}
                </button>
                <p class="text-sm">
                  <span class="text-ink-2">{{ 'recurring.perInvoice' | translate }}</span>
                  <span class="num font-semibold text-ink ms-1">{{ money(formTotal()) }}</span>
                  <span class="text-xs text-ink-3 ms-1">({{ 'recurring.ht' | translate }} {{ money(formSubtotal()) }})</span>
                </p>
              </div>
            </div>
          </div>
          <div class="card-footer flex gap-2 justify-end">
            <button type="button" class="btn-secondary" (click)="cancel()">{{ 'inbox.cancel' | translate }}</button>
            <button type="button" class="btn-primary" [disabled]="busy() || !canSave()" (click)="save()">
              {{ 'recurring.save' | translate }}
            </button>
          </div>
        </section>
      }

      <div class="table-card">
        @if (templates().length) {
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ 'recurring.name' | translate }}</th>
                  <th>{{ 'recurring.customer' | translate }}</th>
                  <th>{{ 'recurring.frequency' | translate }}</th>
                  <th class="col-num">{{ 'recurring.perInvoice' | translate }}</th>
                  <th class="col-actions"></th>
                </tr>
              </thead>
              <tbody>
                @for (t of templates(); track t.id) {
                  <tr>
                    <td>
                      <div class="cell-title flex items-center gap-2 flex-wrap">
                        {{ t.name }}
                        <span class="badge" [class.badge-success]="t.status === 'ACTIVE'" [class.badge-warning]="t.status === 'PAUSED'" [class.badge-neutral]="t.status === 'ENDED'">
                          {{ ('recurring.status.' + t.status) | translate }}
                        </span>
                      </div>
                      <div class="cell-sub">
                        @if (t.status === 'ACTIVE' && t.nextRunDate) {
                          {{ 'recurring.nextOn' | translate: { date: date(t.nextRunDate) } }} ·
                        }
                        {{ 'recurring.generated' | translate: { n: t.generatedCount } }}
                        @if (!t.autoSend) { · {{ 'recurring.draftOnly' | translate }} }
                      </div>
                    </td>
                    <td>{{ customerName(t.partnerId) }}</td>
                    <td>{{ schedule(t) }}</td>
                    <td class="col-num num">{{ money(t.total) }}</td>
                    <td class="col-actions">
                      <div class="flex flex-nowrap items-center justify-end gap-1.5">
                        @if (t.status !== 'ENDED' && canCreate()) {
                          <button type="button" class="btn-primary btn-sm" [disabled]="busy()" (click)="generateNow(t)">{{ 'recurring.generateNow' | translate }}</button>
                        }
                        @if (canWrite()) {
                          @if (t.status === 'ACTIVE') {
                            <button type="button" class="btn-secondary btn-sm" [disabled]="busy()" (click)="pause(t)">{{ 'recurring.pause' | translate }}</button>
                          } @else if (t.status === 'PAUSED') {
                            <button type="button" class="btn-secondary btn-sm" [disabled]="busy()" (click)="resume(t)">{{ 'recurring.resume' | translate }}</button>
                          }
                          <button type="button" class="btn-ghost btn-sm" (click)="startEdit(t)">{{ 'recurring.edit' | translate }}</button>
                        }
                        <button type="button" class="btn-ghost btn-sm" (click)="toggleHistory(t)">
                          {{ (openId() === t.id ? 'recurring.hideInvoices' : 'recurring.showInvoices') | translate }}
                        </button>
                        @if (canDelete()) {
                          <button type="button" class="btn-icon" [attr.aria-label]="'recurring.delete' | translate" (click)="remove(t)">
                            <mat-icon class="icon-sm">delete</mat-icon>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                  @if (openId() === t.id) {
                    <tr>
                      <td colspan="5" class="bg-subtle">
                        @for (inv of history(); track inv.id) {
                          <div class="flex flex-wrap justify-between gap-2 text-xs py-1">
                            <span class="font-medium text-ink">{{ inv.invoiceNumber }}</span>
                            <span class="text-ink-2">{{ date(inv.invoiceDate) }} → {{ date(inv.dueDate) }}</span>
                            <span class="badge badge-neutral">{{ ('recurring.invoiceStatus.' + inv.status) | translate }}</span>
                            <span class="num font-medium text-ink">{{ money(inv.total) }}</span>
                          </div>
                        } @empty {
                          <p class="text-xs text-ink-3 py-1">{{ 'recurring.noInvoicesYet' | translate }}</p>
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        } @else {
          <app-empty-state icon="autorenew" [title]="'recurring.emptyTitle' | translate" [text]="'recurring.emptyBody' | translate" />
        }
      </div>
    </div>
  `
})
export class RecurringInvoicesComponent implements OnInit {
  private api = inject(RecurringInvoicesApi);
  private partners = inject(PartnersService);
  private state = inject(CrmStateService);
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  protected readonly frequencies = FREQUENCIES;
  protected readonly vatRates = VAT_RATES;

  protected templates = signal<RecurringInvoice[]>([]);
  protected editing = signal(false);
  protected editingId = signal<string | null>(null);
  protected scheduleLocked = signal(false);
  protected form = signal<RecurringInvoiceInput>(emptyForm());
  protected busy = signal(false);
  protected openId = signal<string | null>(null);
  protected history = signal<GeneratedInvoice[]>([]);

  protected customers = computed(() => {
    const all = this.partners.allPartners();
    const customers = all.filter(p => p.type === 'Customer');
    return customers.length ? customers : all;
  });

  protected formSubtotal = computed(() =>
    this.form().lines.reduce((sum, l) => sum + (l.qty || 0) * (l.unitPrice || 0), 0));
  protected formTotal = computed(() =>
    this.form().lines.reduce((sum, l) => sum + (l.qty || 0) * (l.unitPrice || 0) * (1 + (l.vatRate || 0)), 0));
  protected canSave = computed(() => {
    const f = this.form();
    return !!f.partnerId && !!f.name.trim() && !!f.startDate && this.formSubtotal() > 0;
  });

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('recurring.title'));
    this.partners.load();
    this.reload();
  }

  protected canCreate(): boolean {
    return this.state.hasAuthority('INVOICES_CREATE');
  }

  protected canWrite(): boolean {
    return this.state.hasAuthority('INVOICES_WRITE');
  }

  protected canDelete(): boolean {
    return this.state.hasAuthority('INVOICES_DELETE');
  }

  private reload(): void {
    this.api.list().subscribe({ next: list => this.templates.set(list), error: e => this.fail(e) });
  }

  startCreate(): void {
    this.form.set(emptyForm());
    this.editingId.set(null);
    this.scheduleLocked.set(false);
    this.editing.set(true);
  }

  startEdit(t: RecurringInvoice): void {
    this.form.set({
      partnerId: t.partnerId,
      name: t.name,
      frequency: t.frequency,
      intervalCount: t.intervalCount,
      startDate: t.startDate,
      endDate: t.endDate ?? null,
      paymentTermsDays: t.paymentTermsDays,
      autoSend: t.autoSend,
      lines: t.lines.map(l => ({
        description: l.description ?? '',
        qty: Number(l.qty) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        vatRate: l.vatRate != null ? Number(l.vatRate) : 0.2,
      })),
    });
    this.editingId.set(t.id);
    this.scheduleLocked.set(t.scheduleLocked);
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
  }

  patch(change: Partial<RecurringInvoiceInput>): void {
    this.form.update(f => ({ ...f, ...change }));
  }

  setLine(index: number, change: Partial<RecurringLine>): void {
    this.form.update(f => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, ...change } : l)) }));
  }

  addLine(): void {
    this.form.update(f => ({ ...f, lines: [...f.lines, { description: '', qty: 1, unitPrice: 0, vatRate: 0.2 }] }));
  }

  removeLine(index: number): void {
    this.form.update(f => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }));
  }

  async save(): Promise<void> {
    this.busy.set(true);
    const f = this.form();
    const input: RecurringInvoiceInput = { ...f, name: f.name.trim(), lines: f.lines.filter(l => l.qty > 0 && l.unitPrice >= 0) };
    try {
      const id = this.editingId();
      await firstValueFrom(id ? this.api.update(id, input) : this.api.create(input));
      this.toast.show(this.i18n.t('recurring.saved'), { type: 'success' });
      this.editing.set(false);
      this.reload();
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async generateNow(t: RecurringInvoice): Promise<void> {
    if (!(await this.confirm.ask({ title: this.i18n.t('recurring.generateConfirm', { name: t.name }) }))) return;
    this.busy.set(true);
    try {
      const invoice = await firstValueFrom(this.api.generateNow(t.id));
      this.toast.show(this.i18n.t(invoice.status === 'SENT' ? 'recurring.generatedSent' : 'recurring.generatedDraft',
        { number: invoice.invoiceNumber ?? '' }), { type: 'success' });
      this.reload();
      if (this.openId() === t.id) this.loadHistory(t.id);
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  async pause(t: RecurringInvoice): Promise<void> {
    await this.act(() => firstValueFrom(this.api.pause(t.id)));
  }

  async resume(t: RecurringInvoice): Promise<void> {
    await this.act(() => firstValueFrom(this.api.resume(t.id)));
  }

  async remove(t: RecurringInvoice): Promise<void> {
    if (!(await this.confirm.ask({ title: this.i18n.t('recurring.deleteConfirm', { name: t.name }), danger: true }))) return;
    await this.act(() => firstValueFrom(this.api.remove(t.id)));
  }

  toggleHistory(t: RecurringInvoice): void {
    if (this.openId() === t.id) {
      this.openId.set(null);
      return;
    }
    this.openId.set(t.id);
    this.loadHistory(t.id);
  }

  private loadHistory(id: string): void {
    this.history.set([]);
    this.api.invoices(id).subscribe({ next: list => this.history.set(list), error: e => this.fail(e) });
  }

  private async act(call: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    try {
      await call();
      this.reload();
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }

  private fail(e: unknown): void {
    this.toast.show((e as { detail?: string })?.detail || this.i18n.t('recurring.error'), { type: 'error' });
  }

  customerName(partnerId: string): string {
    return this.partners.allPartners().find(p => p.id === partnerId)?.name ?? '—';
  }

  schedule(t: RecurringInvoice): string {
    const key = t.intervalCount > 1 ? `recurring.everyN.${t.frequency}` : `recurring.every1.${t.frequency}`;
    return this.i18n.t(key, { n: t.intervalCount });
  }

  money(amount?: number | null): string {
    return new Intl.NumberFormat(this.i18n.currentLang(), { style: 'currency', currency: 'MAD' }).format(Number(amount) || 0);
  }

  date(iso?: string | null): string {
    return iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(this.i18n.currentLang(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }
}
