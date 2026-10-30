import { Component, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { FilePreviewComponent } from '../../shared/file-preview.component';
import { DriveApi } from '../../services/domains/drive.service';
import {
  ChecklistApi, ChecklistDetail, ChecklistItem, ChecklistStatus, RemindResult,
} from '../../services/domains/checklist.service';
import { shortDate } from '../../shared/bank.util';
import { UPLOAD_ACCEPT, checklistProgress, contentTypeFromName, itemBadge, needsFile } from '../../portal/portal.util';
import { errorDetail } from '../bank/bank-labels';

interface ItemEdit { id: string; label: string; required: boolean }

/**
 * One checklist in a side panel: its reminders ("Remind now"), and each document asked for with
 * its status. Staff can send a file on the client's behalf, open what was received, accept it or
 * refuse it with a note the client sees, and add, rename or remove documents.
 */
@Component({
  selector: 'app-checklist-detail',
  imports: [FormsModule, MatIconModule, TranslatePipe, FilePreviewComponent],
  template: `
    @let d = detail();
    @let r = d.request;
    <aside class="drawer-panel" role="dialog" aria-modal="false" aria-labelledby="checklist-title">
      <header class="flex items-start justify-between gap-2 px-5 py-4 border-b border-line shrink-0">
        <div class="min-w-0">
          <h2 id="checklist-title" class="section-title break-words">{{ r.title }}</h2>
          <p class="text-xs text-ink-3 truncate">{{ r.partnerName || '—' }}@if (r.period) { · {{ r.period }} }</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          @if (canWrite()) {
            <button class="btn-ghost btn-sm" (click)="edit.emit(d)">{{ 'bank.edit' | translate }}</button>
          }
          <button class="btn-icon btn-sm" (click)="closed.emit()" [attr.aria-label]="'bank.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge" [class]="statusBadge(r.status)">{{ ('checklists.status.' + r.status) | translate }}</span>
          @if (r.overdue) { <span class="badge badge-danger">{{ 'checklists.overdue' | translate }}</span> }
          @if (r.toCheck > 0) { <span class="badge badge-info">{{ 'checklists.toCheckN' | translate: { n: r.toCheck } }}</span> }
        </div>
        <div>
          <div class="progress" [class.is-success]="r.items > 0 && r.accepted === r.items"><span [style.width.%]="progress()"></span></div>
          <div class="text-xs text-ink-3 mt-1 num">{{ 'checklists.acceptedOf' | translate: { done: r.accepted, total: r.items } }}@if (r.missing > 0) { · {{ 'checklists.missingN' | translate: { n: r.missing } }} }</div>
        </div>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt class="text-ink-3">{{ 'checklists.dueDate' | translate }}</dt><dd class="text-ink" [class.text-danger-ink]="r.overdue">{{ date(r.dueDate) }}</dd>
          <dt class="text-ink-3">{{ 'checklists.reminders' | translate }}</dt>
          <dd class="text-ink">@if (r.remindChannel === 'NONE') { {{ 'checklists.channel.NONE' | translate }} } @else { {{ 'checklists.remindSummary' | translate: { channel: channelLabel(r.remindChannel), n: r.remindEveryDays } }} }</dd>
          <dt class="text-ink-3">{{ 'checklists.lastReminder' | translate }}</dt>
          <dd class="text-ink">{{ r.lastReminderAt ? date(r.lastReminderAt) : '—' }}@if (r.reminderCount > 0) { <span class="text-ink-3"> · {{ 'checklists.reminderCount' | translate: { n: r.reminderCount } }}</span> }</dd>
        </dl>
        @if (d.note) { <p class="text-sm text-ink-2 whitespace-pre-line break-words">{{ d.note }}</p> }

        @if (canWrite() && r.status === 'OPEN') {
          <div class="space-y-2">
            <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="remind()"><mat-icon>notifications_active</mat-icon>{{ 'checklists.remindNow' | translate }}</button>
            @if (remindResult(); as res) {
              <div class="alert text-sm" [class]="res.email || res.whatsapp ? 'alert-success' : 'alert-warning'" role="status">
                @if (res.email && res.whatsapp) { {{ 'checklists.remindSentBoth' | translate }} }
                @else if (res.email) { {{ 'checklists.remindSentEmail' | translate }} }
                @else if (res.whatsapp) { {{ 'checklists.remindSentWhatsapp' | translate }} }
                @if (res.problem) { <div class="text-xs mt-1">{{ res.problem }}</div> }
              </div>
            }
            @if (remindError()) { <div class="alert alert-danger text-sm" role="alert">{{ remindError() }}</div> }
          </div>
        }

        <!-- Items -->
        <section class="space-y-2 border-t border-line pt-4">
          <h3 class="text-sm font-semibold text-ink">{{ 'checklists.items' | translate }}</h3>
          @for (x of d.items ?? []; track x.id) {
            <div class="card p-3 space-y-2">
              @if (editing()?.id === x.id) {
                @if (editing(); as e) {
                  <fieldset class="space-y-2" [disabled]="busy()">
                    <label class="block"><span class="field-label">{{ 'checklists.itemLabel' | translate }}</span>
                      <input class="input-field" maxlength="200" [(ngModel)]="e.label" /></label>
                    <label class="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" [(ngModel)]="e.required" /><span class="text-xs text-ink-2">{{ 'checklists.required' | translate }}</span>
                    </label>
                    <div class="flex justify-end gap-2">
                      <button class="btn-ghost btn-sm" (click)="editing.set(null)">{{ 'bank.cancel' | translate }}</button>
                      <button class="btn-primary btn-sm" [disabled]="busy() || !e.label.trim()" (click)="saveItem(e)">{{ 'bank.save' | translate }}</button>
                    </div>
                  </fieldset>
                }
              } @else {
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-ink break-words">{{ x.label }}</div>
                    <div class="text-xs text-ink-3">
                      @if (!x.required) { {{ 'checklists.optional' | translate }} }
                      @if (x.receivedAt) { @if (!x.required) { · } {{ 'checklists.receivedOn' | translate: { date: date(x.receivedAt) } }} }
                    </div>
                  </div>
                  <span class="badge shrink-0" [class]="badge(x)">{{ ('checklists.itemStatus.' + x.status) | translate }}</span>
                </div>
                @if (x.reviewNote && x.status === 'REJECTED') {
                  <p class="text-xs text-danger-ink break-words">{{ 'checklists.rejectedNote' | translate: { note: x.reviewNote } }}</p>
                }
                @if (x.fileId) {
                  <div class="flex items-center gap-1 min-w-0">
                    <mat-icon class="icon-sm text-ink-3 shrink-0">attach_file</mat-icon>
                    <button type="button" class="btn-link text-sm truncate min-w-0" (click)="preview.set(x)">{{ x.fileName || ('checklists.file' | translate) }}</button>
                    <button class="btn-icon btn-sm shrink-0" (click)="download(x)" [attr.aria-label]="'drive.download' | translate" [title]="'drive.download' | translate"><mat-icon class="icon-sm">download</mat-icon></button>
                  </div>
                }

                @if (rejecting()?.id === x.id) {
                  <fieldset class="space-y-2" [disabled]="busy()">
                    <label class="block"><span class="field-label">{{ 'checklists.rejectWhy' | translate }}</span>
                      <textarea class="input-field" rows="2" maxlength="500" [(ngModel)]="rejectNote" [placeholder]="'checklists.rejectPlaceholder' | translate"></textarea></label>
                    <div class="flex justify-end gap-2">
                      <button class="btn-ghost btn-sm" (click)="rejecting.set(null)">{{ 'bank.cancel' | translate }}</button>
                      <button class="btn-danger btn-sm" [disabled]="busy() || !rejectNote.trim()" (click)="review(x, 'REJECTED')">{{ 'checklists.reject' | translate }}</button>
                    </div>
                  </fieldset>
                } @else if (canWrite()) {
                  <div class="flex flex-wrap justify-end gap-1">
                    @if (x.status === 'RECEIVED' || (x.fileId && x.status === 'REJECTED')) {
                      <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="review(x, 'ACCEPTED')"><mat-icon>check</mat-icon>{{ 'checklists.accept' | translate }}</button>
                    }
                    @if (x.status === 'RECEIVED' || x.status === 'ACCEPTED') {
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="startReject(x)"><mat-icon>block</mat-icon>{{ 'checklists.reject' | translate }}</button>
                    }
                    @if (canUpload() && r.status !== 'CANCELLED') {
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="pickFile(x)"><mat-icon>upload_file</mat-icon>{{ (x.fileId ? 'checklists.replaceFile' : (needsFile(x) ? 'checklists.uploadFile' : 'checklists.replaceFile')) | translate }}</button>
                    }
                    <button class="btn-ghost btn-sm" (click)="startEdit(x)">{{ 'bank.edit' | translate }}</button>
                    <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="removeItem(x)">{{ 'bank.delete' | translate }}</button>
                  </div>
                }
              }
            </div>
          } @empty {
            <p class="text-sm text-ink-3">{{ 'checklists.noItems' | translate }}</p>
          }

          @if (canWrite()) {
            <fieldset class="flex flex-wrap items-end gap-2" [disabled]="busy()">
              <label class="block flex-1 min-w-40"><span class="field-label">{{ 'checklists.newItem' | translate }}</span>
                <input class="input-field" maxlength="200" [(ngModel)]="newLabel" [placeholder]="'checklists.itemPlaceholder' | translate" (keyup.enter)="addItem()" /></label>
              <label class="inline-flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" [(ngModel)]="newRequired" /><span class="text-xs text-ink-2">{{ 'checklists.required' | translate }}</span>
              </label>
              <button class="btn-secondary" [disabled]="busy() || !newLabel.trim()" (click)="addItem()"><mat-icon>add</mat-icon>{{ 'checklists.add' | translate }}</button>
            </fieldset>
          }
          <input #fileInput type="file" class="hidden" [accept]="accept" (change)="onFile($event)" />
        </section>

        @if (canWrite()) {
          <section class="border-t border-line pt-4 flex flex-wrap gap-2">
            @if (r.status === 'CANCELLED') {
              <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="setStatus('OPEN')"><mat-icon>undo</mat-icon>{{ 'checklists.reopen' | translate }}</button>
            } @else {
              <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="cancelChecklist()"><mat-icon>do_not_disturb_on</mat-icon>{{ 'checklists.cancelChecklist' | translate }}</button>
            }
            <button class="btn-danger-soft btn-sm" [disabled]="busy()" (click)="removeChecklist()"><mat-icon>delete</mat-icon>{{ 'checklists.delete' | translate }}</button>
          </section>
        }
      </div>
    </aside>

    @if (preview(); as p) {
      <div class="modal-backdrop">
        <div class="modal modal-3xl" role="dialog" aria-modal="true" aria-labelledby="checklist-preview-title">
          <div class="modal-header">
            <div class="min-w-0">
              <h3 id="checklist-preview-title" class="modal-title truncate">{{ p.fileName || p.label }}</h3>
              <p class="modal-subtitle truncate">{{ p.label }}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button class="btn-icon btn-sm" (click)="download(p)" [attr.aria-label]="'drive.download' | translate"><mat-icon class="icon-sm">download</mat-icon></button>
              <button class="btn-icon btn-sm" (click)="preview.set(null)" [attr.aria-label]="'bank.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
            </div>
          </div>
          <app-file-preview class="h-[70vh]" [fileId]="p.fileId!" [contentType]="contentType(p)" [fileName]="p.fileName || ''" />
          @if (canWrite() && p.status === 'RECEIVED') {
            <div class="modal-footer">
              <button class="btn-secondary" [disabled]="busy()" (click)="startReject(p); preview.set(null)"><mat-icon>block</mat-icon>{{ 'checklists.reject' | translate }}</button>
              <button class="btn-primary" [disabled]="busy()" (click)="review(p, 'ACCEPTED'); preview.set(null)"><mat-icon>check</mat-icon>{{ 'checklists.accept' | translate }}</button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class ChecklistDetailComponent {
  private api = inject(ChecklistApi);
  private drive = inject(DriveApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);
  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  detail = input.required<ChecklistDetail>();
  /** The checklist after a change, for the page to show and to refresh its list. */
  changed = output<ChecklistDetail>();
  removed = output<void>();
  closed = output<void>();
  edit = output<ChecklistDetail>();

  readonly accept = UPLOAD_ACCEPT;
  readonly needsFile = needsFile;

  busy = signal(false);
  editing = signal<ItemEdit | null>(null);
  rejecting = signal<ChecklistItem | null>(null);
  preview = signal<ChecklistItem | null>(null);
  remindResult = signal<RemindResult | null>(null);
  remindError = signal<string | null>(null);
  newLabel = '';
  newRequired = true;
  rejectNote = '';
  private fileTarget: ChecklistItem | null = null;
  private shownId: string | null = null;

  constructor() {
    // Another checklist opened in the same panel: forget what was being done with the previous one.
    effect(() => {
      const id = this.detail().request.id;
      untracked(() => {
        if (id === this.shownId) return;
        this.shownId = id;
        this.editing.set(null);
        this.rejecting.set(null);
        this.preview.set(null);
        this.remindResult.set(null);
        this.remindError.set(null);
        this.newLabel = '';
        this.newRequired = true;
      });
    });
  }

  canWrite(): boolean { return this.state.hasAuthority('PARTNERS_WRITE'); }
  canUpload(): boolean { return this.canWrite() && this.state.hasAuthority('FILES_WRITE'); }

  /** Closes a dialog or inline form of the panel; false when there was none (the page then closes the panel). */
  handleEscape(): boolean {
    if (this.busy()) return true;
    if (this.preview()) { this.preview.set(null); return true; }
    if (this.rejecting()) { this.rejecting.set(null); return true; }
    if (this.editing()) { this.editing.set(null); return true; }
    return false;
  }

  remind(): void {
    this.busy.set(true);
    this.remindResult.set(null);
    this.remindError.set(null);
    const id = this.detail().request.id;
    this.api.remind(id).subscribe({
      next: res => {
        this.busy.set(false);
        this.remindResult.set(res);
        this.reload();
      },
      error: e => {
        this.busy.set(false);
        this.remindError.set(errorDetail(e) || this.i18n.t('bank.error'));
      },
    });
  }

  // Review
  startReject(x: ChecklistItem): void {
    this.rejectNote = '';
    this.editing.set(null);
    this.rejecting.set(x);
  }

  review(x: ChecklistItem, status: 'ACCEPTED' | 'REJECTED'): void {
    if (status === 'REJECTED' && !this.rejectNote.trim()) return;
    this.run(this.api.review(x.id, status, status === 'REJECTED' ? this.rejectNote.trim() : null),
      status === 'ACCEPTED' ? 'checklists.accepted' : 'checklists.rejected', () => this.rejecting.set(null));
  }

  // Items
  addItem(): void {
    const label = this.newLabel.trim();
    if (!label || this.busy()) return;
    const sortOrder = (this.detail().items ?? []).reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1;
    this.run(this.api.addItem(this.detail().request.id, { label, required: this.newRequired, sortOrder }), 'checklists.itemAdded', () => {
      this.newLabel = '';
      this.newRequired = true;
    });
  }

  startEdit(x: ChecklistItem): void {
    this.rejecting.set(null);
    this.editing.set({ id: x.id, label: x.label, required: x.required });
  }

  saveItem(e: ItemEdit): void {
    this.run(this.api.updateItem(e.id, { label: e.label.trim(), required: e.required }), 'checklists.itemSaved', () => this.editing.set(null));
  }

  async removeItem(x: ChecklistItem): Promise<void> {
    if (!(await this.confirm.ask({ title: this.i18n.t('checklists.confirmDeleteItem', { label: x.label }), danger: true }))) return;
    this.run(this.api.deleteItem(x.id), 'checklists.itemDeleted');
  }

  pickFile(x: ChecklistItem): void {
    this.fileTarget = x;
    const input = this.fileInput()?.nativeElement;
    if (!input) return;
    input.value = '';
    input.click();
  }

  onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    const target = this.fileTarget;
    if (!file || !target) return;
    this.run(this.api.upload(target.id, file), 'checklists.fileUploaded');
  }

  download(x: ChecklistItem): void {
    if (!x.fileId) return;
    this.drive.content(x.fileId, true).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = x.fileName || 'document';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: e => this.fail(e),
    });
  }

  // The checklist itself
  setStatus(status: ChecklistStatus): void {
    this.run(this.api.update(this.detail().request.id, { status }), status === 'OPEN' ? 'checklists.reopened' : 'checklists.saved');
  }

  async cancelChecklist(): Promise<void> {
    if (!(await this.confirm.ask({
      title: this.i18n.t('checklists.confirmCancel', { title: this.detail().request.title }),
      message: this.i18n.t('checklists.confirmCancelText'),
    }))) return;
    this.run(this.api.update(this.detail().request.id, { status: 'CANCELLED' }), 'checklists.cancelled');
  }

  async removeChecklist(): Promise<void> {
    const r = this.detail().request;
    if (!(await this.confirm.ask({
      title: this.i18n.t('checklists.confirmDelete', { title: r.title }),
      message: this.i18n.t('checklists.confirmDeleteText'),
      danger: true,
    }))) return;
    this.busy.set(true);
    this.api.remove(r.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('checklists.deleted'), { type: 'success' });
        this.removed.emit();
      },
      error: e => this.fail(e),
    });
  }

  // Display
  statusBadge(s: ChecklistStatus): string {
    return s === 'COMPLETE' ? 'badge-success' : s === 'CANCELLED' ? 'badge-neutral' : 'badge-info';
  }

  channelLabel(c: string): string { return this.i18n.t(`checklists.channel.${c}`); }
  badge(x: ChecklistItem): string { return itemBadge(x.status); }
  contentType(x: ChecklistItem): string | null { return x.contentType || contentTypeFromName(x.fileName); }
  progress(): number { return checklistProgress(this.detail().request); }
  date(iso: string | null | undefined): string { return shortDate(iso); }

  private reload(): void {
    this.api.detail(this.detail().request.id).subscribe({ next: d => this.changed.emit(d), error: () => { /* the panel keeps what it shows */ } });
  }

  private run(call: ReturnType<ChecklistApi['detail']>, messageKey: string, after?: () => void): void {
    this.busy.set(true);
    call.subscribe({
      next: d => {
        this.busy.set(false);
        after?.();
        this.toast.show(this.i18n.t(messageKey), { type: 'success' });
        this.changed.emit(d);
      },
      error: e => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
