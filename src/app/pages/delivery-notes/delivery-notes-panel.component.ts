import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { DeliveryNote, DeliveryNotesApi } from '../../services/domains/delivery-notes.service';
import { shortDate } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';
import { DeliveryNoteDialogComponent } from './delivery-note-dialog.component';
import { deliveryNoteBadge } from './delivery-note-labels';

/**
 * The delivery slips of a deal (GET /delivery-notes?dealId=), and "Create delivery slip"
 * (POST /deals/{id}/delivery-note, a DRAFT from the deal's order lines).
 */
@Component({
  selector: 'app-delivery-notes-panel',
  imports: [MatIconModule, TranslatePipe, DeliveryNoteDialogComponent],
  template: `
    @if (canRead()) {
      <section class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-semibold text-ink">{{ 'deliveryNotes.title' | translate }}</h3>
          @if (canWrite()) {
            <button class="btn-secondary btn-sm ms-auto" [disabled]="busy()" (click)="create()"><mat-icon>local_shipping</mat-icon>{{ 'deliveryNotes.create' | translate }}</button>
          }
        </div>
        @for (n of notes(); track n.id) {
          <button type="button" class="w-full text-start flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 hover:bg-subtle" (click)="open.set(n)">
            <div class="min-w-0">
              <div class="text-sm text-ink truncate">{{ n.number || ('deliveryNotes.draftNumber' | translate) }}</div>
              <div class="text-meta text-ink-3">{{ date(n.deliveredAt || n.date) }} · {{ 'deliveryNotes.nLines' | translate: { n: n.lines?.length || 0 } }}</div>
            </div>
            <span class="badge shrink-0" [class]="badge(n.status)">{{ ('deliveryNotes.status.' + n.status) | translate }}</span>
          </button>
        } @empty {
          <p class="text-xs text-ink-3">{{ 'deliveryNotes.none' | translate }}</p>
        }
      </section>

      @if (open(); as n) {
        <app-delivery-note-dialog [initial]="n" (changed)="load(dealId())" (closed)="open.set(null)" />
      }
    }
  `,
})
export class DeliveryNotesPanelComponent {
  private api = inject(DeliveryNotesApi);
  private state = inject(CrmStateService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);

  dealId = input.required<string>();
  notes = signal<DeliveryNote[]>([]);
  open = signal<DeliveryNote | null>(null);
  busy = signal(false);

  constructor() {
    effect(() => {
      const id = this.dealId();
      untracked(() => this.load(id));
    });
  }

  canRead(): boolean { return this.state.hasAuthority('INVOICES_READ'); }
  canWrite(): boolean { return this.state.hasAuthority('INVOICES_CREATE'); }

  load(dealId: string): void {
    if (!dealId || !this.canRead()) { this.notes.set([]); return; }
    this.api.list({ dealId, size: 100 }).subscribe({
      next: p => { if (this.dealId() === dealId) this.notes.set(p?.content ?? []); },
      error: () => { /* no slip to show */ },
    });
  }

  create(): void {
    this.busy.set(true);
    this.api.fromDeal(this.dealId()).subscribe({
      next: n => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('deliveryNotes.created'), { type: 'success' });
        this.load(this.dealId());
        this.open.set(n);
      },
      error: e => {
        this.busy.set(false);
        this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
      },
    });
  }

  badge(s: string): string { return deliveryNoteBadge(s); }
  date(v: string | null | undefined): string { return shortDate(v); }
}
