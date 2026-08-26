import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { DealsService } from '../services/domains/deals.service';
import { PartnersService } from '../services/domains/partners.service';
import { CrmStateService, Deal, DealStage } from '../services/crm-state.service';
import { ToastService } from '../services/toast.service';

interface StageMeta {
  stage: DealStage;
  label: string;
  probability: number;
  dot: string;
  ring: string;
  headerText: string;
}

const PIPELINE_STAGES: StageMeta[] = [
  { stage: 'New',                 label: 'New',                 probability: 0.10, dot: 'bg-slate-400',   ring: 'bg-slate-50 border-slate-200',   headerText: 'text-slate-700' },
  { stage: 'Confirmed',           label: 'Confirmed',           probability: 0.50, dot: 'bg-sky-500',      ring: 'bg-sky-50 border-sky-200',       headerText: 'text-sky-700' },
  { stage: 'Awaiting Invoicing',  label: 'Awaiting Invoicing',  probability: 0.75, dot: 'bg-amber-500',    ring: 'bg-amber-50 border-amber-200',   headerText: 'text-amber-700' },
  { stage: 'Invoiced',            label: 'Invoiced',            probability: 0.90, dot: 'bg-violet-500',   ring: 'bg-violet-50 border-violet-200', headerText: 'text-violet-700' },
  { stage: 'Closed Won',          label: 'Closed Won',          probability: 1.00, dot: 'bg-emerald-500',  ring: 'bg-emerald-50 border-emerald-200', headerText: 'text-emerald-700' },
  { stage: 'Closed Lost',         label: 'Closed Lost',         probability: 0.00, dot: 'bg-rose-500',     ring: 'bg-rose-50 border-rose-200',     headerText: 'text-rose-700' },
];

const AVATAR_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];

@Component({
  selector: 'app-sales-pipeline-board',
  standalone: true,
  imports: [CommonModule, MatIconModule, DragDropModule],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 min-h-[600px]" cdkDropListGroup>
      @for (col of columns(); track col.meta.stage) {
        <div class="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col">
          <!-- Column Header -->
          <div class="mb-3 px-1">
            <div class="flex items-center gap-2 mb-1">
              <div [class]="col.meta.dot" class="w-2.5 h-2.5 rounded-full shrink-0"></div>
              <h3 [class]="col.meta.headerText" class="text-sm font-bold uppercase tracking-wide truncate">{{ col.meta.label }}</h3>
              <span class="ml-auto text-xs font-semibold text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-100 shrink-0">{{ col.deals.length }}</span>
            </div>
            <div class="text-sm font-sans font-bold text-zinc-900 tabular-nums">{{ formatCurrency(col.totalValue) }}</div>
          </div>

          <!-- Cards -->
          <div
            cdkDropList
            [cdkDropListData]="col.deals"
            (cdkDropListDropped)="onDrop($event, col.meta)"
            class="kanban-column flex-1 space-y-3 min-h-[100px] rounded-xl"
          >
            @for (deal of col.deals; track deal.id) {
              <div cdkDrag [cdkDragData]="deal" class="kanban-card card rounded-xl p-3.5 cursor-grab active:cursor-grabbing hover:shadow-md space-y-2.5">
                <!-- Company + staleness -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <div
                      [style.background-color]="avatarColor(getPartnerName(deal.partnerId))"
                      class="w-7 h-7 rounded-full text-white font-semibold text-meta uppercase flex items-center justify-center shrink-0 shadow-xs">
                      {{ initials(getPartnerName(deal.partnerId)) }}
                    </div>
                    <span class="text-sm font-semibold text-zinc-900 truncate">{{ getPartnerName(deal.partnerId) }}</span>
                  </div>
                  <div
                    class="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                    [class]="stalenessColor(deal)"
                    [title]="stalenessLabel(deal)">
                  </div>
                </div>

                <h4 class="text-xs font-medium text-zinc-600 leading-snug line-clamp-2">{{ deal.title }}</h4>

                <div class="flex items-center justify-between pt-2 border-t border-zinc-100">
                  <span class="text-sm font-sans font-bold text-zinc-900 tabular-nums">{{ formatCurrency(deal.amount) }}</span>
                  <div
                    [style.background-color]="avatarColor(deal.salesPerson || 'Unassigned')"
                    class="w-6 h-6 rounded-full text-white font-semibold text-meta uppercase flex items-center justify-center shrink-0 shadow-xs"
                    [title]="deal.salesPerson || 'Unassigned'">
                    {{ initials(deal.salesPerson || '?') }}
                  </div>
                </div>
              </div>
            } @empty {
              <div class="text-center py-8 text-xs text-zinc-400 italic">No deals</div>
            }
          </div>

          <!-- Column Footer: weighted forecast -->
          <div class="mt-3 pt-3 border-t border-zinc-100 px-1">
            <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block">Weighted Forecast</span>
            <span class="text-sm font-sans font-bold text-zinc-700 tabular-nums">{{ formatCurrency(col.weightedForecast) }}</span>
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
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
    if (days <= 3) return 'bg-zinc-300';
    if (days <= 10) return 'bg-amber-400';
    return 'bg-red-500';
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
