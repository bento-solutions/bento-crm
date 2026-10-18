import { Component, ElementRef, OnInit, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { ContactOption, DriveApi } from '../../services/domains/drive.service';
import {
  DELIVERABLE_STATUSES, Deliverable, DeliverableRequest, DeliverableStatus, DisbursementQuery, MISSION_STATUSES,
  MissionApi, MissionDetail, MissionStatus, MissionSummary,
} from '../../services/domains/mission.service';
import { formatMoney, shortDate } from '../../shared/bank.util';
import { progressPercent, vatPercent } from '../../shared/practice.util';
import { errorDetail } from '../bank/bank-labels';

interface MissionForm {
  id?: string;
  partnerId: string | null;
  name: string;
  description: string;
  status: MissionStatus;
  startDate: string;
  dueDate: string;
  feeAmount: number | null;
  assignedUserId: string | null;
}

interface DeliverableEdit {
  id: string;
  title: string;
  dueDate: string;
}

/**
 * Missions → Missions: each client's missions with their progress, fee and unbilled costs. A
 * mission opens in a side panel with its description, deliverables (and their files) and costs.
 */
@Component({
  selector: 'app-mission-list',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <label class="block min-w-0"><span class="field-label">{{ 'missions.client' | translate }}</span>
          <select class="input-field" [ngModel]="partnerId()" (ngModelChange)="partnerId.set($event); load()">
            <option value="">{{ 'missions.allClients' | translate }}</option>
            @for (c of clients(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
          </select></label>
        <label class="block min-w-0"><span class="field-label">{{ 'missions.status' | translate }}</span>
          <select class="input-field" [ngModel]="status()" (ngModelChange)="status.set($event); load()">
            <option value="">{{ 'missions.allStatuses' | translate }}</option>
            @for (s of statuses; track s) { <option [value]="s">{{ ('missions.statusName.' + s) | translate }}</option> }
          </select></label>
        @if (canWrite()) {
          <button class="btn-primary col-span-2 justify-self-start sm:ms-auto" (click)="openForm()"><mat-icon>add</mat-icon>{{ 'missions.new' | translate }}</button>
        }
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'missions.name' | translate }}</th>
              <th class="hidden md:table-cell">{{ 'missions.client' | translate }}</th>
              <th>{{ 'missions.status' | translate }}</th>
              <th class="hidden lg:table-cell">{{ 'missions.dates' | translate }}</th>
              <th class="hidden sm:table-cell">{{ 'missions.progress' | translate }}</th>
              <th class="col-num hidden lg:table-cell">{{ 'missions.fee' | translate }}</th>
              <th class="col-num hidden md:table-cell">{{ 'missions.unbilled' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (m of missions(); track m.id) {
                <tr [class.bg-subtle]="selected()?.mission?.id === m.id">
                  <td class="max-w-48 sm:max-w-72">
                    <button type="button" class="text-start block w-full min-w-0" (click)="open(m)">
                      <span class="cell-title truncate block hover:underline">{{ m.name }}</span>
                    </button>
                    <div class="cell-sub truncate md:hidden">{{ m.partnerName || '—' }}</div>
                    @if (m.overdue) {
                      <div class="text-xs text-danger-ink flex items-center gap-1"><mat-icon class="icon-xs">schedule</mat-icon>{{ 'missions.overdue' | translate }}</div>
                    }
                  </td>
                  <td class="hidden md:table-cell max-w-48 truncate">{{ m.partnerName || '—' }}</td>
                  <td><span class="badge" [class]="statusBadge(m.status)">{{ ('missions.statusName.' + m.status) | translate }}</span></td>
                  <td class="hidden lg:table-cell cell-muted whitespace-nowrap">{{ date(m.startDate) }} → <span [class.text-danger-ink]="m.overdue">{{ date(m.dueDate) }}</span></td>
                  <td class="hidden sm:table-cell min-w-28">
                    <div class="progress" [class.is-success]="m.deliverables > 0 && m.delivered === m.deliverables"><span [style.width.%]="progress(m)"></span></div>
                    <div class="text-xs text-ink-3 mt-1 num">{{ 'missions.deliveredOf' | translate: { done: m.delivered, total: m.deliverables } }}</div>
                  </td>
                  <td class="col-num num whitespace-nowrap hidden lg:table-cell">{{ m.feeAmount !== null && m.feeAmount !== undefined ? money(m.feeAmount) : '—' }}</td>
                  <td class="col-num num whitespace-nowrap hidden md:table-cell" [class.text-warning-ink]="(m.unbilledDisbursements ?? 0) > 0">{{ money(m.unbilledDisbursements) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="row-empty">
                  <app-empty-state icon="work" [title]="'missions.emptyTitle' | translate" [text]="'missions.emptyText' | translate" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Detail -->
    @if (selected(); as d) {
      <aside class="drawer-panel" role="dialog" aria-modal="false" aria-labelledby="mission-title">
        <header class="flex items-start justify-between gap-2 px-5 py-4 border-b border-line shrink-0">
          <div class="min-w-0">
            <h2 id="mission-title" class="section-title break-words">{{ d.mission.name }}</h2>
            <p class="text-xs text-ink-3 truncate">{{ d.mission.partnerName || '—' }}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            @if (canWrite()) {
              <button class="btn-ghost btn-sm" (click)="openForm(d)">{{ 'bank.edit' | translate }}</button>
            }
            <button class="btn-icon btn-sm" (click)="close()" [attr.aria-label]="'bank.close' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge" [class]="statusBadge(d.mission.status)">{{ ('missions.statusName.' + d.mission.status) | translate }}</span>
            @if (d.mission.overdue) { <span class="badge badge-danger">{{ 'missions.overdue' | translate }}</span> }
          </div>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt class="text-ink-3">{{ 'missions.startDate' | translate }}</dt><dd class="text-ink">{{ date(d.mission.startDate) }}</dd>
            <dt class="text-ink-3">{{ 'missions.dueDate' | translate }}</dt><dd class="text-ink" [class.text-danger-ink]="d.mission.overdue">{{ date(d.mission.dueDate) }}</dd>
            <dt class="text-ink-3">{{ 'missions.fee' | translate }}</dt><dd class="text-ink num">{{ d.mission.feeAmount !== null && d.mission.feeAmount !== undefined ? money(d.mission.feeAmount) : '—' }}</dd>
            <dt class="text-ink-3">{{ 'missions.assignedTo' | translate }}</dt><dd class="text-ink">{{ d.mission.assignedUserName || '—' }}</dd>
          </dl>
          @if (d.description) {
            <p class="text-sm text-ink-2 whitespace-pre-line break-words">{{ d.description }}</p>
          }

          <!-- Deliverables -->
          <section class="space-y-2 border-t border-line pt-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-semibold text-ink">{{ 'missions.deliverables' | translate }}</h3>
              <span class="text-xs text-ink-3 num">{{ 'missions.deliveredOf' | translate: { done: d.mission.delivered, total: d.mission.deliverables } }}</span>
            </div>
            @for (x of d.deliverables ?? []; track x.id) {
              <div class="card p-3 space-y-2">
                @if (editing()?.id === x.id) {
                  @if (editing(); as e) {
                    <fieldset class="space-y-2" [disabled]="busy()">
                      <label class="block"><span class="field-label">{{ 'missions.deliverableTitle' | translate }}</span>
                        <input class="input-field" maxlength="160" [(ngModel)]="e.title" /></label>
                      <label class="block"><span class="field-label">{{ 'missions.dueDate' | translate }}</span>
                        <input type="date" class="input-field" [(ngModel)]="e.dueDate" /></label>
                      <div class="flex justify-end gap-2">
                        <button class="btn-ghost btn-sm" (click)="editing.set(null)">{{ 'bank.cancel' | translate }}</button>
                        <button class="btn-primary btn-sm" [disabled]="busy() || !e.title.trim()" (click)="saveEdit(x, e)">{{ 'bank.save' | translate }}</button>
                      </div>
                    </fieldset>
                  }
                } @else {
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-sm font-medium text-ink break-words">{{ x.title }}</div>
                      <div class="text-xs text-ink-3">
                        @if (x.status === 'DELIVERED' && x.deliveredAt) { {{ 'missions.deliveredOn' | translate: { date: date(x.deliveredAt) } }} }
                        @else if (x.dueDate) { {{ 'missions.dueOn' | translate: { date: date(x.dueDate) } }} }
                        @else { {{ 'missions.noDueDate' | translate }} }
                      </div>
                    </div>
                    <span class="badge shrink-0" [class]="deliverableBadge(x.status)">{{ ('missions.deliverableStatus.' + x.status) | translate }}</span>
                  </div>

                  @if (x.fileId) {
                    <div class="flex items-center gap-1 min-w-0">
                      <mat-icon class="icon-sm text-ink-3 shrink-0">attach_file</mat-icon>
                      <button type="button" class="btn-link text-sm truncate min-w-0" (click)="download(x)">{{ x.fileName || ('missions.file' | translate) }}</button>
                      @if (canWrite()) {
                        <button class="btn-icon btn-sm shrink-0" [disabled]="busy()" (click)="patch(x, { removeFile: true }, 'missions.fileRemoved')"
                                [attr.aria-label]="'missions.removeFile' | translate" [title]="'missions.removeFile' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
                      }
                    </div>
                  }

                  @if (canWrite()) {
                    <div class="flex flex-wrap items-center gap-2">
                      <select class="input-field input-sm w-auto" [ngModel]="x.status" (ngModelChange)="setDeliverableStatus(x, $event)" [disabled]="busy()"
                              [attr.aria-label]="'missions.status' | translate">
                        @for (s of deliverableStatuses; track s) { <option [value]="s">{{ ('missions.deliverableStatus.' + s) | translate }}</option> }
                      </select>
                      @if (x.status !== 'DELIVERED') {
                        <button class="btn-secondary btn-sm" [disabled]="busy()" (click)="setDeliverableStatus(x, 'DELIVERED')"><mat-icon>done_all</mat-icon>{{ 'missions.markDelivered' | translate }}</button>
                      }
                      <label class="inline-flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" [ngModel]="x.visibleToClient" (ngModelChange)="patch(x, { visibleToClient: $event }, 'missions.deliverableSaved')" [disabled]="busy()" />
                        <span class="text-xs text-ink-2">{{ 'missions.visibleToClient' | translate }}</span>
                      </label>
                    </div>
                    <div class="flex flex-wrap justify-end gap-1">
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="pickFile(x)"><mat-icon>upload_file</mat-icon>{{ (x.fileId ? 'missions.replaceFile' : 'missions.attachFile') | translate }}</button>
                      <button class="btn-ghost btn-sm" (click)="startEdit(x)">{{ 'bank.edit' | translate }}</button>
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="removeDeliverable(x)">{{ 'bank.delete' | translate }}</button>
                    </div>
                  } @else if (!x.visibleToClient) {
                    <div class="text-xs text-ink-3 flex items-center gap-1"><mat-icon class="icon-xs">visibility_off</mat-icon>{{ 'missions.internalOnly' | translate }}</div>
                  }
                }
              </div>
            } @empty {
              <p class="text-sm text-ink-3">{{ 'missions.noDeliverables' | translate }}</p>
            }

            @if (canWrite()) {
              <fieldset class="flex flex-wrap items-end gap-2" [disabled]="busy()">
                <label class="block flex-1 min-w-40"><span class="field-label">{{ 'missions.newDeliverable' | translate }}</span>
                  <input class="input-field" maxlength="160" [(ngModel)]="newTitle" [placeholder]="'missions.deliverablePlaceholder' | translate" (keyup.enter)="addDeliverable(d)" /></label>
                <label class="block"><span class="field-label">{{ 'missions.dueDate' | translate }}</span>
                  <input type="date" class="input-field" [(ngModel)]="newDue" /></label>
                <button class="btn-secondary" [disabled]="busy() || !newTitle.trim()" (click)="addDeliverable(d)"><mat-icon>add</mat-icon>{{ 'missions.add' | translate }}</button>
              </fieldset>
            }
            <input #fileInput type="file" class="hidden" (change)="onFile($event)" />
          </section>

          <!-- Costs -->
          <section class="space-y-2 border-t border-line pt-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-semibold text-ink">{{ 'missions.costs' | translate }}</h3>
              <button class="btn-link text-sm" (click)="openCosts.emit({ partnerId: d.mission.partnerId, missionId: d.mission.id })">{{ 'missions.manageCosts' | translate }}</button>
            </div>
            @for (c of d.disbursements ?? []; track c.id) {
              <div class="flex items-start justify-between gap-2 text-sm">
                <div class="min-w-0">
                  <div class="text-ink break-words">{{ c.description }}</div>
                  <div class="text-xs text-ink-3">{{ date(c.spentOn) }}@if (c.vatRate) { · {{ 'missions.vatN' | translate: { n: vat(c.vatRate) } }} }@if (!c.rebillable) { · {{ 'missions.notRebillable' | translate }} }</div>
                </div>
                <div class="text-end shrink-0">
                  <div class="num text-ink">{{ money(c.amount) }}</div>
                  @if (c.invoiceNumber) { <span class="badge badge-success">{{ c.invoiceNumber }}</span> }
                  @else if (c.rebillable) { <span class="badge badge-warning">{{ 'missions.toBill' | translate }}</span> }
                </div>
              </div>
            } @empty {
              <p class="text-sm text-ink-3">{{ 'missions.noCosts' | translate }}</p>
            }
          </section>

          @if (canWrite()) {
            <section class="border-t border-line pt-4">
              <button class="btn-danger-soft btn-sm" [disabled]="busy()" (click)="removeMission(d)"><mat-icon>delete</mat-icon>{{ 'missions.delete' | translate }}</button>
            </section>
          }
        </div>
      </aside>
    }

    <!-- Create / edit -->
    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="mission-form-title">
          <div class="modal-header">
            <h3 id="mission-form-title" class="modal-title">{{ (f.id ? 'missions.editTitle' : 'missions.new') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'bank.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-3" [disabled]="busy()">
            <label class="block sm:col-span-2"><span class="field-label">{{ 'missions.client' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.partnerId">
                <option [ngValue]="null">{{ 'missions.pickClient' | translate }}</option>
                @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
              </select></label>
            <label class="block sm:col-span-2"><span class="field-label">{{ 'missions.name' | translate }}</span>
              <input class="input-field" maxlength="160" [(ngModel)]="f.name" [placeholder]="'missions.namePlaceholder' | translate" /></label>
            <label class="block sm:col-span-2"><span class="field-label">{{ 'missions.description' | translate }}</span>
              <textarea class="input-field" rows="3" maxlength="2000" [(ngModel)]="f.description"></textarea></label>
            <label class="block"><span class="field-label">{{ 'missions.status' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.status">
                @for (s of statuses; track s) { <option [ngValue]="s">{{ ('missions.statusName.' + s) | translate }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'missions.assignedTo' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.assignedUserId">
                <option [ngValue]="null">—</option>
                @for (u of users(); track u.id) { <option [ngValue]="u.id">{{ u.displayName }}</option> }
              </select></label>
            <label class="block"><span class="field-label">{{ 'missions.startDate' | translate }}</span>
              <input type="date" class="input-field" [(ngModel)]="f.startDate" /></label>
            <label class="block"><span class="field-label">{{ 'missions.dueDate' | translate }}</span>
              <input type="date" class="input-field" [(ngModel)]="f.dueDate" [min]="f.startDate" /></label>
            <label class="block"><span class="field-label">{{ 'missions.feeHt' | translate }}</span>
              <input type="number" min="0" step="0.01" class="input-field num" [(ngModel)]="f.feeAmount" /></label>
          </fieldset>
          @if (f.startDate && f.dueDate && f.dueDate < f.startDate) {
            <p class="field-error">{{ 'missions.dueBeforeStart' | translate }}</p>
          }
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'bank.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !f.partnerId || !f.name.trim() || (!!f.startDate && !!f.dueDate && f.dueDate < f.startDate)" (click)="save(f)">{{ 'bank.save' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MissionListComponent implements OnInit {
  private api = inject(MissionApi);
  private drive = inject(DriveApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  /** Asks the page to show the Costs tab for this mission. */
  openCosts = output<DisbursementQuery>();

  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly statuses = MISSION_STATUSES;
  readonly deliverableStatuses = DELIVERABLE_STATUSES;

  missions = signal<MissionSummary[]>([]);
  clients = signal<ContactOption[]>([]);
  partnerId = signal('');
  status = signal<MissionStatus | ''>('');
  busy = signal(false);
  form = signal<MissionForm | null>(null);
  selected = signal<MissionDetail | null>(null);
  editing = signal<DeliverableEdit | null>(null);
  users = computed(() => [...this.state.users()].sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '')));

  newTitle = '';
  newDue = '';
  private fileTarget: Deliverable | null = null;

  canWrite(): boolean { return this.state.hasAuthority('PARTNERS_WRITE'); }

  ngOnInit(): void {
    this.drive.contacts('CUSTOMER').subscribe({ next: c => this.clients.set(c), error: () => { /* the filter stays empty */ } });
    this.load();
  }

  load(): void {
    this.api.list(this.partnerId() || null, this.status() || null).subscribe({
      next: m => this.missions.set(m ?? []),
      error: e => this.fail(e),
    });
  }

  // Mission form
  openForm(d?: MissionDetail): void {
    const m = d?.mission;
    this.form.set(m ? {
      id: m.id, partnerId: m.partnerId, name: m.name, description: d?.description ?? '', status: m.status,
      startDate: m.startDate ?? '', dueDate: m.dueDate ?? '', feeAmount: m.feeAmount ?? null, assignedUserId: m.assignedUserId ?? null,
    } : {
      partnerId: this.partnerId() || null, name: '', description: '', status: 'PLANNED',
      startDate: '', dueDate: '', feeAmount: null, assignedUserId: null,
    });
  }

  save(f: MissionForm): void {
    this.busy.set(true);
    this.api.save({
      partnerId: f.partnerId, name: f.name.trim(), description: f.description, status: f.status,
      startDate: f.startDate || null, dueDate: f.dueDate || null,
      feeAmount: f.feeAmount !== null && String(f.feeAmount) !== '' ? Number(f.feeAmount) : null,
      assignedUserId: f.assignedUserId,
    }, f.id).subscribe({
      next: d => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t('missions.saved'), { type: 'success' });
        this.select(d);
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  async removeMission(d: MissionDetail): Promise<void> {
    if (!(await this.confirm.ask({
      title: this.i18n.t('missions.confirmDelete', { name: d.mission.name }),
      message: this.i18n.t('missions.confirmDeleteText'),
      danger: true,
    }))) return;
    this.busy.set(true);
    this.api.remove(d.mission.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('missions.deleted'), { type: 'success' });
        this.close();
        this.load();
      },
      error: e => this.fail(e),
    });
  }

  // Panel
  open(m: MissionSummary): void {
    this.api.detail(m.id).subscribe({ next: d => this.select(d), error: e => this.fail(e) });
  }

  close(): void {
    this.selected.set(null);
    this.editing.set(null);
  }

  private select(d: MissionDetail): void {
    if (this.selected()?.mission.id !== d.mission.id) {
      this.newTitle = '';
      this.newDue = '';
      this.editing.set(null);
    }
    this.selected.set(d);
  }

  /** Reloads the open mission (its counters change with every deliverable) and the list. */
  private refresh(messageKey?: string): void {
    this.busy.set(false);
    if (messageKey) this.toast.show(this.i18n.t(messageKey), { type: 'success' });
    const id = this.selected()?.mission.id;
    if (id) this.api.detail(id).subscribe({ next: d => this.select(d), error: e => this.fail(e) });
    this.load();
  }

  // Deliverables
  addDeliverable(d: MissionDetail): void {
    const title = this.newTitle.trim();
    if (!title || this.busy()) return;
    this.busy.set(true);
    this.api.addDeliverable(d.mission.id, { title, dueDate: this.newDue || null, visibleToClient: true }).subscribe({
      next: () => {
        this.newTitle = '';
        this.newDue = '';
        this.refresh('missions.deliverableAdded');
      },
      error: e => this.fail(e),
    });
  }

  startEdit(x: Deliverable): void {
    this.editing.set({ id: x.id, title: x.title, dueDate: x.dueDate ?? '' });
  }

  saveEdit(x: Deliverable, e: DeliverableEdit): void {
    this.patch(x, { title: e.title.trim(), dueDate: e.dueDate || null }, 'missions.deliverableSaved', () => this.editing.set(null));
  }

  setDeliverableStatus(x: Deliverable, status: DeliverableStatus): void {
    if (status === x.status) return;
    this.patch(x, { status }, status === 'DELIVERED' ? 'missions.markedDelivered' : 'missions.deliverableSaved');
  }

  patch(x: Deliverable, body: DeliverableRequest, messageKey: string, after?: () => void): void {
    this.busy.set(true);
    this.api.updateDeliverable(x.id, body).subscribe({
      next: () => { after?.(); this.refresh(messageKey); },
      error: e => this.fail(e),
    });
  }

  async removeDeliverable(x: Deliverable): Promise<void> {
    if (!(await this.confirm.ask({ title: this.i18n.t('missions.confirmDeleteDeliverable', { title: x.title }), danger: true }))) return;
    this.busy.set(true);
    this.api.deleteDeliverable(x.id).subscribe({
      next: () => this.refresh('missions.deliverableDeleted'),
      error: e => this.fail(e),
    });
  }

  // Files: uploaded to the drive, then linked to the deliverable.
  pickFile(x: Deliverable): void {
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
    this.busy.set(true);
    this.drive.upload(file).subscribe({
      next: f => this.patch(target, { fileId: f.id }, 'missions.fileAttached'),
      error: e => this.fail(e),
    });
  }

  download(x: Deliverable): void {
    if (!x.fileId) return;
    this.drive.content(x.fileId, true).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = x.fileName || 'file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: e => this.fail(e),
    });
  }

  // Display
  statusBadge(s: MissionStatus): string {
    switch (s) {
      case 'IN_PROGRESS': return 'badge-info';
      case 'DONE': return 'badge-success';
      case 'CANCELLED': return 'badge-neutral';
      default: return 'badge-warning';
    }
  }

  deliverableBadge(s: DeliverableStatus): string {
    return s === 'DELIVERED' ? 'badge-success' : s === 'IN_PROGRESS' ? 'badge-info' : 'badge-neutral';
  }

  progress(m: MissionSummary): number { return progressPercent(m.delivered, m.deliverables); }
  money(v: number | null | undefined): string { return formatMoney(v); }
  date(iso: string | null | undefined): string { return shortDate(iso); }
  vat(rate: number | null | undefined): number { return vatPercent(rate); }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
  }
}
