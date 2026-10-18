import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { errorDetail } from '../../pages/bank/bank-labels';
import { shortDate } from '../../shared/bank.util';
import { ChecklistDetail, ChecklistItem } from '../../services/domains/checklist.service';
import { PortalApi, saveBlob } from '../portal-api.service';
import { UPLOAD_ACCEPT, checklistProgress, itemBadge, needsFile } from '../portal.util';

/**
 * One checklist: each document asked for, with a button to send it (a PDF, or a photo taken
 * with the phone), why it was refused when it was, and the client's own file once sent.
 */
@Component({
  selector: 'app-portal-checklist-detail',
  imports: [MatIconModule, RouterLink, TranslatePipe],
  template: `
    <div class="space-y-4">
      <a routerLink="/portal/checklists" class="btn-link text-sm inline-flex items-center gap-1"><mat-icon class="icon-sm rtl:rotate-180">arrow_back</mat-icon>{{ 'portal.checklists.title' | translate }}</a>
      @if (error()) { <div class="alert alert-danger text-sm" role="alert">{{ error() }}</div> }
      @if (done()) { <div class="alert alert-success text-sm" role="status">{{ done() }}</div> }

      @if (detail(); as d) {
        <div class="space-y-1">
          <h1 class="t-title break-words">{{ d.request.title }}</h1>
          <p class="text-sm text-ink-3">
            @if (d.request.period) { {{ d.request.period }} · }
            @if (d.request.dueDate) { <span [class.text-danger-ink]="d.request.overdue">{{ 'portal.checklists.dueOn' | translate: { date: date(d.request.dueDate) } }}</span> }
          </p>
          <div class="progress mt-2" [class.is-success]="d.request.items > 0 && d.request.accepted === d.request.items"><span [style.width.%]="progress(d)"></span></div>
          <p class="text-xs text-ink-3 num">{{ 'checklists.acceptedOf' | translate: { done: d.request.accepted, total: d.request.items } }}</p>
        </div>
        @if (d.note) { <p class="card p-4 text-sm text-ink-2 whitespace-pre-line break-words">{{ d.note }}</p> }

        <div class="space-y-2">
          @for (x of d.items ?? []; track x.id) {
            <div class="card p-4 space-y-2">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-ink break-words">{{ x.label }}</div>
                  @if (!x.required) { <div class="text-xs text-ink-3">{{ 'checklists.optional' | translate }}</div> }
                </div>
                <span class="badge shrink-0" [class]="badge(x)">{{ ('portal.itemStatus.' + x.status) | translate }}</span>
              </div>
              @if (x.status === 'REJECTED' && x.reviewNote) {
                <div class="alert alert-danger text-sm"><span class="font-medium">{{ 'portal.checklists.rejectedBecause' | translate }}</span> {{ x.reviewNote }}</div>
              }
              @if (x.status === 'RECEIVED') { <p class="text-xs text-ink-3">{{ 'portal.checklists.receivedHint' | translate }}</p> }
              <div class="flex flex-wrap items-center gap-2">
                @if (x.fileId) {
                  <button type="button" class="btn-ghost btn-sm min-w-0 max-w-full" (click)="download(x)">
                    <mat-icon>attach_file</mat-icon><span class="truncate">{{ x.fileName || ('portal.checklists.yourFile' | translate) }}</span>
                  </button>
                }
                @if (d.request.status === 'OPEN' && canSend(x)) {
                  <button type="button" class="btn-primary btn-sm ms-auto" [disabled]="busy()" (click)="pick(x)">
                    <mat-icon>upload</mat-icon>{{ (busy() === x.id ? 'portal.checklists.sending' : (x.status === 'REJECTED' ? 'portal.checklists.sendAgain' : 'portal.checklists.send')) | translate }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
        <p class="text-xs text-ink-3">{{ 'portal.checklists.fileHint' | translate }}</p>
        <input #fileInput type="file" class="hidden" [accept]="accept" (change)="onFile($event)" />
      } @else if (!error()) {
        <div class="card p-10 flex justify-center"><div class="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin"></div></div>
      }
    </div>
  `,
})
export class PortalChecklistDetailComponent implements OnInit {
  private api = inject(PortalApi);
  private route = inject(ActivatedRoute);
  private i18n = inject(TranslationService);
  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly accept = UPLOAD_ACCEPT;

  detail = signal<ChecklistDetail | null>(null);
  /** The id of the item whose file is being sent. */
  busy = signal<string | null>(null);
  error = signal<string | null>(null);
  done = signal<string | null>(null);
  private target: ChecklistItem | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.checklist(id).subscribe({ next: d => this.detail.set(d), error: e => this.fail(e) });
  }

  canSend(x: ChecklistItem): boolean { return needsFile(x); }

  pick(x: ChecklistItem): void {
    this.target = x;
    const input = this.fileInput()?.nativeElement;
    if (!input) return;
    input.value = '';
    input.click();
  }

  onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    const x = this.target;
    if (!file || !x) return;
    this.busy.set(x.id);
    this.error.set(null);
    this.done.set(null);
    this.api.upload(x.id, file).subscribe({
      next: d => {
        this.busy.set(null);
        this.detail.set(d);
        this.done.set(this.i18n.t('portal.checklists.sent', { label: x.label }));
      },
      error: e => { this.busy.set(null); this.fail(e); },
    });
  }

  download(x: ChecklistItem): void {
    this.api.checklistFile(x.id).subscribe({
      next: blob => saveBlob(blob, x.fileName || 'document'),
      error: e => this.fail(e),
    });
  }

  badge(x: ChecklistItem): string { return itemBadge(x.status); }
  progress(d: ChecklistDetail): number { return checklistProgress(d.request); }
  date(iso: string | null | undefined): string { return shortDate(iso); }

  private fail(e: unknown): void {
    this.error.set(errorDetail(e) || this.i18n.t('portal.error'));
  }
}
