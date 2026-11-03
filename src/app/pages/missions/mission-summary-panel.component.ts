import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { MissionApi, MissionDocumentType, MissionFinancials } from '../../services/domains/mission.service';
import { formatMoney, shortDate } from '../../shared/bank.util';

/** Where each document of the timeline opens. */
export function missionDocumentLink(type: MissionDocumentType, id: string, dealId?: string | null): { path: string; query: Record<string, string> } | null {
  switch (type) {
    case 'DEAL': return { path: `/sales/deals/${id}`, query: {} };
    case 'PROPOSAL': return dealId ? { path: `/sales/deals/${dealId}`, query: {} } : { path: '/sales', query: {} };
    case 'DELIVERY_NOTE': return { path: '/finance/delivery-notes', query: { note: id } };
    case 'INVOICE':
    case 'ADVANCE': return { path: '/finance', query: {} };
    case 'BILL': return { path: '/finance', query: { tab: 'Vendor' } };
    case 'EXPENSE': return { path: '/finance', query: { tab: 'Expenses' } };
    default: return null;
  }
}

const DOC_ICONS: Record<MissionDocumentType, string> = {
  PROPOSAL: 'description', DEAL: 'handshake', DELIVERY_NOTE: 'local_shipping', INVOICE: 'receipt',
  ADVANCE: 'request_quote', BILL: 'request_page', EXPENSE: 'payments',
};

/**
 * "Mission summary": quoted, invoiced, costs by account and margin, and the timeline of the
 * documents behind them (GET /missions/{id}/summary).
 */
@Component({
  selector: 'app-mission-summary-panel',
  imports: [MatIconModule, RouterLink, TranslatePipe],
  template: `
    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-ink">{{ 'missions.summary.title' | translate }}</h3>
      @if (summary(); as s) {
        <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt class="text-ink-3">{{ 'missions.summary.quoted' | translate }}</dt><dd class="text-ink num text-end">{{ money(s.quoted) }}</dd>
          <dt class="text-ink-3">{{ 'missions.summary.invoiced' | translate }}</dt><dd class="text-ink num text-end">{{ money(s.invoiced) }}</dd>
          @if (s.advances) {
            <dt class="text-ink-3">{{ 'missions.summary.advances' | translate }}</dt><dd class="text-ink-2 num text-end">{{ money(s.advances) }}</dd>
          }
          <dt class="text-ink-3">{{ 'missions.summary.costs' | translate }}</dt><dd class="text-ink num text-end">{{ money(s.costsTotal) }}</dd>
          <dt class="font-semibold text-ink border-t border-line pt-1">{{ 'missions.summary.margin' | translate }}</dt>
          <dd class="num font-semibold text-end border-t border-line pt-1" [class.text-danger-ink]="(s.margin ?? 0) < 0" [class.text-success-ink]="(s.margin ?? 0) > 0">{{ money(s.margin) }}</dd>
        </dl>

        @if (s.costs?.length) {
          <div class="space-y-1">
            <div class="text-xs font-semibold text-ink-2">{{ 'missions.summary.costsByAccount' | translate }}</div>
            @for (c of s.costs; track c.accountCode) {
              <div class="flex justify-between gap-2 text-xs">
                <span class="text-ink-2 truncate"><span class="num">{{ c.accountCode }}</span> · {{ c.accountName || '' }}</span>
                <span class="num text-ink shrink-0">{{ money(c.amount) }}</span>
              </div>
            }
          </div>
        } @else if (!s.costCenterId) {
          <p class="text-xs text-ink-3">{{ 'missions.summary.noCostCenter' | translate }}</p>
        }

        <div class="space-y-1">
          <div class="text-xs font-semibold text-ink-2">{{ 'missions.summary.timeline' | translate }}</div>
          <ol class="space-y-1">
            @for (d of s.documents ?? []; track d.type + d.id) {
              <li class="flex items-center gap-2 text-sm">
                <mat-icon class="icon-sm text-ink-3 shrink-0">{{ icon(d.type) }}</mat-icon>
                <span class="text-xs text-ink-3 w-20 shrink-0">{{ date(d.date) }}</span>
                <span class="min-w-0 flex-1 truncate">
                  @if (link(d.type, d.id, s.dealId); as r) {
                    <a class="text-accent-ink hover:underline" [routerLink]="r.path" [queryParams]="r.query">{{ ('missions.summary.doc.' + d.type) | translate }} {{ d.number || '' }}</a>
                  } @else {
                    {{ ('missions.summary.doc.' + d.type) | translate }} {{ d.number || '' }}
                  }
                  @if (d.status) { <span class="text-xs text-ink-3"> · {{ d.status }}</span> }
                </span>
                @if (d.amount !== null && d.amount !== undefined) { <span class="num text-xs text-ink shrink-0">{{ money(d.amount) }}</span> }
              </li>
            } @empty {
              <li class="text-xs text-ink-3">{{ 'missions.summary.noDocuments' | translate }}</li>
            }
          </ol>
        </div>
      } @else if (failed()) {
        <p class="text-xs text-ink-3">{{ 'missions.summary.unavailable' | translate }}</p>
      } @else {
        <p class="text-xs text-ink-3">{{ 'missions.summary.loading' | translate }}</p>
      }
    </section>
  `,
})
export class MissionSummaryPanelComponent {
  private api = inject(MissionApi);

  missionId = input.required<string>();
  summary = signal<MissionFinancials | null>(null);
  failed = signal(false);

  constructor() {
    effect(() => {
      const id = this.missionId();
      untracked(() => this.load(id));
    });
  }

  reload(): void { this.load(this.missionId()); }

  private load(id: string): void {
    this.summary.set(null);
    this.failed.set(false);
    if (!id) return;
    this.api.summary(id).subscribe({
      next: s => { if (this.missionId() === id) this.summary.set(s); },
      error: () => { if (this.missionId() === id) this.failed.set(true); },
    });
  }

  icon(t: MissionDocumentType): string { return DOC_ICONS[t] ?? 'description'; }
  link(t: MissionDocumentType, id: string, dealId?: string | null) { return missionDocumentLink(t, id, dealId); }
  money(v: number | null | undefined): string { return formatMoney(v); }
  date(v: string | null | undefined): string { return shortDate(v); }
}
