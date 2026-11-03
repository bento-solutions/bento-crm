import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PaginatorComponent } from '../../shared/paginator.component';
import { DELIVERY_NOTE_STATUSES, DeliveryNote, DeliveryNoteStatus, DeliveryNotesApi } from '../../services/domains/delivery-notes.service';
import { shortDate } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';
import { DeliveryNoteDialogComponent } from './delivery-note-dialog.component';
import { deliveryNoteBadge } from './delivery-note-labels';

/**
 * Accounts Receivable → Delivery slips: every bon de livraison, filtered by status, each opening
 * in its panel. ?note=<id> opens one (the mission timeline links here).
 */
@Component({
  selector: 'app-delivery-notes',
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe, PageHeaderComponent, EmptyStateComponent, PaginatorComponent, DeliveryNoteDialogComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'deliveryNotes.title' | translate" [subtitle]="'deliveryNotes.subtitle' | translate">
        @if (canWrite()) {
          <button actions class="btn-primary" (click)="openNew()"><mat-icon>add</mat-icon>{{ 'deliveryNotes.new' | translate }}</button>
        }
      </app-page-header>

      <div class="segmented self-start overflow-x-auto max-w-full" role="group" [attr.aria-label]="'deliveryNotes.statusFilter' | translate">
        <button type="button" class="segmented__item" [class.is-active]="!status()" [attr.aria-pressed]="!status()" (click)="setStatus(null)">{{ 'deliveryNotes.allStatuses' | translate }}</button>
        @for (s of statuses; track s) {
          <button type="button" class="segmented__item" [class.is-active]="status() === s" [attr.aria-pressed]="status() === s" (click)="setStatus(s)">{{ ('deliveryNotes.status.' + s) | translate }}</button>
        }
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'deliveryNotes.number' | translate }}</th>
              <th>{{ 'deliveryNotes.customer' | translate }}</th>
              <th class="hidden sm:table-cell">{{ 'deliveryNotes.date' | translate }}</th>
              <th class="hidden md:table-cell">{{ 'deliveryNotes.deal' | translate }}</th>
              <th class="hidden md:table-cell col-num">{{ 'deliveryNotes.lines' | translate }}</th>
              <th>{{ 'deliveryNotes.statusLabel' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (n of notes(); track n.id) {
                <tr [class.bg-subtle]="open()?.id === n.id">
                  <td><button type="button" class="cell-title hover:underline text-start" (click)="open.set(n)">{{ n.number || ('deliveryNotes.draftNumber' | translate) }}</button></td>
                  <td class="max-w-48 truncate">{{ partnerName(n) }}</td>
                  <td class="hidden sm:table-cell cell-muted whitespace-nowrap">{{ date(n.deliveredAt || n.date) }}</td>
                  <td class="hidden md:table-cell">
                    @if (n.dealId) { <a class="text-accent-ink hover:underline" [routerLink]="['/sales/deals', n.dealId]">{{ 'missions.openDeal' | translate }}</a> } @else { — }
                  </td>
                  <td class="hidden md:table-cell col-num num">{{ n.lines?.length || 0 }}</td>
                  <td><span class="badge" [class]="badge(n.status)">{{ ('deliveryNotes.status.' + n.status) | translate }}</span></td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="row-empty">
                  <app-empty-state icon="local_shipping" [title]="'deliveryNotes.emptyTitle' | translate" [text]="'deliveryNotes.emptyText' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (totalPages() > 1) {
          <app-paginator [currentPage]="page() + 1" [totalPages]="totalPages()" [pageSize]="size()"
                         (pageChange)="page.set($event - 1); load()" (pageSizeChange)="size.set(+$event); page.set(0); load()" />
        }
      </div>
    </div>

    @if (open() !== undefined) {
      <app-delivery-note-dialog [initial]="open() ?? null" (changed)="load()" (closed)="close()" />
    }
  `,
})
export class DeliveryNotesComponent implements OnInit {
  private api = inject(DeliveryNotesApi);
  private state = inject(CrmStateService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly statuses = DELIVERY_NOTE_STATUSES;
  notes = signal<DeliveryNote[]>([]);
  status = signal<DeliveryNoteStatus | null>(null);
  page = signal(0);
  size = signal(20);
  totalPages = signal(0);
  /** undefined: closed; null: a new slip; a note: that slip. */
  open = signal<DeliveryNote | null | undefined>(undefined);

  canWrite(): boolean { return this.state.hasAuthority('INVOICES_CREATE'); }

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('deliveryNotes.title'));
    if (!this.state.partners().length) this.state.loadPartners();
    this.load();
    const id = this.route.snapshot.queryParamMap.get('note');
    if (id) this.api.getOne(id).subscribe({ next: n => this.open.set(n), error: e => this.fail(e) });
  }

  load(): void {
    this.api.list({ status: this.status(), page: this.page(), size: this.size() }).subscribe({
      next: p => {
        this.notes.set(p?.content ?? []);
        this.totalPages.set(p?.total_pages ?? 0);
      },
      error: e => this.fail(e),
    });
  }

  setStatus(s: DeliveryNoteStatus | null): void {
    this.status.set(s);
    this.page.set(0);
    this.load();
  }

  openNew(): void { this.open.set(null); }

  close(): void {
    this.open.set(undefined);
    if (this.route.snapshot.queryParamMap.get('note')) {
      this.router.navigate([], { queryParams: { note: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  partnerName(n: DeliveryNote): string {
    return n.partnerName || this.state.partners().find(p => p.id === n.partnerId)?.name || '—';
  }

  badge(s: string): string { return deliveryNoteBadge(s); }
  date(v: string | null | undefined): string { return shortDate(v); }

  private fail(e: unknown): void {
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
