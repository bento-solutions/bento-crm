import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { ToastService } from '../../services/toast.service';
import { CrmStateService } from '../../services/crm-state.service';
import { MissionApi, MissionDetail, MissionStatus, MissionSummary } from '../../services/domains/mission.service';
import { formatMoney } from '../../shared/bank.util';
import { errorDetail } from '../bank/bank-labels';

/**
 * The missions of a deal (GET /missions?dealId=), and "Create mission" when there is none
 * (POST /deals/{id}/mission: name, client and fee from the deal).
 */
@Component({
  selector: 'app-deal-missions-panel',
  imports: [MatIconModule, RouterLink, TranslatePipe],
  template: `
    @if (canRead()) {
      <section class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-semibold text-ink">{{ 'missions.dealPanel.title' | translate }}</h3>
          @if (loaded() && !missions().length && canWrite()) {
            <button class="btn-secondary btn-sm ms-auto" [disabled]="busy()" (click)="create()"><mat-icon>work</mat-icon>{{ 'missions.dealPanel.create' | translate }}</button>
          }
        </div>
        @for (m of missions(); track m.id) {
          <a class="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 hover:bg-subtle"
             routerLink="/missions" [queryParams]="{ mission: m.id }">
            <div class="min-w-0">
              <div class="text-sm text-ink truncate">{{ m.name }}</div>
              <div class="text-meta text-ink-3">{{ 'missions.deliveredOf' | translate: { done: m.delivered, total: m.deliverables } }}</div>
            </div>
            <div class="text-end shrink-0">
              @if (m.feeAmount !== null && m.feeAmount !== undefined) { <div class="num text-sm text-ink">{{ money(m.feeAmount) }}</div> }
              <span class="badge" [class]="statusBadge(m.status)">{{ ('missions.statusName.' + m.status) | translate }}</span>
            </div>
          </a>
        } @empty {
          @if (loaded()) { <p class="text-xs text-ink-3">{{ 'missions.dealPanel.none' | translate }}</p> }
        }
      </section>
    }
  `,
})
export class DealMissionsPanelComponent {
  private api = inject(MissionApi);
  private state = inject(CrmStateService);
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);

  dealId = input.required<string>();
  missions = signal<MissionSummary[]>([]);
  loaded = signal(false);
  busy = signal(false);

  constructor() {
    effect(() => {
      const id = this.dealId();
      untracked(() => this.load(id));
    });
  }

  canRead(): boolean { return this.state.hasAuthority('PARTNERS_READ'); }
  canWrite(): boolean { return this.state.hasAuthority('PARTNERS_WRITE'); }

  private load(dealId: string): void {
    this.missions.set([]);
    this.loaded.set(false);
    if (!dealId || !this.canRead()) return;
    this.api.list(null, null, dealId).subscribe({
      next: list => {
        if (this.dealId() !== dealId) return;
        // An older server ignores ?dealId=, so keep only this deal's.
        this.missions.set((list ?? []).filter(m => m.dealId === dealId));
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  create(): void {
    this.busy.set(true);
    this.api.createForDeal(this.dealId()).subscribe({
      next: r => {
        this.busy.set(false);
        this.toast.show(this.i18n.t('missions.dealPanel.created'), { type: 'success' });
        const m = (r as MissionDetail)?.mission ?? (r as MissionSummary);
        // Show it at once, then reload the list from the server.
        if (m?.id) this.missions.set([{ ...m, dealId: this.dealId() }]);
        this.load(this.dealId());
      },
      error: e => {
        this.busy.set(false);
        this.toast.show(errorDetail(e) || this.i18n.t('bank.error'), { type: 'error' });
      },
    });
  }

  statusBadge(s: MissionStatus): string {
    switch (s) {
      case 'IN_PROGRESS': return 'badge-info';
      case 'DONE': return 'badge-success';
      case 'CANCELLED': return 'badge-neutral';
      default: return 'badge-warning';
    }
  }

  money(v: number | null | undefined): string { return formatMoney(v); }
}
