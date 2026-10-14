import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
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
  imports: [FormsModule, RouterLink, MatIconModule, TranslatePipe],
  styles: [`
    .ri-card { background: var(--color-surface); border: 1px solid var(--color-border); }
    .ri-muted { color: var(--color-text-secondary); }
    .ri-faint { color: var(--color-text-tertiary); }
    .ri-input { background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-primary); }
    .ri-btn { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
    .ri-btn:disabled { opacity: .5; cursor: not-allowed; }
    .ri-btn-primary { background: var(--color-text-primary); color: var(--color-surface); }
    .ri-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .ri-danger { color: var(--color-danger); }
    .ri-row { border-top: 1px solid var(--color-border-light); }
    .ri-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
    .ri-active { background: var(--color-success-light); color: var(--color-success); }
    .ri-paused { background: var(--color-warning-light); color: var(--color-text-primary); }
    .ri-ended { background: var(--color-bg); color: var(--color-text-tertiary); border: 1px solid var(--color-border); }
  `],
  template: `
    <div class="space-y-6 max-w-5xl">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a routerLink="/finance" class="text-xs ri-muted inline-flex items-center gap-1 mb-1">
            <mat-icon class="!text-[14px] !w-3.5 !h-3.5">arrow_back</mat-icon>{{ 'recurring.back' | translate }}
          </a>
          <h1 class="text-lg font-bold">{{ 'recurring.title' | translate }}</h1>
          <p class="text-sm ri-muted mt-1">{{ 'recurring.subtitle' | translate }}</p>
        </div>
        @if (!editing() && canCreate()) {
          <button type="button" class="ri-btn-primary text-sm font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1" (click)="startCreate()">
            <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">add</mat-icon>{{ 'recurring.new' | translate }}
          </button>
        }
      </div>

      @if (editing()) {
        <section class="ri-card rounded-2xl p-6 space-y-5">
          <h2 class="text-base font-bold">{{ (editingId() ? 'recurring.editTitle' : 'recurring.newTitle') | translate }}</h2>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-xs font-semibold ri-muted">{{ 'recurring.customer' | translate }}</span>
              <select class="ri-input w-full rounded-lg px-3 py-2 mt-1 text-sm" [ngModel]="form().partnerId" (ngModelChange)="patch({ partnerId: $event })">
                <option value="" disabled>{{ 'recurring.pickCustomer' | translate }}</option>
                @for (c of customers(); track c.id) {
                  <option [value]="c.id">{{ c.name }}{{ c.email ? '' : ' (' + ('recurring.noEmail' | translate) + ')' }}</option>
                }
              </select>
            </label>
            <label class="block">
              <span class="text-xs font-semibold ri-muted">{{ 'recurring.name' | translate }}</span>
              <input class="ri-input w-full rounded-lg px-3 py-2 mt-1 text-sm" maxlength="255" [placeholder]="'recurring.namePlaceholder' | translate"
                     [ngModel]="form().name" (ngModelChange)="patch({ name: $event })" />
            </label>
          </div>

          <div class="grid gap-4 sm:grid-cols-4">
            <label class="block">
              <span class="text-xs font-semibold ri-muted">{{ 'recurring.every' | translate }}</span>
              <input type="number" min="1" max="24" class="ri-input w-full rounded-lg px-3 py-2 mt-1 text-sm" [disabled]="scheduleLocked()"
                     [ngModel]="form().intervalCount" (ngModelChange)="patch({ intervalCount: +$event || 1 })" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold ri-muted">{{ 'recurring.frequency' | translate }}</span>
              <select class="ri-input w-full rounded-lg px-3 py-2 mt-1 text-sm" [disabled]="scheduleLocked()"
                      [ngModel]="form().frequency" (ngModelChange)="patch({ frequency: $event })">
                @for (f of frequencies; track f) {
                  <option [value]="f">{{ ('recurring.freq.' + f) | translate }}</option>
                }
              </select>
            </label>
            <label class="block">
              <span class="text-xs font-semibold ri-muted">{{ 'recurring.startDate' | translate }}</span>
              <input type="date" class="ri-input w-full rounded-lg px-3 py-2 mt-1 text-sm" [disabled]="scheduleLocked()"
                     [ngModel]="form().startDate" (ngModelChange)="patch({ startDate: $event })" />
            </label>
            <label class="block">
              <span class="text-xs font-semibold ri-muted">{{ 'recurring.endDate' | translate }}</span>
              <input type="date" class="ri-input w-full rounded-lg px-3 py-2 mt-1 text-sm"
                     [ngModel]="form().endDate ?? ''" (ngModelChange)="patch({ endDate: $event || null })" />
            </label>
          </div>
          @if (scheduleLocked()) {
            <p class="text-xs ri-faint -mt-2">{{ 'recurring.scheduleLocked' | translate }}</p>
          }

          <div class="grid gap-4 sm:grid-cols-2 items-end">
            <label class="block">
              <span class="text-xs font-semibold ri-muted">{{ 'recurring.terms' | translate }}</span>
              <input type="number" min="0" max="365" class="ri-input w-full rounded-lg px-3 py-2 mt-1 text-sm"
                     [ngModel]="form().paymentTermsDays" (ngModelChange)="patch({ paymentTermsDays: +$event || 0 })" />
            </label>
            <label class="flex items-start gap-2 text-sm pb-2">
              <input type="checkbox" class="mt-1" [ngModel]="form().autoSend" (ngModelChange)="patch({ autoSend: $event })" />
              <span>
                <span class="font-semibold block">{{ 'recurring.autoSend' | translate }}</span>
                <span class="text-xs ri-muted">{{ 'recurring.autoSendHint' | translate }}</span>
              </span>
            </label>
          </div>

          <div>
            <p class="text-xs font-semibold ri-muted mb-2">{{ 'recurring.lines' | translate }}</p>
            <div class="space-y-2">
              @for (line of form().lines; track $index; let i = $index) {
                <div class="grid gap-2 grid-cols-12 items-center">
                  <input class="ri-input col-span-12 sm:col-span-5 rounded-lg px-3 py-2 text-sm" [placeholder]="'recurring.lineDescription' | translate"
                         [ngModel]="line.description" (ngModelChange)="setLine(i, { description: $event })" />
                  <input type="number" min="0" step="any" class="ri-input col-span-3 sm:col-span-2 rounded-lg px-3 py-2 text-sm" [attr.aria-label]="'recurring.qty' | translate"
                         [ngModel]="line.qty" (ngModelChange)="setLine(i, { qty: +$event })" />
                  <input type="number" min="0" step="any" class="ri-input col-span-4 sm:col-span-2 rounded-lg px-3 py-2 text-sm" [attr.aria-label]="'recurring.unitPrice' | translate"
                         [ngModel]="line.unitPrice" (ngModelChange)="setLine(i, { unitPrice: +$event })" />
                  <select class="ri-input col-span-3 sm:col-span-2 rounded-lg px-2 py-2 text-sm" [attr.aria-label]="'recurring.vat' | translate"
                          [ngModel]="line.vatRate" (ngModelChange)="setLine(i, { vatRate: +$event })">
                    @for (r of vatRates; track r) {
                      <option [ngValue]="r">TVA {{ r * 100 }} %</option>
                    }
                  </select>
                  <button type="button" class="ri-btn col-span-2 sm:col-span-1 rounded-lg py-2 inline-flex justify-center" [disabled]="form().lines.length === 1"
                          (click)="removeLine(i)" [attr.aria-label]="'recurring.removeLine' | translate">
                    <mat-icon class="!text-[16px] !w-4 !h-4">delete</mat-icon>
                  </button>
                </div>
              }
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 mt-3">
              <button type="button" class="ri-btn text-xs font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1" (click)="addLine()">
                <mat-icon class="!text-[14px] !w-3.5 !h-3.5">add</mat-icon>{{ 'recurring.addLine' | translate }}
              </button>
              <p class="text-sm">
                <span class="ri-muted">{{ 'recurring.perInvoice' | translate }}</span>
                <strong class="ms-1">{{ money(formTotal()) }}</strong>
                <span class="text-xs ri-faint ms-1">({{ 'recurring.ht' | translate }} {{ money(formSubtotal()) }})</span>
              </p>
            </div>
          </div>

          <div class="flex gap-2">
            <button type="button" class="ri-btn-primary text-sm font-semibold px-4 py-2 rounded-lg" [disabled]="busy() || !canSave()" (click)="save()">
              {{ 'recurring.save' | translate }}
            </button>
            <button type="button" class="ri-btn text-sm px-4 py-2 rounded-lg" (click)="cancel()">{{ 'inbox.cancel' | translate }}</button>
          </div>
        </section>
      }

      <section class="ri-card rounded-2xl p-6">
        @for (t of templates(); track t.id) {
          <div class="ri-row py-4 first:border-t-0 first:pt-0">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-semibold flex items-center gap-2 flex-wrap">
                  {{ t.name }}
                  <span class="ri-badge" [class.ri-active]="t.status === 'ACTIVE'" [class.ri-paused]="t.status === 'PAUSED'" [class.ri-ended]="t.status === 'ENDED'">
                    {{ ('recurring.status.' + t.status) | translate }}
                  </span>
                </p>
                <p class="text-xs ri-muted mt-0.5">{{ customerName(t.partnerId) }} · {{ schedule(t) }} · {{ money(t.total) }}</p>
                <p class="text-xs ri-faint mt-0.5">
                  @if (t.status === 'ACTIVE' && t.nextRunDate) {
                    {{ 'recurring.nextOn' | translate: { date: date(t.nextRunDate) } }} ·
                  }
                  {{ 'recurring.generated' | translate: { n: t.generatedCount } }}
                  @if (!t.autoSend) { · {{ 'recurring.draftOnly' | translate }} }
                </p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                @if (t.status !== 'ENDED' && canCreate()) {
                  <button type="button" class="ri-btn text-xs font-semibold px-3 py-1.5 rounded-lg" [disabled]="busy()" (click)="generateNow(t)">{{ 'recurring.generateNow' | translate }}</button>
                }
                @if (canWrite()) {
                  @if (t.status === 'ACTIVE') {
                    <button type="button" class="ri-btn text-xs px-3 py-1.5 rounded-lg" [disabled]="busy()" (click)="pause(t)">{{ 'recurring.pause' | translate }}</button>
                  } @else if (t.status === 'PAUSED') {
                    <button type="button" class="ri-btn text-xs px-3 py-1.5 rounded-lg" [disabled]="busy()" (click)="resume(t)">{{ 'recurring.resume' | translate }}</button>
                  }
                  <button type="button" class="ri-btn text-xs px-3 py-1.5 rounded-lg" (click)="startEdit(t)">{{ 'recurring.edit' | translate }}</button>
                }
                <button type="button" class="ri-btn text-xs px-3 py-1.5 rounded-lg" (click)="toggleHistory(t)">
                  {{ (openId() === t.id ? 'recurring.hideInvoices' : 'recurring.showInvoices') | translate }}
                </button>
                @if (canDelete()) {
                  <button type="button" class="ri-btn ri-danger text-xs px-3 py-1.5 rounded-lg" [attr.aria-label]="'recurring.delete' | translate" (click)="remove(t)">
                    <mat-icon class="!text-[14px] !w-3.5 !h-3.5">delete</mat-icon>
                  </button>
                }
              </div>
            </div>
            @if (openId() === t.id) {
              <div class="mt-3 rounded-xl px-4 py-2" style="background: var(--color-bg)">
                @for (inv of history(); track inv.id) {
                  <div class="flex flex-wrap justify-between gap-2 text-xs py-1.5">
                    <span class="font-semibold">{{ inv.invoiceNumber }}</span>
                    <span class="ri-muted">{{ date(inv.invoiceDate) }} → {{ date(inv.dueDate) }}</span>
                    <span>{{ ('recurring.invoiceStatus.' + inv.status) | translate }}</span>
                    <span class="font-semibold">{{ money(inv.total) }}</span>
                  </div>
                } @empty {
                  <p class="text-xs ri-faint py-1.5">{{ 'recurring.noInvoicesYet' | translate }}</p>
                }
              </div>
            }
          </div>
        } @empty {
          <div class="text-center py-8">
            <mat-icon class="ri-faint">autorenew</mat-icon>
            <p class="text-sm font-semibold mt-2">{{ 'recurring.emptyTitle' | translate }}</p>
            <p class="text-xs ri-muted mt-1">{{ 'recurring.emptyBody' | translate }}</p>
          </div>
        }
      </section>
    </div>
  `
})
export class RecurringInvoicesComponent implements OnInit {
  private api = inject(RecurringInvoicesApi);
  private partners = inject(PartnersService);
  private state = inject(CrmStateService);
  private i18n = inject(TranslationService);
  private toast = inject(ToastService);

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
    if (!confirm(this.i18n.t('recurring.generateConfirm', { name: t.name }))) return;
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
    if (!confirm(this.i18n.t('recurring.deleteConfirm', { name: t.name }))) return;
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
