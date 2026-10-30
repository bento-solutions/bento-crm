import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ToastService } from '../services/toast.service';
import { CrmStateService } from '../services/crm-state.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { ContactOption, DriveApi } from '../services/domains/drive.service';
import {
  CHECKLIST_STATUSES, ChecklistApi, ChecklistDetail, ChecklistStatus, ChecklistSummary, ChecklistTemplate,
  REMINDER_CHANNELS, ReminderChannel,
} from '../services/domains/checklist.service';
import { shortDate } from '../shared/bank.util';
import { checklistProgress } from '../portal/portal.util';
import { errorDetail } from './bank/bank-labels';
import { ChecklistDetailComponent } from './checklists/checklist-detail.component';

/** The create / edit form of a checklist. Items and template only matter when creating. */
export interface ChecklistForm {
  id?: string;
  partnerId: string | null;
  title: string;
  period: string;
  dueDate: string;
  remindChannel: ReminderChannel;
  remindEveryDays: number;
  note: string;
  template: string;
  items: { label: string }[];
}

/**
 * Documents à fournir: the documents asked from each client (bank statements, purchase invoices,
 * payslips…), what was received, checked or refused, and the automatic reminders.
 */
@Component({
  selector: 'app-checklists',
  host: { '(document:keydown.escape)': 'onEscape()' },
  imports: [FormsModule, MatIconModule, TranslatePipe, PageHeaderComponent, EmptyStateComponent, ChecklistDetailComponent],
  template: `
    <div class="page">
      <app-page-header [title]="'checklists.title' | translate" [subtitle]="'checklists.subtitle' | translate">
        @if (canWrite()) {
          <button actions class="btn-primary" (click)="openForm()"><mat-icon>add</mat-icon>{{ 'checklists.new' | translate }}</button>
        }
      </app-page-header>

      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <label class="block min-w-0"><span class="field-label">{{ 'checklists.client' | translate }}</span>
            <select class="input-field" [ngModel]="partnerId()" (ngModelChange)="setFilter($event, status())">
              <option value="">{{ 'checklists.allClients' | translate }}</option>
              @for (c of clients(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
            </select></label>
          <label class="block min-w-0"><span class="field-label">{{ 'checklists.statusLabel' | translate }}</span>
            <select class="input-field" [ngModel]="status()" (ngModelChange)="setFilter(partnerId(), $event)">
              <option value="">{{ 'checklists.allStatuses' | translate }}</option>
              @for (s of statuses; track s) { <option [value]="s">{{ ('checklists.status.' + s) | translate }}</option> }
            </select></label>
        </div>

        <div class="table-card">
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead><tr>
                <th>{{ 'checklists.name' | translate }}</th>
                <th class="hidden md:table-cell">{{ 'checklists.client' | translate }}</th>
                <th class="hidden sm:table-cell">{{ 'checklists.progress' | translate }}</th>
                <th>{{ 'checklists.statusLabel' | translate }}</th>
                <th class="hidden lg:table-cell">{{ 'checklists.dueDate' | translate }}</th>
                <th class="hidden lg:table-cell">{{ 'checklists.lastReminder' | translate }}</th>
              </tr></thead>
              <tbody>
                @for (c of lists(); track c.id) {
                  <tr [class.bg-subtle]="selected()?.request?.id === c.id">
                    <td class="max-w-48 sm:max-w-72">
                      <button type="button" class="text-start block w-full min-w-0" (click)="open(c.id)">
                        <span class="cell-title truncate block hover:underline">{{ c.title }}</span>
                      </button>
                      <div class="cell-sub truncate">@if (c.period) { {{ c.period }} }<span class="md:hidden">@if (c.period) { · }{{ c.partnerName || '—' }}</span></div>
                      <div class="cell-sub sm:hidden num">{{ 'checklists.acceptedOf' | translate: { done: c.accepted, total: c.items } }}</div>
                    </td>
                    <td class="hidden md:table-cell max-w-48 truncate">{{ c.partnerName || '—' }}</td>
                    <td class="hidden sm:table-cell min-w-36">
                      <div class="progress" [class.is-success]="c.items > 0 && c.accepted === c.items"><span [style.width.%]="progress(c)"></span></div>
                      <div class="text-xs text-ink-3 mt-1 num">{{ 'checklists.acceptedOf' | translate: { done: c.accepted, total: c.items } }}</div>
                      <div class="text-xs mt-0.5 flex flex-wrap gap-x-2">
                        @if (c.missing > 0) { <span class="text-warning-ink">{{ 'checklists.missingN' | translate: { n: c.missing } }}</span> }
                        @if (c.toCheck > 0) { <span class="text-info-ink">{{ 'checklists.toCheckN' | translate: { n: c.toCheck } }}</span> }
                      </div>
                    </td>
                    <td>
                      <span class="badge" [class]="statusBadge(c.status)">{{ ('checklists.status.' + c.status) | translate }}</span>
                      @if (c.overdue) { <div class="text-xs text-danger-ink flex items-center gap-1 mt-1"><mat-icon class="icon-xs">schedule</mat-icon>{{ 'checklists.overdue' | translate }}</div> }
                      @if (c.toCheck > 0) { <div class="text-xs text-info-ink sm:hidden mt-1">{{ 'checklists.toCheckN' | translate: { n: c.toCheck } }}</div> }
                    </td>
                    <td class="hidden lg:table-cell cell-muted whitespace-nowrap" [class.text-danger-ink]="c.overdue">{{ date(c.dueDate) }}</td>
                    <td class="hidden lg:table-cell cell-muted whitespace-nowrap">
                      {{ c.lastReminderAt ? date(c.lastReminderAt) : '—' }}
                      @if (c.reminderCount > 0) { <div class="text-xs text-ink-3">{{ 'checklists.reminderCount' | translate: { n: c.reminderCount } }}</div> }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="row-empty">
                    <app-empty-state icon="checklist" [title]="'checklists.emptyTitle' | translate" [text]="'checklists.emptyText' | translate" />
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    @if (selected(); as d) {
      <app-checklist-detail [detail]="d" (changed)="onChanged($event)" (removed)="onRemoved()" (closed)="close()" (edit)="openForm($event)" />
    }

    <!-- Create / edit -->
    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="checklist-form-title">
          <div class="modal-header">
            <h3 id="checklist-form-title" class="modal-title">{{ (f.id ? 'checklists.editTitle' : 'checklists.new') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'bank.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3" [disabled]="busy()">
            @if (!f.id) {
              <label class="block sm:col-span-2"><span class="field-label">{{ 'checklists.client' | translate }}</span>
                <select class="input-field" [(ngModel)]="f.partnerId">
                  <option [ngValue]="null">{{ 'checklists.pickClient' | translate }}</option>
                  @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                </select></label>
              <label class="block sm:col-span-2"><span class="field-label">{{ 'checklists.template' | translate }}</span>
                <select class="input-field" [ngModel]="f.template" (ngModelChange)="applyTemplate(f, $event)">
                  <option value="">{{ 'checklists.noTemplate' | translate }}</option>
                  @for (t of templates(); track t.key) { <option [value]="t.key">{{ t.title }}</option> }
                </select></label>
            }
            <label class="block sm:col-span-2"><span class="field-label">{{ 'checklists.name' | translate }}</span>
              <input class="input-field" maxlength="160" [(ngModel)]="f.title" [placeholder]="'checklists.namePlaceholder' | translate" /></label>
            <label class="block"><span class="field-label">{{ 'checklists.period' | translate }}</span>
              <input class="input-field" maxlength="60" [(ngModel)]="f.period" [placeholder]="'checklists.periodPlaceholder' | translate" /></label>
            <label class="block"><span class="field-label">{{ 'checklists.dueDate' | translate }}</span>
              <input type="date" class="input-field" [(ngModel)]="f.dueDate" /></label>
            <label class="block"><span class="field-label">{{ 'checklists.remindChannel' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.remindChannel">
                @for (ch of channels; track ch) { <option [ngValue]="ch">{{ ('checklists.channel.' + ch) | translate }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'checklists.remindEvery' | translate }}</span>
              <input type="number" min="1" max="30" step="1" class="input-field num" [(ngModel)]="f.remindEveryDays" [disabled]="f.remindChannel === 'NONE'" /></label>
            <label class="block sm:col-span-2"><span class="field-label">{{ 'checklists.note' | translate }}</span>
              <textarea class="input-field" rows="2" maxlength="2000" [(ngModel)]="f.note" [placeholder]="'checklists.notePlaceholder' | translate"></textarea></label>

            @if (!f.id) {
              <div class="sm:col-span-2 space-y-2">
                <span class="field-label">{{ 'checklists.items' | translate }}</span>
                @for (it of f.items; track $index; let i = $index) {
                  <div class="flex items-center gap-2">
                    <input class="input-field flex-1" maxlength="200" [(ngModel)]="it.label" [attr.aria-label]="'checklists.itemLabel' | translate" [placeholder]="'checklists.itemPlaceholder' | translate" />
                    <button type="button" class="btn-icon btn-sm shrink-0" (click)="f.items.splice(i, 1)" [attr.aria-label]="'bank.delete' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
                  </div>
                }
                <button type="button" class="btn-ghost btn-sm" (click)="f.items.push({ label: '' })"><mat-icon>add</mat-icon>{{ 'checklists.addItem' | translate }}</button>
              </div>
            }
          </fieldset>
          @if (!validEvery(f)) { <p class="field-error">{{ 'checklists.everyRange' | translate }}</p> }
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'bank.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !canSave(f)" (click)="save(f)">{{ (f.id ? 'bank.save' : 'checklists.create') | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ChecklistsComponent implements OnInit {
  private api = inject(ChecklistApi);
  private drive = inject(DriveApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private detailPanel = viewChild(ChecklistDetailComponent);

  readonly statuses = CHECKLIST_STATUSES;
  readonly channels = REMINDER_CHANNELS;

  lists = signal<ChecklistSummary[]>([]);
  clients = signal<ContactOption[]>([]);
  templates = signal<ChecklistTemplate[]>([]);
  partnerId = signal('');
  status = signal<ChecklistStatus | ''>('');
  selected = signal<ChecklistDetail | null>(null);
  form = signal<ChecklistForm | null>(null);
  busy = signal(false);

  canWrite(): boolean { return this.state.hasAuthority('PARTNERS_WRITE'); }

  ngOnInit(): void {
    this.state.breadcrumbLabel.set(this.i18n.t('checklists.title'));
    const q = this.route.snapshot.queryParamMap;
    this.partnerId.set(q.get('partnerId') ?? '');
    const s = q.get('status') as ChecklistStatus | null;
    if (s && CHECKLIST_STATUSES.includes(s)) this.status.set(s);
    this.drive.contacts('CUSTOMER').subscribe({ next: c => this.clients.set(c), error: () => { /* the filter stays empty */ } });
    this.api.templates().subscribe({ next: t => this.templates.set(t ?? []), error: () => { /* free items only */ } });
    this.load();
    const open = q.get('open');
    if (open) this.open(open);
  }

  load(): void {
    this.api.list(this.partnerId() || null, this.status() || null).subscribe({
      next: l => this.lists.set(l ?? []),
      error: e => this.fail(e),
    });
  }

  setFilter(partnerId: string, status: ChecklistStatus | ''): void {
    this.partnerId.set(partnerId);
    this.status.set(status);
    this.router.navigate([], {
      queryParams: { partnerId: partnerId || null, status: status || null }, queryParamsHandling: 'merge', replaceUrl: true,
    });
    this.load();
  }

  open(id: string): void {
    this.api.detail(id).subscribe({ next: d => this.selected.set(d), error: e => this.fail(e) });
  }

  close(): void {
    this.selected.set(null);
    if (this.route.snapshot.queryParamMap.get('open')) {
      this.router.navigate([], { queryParams: { open: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  onChanged(d: ChecklistDetail): void {
    this.selected.set(d);
    this.load();
  }

  onRemoved(): void {
    this.close();
    this.load();
  }

  // Form
  openForm(d?: ChecklistDetail): void {
    const r = d?.request;
    this.form.set(r ? {
      id: r.id, partnerId: r.partnerId, title: r.title, period: r.period ?? '', dueDate: r.dueDate ?? '',
      remindChannel: r.remindChannel, remindEveryDays: r.remindEveryDays || 7, note: d?.note ?? '', template: '', items: [],
    } : {
      partnerId: this.partnerId() || null, title: '', period: '', dueDate: '', remindChannel: 'EMAIL', remindEveryDays: 7,
      note: '', template: '', items: [{ label: '' }],
    });
  }

  /** A template fills in the title (when still empty) and its documents, which stay editable. */
  applyTemplate(f: ChecklistForm, key: string): void {
    const t = this.templates().find(x => x.key === key);
    const previous = this.templates().find(x => x.key === f.template);
    f.template = key;
    if (!t) return;
    if (!f.title.trim() || f.title === previous?.title) f.title = t.title;
    f.items = t.items.map(label => ({ label }));
  }

  validEvery(f: ChecklistForm): boolean {
    if (f.remindChannel === 'NONE') return true;
    const n = Number(f.remindEveryDays);
    return Number.isInteger(n) && n >= 1 && n <= 30;
  }

  canSave(f: ChecklistForm): boolean {
    if (!f.title.trim() || !this.validEvery(f)) return false;
    return !!f.id || (!!f.partnerId && f.items.some(i => i.label.trim()));
  }

  save(f: ChecklistForm): void {
    if (!this.canSave(f)) return;
    this.busy.set(true);
    const common = {
      title: f.title.trim(), period: f.period.trim() || null, dueDate: f.dueDate || null, remindChannel: f.remindChannel,
      remindEveryDays: f.remindChannel === 'NONE' ? null : Number(f.remindEveryDays), note: f.note.trim() || null,
    };
    const call = f.id
      ? this.api.update(f.id, common)
      : this.api.create({ ...common, partnerId: f.partnerId!, items: f.items.map(i => i.label.trim()).filter(Boolean) });
    call.subscribe({
      next: d => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t(f.id ? 'checklists.saved' : 'checklists.created'), { type: 'success' });
        this.selected.set(d);
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  /** Escape closes the innermost open dialog, unless a request is running. */
  onEscape(): void {
    if (this.busy()) return;
    if (this.form()) { this.form.set(null); return; }
    const panel = this.detailPanel();
    if (panel?.handleEscape()) return;
    if (this.selected()) this.close();
  }

  statusBadge(s: ChecklistStatus): string {
    return s === 'COMPLETE' ? 'badge-success' : s === 'CANCELLED' ? 'badge-neutral' : 'badge-info';
  }

  progress(c: ChecklistSummary): number { return checklistProgress(c); }
  date(iso: string | null | undefined): string { return shortDate(iso); }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
