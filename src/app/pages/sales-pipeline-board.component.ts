import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { DealsService } from '../services/domains/deals.service';
import { PartnersService } from '../services/domains/partners.service';
import { CrmStateService, Deal, DealStage } from '../services/crm-state.service';
import { ToastService } from '../services/toast.service';
import { identityColor } from '../shared/ui/identity-color';

interface StageMeta {
  stage: DealStage;
  label: string;
  probability: number;
  dot: string;
  ring: string;
  headerText: string;
}

const PIPELINE_STAGES: StageMeta[] = [
  { stage: 'New',                 label: 'New',                 probability: 0.10, dot: 'bg-ink-4',   ring: 'bg-subtle border-line',   headerText: 'text-ink-2' },
  { stage: 'Confirmed',           label: 'Confirmed',           probability: 0.50, dot: 'bg-info',      ring: 'bg-info-soft border-info-line',       headerText: 'text-info-ink' },
  { stage: 'Awaiting Invoicing',  label: 'Awaiting Invoicing',  probability: 0.75, dot: 'bg-warning',    ring: 'bg-warning-soft border-warning-line',   headerText: 'text-warning-ink' },
  { stage: 'Invoiced',            label: 'Invoiced',            probability: 0.90, dot: 'bg-violet',   ring: 'bg-violet-soft border-violet-line', headerText: 'text-violet-ink' },
  { stage: 'Closed Won',          label: 'Closed Won',          probability: 1.00, dot: 'bg-success',  ring: 'bg-success-soft border-success-line', headerText: 'text-success-ink' },
  { stage: 'Closed Lost',         label: 'Closed Lost',         probability: 0.00, dot: 'bg-danger',     ring: 'bg-danger-soft border-danger-line',     headerText: 'text-danger-ink' },
];


@Component({
  selector: 'app-sales-pipeline-board',
  standalone: true,
  imports: [CommonModule, MatIconModule, DragDropModule],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 min-h-[600px]" cdkDropListGroup>
      @for (col of columns(); track col.meta.stage) {
        <div class="card p-4 flex flex-col">
          <!-- Column Header -->
          <div class="mb-3 px-1">
            <div class="flex items-center gap-2 mb-1">
              <div [class]="col.meta.dot" class="w-2.5 h-2.5 rounded-full shrink-0"></div>
              <h3 [class]="col.meta.headerText" class="eyebrow truncate">{{ col.meta.label }}</h3>
              <span class="badge badge-neutral ml-auto shrink-0">{{ col.deals.length }}</span>
            </div>
            <div class="text-sm font-semibold text-ink tabular-nums">{{ formatCurrency(col.totalValue) }}</div>
          </div>

          <!-- Cards -->
          <div
            cdkDropList
            [cdkDropListData]="col.deals"
            (cdkDropListDropped)="onDrop($event, col.meta)"
            class="kanban-column flex-1 space-y-3 min-h-[100px] rounded-xl"
          >
            @for (deal of col.deals; track deal.id) {
              <div cdkDrag [cdkDragData]="deal" class="kanban-card card p-3.5 cursor-grab active:cursor-grabbing space-y-2.5">
                <!-- Company + staleness -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <div
                      [style.background-color]="avatarColor(getPartnerName(deal.partnerId))"
                      class="w-7 h-7 rounded-full text-white font-semibold text-meta uppercase flex items-center justify-center shrink-0 shadow-xs">
                      {{ initials(getPartnerName(deal.partnerId)) }}
                    </div>
                    <span class="text-sm font-semibold text-ink truncate">{{ getPartnerName(deal.partnerId) }}</span>
                  </div>
                  <div
                    class="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                    [class]="stalenessColor(deal)"
                    [title]="stalenessLabel(deal)">
                  </div>
                </div>

                <h4 class="text-xs font-medium text-ink-2 leading-snug line-clamp-2">{{ deal.title }}</h4>

                <div class="flex items-center justify-between pt-2 border-t border-line-soft">
                  <span class="text-sm font-semibold text-ink tabular-nums">{{ formatCurrency(deal.amount) }}</span>
                  <div
                    [style.background-color]="avatarColor(deal.salesPerson || 'Unassigned')"
                    class="w-6 h-6 rounded-full text-white font-semibold text-meta uppercase flex items-center justify-center shrink-0 shadow-xs"
                    [title]="deal.salesPerson || 'Unassigned'">
                    {{ initials(deal.salesPerson || '?') }}
                  </div>
                </div>
              </div>
            } @empty {
              <div class="text-center py-8 text-xs text-ink-3 italic">No deals</div>
            }
          </div>

          <!-- Column Footer: weighted forecast -->
          <div class="mt-3 pt-3 border-t border-line-soft px-1">
            <span class="eyebrow block">Weighted Forecast</span>
            <span class="text-sm font-semibold text-ink-2 tabular-nums">{{ formatCurrency(col.weightedForecast) }}</span>
          </div>
        </div>
      }
    </div>
  `
})
export class SalesPipelineBoardComponent {
  private dealsService = inject(DealsService);
  private partnersService = inject(PartnersService);
  private state = inject(CrmStateService);
  private toast = inject(ToastService);

  stages = PIPELINE_STAGES;

  canWriteDeal(): boolean { return this.state.hasAuthority('DEALS_WRITE'); }

  columns = computed(() => {
    const deals = this.dealsService.allDeals();
    return this.stages.map(meta => {
      const colDeals = deals.filter(d => d.stage === meta.stage);
      const totalValue = colDeals.reduce((sum, d) => sum + d.amount, 0);
      const weightedForecast = totalValue * meta.probability;
      return { meta, deals: colDeals, totalValue, weightedForecast };
    });
  });

  getPartnerName(id: string): string {
    return this.partnersService.allPartners().find(p => p.id === id)?.name || 'Unknown';
  }

  formatCurrency(value: number) {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(value);
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  avatarColor(seed: string): string {
    return identityColor(seed);
  }

  /** Latest activity date across all logged interactions, falling back to order/creation date. */
  lastActivityDate(deal: Deal): Date {
    const dates: string[] = [
      ...(deal.activityLog?.calls.map(c => c.date) || []),
      ...(deal.activityLog?.emails.map(e => e.date) || []),
      ...(deal.activityLog?.meetings.map(m => m.date) || []),
      ...(deal.activityLog?.recordings.map(r => r.date) || []),
      ...(deal.activityLog?.notes.map(n => n.date) || []),
      deal.orderDate || deal.createdAt
    ].filter(Boolean) as string[];
    const timestamps = dates.map(d => new Date(d).getTime()).filter(t => !isNaN(t));
    return new Date(timestamps.length ? Math.max(...timestamps) : 0);
  }

  daysSinceLastActivity(deal: Deal): number {
    const ms = Date.now() - this.lastActivityDate(deal).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  stalenessColor(deal: Deal): string {
    const days = this.daysSinceLastActivity(deal);
    if (days <= 3) return 'bg-muted-strong';
    if (days <= 10) return 'bg-warning';
    return 'bg-danger';
  }

  stalenessLabel(deal: Deal): string {
    const days = this.daysSinceLastActivity(deal);
    return `Last activity ${days} day${days !== 1 ? 's' : ''} ago`;
  }

  onDrop(event: CdkDragDrop<Deal[]>, targetMeta: StageMeta) {
    if (!this.canWriteDeal()) return;
    if (event.previousContainer === event.container) return;

    const deal = event.item.data as Deal;
    const previousStage = deal.stage;

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    this.dealsService.moveDealStage(deal.id, targetMeta.stage);
    this.toast.show(`<strong>${deal.title}</strong> moved to <strong>${targetMeta.label}</strong>`, {
      undo: () => this.dealsService.moveDealStage(deal.id, previousStage)
    });
  }
}
