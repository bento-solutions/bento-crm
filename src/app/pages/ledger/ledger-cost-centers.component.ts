import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { CostCenter, LedgerApi } from '../../services/domains/ledger.service';
import { MissionApi, MissionSummary } from '../../services/domains/mission.service';
import { errorDetail } from './ledger-labels';

interface CostCenterForm {
  id?: string;
  code: string;
  name: string;
  missionId: string | null;
}

/** General Ledger → Cost centers: analytic codes put on entry lines, by function or person (a legacy mission link is kept as data). */
@Component({
  selector: 'app-ledger-cost-centers',
  imports: [FormsModule, MatIconModule, TranslatePipe, EmptyStateComponent],
  template: `
    <div class="space-y-4">
      <p class="text-sm text-ink-2 flex items-start gap-2">
        <mat-icon class="icon-sm text-ink-3 shrink-0">info</mat-icon>{{ 'ledger.cc.help' | translate }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <label class="choice-row">
          <input type="checkbox" [ngModel]="showInactive()" (ngModelChange)="showInactive.set($event)" />
          <span class="text-sm text-ink">{{ 'ledger.showInactive' | translate }}</span>
        </label>
        @if (canWrite()) {
          <button class="btn-primary ms-auto" (click)="openForm()"><mat-icon>add</mat-icon>{{ 'ledger.cc.add' | translate }}</button>
        }
      </div>

      <div class="table-card">
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr>
              <th>{{ 'ledger.code' | translate }}</th>
              <th>{{ 'ledger.cc.name' | translate }}</th>
              <th>{{ 'ledger.cc.mission' | translate }}</th>
              <th>{{ 'ledger.status' | translate }}</th>
              <th class="col-actions"></th>
            </tr></thead>
            <tbody>
              @for (c of shown(); track c.id) {
                <tr>
                  <td class="num cell-title whitespace-nowrap">{{ c.code }}</td>
                  <td class="min-w-40 text-ink">{{ c.name }}</td>
                  <td class="cell-muted">{{ c.missionName || '—' }}</td>
                  <td>
                    @if (c.active) { <span class="badge badge-success">{{ 'ledger.active' | translate }}</span> }
                    @else { <span class="badge badge-neutral">{{ 'ledger.inactive' | translate }}</span> }
                  </td>
                  <td class="col-actions">
                    @if (canWrite()) {
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="openForm(c)">{{ 'ledger.edit' | translate }}</button>
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="toggleActive(c)">{{ (c.active ? 'ledger.deactivate' : 'ledger.reactivate') | translate }}</button>
                      <button class="btn-ghost btn-sm" [disabled]="busy()" (click)="remove(c)">{{ 'ledger.delete' | translate }}</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="row-empty">
                  <app-empty-state icon="hub" [title]="(loading() ? 'ledger.loading' : 'ledger.cc.emptyTitle') | translate"
                                   [text]="loading() ? '' : ('ledger.cc.emptyText' | translate)" />
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (form(); as f) {
      <div class="modal-backdrop">
        <div class="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="ledger-cc-title">
          <div class="modal-header">
            <h3 id="ledger-cc-title" class="modal-title">{{ (f.id ? 'ledger.cc.editTitle' : 'ledger.cc.add') | translate }}</h3>
            <button class="btn-icon btn-sm" (click)="form.set(null)" [attr.aria-label]="'ledger.cancel' | translate"><mat-icon class="icon-sm">close</mat-icon></button>
          </div>
          <fieldset class="space-y-3" [disabled]="busy()">
            <label class="block"><span class="field-label">{{ 'ledger.code' | translate }}</span>
              <input class="input-field" maxlength="20" [disabled]="!!f.id" [(ngModel)]="f.code" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.cc.name' | translate }}</span>
              <input class="input-field" maxlength="200" [(ngModel)]="f.name" /></label>
            <label class="block"><span class="field-label">{{ 'ledger.cc.mission' | translate }}</span>
              <select class="input-field" [(ngModel)]="f.missionId">
                <option [ngValue]="null">{{ 'ledger.cc.noMission' | translate }}</option>
                @for (m of missions(); track m.id) { <option [ngValue]="m.id">{{ m.name }}@if (m.partnerName) { · {{ m.partnerName }} }</option> }
              </select>
              <span class="field-hint">{{ 'ledger.cc.missionHint' | translate }}</span></label>
          </fieldset>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="form.set(null)">{{ 'ledger.cancel' | translate }}</button>
            <button class="btn-primary" [disabled]="busy() || !f.name.trim() || !f.code.trim()" (click)="save(f)">{{ 'ledger.save' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LedgerCostCentersComponent implements OnInit {
  private api = inject(LedgerApi);
  private missionApi = inject(MissionApi);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private state = inject(CrmStateService);
  private confirm = inject(ConfirmService);

  centers = signal<CostCenter[]>([]);
  missions = signal<MissionSummary[]>([]);
  loading = signal(true);
  busy = signal(false);
  showInactive = signal(false);
  form = signal<CostCenterForm | null>(null);

  shown = computed(() => this.centers()
    .filter(c => this.showInactive() || c.active)
    .sort((a, b) => a.code.localeCompare(b.code)));

  canWrite(): boolean { return this.state.hasAuthority('LEDGER_WRITE'); }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.costCenters(true).subscribe({
      next: c => { this.centers.set(c ?? []); this.loading.set(false); },
      error: e => { this.loading.set(false); this.fail(e); },
    });
  }

  openForm(c?: CostCenter): void {
    if (!this.missions().length) {
      this.missionApi.list().subscribe({ next: m => this.missions.set(m ?? []), error: () => { /* no mission to pick */ } });
    }
    this.form.set(c ? { id: c.id, code: c.code, name: c.name, missionId: c.missionId ?? null } : { code: '', name: '', missionId: null });
  }

  save(f: CostCenterForm): void {
    this.busy.set(true);
    const call = f.id
      ? this.api.updateCostCenter(f.id, { name: f.name.trim(), missionId: f.missionId })
      : this.api.createCostCenter({ code: f.code.trim(), name: f.name.trim(), missionId: f.missionId });
    call.subscribe({
      next: saved => {
        this.busy.set(false);
        this.form.set(null);
        this.toast.show(this.i18n.t(f.id ? 'ledger.cc.saved' : 'ledger.cc.created'), { type: 'success' });
        this.upsert(saved);
      },
      error: e => this.fail(e),
    });
  }

  toggleActive(c: CostCenter): void {
    this.busy.set(true);
    this.api.updateCostCenter(c.id, { active: !c.active }).subscribe({
      next: saved => {
        this.busy.set(false);
        this.toast.show(this.i18n.t(saved.active ? 'ledger.cc.reactivated' : 'ledger.cc.deactivated'), { type: 'success' });
        this.upsert(saved);
      },
      error: e => this.fail(e),
    });
  }

  async remove(c: CostCenter): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.i18n.t('ledger.cc.confirmDelete', { code: c.code }),
      confirmLabel: this.i18n.t('ledger.delete'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    this.api.deleteCostCenter(c.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('ledger.cc.deleted'), { type: 'success' });
        this.centers.update(list => list.filter(x => x.id !== c.id));
      },
      error: e => this.fail(e),
    });
  }

  private upsert(saved: CostCenter): void {
    this.centers.update(list => (list.some(x => x.id === saved.id) ? list.map(x => (x.id === saved.id ? saved : x)) : [...list, saved]));
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.toast.show(errorDetail(e) || this.i18n.t('ledger.error'), { type: 'error' });
  }
}
