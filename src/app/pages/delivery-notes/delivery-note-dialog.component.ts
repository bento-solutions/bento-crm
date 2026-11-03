import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { DeliveryNote, DeliveryNoteLine, DeliveryNotesApi } from '../../services/domains/delivery-notes.service';
import { InvoicesService } from '../../services/domains/invoices.service';
import { shortDate } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';
import { deliveryNoteBadge, saveBlob, todayIso } from './delivery-note-labels';

interface LineRow extends DeliveryNoteLine { uid: number }
let nextUid = 0;

/**
 * A delivery slip (bon de livraison) in a side panel: its lines while DRAFT, "Mark delivered" (date,
 * signed by), "Download PDF" and "Create invoice". Without a note it creates one for a customer.
 */
@Component({
  selector: 'app-delivery-note-dialog',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe],
  template: `
    <aside class="drawer-panel" role="dialog" aria-modal="false" aria-labelledby="dn-title">
      <header class="flex items-start justify-between gap-2 px-5 py-4 border-b border-line shrink-0">
        <div class="min-w-0">
          <h2 id="dn-title" class="section-title break-words">
            {{ note()?.number || ((note() ? 'deliveryNotes.draftNumber' : 'deliveryNotes.new') | translate) }}
          </h2>
          <p class="text-xs text-ink-3 truncate">{{ partnerName() }}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          @if (note(); as n) { <span class="badge" [class]="badge(n.status)">{{ ('deliveryNotes.status.' + n.status) | translate }}</span> }
          <button class="btn-icon btn-sm" (click)="closed.emit()" [attr.aria-label]="'bank.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3" [disabled]="busy() || !editable()">
          @if (!note()) {
            <label class="block sm:col-span-2"><span class="field-label">{{ 'deliveryNotes.customer' | translate }}</span>
              <select class="input-field" [(ngModel)]="partnerId">
                <option value="">{{ 'deliveryNotes.pickCustomer' | translate }}</option>
                @for (c of customers(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
              </select></label>
          }
          <label class="block"><span class="field-label">{{ 'deliveryNotes.date' | translate }}</span>
            <input type="date" class="input-field" [(ngModel)]="date" /></label>
          @if (note()?.dealId; as dealId) {
            <div class="block"><span class="field-label">{{ 'deliveryNotes.deal' | translate }}</span>
              <a class="text-accent-ink hover:underline text-sm inline-flex items-center gap-1 pt-2" [routerLink]="['/sales/deals', dealId]"><mat-icon class="icon-xs">handshake</mat-icon>{{ 'missions.openDeal' | translate }}</a></div>
          }
        </fieldset>

        <section class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">{{ 'deliveryNotes.lines' | translate }}</h3>
          @for (l of lines(); track l.uid; let i = $index) {
            <div class="grid gap-2 items-end" style="grid-template-columns: 1fr 80px 80px 32px">
              <label class="block min-w-0"><span class="field-label" [class.sr-only]="i > 0">{{ 'deliveryNotes.description' | translate }}</span>
                <input class="input-field w-full" maxlength="500" [disabled]="busy() || !editable()" [ngModel]="l.description" (ngModelChange)="patch(l, { description: $event })" /></label>
              <label class="block"><span class="field-label" [class.sr-only]="i > 0">{{ 'deliveryNotes.qty' | translate }}</span>
                <input type="number" min="0" step="any" class="input-field w-full text-end" [disabled]="busy() || !editable()" [ngModel]="l.qty" (ngModelChange)="patch(l, { qty: +$event || 0 })" /></label>
              <label class="block"><span class="field-label" [class.sr-only]="i > 0">{{ 'deliveryNotes.unit' | translate }}</span>
                <input class="input-field w-full" maxlength="20" [disabled]="busy() || !editable()" [ngModel]="l.unit ?? ''" (ngModelChange)="patch(l, { unit: $event || null })" /></label>
              @if (editable()) {
                <button class="btn-icon btn-sm" [disabled]="busy()" (click)="removeLine(l)" [attr.aria-label]="'deliveryNotes.removeLine' | translate"><mat-icon class="icon-sm">delete</mat-icon></button>
              }
            </div>
          } @empty {
            <p class="text-sm text-ink-3">{{ 'deliveryNotes.noLines' | translate }}</p>
          }
          @if (editable()) {
            <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="addLine()"><mat-icon>add</mat-icon>{{ 'deliveryNotes.addLine' | translate }}</button>
          }
        </section>

        <label class="block"><span class="field-label">{{ 'deliveryNotes.notes' | translate }}</span>
          <textarea class="input-field" rows="2" maxlength="2000" [disabled]="busy() || !editable()" [(ngModel)]="notes"></textarea></label>

        @if (editable() && canWrite()) {
          <div class="flex flex-wrap justify-end gap-2">
            @if (note()) {
              <button class="btn-danger-soft btn-sm me-auto" [disabled]="busy()" (click)="remove()"><mat-icon>delete</mat-icon>{{ 'bank.delete' | translate }}</button>
            }
            <button class="btn-primary btn-sm" [disabled]="busy() || !canSave()" (click)="save()">{{ 'bank.save' | translate }}</button>
          </div>
        }

        @if (note(); as n) {
          @if (n.status === 'DRAFT' && canWrite()) {
            <section class="space-y-2 border-t border-line pt-4">
              <h3 class="text-sm font-semibold text-ink">{{ 'deliveryNotes.markDelivered' | translate }}</h3>
              <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3" [disabled]="busy()">
                <label class="block"><span class="field-label">{{ 'deliveryNotes.deliveredOn' | translate }}</span>
                  <input type="date" class="input-field" [(ngModel)]="deliverDate" /></label>
                <label class="block"><span class="field-label">{{ 'deliveryNotes.signedBy' | translate }}</span>
                  <input class="input-field" maxlength="160" [(ngModel)]="signedBy" /></label>
              </fieldset>
              <p class="text-xs text-ink-3">{{ 'deliveryNotes.deliverHint' | translate }}</p>
              <div class="flex justify-end">
                <button class="btn-primary btn-sm" [disabled]="busy() || !lines().length" (click)="deliver(n)"><mat-icon>local_shipping</mat-icon>{{ 'deliveryNotes.markDelivered' | translate }}</button>
              </div>
            </section>
          }

          @if (n.status !== 'DRAFT') {
            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border-t border-line pt-4">
              <dt class="text-ink-3">{{ 'deliveryNotes.deliveredOn' | translate }}</dt><dd class="text-ink">{{ fmt(n.deliveredAt || n.date) }}</dd>
              <dt class="text-ink-3">{{ 'deliveryNotes.signedBy' | translate }}</dt><dd class="text-ink">{{ n.signedBy || '—' }}</dd>
            </dl>
          }

          <div class="flex flex-wrap gap-2 border-t border-line pt-4">
            <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="pdf(n)"><mat-icon>picture_as_pdf</mat-icon>{{ 'deliveryNotes.pdf' | translate }}</button>
            @if (n.status === 'DELIVERED' && !n.invoiceId && canWrite()) {
              <button class="btn-primary btn-sm" [disabled]="busy()" (click)="invoice(n)"><mat-icon>receipt</mat-icon>{{ 'deliveryNotes.createInvoice' | translate }}</button>
            }
            @if (n.invoiceId) {
              <a class="btn-ghost btn-sm" routerLink="/finance"><mat-icon>receipt</mat-icon>{{ 'deliveryNotes.openInvoice' | translate }}</a>
            }
          </div>
        }
      </div>
    </aside>
  `,
})
export class DeliveryNoteDialogComponent implements OnInit {
  private api = inject(DeliveryNotesApi);
  private invoices = inject(InvoicesService);
  private state = inject(CrmStateService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private confirm = inject(ConfirmService);

  /** The note to show; null creates a new one. */
  initial = input<DeliveryNote | null>(null);
  changed = output<DeliveryNote | null>();
  closed = output<void>();

  note = signal<DeliveryNote | null>(null);
  lines = signal<LineRow[]>([]);
  busy = signal(false);
  customers = computed(() => this.state.partners().filter(p => p.type === 'Customer'));
  editable = computed(() => !this.note() || this.note()!.status === 'DRAFT');

  partnerId = '';
  date = todayIso();
  notes = '';
  deliverDate = todayIso();
  signedBy = '';

  ngOnInit(): void {
    this.show(this.initial());
    if (!this.state.partners().length) this.state.loadPartners();
  }

  canWrite(): boolean { return this.state.hasAuthority('INVOICES_CREATE'); }
  canSave(): boolean { return (!!this.note() || !!this.partnerId) && this.lines().some(l => l.description.trim()); }

  partnerName(): string {
    const n = this.note();
    if (n?.partnerName) return n.partnerName;
    const id = n?.partnerId || this.partnerId;
    return this.state.partners().find(p => p.id === id)?.name || '';
  }

  private show(n: DeliveryNote | null): void {
    this.note.set(n);
    this.partnerId = n?.partnerId ?? '';
    this.date = n?.date ?? todayIso();
    this.notes = n?.notes ?? '';
    this.lines.set((n?.lines ?? []).map(l => ({ ...l, uid: ++nextUid })));
    if (!n) this.addLine();
  }

  patch(l: LineRow, change: Partial<DeliveryNoteLine>): void {
    this.lines.update(list => list.map(x => (x.uid === l.uid ? { ...x, ...change } : x)));
  }

  addLine(): void {
    this.lines.update(list => [...list, { uid: ++nextUid, description: '', qty: 1, unit: null }]);
  }

  removeLine(l: LineRow): void {
    this.lines.update(list => list.filter(x => x.uid !== l.uid));
  }

  save(): void {
    const n = this.note();
    const lines: DeliveryNoteLine[] = this.lines().filter(l => l.description.trim()).map(l => {
      const out: DeliveryNoteLine = { description: l.description.trim(), qty: Number(l.qty) || 0 };
      if (l.unit) out.unit = l.unit;
      if (l.productId) out.productId = l.productId;
      return out;
    });
    const body = {
      partnerId: n?.partnerId ?? this.partnerId,
      dealId: n?.dealId ?? null,
      missionId: n?.missionId ?? null,
      date: this.date || null,
      lines,
      notes: this.notes.trim() || null,
    };
    this.busy.set(true);
    (n ? this.api.update(n.id, body) : this.api.create(body)).subscribe({
      next: saved => this.done(saved, 'deliveryNotes.saved'),
      error: e => this.fail(e),
    });
  }

  async remove(): Promise<void> {
    const n = this.note();
    if (!n) return;
    if (!(await this.confirm.ask({ title: this.i18n.t('deliveryNotes.confirmDelete'), danger: true }))) return;
    this.busy.set(true);
    this.api.remove(n.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('deliveryNotes.deleted'), { type: 'success' });
        this.changed.emit(null);
        this.closed.emit();
      },
      error: e => this.fail(e),
    });
  }

  deliver(n: DeliveryNote): void {
    this.busy.set(true);
    this.api.deliver(n.id, { date: this.deliverDate || null, signedBy: this.signedBy.trim() || null }).subscribe({
      next: saved => this.done(saved, 'deliveryNotes.delivered'),
      error: e => this.fail(e),
    });
  }

  invoice(n: DeliveryNote): void {
    this.busy.set(true);
    this.api.invoice(n.id).subscribe({
      next: inv => {
        this.invoices.load(undefined, true);
        this.toast.show(this.i18n.t('deliveryNotes.invoiced'), { type: 'success' });
        this.api.getOne(n.id).subscribe({
          next: saved => this.done(saved),
          error: () => this.done({ ...n, status: 'INVOICED', invoiceId: inv?.id ?? n.invoiceId }),
        });
      },
      error: e => this.fail(e),
    });
  }

  pdf(n: DeliveryNote): void {
    this.api.pdf(n.id).subscribe({
      next: blob => saveBlob(blob, `${n.number || 'delivery-slip'}.pdf`),
      error: e => this.fail(e),
    });
  }

  private done(saved: DeliveryNote, messageKey?: string): void {
    this.busy.set(false);
    if (messageKey) this.toast.show(this.i18n.t(messageKey), { type: 'success' });
    this.show(saved);
    this.changed.emit(saved);
  }

  badge(s: string): string { return deliveryNoteBadge(s); }
  fmt(v: string | null | undefined): string { return v ? shortDate(v) : '—'; }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
