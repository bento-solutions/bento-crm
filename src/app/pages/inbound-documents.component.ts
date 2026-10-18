import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { FilePreviewComponent } from '../shared/file-preview.component';
import { formatBytes, totalsMismatch } from '../shared/documents.util';
import { ContactOption, DriveApi } from '../services/domains/drive.service';
import {
  BookRequest, InboundApi, InboundDocument, InboundKind, InboundStatus,
} from '../services/domains/inbound.service';

interface ReviewForm {
  supplierMode: 'existing' | 'new';
  partnerId: string | null;
  supplierName: string;
  supplierIce: string;
  supplierIf: string;
  supplierEmail: string;
  supplierPhone: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
}

const STATUSES: InboundStatus[] = ['NEEDS_REVIEW', 'BOOKED', 'QUEUED', 'FILED', 'DUPLICATE', 'IGNORED', 'FAILED'];
const PAGE_SIZE = 25;

function blank(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Documents inbox: supplier invoices and bank statements that arrive by email, WhatsApp or upload.
 * The AI reader books what it is sure of; the rest waits here under "To check", where a person
 * confirms or corrects what was read, beside the document itself, before it is booked.
 */
@Component({
  selector: 'app-inbound-documents',
  host: { '(document:keydown.escape)': 'onEscape()' },
  imports: [FormsModule, MatIconModule, RouterLink, TranslatePipe, PageHeaderComponent, EmptyStateComponent, FilePreviewComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'inboundDocs.title' | translate" [subtitle]="'inboundDocs.subtitle' | translate">
        <div actions class="flex flex-wrap gap-2">
          <button class="btn-secondary" (click)="reload()"><mat-icon>refresh</mat-icon>{{ 'inboundDocs.refresh' | translate }}</button>
          @if (canSeeSettings()) {
            <a routerLink="/settings/inboxes" class="btn-secondary"><mat-icon>alternate_email</mat-icon>{{ 'inboundDocs.addresses' | translate }}</a>
          }
          @if (canUpload()) {
            <button class="btn-primary" (click)="uploadOpen.set(true)"><mat-icon>upload</mat-icon>{{ 'inboundDocs.upload' | translate }}</button>
          }
        </div>
      </app-page-header>

      <div class="tabs" role="tablist">
        @for (s of statuses; track s) {
          <button role="tab" class="tab" [class.is-active]="status() === s" [attr.aria-selected]="status() === s" (click)="setStatus(s)">
            {{ ('inboundDocs.status.' + s) | translate }}
            <span class="count-pill" [class.is-alert]="s === 'NEEDS_REVIEW' && (counts()[s] ?? 0) > 0">{{ counts()[s] ?? 0 }}</span>
          </button>
        }
      </div>

      <div class="table-card">
        <table class="data-table">
          <thead><tr>
            <th>{{ 'inboundDocs.file' | translate }}</th>
            <th class="hidden md:table-cell">{{ 'inboundDocs.channel' | translate }}</th>
            <th class="hidden lg:table-cell">{{ 'inboundDocs.sender' | translate }}</th>
            <th class="hidden md:table-cell">{{ 'inboundDocs.received' | translate }}</th>
            <th class="hidden lg:table-cell">{{ 'inboundDocs.supplier' | translate }}</th>
            <th class="col-num hidden sm:table-cell">{{ 'inboundDocs.total' | translate }}</th>
            <th>{{ 'inboundDocs.statusLabel' | translate }}</th>
            <th class="hidden sm:table-cell">{{ 'inboundDocs.reason' | translate }}</th>
            <th class="col-actions hidden sm:table-cell"></th>
          </tr></thead>
          <tbody>
            @for (d of docs(); track d.id) {
              <tr>
                <td class="max-w-44 sm:max-w-64">
                  <button class="text-start min-w-0 block w-full" (click)="open(d)">
                    <span class="cell-title truncate block hover:underline">{{ d.fileName || '—' }}</span>
                  </button>
                  <div class="cell-sub truncate">{{ ('inboundDocs.kind.' + d.kind) | translate }}@if (d.subject) { · {{ d.subject }} }</div>
                  <div class="cell-sub truncate lg:hidden">@if (d.partnerName || d.extraction?.supplierName) { {{ d.partnerName || d.extraction?.supplierName }} · }<span class="md:hidden">{{ dateTime(d.receivedAt) }}</span>@if (has(d.extraction?.total)) { <span class="sm:hidden num"> · {{ money(d.extraction?.total, d.extraction?.currency) }}</span> }</div>
                  @if (d.reviewReason || d.error) { <div class="sm:hidden text-xs text-ink-3 whitespace-normal break-words mt-1">{{ d.reviewReason || d.error }}</div> }
                </td>
                <td class="whitespace-nowrap hidden md:table-cell"><span class="badge badge-neutral"><mat-icon class="icon-xs">{{ channelIcon(d.channel) }}</mat-icon>{{ channelLabel(d.channel) }}</span></td>
                <td class="cell-muted max-w-48 truncate hidden lg:table-cell">{{ d.sender || '—' }}</td>
                <td class="cell-muted whitespace-nowrap hidden md:table-cell">{{ dateTime(d.receivedAt) }}</td>
                <td class="max-w-48 truncate hidden lg:table-cell">{{ d.partnerName || d.extraction?.supplierName || '—' }}</td>
                <td class="col-num num whitespace-nowrap hidden sm:table-cell">{{ has(d.extraction?.total) ? money(d.extraction?.total, d.extraction?.currency) : '—' }}</td>
                <td><span class="badge" [class]="statusBadge(d.status)">{{ ('inboundDocs.status.' + d.status) | translate }}</span>
                  @if (d.status === 'BOOKED' && d.invoiceNumber) { <div class="cell-sub">{{ d.invoiceNumber }}</div> }</td>
                <td class="cell-muted text-xs max-w-64 min-w-32 hidden sm:table-cell">{{ d.reviewReason || d.error || '' }}</td>
                <td class="col-actions hidden sm:table-cell">
                  @if (isReviewable(d)) {
                    <button class="btn-secondary btn-sm" (click)="open(d)">{{ 'inboundDocs.review' | translate }}</button>
                  } @else {
                    <button class="btn-ghost btn-sm" (click)="open(d)">{{ 'inboundDocs.view' | translate }}</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="9" class="row-empty">
                <app-empty-state icon="move_to_inbox" [title]="'inboundDocs.emptyTitle' | translate" [text]="'inboundDocs.emptyText' | translate" />
              </td></tr>
            }
          </tbody>
        </table>
        @if (totalPages() > 1) {
          <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-line">
            <button class="btn-icon btn-sm" [disabled]="page() === 0" (click)="goPage(page() - 1)" [attr.aria-label]="'drive.previous' | translate"><mat-icon class="icon-sm rtl:rotate-180">chevron_left</mat-icon></button>
            <span class="text-xs text-ink-2 num">{{ 'drive.pageOf' | translate: { page: page() + 1, pages: totalPages() } }}</span>
            <button class="btn-icon btn-sm" [disabled]="page() + 1 >= totalPages()" (click)="goPage(page() + 1)" [attr.aria-label]="'drive.next' | translate"><mat-icon class="icon-sm rtl:rotate-180">chevron_right</mat-icon></button>
          </div>
        }
      </div>
    </div>

    <!-- Upload -->
    @if (uploadOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">{{ 'inboundDocs.upload' | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="closeUpload()" [attr.aria-label]="'inboundDocs.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <div role="radiogroup" [attr.aria-label]="'inboundDocs.kindLabel' | translate" class="space-y-2">
            @for (k of uploadKinds; track k) {
              <label class="choice-row">
                <input type="radio" name="kind" [value]="k" [checked]="uploadKind() === k" (change)="uploadKind.set(k)" />
                <span class="text-sm text-ink">{{ ('inboundDocs.kind.' + k) | translate }}</span>
              </label>
            }
          </div>
          <label class="block"><span class="field-label">{{ 'inboundDocs.file' | translate }}</span>
            <input type="file" class="input-field" accept="application/pdf,image/*" (change)="onUploadPick($event)" /></label>
          <p class="text-xs text-ink-3">{{ 'inboundDocs.uploadHint' | translate }}</p>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeUpload()">{{ 'inboundDocs.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !uploadFile()" (click)="upload()">{{ (busy() ? 'inboundDocs.reading' : 'inboundDocs.uploadAction') | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Review / detail -->
    @if (selected(); as d) {
      <div class="modal-backdrop">
        <div class="modal modal-3xl" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 class="modal-title truncate">{{ d.fileName }}</h3>
              <p class="modal-subtitle">
                {{ ('inboundDocs.kind.' + d.kind) | translate }} · {{ channelLabel(d.channel) }}@if (d.sender) { · {{ d.sender }} } · {{ dateTime(d.receivedAt) }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="badge" [class]="statusBadge(d.status)">{{ ('inboundDocs.status.' + d.status) | translate }}</span>
              <button class="btn-icon btn-sm" (click)="close()" [attr.aria-label]="'inboundDocs.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2 min-h-0">
            <div class="h-[50vh] lg:h-[70vh] min-h-0">
              @if (d.fileId) {
                <app-file-preview class="h-full" [fileId]="d.fileId" [contentType]="d.contentType" [fileName]="d.fileName || ''" />
              }
            </div>

            <div class="space-y-4 min-w-0">
              @if (d.reviewReason || d.error) {
                <div class="alert text-sm" [class.alert-warning]="d.status !== 'FAILED'" [class.alert-danger]="d.status === 'FAILED'">{{ d.reviewReason || d.error }}</div>
              }

              @if (d.status === 'BOOKED' && d.invoiceId) {
                <div class="alert alert-success text-sm flex flex-wrap items-center gap-2">
                  <span>{{ 'inboundDocs.bookedAs' | translate: { number: d.invoiceNumber || '' } }}</span>
                  <button class="btn-link" (click)="openInvoice()">{{ 'inboundDocs.openInvoice' | translate }}</button>
                </div>
              }

              @if (form(); as f) {
                <fieldset class="space-y-3" [disabled]="busy() || !canBook()">
                  <div>
                    <span class="field-label">{{ 'inboundDocs.supplier' | translate }}</span>
                    <div class="segmented" role="group">
                      <button type="button" class="segmented__item" [attr.aria-pressed]="f.supplierMode === 'existing'" (click)="f.supplierMode = 'existing'">{{ 'inboundDocs.existingSupplier' | translate }}</button>
                      <button type="button" class="segmented__item" [attr.aria-pressed]="f.supplierMode === 'new'" (click)="f.supplierMode = 'new'">{{ 'inboundDocs.newSupplier' | translate }}</button>
                    </div>
                  </div>
                  @if (f.supplierMode === 'existing') {
                    <label class="block"><span class="field-label">{{ 'inboundDocs.vendor' | translate }}</span>
                      <select class="input-field" [(ngModel)]="f.partnerId">
                        <option [ngValue]="null">{{ 'inboundDocs.pickVendor' | translate }}</option>
                        @for (v of vendors(); track v.id) { <option [ngValue]="v.id">{{ v.name }}</option> }
                      </select></label>
                    @if (d.extraction?.supplierName) {
                      <p class="text-xs text-ink-3">{{ 'inboundDocs.readAs' | translate: { name: d.extraction?.supplierName || '' } }}</p>
                    }
                  } @else {
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label class="block sm:col-span-2"><span class="field-label">{{ 'inboundDocs.supplierName' | translate }}</span>
                        <input class="input-field" [(ngModel)]="f.supplierName" maxlength="255" /></label>
                      <label class="block"><span class="field-label">ICE</span>
                        <input class="input-field num" [(ngModel)]="f.supplierIce" maxlength="30" /></label>
                      <label class="block"><span class="field-label">IF</span>
                        <input class="input-field num" [(ngModel)]="f.supplierIf" maxlength="30" /></label>
                      <label class="block"><span class="field-label">{{ 'inboundDocs.email' | translate }}</span>
                        <input type="email" class="input-field" [(ngModel)]="f.supplierEmail" maxlength="255" /></label>
                      <label class="block"><span class="field-label">{{ 'inboundDocs.phone' | translate }}</span>
                        <input type="tel" class="input-field" [(ngModel)]="f.supplierPhone" maxlength="40" /></label>
                    </div>
                  }

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label class="block"><span class="field-label">{{ 'inboundDocs.invoiceNumber' | translate }}</span>
                      <input class="input-field" [(ngModel)]="f.invoiceNumber" maxlength="100" /></label>
                    <label class="block"><span class="field-label">{{ 'inboundDocs.invoiceDate' | translate }}</span>
                      <input type="date" class="input-field" [(ngModel)]="f.invoiceDate" /></label>
                    <label class="block"><span class="field-label">{{ 'inboundDocs.dueDate' | translate }}</span>
                      <input type="date" class="input-field" [(ngModel)]="f.dueDate" /></label>
                    <label class="block"><span class="field-label">{{ 'inboundDocs.subtotal' | translate }}</span>
                      <input type="number" step="0.01" class="input-field num" [(ngModel)]="f.subtotal" /></label>
                    <label class="block"><span class="field-label">{{ 'inboundDocs.tax' | translate }}</span>
                      <input type="number" step="0.01" class="input-field num" [(ngModel)]="f.tax" /></label>
                    <label class="block"><span class="field-label">{{ 'inboundDocs.totalTtc' | translate }}</span>
                      <input type="number" step="0.01" class="input-field num" [(ngModel)]="f.total" /></label>
                  </div>
                  @if (mismatch(f)) {
                    <div class="alert alert-warning text-sm">{{ 'inboundDocs.mismatch' | translate: { sum: money((f.subtotal ?? 0) + (f.tax ?? 0), d.extraction?.currency) } }}</div>
                  }
                  @if (d.extraction?.lines?.length) {
                    <p class="text-xs text-ink-3">{{ 'inboundDocs.linesKept' | translate: { n: d.extraction?.lines?.length ?? 0 } }}</p>
                  }
                </fieldset>
                @if (!canBook()) {
                  <p class="text-xs text-ink-3">{{ 'inboundDocs.noBookRight' | translate }}</p>
                }
              } @else if (d.extraction; as x) {
                <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt class="text-ink-3">{{ 'inboundDocs.supplier' | translate }}</dt><dd class="text-ink">{{ d.partnerName || x.supplierName || '—' }}</dd>
                  <dt class="text-ink-3">{{ 'inboundDocs.invoiceNumber' | translate }}</dt><dd class="text-ink">{{ x.invoiceNumber || '—' }}</dd>
                  <dt class="text-ink-3">{{ 'inboundDocs.invoiceDate' | translate }}</dt><dd class="text-ink">{{ shortDate(x.invoiceDate) }}</dd>
                  <dt class="text-ink-3">{{ 'inboundDocs.dueDate' | translate }}</dt><dd class="text-ink">{{ shortDate(x.dueDate) }}</dd>
                  <dt class="text-ink-3">{{ 'inboundDocs.subtotal' | translate }}</dt><dd class="text-ink num">{{ has(x.subtotal) ? money(x.subtotal, x.currency) : '—' }}</dd>
                  <dt class="text-ink-3">{{ 'inboundDocs.tax' | translate }}</dt><dd class="text-ink num">{{ has(x.tax) ? money(x.tax, x.currency) : '—' }}</dd>
                  <dt class="text-ink-3">{{ 'inboundDocs.totalTtc' | translate }}</dt><dd class="text-ink num">{{ has(x.total) ? money(x.total, x.currency) : '—' }}</dd>
                </dl>
              } @else {
                <p class="text-sm text-ink-3">{{ 'inboundDocs.notRead' | translate }}</p>
              }
            </div>
          </div>

          <div class="modal-footer flex-wrap">
            <span class="text-xs text-ink-3 me-auto">{{ size(d.fileSize) }}</span>
            @if (canIgnore(d)) {
              <button class="btn-ghost" [disabled]="busy()" (click)="ignore(d)">{{ 'inboundDocs.ignore' | translate }}</button>
            }
            @if (canRetry(d)) {
              <button class="btn-secondary" [disabled]="busy()" (click)="retry(d)"><mat-icon>auto_awesome</mat-icon>{{ 'inboundDocs.retry' | translate }}</button>
            }
            @if (form() && canBook()) {
              <button class="btn-primary" [disabled]="busy() || !bookable()" (click)="book(d)">{{ 'inboundDocs.book' | translate }}</button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class InboundDocumentsComponent implements OnInit {
  private api = inject(InboundApi);
  private drive = inject(DriveApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private router = inject(Router);

  readonly statuses = STATUSES;
  readonly uploadKinds: InboundKind[] = ['VENDOR_INVOICE', 'BANK_STATEMENT'];

  status = signal<InboundStatus>('NEEDS_REVIEW');
  counts = signal<Partial<Record<InboundStatus, number>>>({});
  docs = signal<InboundDocument[]>([]);
  total = signal(0);
  page = signal(0);
  busy = signal(false);
  vendors = signal<ContactOption[]>([]);

  uploadOpen = signal(false);
  uploadKind = signal<InboundKind>('VENDOR_INVOICE');
  uploadFile = signal<File | null>(null);

  selected = signal<InboundDocument | null>(null);
  form = signal<ReviewForm | null>(null);

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  canBook(): boolean {
    return this.state.hasAuthority('INVOICES_CREATE');
  }

  canUpload(): boolean {
    return this.state.hasAuthority('FILES_WRITE');
  }

  canSeeSettings(): boolean {
    return this.state.hasAuthority('INVOICES_READ') || this.state.hasAuthority('PAYMENTS_READ');
  }

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('inboundDocs.title'));
    this.reload();
    this.drive.contacts('VENDOR').subscribe({ next: v => this.vendors.set(v), error: () => { /* typed-in supplier only */ } });
  }

  reload(): void {
    this.api.counts().subscribe({ next: c => this.counts.set(c ?? {}), error: () => { /* tabs show 0 */ } });
    this.api.documents([this.status()], this.page(), PAGE_SIZE).subscribe({
      next: p => { this.docs.set(p.content); this.total.set(p.total); },
      error: e => this.fail(e),
    });
  }

  setStatus(s: InboundStatus): void {
    this.status.set(s);
    this.page.set(0);
    this.reload();
  }

  goPage(p: number): void {
    this.page.set(p);
    this.reload();
  }

  // Upload
  onUploadPick(event: Event): void {
    this.uploadFile.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  closeUpload(): void {
    this.uploadOpen.set(false);
    this.uploadFile.set(null);
  }

  upload(): void {
    const file = this.uploadFile();
    if (!file) return;
    this.busy.set(true);
    this.api.upload(file, this.uploadKind()).subscribe({
      next: d => {
        this.busy.set(false);
        this.closeUpload();
        this.toast.show(this.i18n.t('inboundDocs.uploaded'), { type: 'success' });
        this.status.set(d.status);
        this.page.set(0);
        this.reload();
        if (this.isReviewable(d)) this.open(d);
      },
      error: e => this.fail(e),
    });
  }

  // Review
  isReviewable(d: InboundDocument): boolean {
    return d.status === 'NEEDS_REVIEW' && d.kind === 'VENDOR_INVOICE';
  }

  /** Setting a document aside or reading it again changes it: write rights for its kind. */
  canChange(d: InboundDocument): boolean {
    const authority = d.kind === 'VENDOR_INVOICE' ? 'INVOICES_WRITE' : d.kind === 'BANK_STATEMENT' ? 'PAYMENTS_WRITE' : 'FILES_WRITE';
    return this.state.hasAuthority(authority);
  }

  canIgnore(d: InboundDocument): boolean {
    return this.canChange(d) && (d.status === 'NEEDS_REVIEW' || d.status === 'FAILED' || d.status === 'QUEUED');
  }

  canRetry(d: InboundDocument): boolean {
    return this.canChange(d) && (d.status === 'NEEDS_REVIEW' || d.status === 'FAILED' || d.status === 'IGNORED');
  }

  open(d: InboundDocument): void {
    this.selected.set(d);
    this.form.set(this.isReviewable(d) ? this.formFrom(d) : null);
  }

  close(): void {
    this.selected.set(null);
    this.form.set(null);
  }

  /** Escape closes whichever dialog is open, unless a request is running. */
  onEscape(): void {
    if (this.busy()) return;
    if (this.uploadOpen()) this.closeUpload();
    else if (this.selected()) this.close();
  }

  private formFrom(d: InboundDocument): ReviewForm {
    const x = d.extraction ?? {};
    const name = (x.supplierName ?? '').trim().toLowerCase();
    const match = d.partnerId ?? (name ? this.vendors().find(v => v.name.trim().toLowerCase() === name)?.id : null) ?? null;
    return {
      supplierMode: match || !name ? 'existing' : 'new',
      partnerId: match,
      supplierName: blank(x.supplierName), supplierIce: blank(x.supplierIce), supplierIf: blank(x.supplierIf),
      supplierEmail: blank(x.supplierEmail), supplierPhone: blank(x.supplierPhone),
      invoiceNumber: blank(x.invoiceNumber), invoiceDate: blank(x.invoiceDate).slice(0, 10), dueDate: blank(x.dueDate).slice(0, 10),
      subtotal: num(x.subtotal), tax: num(x.tax), total: num(x.total),
    };
  }

  mismatch(f: ReviewForm): boolean {
    return totalsMismatch(f.subtotal, f.tax, f.total);
  }

  bookable(): boolean {
    const f = this.form();
    if (!f || num(f.total) === null) return false;
    return f.supplierMode === 'existing' ? !!f.partnerId : !!f.supplierName.trim();
  }

  book(d: InboundDocument): void {
    const f = this.form();
    if (!f) return;
    const existing = f.supplierMode === 'existing';
    const opt = (v: string): string | null => v.trim() || null;
    const body: BookRequest = {
      partnerId: existing ? f.partnerId : null,
      supplierName: existing ? null : opt(f.supplierName),
      supplierIce: existing ? null : opt(f.supplierIce),
      supplierIf: existing ? null : opt(f.supplierIf),
      supplierEmail: existing ? null : opt(f.supplierEmail),
      supplierPhone: existing ? null : opt(f.supplierPhone),
      invoiceNumber: opt(f.invoiceNumber),
      invoiceDate: opt(f.invoiceDate),
      dueDate: opt(f.dueDate),
      subtotal: num(f.subtotal),
      tax: num(f.tax),
      total: num(f.total)!,
      lines: d.extraction?.lines ?? null,
    };
    this.busy.set(true);
    this.api.book(d.id, body).subscribe({
      next: booked => {
        this.busy.set(false);
        this.form.set(null);
        this.selected.set(booked);
        this.toast.show(this.i18n.t('inboundDocs.booked', { number: booked.invoiceNumber || '' }), {
          type: 'success',
          action: booked.invoiceId ? { label: this.i18n.t('inboundDocs.openInvoice'), onClick: () => this.openInvoice() } : undefined,
        });
        this.reload();
      },
      error: e => this.fail(e),
    });
  }

  ignore(d: InboundDocument): void {
    this.busy.set(true);
    this.api.ignore(d.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.close();
        this.toast.show(this.i18n.t('inboundDocs.ignored'), { type: 'success' });
        this.reload();
      },
      error: e => this.fail(e),
    });
  }

  retry(d: InboundDocument): void {
    this.busy.set(true);
    this.api.retry(d.id).subscribe({
      next: updated => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('inboundDocs.retried'), { type: 'success' });
        this.open(updated);
        this.reload();
      },
      error: e => this.fail(e),
    });
  }

  /** Vendor invoices live under Finance → Vendor invoices. */
  openInvoice(): void {
    this.close();
    this.state.navigateTab.set('Vendor');
    this.router.navigate(['/finance']);
  }

  // Display
  channelLabel(c?: string | null): string {
    return c && ['EMAIL', 'WHATSAPP', 'UPLOAD'].includes(c) ? this.i18n.t('inboundDocs.channel.' + c) : (c ?? '—');
  }

  channelIcon(c?: string | null): string {
    return c === 'EMAIL' ? 'mail' : c === 'WHATSAPP' ? 'chat' : 'upload';
  }

  statusBadge(s: InboundStatus): string {
    switch (s) {
      case 'BOOKED': case 'FILED': return 'badge badge-success';
      case 'NEEDS_REVIEW': return 'badge badge-warning';
      case 'FAILED': return 'badge badge-danger';
      case 'QUEUED': return 'badge badge-info';
      default: return 'badge badge-neutral';
    }
  }

  money(v: number | null | undefined, currency?: string | null): string {
    try {
      return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: currency || 'MAD' }).format(Number(v) || 0);
    } catch {
      return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Number(v) || 0);
    }
  }

  has(v: unknown): boolean {
    return v !== null && v !== undefined && v !== '';
  }

  size(bytes?: number | null): string {
    return formatBytes(bytes);
  }

  shortDate(iso?: string | null): string {
    return iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR') : '—';
  }

  dateTime(iso?: string | null): string {
    return iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    const err = e as { error?: { detail?: string } };
    this.toast.show(err?.error?.detail || this.i18n.t('inboundDocs.error'), { type: 'error' });
  }
}
