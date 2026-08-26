import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { CrmStateService, Task, Ticket, TaskStatus } from '../services/crm-state.service';
import { PartnerScheduleCalendarComponent } from '../shared/partner-schedule-calendar.component';
import { BentoGrid, BentoTile } from '../shared/bento-grid';
import { CountUpDirective } from '../shared/count-up.directive';

type Tone = 'slate' | 'blue' | 'sky' | 'violet' | 'emerald' | 'amber' | 'rose';
type TileKind = 'today' | 'pipeline' | 'late' | 'donut' | 'schedule' | 'queue' | 'kpi';

interface TileDef {
  id: string;
  kind: TileKind;
  title: string;
  icon: string;
  tone: Tone;
  /** Column span (of 12) and row span. `hSm` overrides the row span on narrow screens. */
  w: number;
  h: number;
  hSm?: number;
}

interface Delta {
  pct: number;
  direction: 'up' | 'down' | 'flat';
  /** True when "up" is bad news (overdue invoices, lost deals). */
  inverted?: boolean;
}

interface Spark {
  line: string;
  area: string;
}

interface KpiData {
  label: string;
  icon: string;
  raw: number;
  format: (v: number) => string;
  hint: string;
  delta: Delta | null;
  spark: Spark;
}

interface TodayItem {
  kind: 'task' | 'deal' | 'ticket';
  id: string;
  icon: string;
  tone: Tone;
  title: string;
  meta: string;
  actionLabel: string;
  action: () => void;
}

interface QueueRow {
  id: string;
  title: string;
  sub: string;
  deadline: string;
  overdue: boolean;
}

interface QueueSection {
  key: string;
  label: string;
  tone: Tone;
  rows: QueueRow[];
}

interface Slice {
  label: string;
  count: number;
  pct: number;
  dasharray: string;
  dashoffset: number;
  opacity: number;
}

/**
 * Every tile the dashboard can show, in a stable order. The rendered order lives in
 * `state.dashboardLayout()` and is applied by the bento grid via CSS `order`, so this
 * array — and therefore the DOM — never changes when tiles are rearranged.
 *
 * Row spans are always 2 or 4 so the tiles tile: a 4-row panel is exactly two stacked 2-row
 * tiles, which lets `dense` auto-flow backfill every hole. An odd span would leave a one-row
 * sliver nothing else can fit into.
 */
const CATALOG: TileDef[] = [
  { id: 'today', kind: 'today', title: 'Focus Today', icon: 'bolt', tone: 'slate', w: 4, h: 4 },
  { id: 'pipeline', kind: 'pipeline', title: 'Pipeline Value', icon: 'trending_up', tone: 'violet', w: 4, h: 4 },
  { id: 'tasks-queue', kind: 'queue', title: 'Pending Tasks', icon: 'checklist', tone: 'amber', w: 4, h: 4, hSm: 5 },
  { id: 'schedule', kind: 'schedule', title: 'Partner Schedule', icon: 'calendar_month', tone: 'blue', w: 4, h: 4, hSm: 6 },
  { id: 'tickets-queue', kind: 'queue', title: 'Pending Tickets', icon: 'support_agent', tone: 'sky', w: 4, h: 4, hSm: 5 },
  { id: 'partner-mix', kind: 'donut', title: 'Partner Mix', icon: 'groups', tone: 'blue', w: 2, h: 4 },
  { id: 'task-status', kind: 'donut', title: 'Task Status', icon: 'donut_small', tone: 'emerald', w: 2, h: 4 },
  { id: 'late-payers', kind: 'late', title: 'Late Payers', icon: 'running_with_errors', tone: 'rose', w: 2, h: 2 },
  { id: 'kpi:totalDeals', kind: 'kpi', title: 'Deal Value', icon: 'payments', tone: 'emerald', w: 2, h: 2 },
  { id: 'kpi:newDeals', kind: 'kpi', title: 'New Deals', icon: 'handshake', tone: 'violet', w: 2, h: 2 },
  { id: 'kpi:totalProspects', kind: 'kpi', title: 'Prospects', icon: 'person_search', tone: 'blue', w: 2, h: 2 },
  { id: 'kpi:openTickets', kind: 'kpi', title: 'Open Tickets', icon: 'confirmation_number', tone: 'amber', w: 2, h: 2 },
  { id: 'kpi:activeCampaigns', kind: 'kpi', title: 'Campaigns', icon: 'campaign', tone: 'sky', w: 2, h: 2 },
  { id: 'kpi:marketingSpend', kind: 'kpi', title: 'Reach', icon: 'send', tone: 'violet', w: 2, h: 2 },
  { id: 'kpi:newTasksWeek', kind: 'kpi', title: 'New Tasks', icon: 'assignment_add', tone: 'emerald', w: 2, h: 2 },
  { id: 'kpi:newProspects', kind: 'kpi', title: 'New Prospects', icon: 'group_add', tone: 'sky', w: 2, h: 2 },
  { id: 'kpi:lostProspects', kind: 'kpi', title: 'Lost Deals', icon: 'trending_down', tone: 'rose', w: 2, h: 2 },
  { id: 'kpi:todaysDeal', kind: 'kpi', title: 'Best Today', icon: 'star', tone: 'amber', w: 2, h: 2 }
];

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule, PartnerScheduleCalendarComponent, BentoGrid, BentoTile, CountUpDirective],
  template: `
    <div class="dash">
      <!-- Customise tray -->
      @if (state.isCustomizing()) {
        <div class="dash-tray">
          <div class="dash-tray__hint">
            <mat-icon class="dash-tray__hint-icon">drag_indicator</mat-icon>
            <span>Drag any tile to rearrange. Tiles reflow to fill every gap.</span>
          </div>
          <div class="dash-tray__chips">
            @for (tile of hiddenTiles(); track tile.id) {
              <button class="dash-chip" [attr.data-tone]="tile.tone" (click)="toggle(tile.id)">
                <mat-icon class="dash-chip__icon">add</mat-icon>{{ tile.title }}
              </button>
            } @empty {
              <span class="dash-tray__empty">Every tile is on the board.</span>
            }
          </div>
          <button class="dash-reset" (click)="reset()">
            <mat-icon class="dash-chip__icon">restart_alt</mat-icon>Reset layout
          </button>
        </div>
      }

      <div
        appBentoGrid
        [bentoGrid]="layout()"
        [bentoEditing]="state.isCustomizing()"
        (bentoReorder)="onReorder($event)"
        [class.is-editing]="state.isCustomizing()"
      >
        @for (tile of tiles(); track tile.id) {
          <section
            appBentoTile
            [bentoTile]="tile.id"
            [attr.data-tone]="tile.tone"
            [style]="varsFor(tile)"
            [attr.aria-label]="tile.title"
          >
            @if (state.isCustomizing()) {
              <button class="bento-remove" (click)="toggle(tile.id)" [attr.aria-label]="'Remove ' + tile.title">
                <mat-icon class="dash-chip__icon">close</mat-icon>
              </button>
            }

            <!-- ── Shared tile header ── -->
            <header class="bento-tile__head">
              <span class="bento-icon"><mat-icon>{{ tile.icon }}</mat-icon></span>
              @if (tile.kind === 'kpi') {
                <h3 class="bento-tile__title bento-tile__title--help" [matTooltip]="kpi(tile.id).hint" matTooltipPosition="above">{{ tile.title }}</h3>
              } @else {
                <h3 class="bento-tile__title">{{ tile.title }}</h3>
              }
              @switch (tile.kind) {
                @case ('today') {
                  @if (todayItems().length) { <span class="dash-count">{{ todayItems().length }}</span> }
                }
                @case ('queue') {
                  <span class="dash-count">{{ queue(tile.id).total }}</span>
                }
              }
              <button
                class="bento-grip"
                data-bento-handle
                type="button"
                [attr.aria-label]="'Reorder ' + tile.title + '. Press space to pick up, arrow keys to move.'"
              >
                <mat-icon class="dash-chip__icon">drag_indicator</mat-icon>
              </button>
            </header>

            <div class="bento-tile__body">
              @switch (tile.kind) {

                <!-- ── Focus Today ── -->
                @case ('today') {
                  <div class="bento-tile__scroll dash-stack">
                    @for (item of todayItems(); track item.kind + item.id) {
                      <div class="focus-row" [attr.data-tone]="item.tone">
                        <span class="focus-row__icon"><mat-icon>{{ item.icon }}</mat-icon></span>
                        <div class="focus-row__text">
                          <div class="focus-row__title">{{ item.title }}</div>
                          <div class="focus-row__meta">{{ item.meta }}</div>
                        </div>
                        <button class="focus-row__action" data-no-drag (click)="item.action()">
                          {{ item.actionLabel }}
                        </button>
                      </div>
                    } @empty {
                      <div class="dash-empty">
                        <mat-icon class="dash-empty__icon">verified</mat-icon>
                        <div class="dash-empty__title">Nothing needs you right now</div>
                        <div class="dash-empty__sub">No overdue tasks, stale deals or unassigned tickets.</div>
                      </div>
                    }
                  </div>
                }

                <!-- ── Pipeline ── -->
                @case ('pipeline') {
                  <div class="dash-figure">
                    <span class="dash-value" [appCountUp]="pipelineValueNum()" [appCountUpFormat]="moneyFormat">0</span>
                    @if (pipelineDelta(); as d) {
                      <span class="dash-delta" [attr.data-dir]="dirOf(d)">
                        <mat-icon class="dash-delta__icon">{{ arrow(d) }}</mat-icon>{{ pctLabel(d) }}
                      </span>
                    }
                  </div>
                  <div class="dash-caption">across {{ openDealCount() }} open deals</div>

                  <svg class="dash-area" viewBox="0 0 300 62" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="grad-pipeline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--tile)" stop-opacity="0.28" />
                        <stop offset="100%" stop-color="var(--tile)" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                    <path class="dash-area__fill" [attr.d]="pipelineSpark().area" fill="url(#grad-pipeline)" />
                    <path class="dash-area__line" [attr.d]="pipelineSpark().line" pathLength="1" fill="none" stroke="var(--tile)" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                  </svg>

                  <div class="dash-sublabel">Top open deals</div>
                  <div class="dash-stack">
                    @for (deal of topDeals(); track deal.id; let i = $index) {
                      <button class="deal-row" data-no-drag (click)="openDeal(deal.id)">
                        <span class="deal-row__rank">{{ i + 1 }}</span>
                        <span class="deal-row__name">{{ deal.partner }}</span>
                        <span class="deal-row__amount">{{ deal.amount }}</span>
                      </button>
                    } @empty {
                      <div class="dash-note">No open deals in the pipeline.</div>
                    }
                  </div>
                }

                <!-- ── Late payers ── -->
                @case ('late') {
                  <div class="dash-figure">
                    <span class="dash-value" [appCountUp]="latePayers().count" [appCountUpFormat]="intFormat">0</span>
                    @if (latePayers().delta; as d) {
                      <span class="dash-delta" [attr.data-dir]="dirOf(d)">
                        <mat-icon class="dash-delta__icon">{{ arrow(d) }}</mat-icon>{{ pctLabel(d) }}
                      </span>
                    }
                  </div>
                  <dl class="dash-facts">
                    <div><dt>At risk</dt><dd>{{ latePayers().atRisk }}</dd></div>
                    <div><dt>Oldest</dt><dd>{{ latePayers().oldest }}</dd></div>
                  </dl>
                }

                <!-- ── Donuts ── -->
                @case ('donut') {
                  @let d = donut(tile.id);
                  <div class="donut">
                    <svg viewBox="0 0 36 36" class="donut__svg" aria-hidden="true">
                      <circle cx="18" cy="18" r="15.9155" class="donut__track" stroke-width="4.2" fill="none" />
                      @for (s of d.slices; track s.label) {
                        <circle
                          class="donut__slice"
                          cx="18" cy="18" r="15.9155" fill="none"
                          stroke="var(--tile)" stroke-width="4.2"
                          [attr.stroke-opacity]="s.opacity"
                          [attr.stroke-dasharray]="s.dasharray"
                          [attr.stroke-dashoffset]="s.dashoffset"
                        />
                      }
                    </svg>
                    <div class="donut__center">
                      <span class="donut__total" [appCountUp]="d.total" [appCountUpFormat]="intFormat">0</span>
                      <span class="donut__unit">{{ d.unit }}</span>
                    </div>
                  </div>
                  <ul class="legend">
                    @for (s of d.slices; track s.label) {
                      <li class="legend__row">
                        <span class="legend__dot" [style.opacity]="s.opacity"></span>
                        <span class="legend__label">{{ s.label }}</span>
                        <span class="legend__pct">{{ s.pct }}%</span>
                        <span class="legend__count">{{ s.count }}</span>
                      </li>
                    } @empty {
                      <li class="dash-note">Nothing to chart yet.</li>
                    }
                  </ul>
                }

                <!-- ── Schedule ── -->
                @case ('schedule') {
                  <app-partner-schedule-calendar [bare]="true" />
                }

                <!-- ── Task / ticket queues ── -->
                @case ('queue') {
                  @let q = queue(tile.id);
                  <div class="bento-tile__scroll">
                    @for (section of q.sections; track section.key) {
                      <button class="queue-head" data-no-drag [attr.data-tone]="section.tone" (click)="q.filter(section.key)">
                        <span class="queue-head__dot"></span>
                        <span>{{ section.label }}</span>
                        <span class="queue-head__count">{{ section.rows.length }}</span>
                      </button>
                      @for (row of section.rows; track row.id) {
                        <button class="queue-row" data-no-drag (click)="q.open()">
                          <span class="queue-row__title">{{ row.title }}</span>
                          <span class="queue-row__sub">{{ row.sub }}</span>
                          @if (row.deadline) {
                            <span class="queue-row__date" [class.is-overdue]="row.overdue">{{ row.deadline }}</span>
                          }
                        </button>
                      }
                    } @empty {
                      <div class="dash-empty">
                        <mat-icon class="dash-empty__icon">inbox</mat-icon>
                        <div class="dash-empty__title">{{ q.emptyText }}</div>
                      </div>
                    }
                  </div>
                }

                <!-- ── KPI ── -->
                @case ('kpi') {
                  @let k = kpi(tile.id);
                  <div class="kpi">
                    <span class="dash-value dash-value--kpi" [appCountUp]="k.raw" [appCountUpFormat]="k.format">0</span>
                  </div>
                  <div class="kpi__foot">
                    @if (k.delta; as delta) {
                      <span class="dash-delta" [attr.data-dir]="dirOf(delta)">
                        <mat-icon class="dash-delta__icon">{{ arrow(delta) }}</mat-icon>{{ pctLabel(delta) }}
                      </span>
                    } @else {
                      <span class="dash-delta" data-dir="flat">—</span>
                    }
                    <svg class="kpi__spark" viewBox="0 0 90 26" preserveAspectRatio="none" aria-hidden="true">
                      <path class="kpi__spark-line" [attr.d]="k.spark.line" pathLength="1" fill="none" stroke="var(--tile)" stroke-width="1.75"
                            stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                    </svg>
                  </div>
                }
              }
            </div>
          </section>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .dash { padding-bottom: 24px; }

    /* ── Customise tray ── */
    .dash-tray {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      padding: 10px 14px; margin-bottom: 12px;
      background: var(--color-surface); border: 1px dashed var(--color-border-strong);
      border-radius: var(--radius-lg);
    }
    .dash-tray__hint { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
    .dash-tray__hint-icon { font-size: 16px; width: 16px; height: 16px; color: var(--color-text-tertiary); }
    .dash-tray__chips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; min-width: 0; }
    .dash-tray__empty { font-size: 12px; color: var(--color-text-tertiary); }
    .dash-chip, .dash-reset {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600; padding: 4px 10px 4px 6px;
      border-radius: 999px; border: 1px solid var(--color-border);
      background: var(--color-surface); color: var(--color-text-secondary);
      cursor: pointer; transition: all var(--transition-fast); white-space: nowrap;
    }
    .dash-chip:hover { border-color: var(--color-text-tertiary); color: var(--color-text-primary); }
    .dash-reset { padding: 4px 10px; }
    .dash-chip__icon { font-size: 14px; width: 14px; height: 14px; line-height: 14px; }

    /* ── Shared atoms ── */
    .dash-count {
      font-size: 10px; font-weight: 700; line-height: 1;
      padding: 3px 6px; border-radius: 999px;
      background: var(--tile-soft); color: var(--tile);
    }
    .dash-stack { display: flex; flex-direction: column; gap: 5px; }
    .dash-figure { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .dash-value {
      font-size: 24px; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em;
      color: var(--color-text-primary); font-variant-numeric: tabular-nums;
    }
    .dash-value--kpi { font-size: 20px; }
    .dash-caption { font-size: 11px; font-weight: 500; color: var(--color-text-tertiary); margin-top: 2px; }
    .dash-sublabel {
      font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      color: var(--color-text-tertiary); margin: 10px 0 5px;
    }
    .dash-note { font-size: 11px; color: var(--color-text-tertiary); padding: 6px 0; }

    .dash-delta {
      display: inline-flex; align-items: center; gap: 1px;
      font-size: 11px; font-weight: 700; line-height: 1;
      padding: 3px 7px 3px 4px; border-radius: 999px;
      font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    .dash-delta[data-dir='good'] { background: var(--color-success-light); color: var(--color-success); }
    .dash-delta[data-dir='bad']  { background: var(--color-danger-light);  color: var(--color-danger); }
    .dash-delta[data-dir='flat'] { background: var(--color-surface-hover); color: var(--color-text-tertiary); padding: 3px 7px; }
    .dash-delta__icon { font-size: 13px; width: 13px; height: 13px; line-height: 13px; }

    .dash-empty {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; gap: 3px; padding: 12px 8px;
    }
    .dash-empty__icon { font-size: 22px; width: 22px; height: 22px; color: var(--tile); opacity: 0.5; }
    .dash-empty__title { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
    .dash-empty__sub { font-size: 11px; color: var(--color-text-tertiary); max-width: 24ch; }

    /* Charts bleed to the tile edges — the bento look, and it buys chart width back. */
    .dash-area { display: block; width: calc(100% + 28px); margin: 6px -14px 0; height: 58px; }
    .dash-area--bleed { margin-top: auto; margin-bottom: -12px; height: 34px; }

    /* ── Graph entrance animation ──
       pathLength="1" normalises every path to a unit length, so the same
       dash-based "draw" keyframe works regardless of the real path length. */
    @keyframes spark-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
    @keyframes area-fade { from { opacity: 0; transform: scaleY(0.85); } to { opacity: 1; transform: scaleY(1); } }
    .dash-area__line, .kpi__spark-line {
      stroke-dasharray: 1; stroke-dashoffset: 1;
      animation: spark-draw 900ms cubic-bezier(0.16, 0.84, 0.44, 1) forwards;
    }
    .dash-area__fill {
      opacity: 0; transform-origin: bottom; transform-box: fill-box;
      animation: area-fade 700ms cubic-bezier(0.16, 0.84, 0.44, 1) 250ms forwards;
    }
    @media (prefers-reduced-motion: reduce) {
      .dash-area__line, .kpi__spark-line, .dash-area__fill { animation: none; stroke-dashoffset: 0; opacity: 1; transform: none; }
    }

    /* ── Focus rows ── */
    .focus-row {
      display: flex; align-items: center; gap: 9px;
      padding: 8px 9px; border-radius: var(--radius-md);
      background: var(--color-surface-hover); border: 1px solid var(--color-border-light);
    }
    .focus-row__icon {
      width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--color-surface); border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
    }
    .focus-row[data-tone='rose'] .focus-row__icon { color: var(--color-danger); }
    .focus-row[data-tone='amber'] .focus-row__icon { color: var(--color-warning); }
    .focus-row[data-tone='sky'] .focus-row__icon { color: var(--color-info); }
    .focus-row__icon .mat-icon { font-size: 14px; width: 14px; height: 14px; line-height: 14px; }
    .focus-row__text { flex: 1; min-width: 0; }
    .focus-row__title { font-size: 12px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .focus-row__meta { font-size: 10.5px; color: var(--color-text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .focus-row__action {
      flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 4px 9px;
      border-radius: var(--radius-sm); cursor: pointer;
      background: var(--color-surface); color: var(--color-text-primary);
      border: 1px solid var(--color-border-strong);
      transition: all var(--transition-fast);
    }
    .focus-row__action:hover { background: var(--color-text-primary); color: var(--color-surface); border-color: var(--color-text-primary); }

    /* ── Deal rows ── */
    .deal-row {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 5px 8px; border-radius: var(--radius-sm); cursor: pointer;
      background: var(--color-surface-hover); border: 1px solid transparent;
      text-align: left; transition: all var(--transition-fast);
    }
    .deal-row:hover { border-color: var(--tile); background: var(--tile-soft); }
    .deal-row__rank {
      width: 17px; height: 17px; border-radius: 5px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; background: var(--tile-soft); color: var(--tile);
    }
    .deal-row__name { flex: 1; min-width: 0; font-size: 11.5px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .deal-row__amount { font-size: 11.5px; font-weight: 700; color: var(--color-text-primary); font-variant-numeric: tabular-nums; flex-shrink: 0; }

    /* ── Facts (late payers) ── */
    .dash-facts { display: flex; gap: 8px; margin-top: 10px; }
    .dash-facts > div { flex: 1; min-width: 0; padding: 6px 8px; border-radius: var(--radius-sm); background: var(--color-surface-hover); }
    .dash-facts dt { font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-text-tertiary); }
    .dash-facts dd { font-size: 12px; font-weight: 700; color: var(--color-text-primary); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ── Donut ── */
    /* margin-block: auto centres the ring in whatever height is left above the legend. */
    .donut { position: relative; width: 104px; height: 104px; margin: auto auto 10px; flex-shrink: 0; }
    .donut__svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .donut__track { stroke: var(--color-border); }
    .donut__slice {
      transition: stroke-dasharray 800ms cubic-bezier(0.16, 0.84, 0.44, 1),
                  stroke-dashoffset 800ms cubic-bezier(0.16, 0.84, 0.44, 1);
    }
    @media (prefers-reduced-motion: reduce) {
      .donut__slice { transition: none; }
    }
    .donut__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .donut__total { font-size: 19px; font-weight: 700; line-height: 1; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
    .donut__unit { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-tertiary); }
    .legend { display: flex; flex-direction: column; gap: 3px; margin: 0; padding: 0; list-style: none; }
    .legend__row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
    .legend__dot { width: 8px; height: 8px; border-radius: 3px; background: var(--tile); flex-shrink: 0; }
    .legend__label { color: var(--color-text-secondary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .legend__pct { margin-left: auto; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
    .legend__count { min-width: 20px; text-align: right; font-weight: 700; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }

    /* ── Queues ── */
    .queue-head {
      display: flex; align-items: center; gap: 6px; width: 100%;
      padding: 7px 2px 4px; background: none; border: none; cursor: pointer;
      font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      color: var(--color-text-tertiary); position: sticky; top: 0; z-index: 1;
      background: var(--color-surface);
    }
    .queue-head:hover { color: var(--color-text-primary); }
    .queue-head__dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; background: var(--color-text-tertiary); }
    .queue-head[data-tone='rose'] .queue-head__dot { background: var(--color-danger); }
    .queue-head[data-tone='amber'] .queue-head__dot { background: var(--color-warning); }
    .queue-head[data-tone='slate'] .queue-head__dot { background: var(--color-text-tertiary); }
    .queue-head__count { margin-left: auto; font-variant-numeric: tabular-nums; }
    .queue-row {
      display: grid; grid-template-columns: 1fr auto; align-items: baseline; column-gap: 8px; width: 100%;
      padding: 5px 8px; border-radius: var(--radius-sm); cursor: pointer; text-align: left;
      border: 1px solid transparent; background: none; transition: background var(--transition-fast);
    }
    .queue-row:hover { background: var(--color-surface-hover); }
    .queue-row__title { font-size: 12px; font-weight: 500; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .queue-row__sub { grid-column: 1; font-size: 10px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .queue-row__date { grid-row: 1; grid-column: 2; font-size: 10px; font-weight: 600; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
    .queue-row__date.is-overdue { color: var(--color-danger); }

    /* ── KPI ── */
    .kpi { display: flex; flex-direction: column; justify-content: center; flex: 1; min-height: 0; }
    .kpi__foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-top: 4px; }
    .kpi__spark { width: 72px; height: 24px; flex-shrink: 0; opacity: 0.85; }
  `]
})
export class DashboardComponent {
  state = inject(CrmStateService);
  private router = inject(Router);

  constructor() {
    // Every tile below reads directly off CrmStateService signals; without these
    // lazy-loads the dashboard shows stale/seed data whenever it's the first
    // page visited in a session (loadX() is idempotent, so this is safe to
    // call even if another page already triggered it).
    this.state.loadDeals();
    this.state.loadPartners();
    this.state.loadTasks();
    this.state.loadTickets();
    this.state.loadInvoices();
    this.state.loadCampaigns();
  }

  // ────────────────────────────────────────────────────────
  // Layout
  // ────────────────────────────────────────────────────────

  /** Only ids the catalog actually knows about, so a stale saved layout can't blank the page. */
  layout = computed(() => {
    const known = new Set(CATALOG.map(t => t.id));
    return this.state.dashboardLayout().filter(id => known.has(id));
  });

  /** Catalog order, filtered to what's on the board — the DOM order, which never changes. */
  tiles = computed(() => {
    const visible = new Set(this.layout());
    return CATALOG.filter(t => visible.has(t.id));
  });

  hiddenTiles = computed(() => {
    const visible = new Set(this.layout());
    return CATALOG.filter(t => !visible.has(t.id));
  });

  varsFor(tile: TileDef): string {
    return `--w:${tile.w};--h:${tile.h};--h-sm:${tile.hSm ?? tile.h}`;
  }

  onReorder(order: string[]) {
    this.state.setDashboardLayout(order);
  }

  toggle(id: string) {
    this.state.toggleDashboardTile(id);
  }

  reset() {
    this.state.resetDashboardLayout();
  }

  // ────────────────────────────────────────────────────────
  // Focus Today — overdue tasks, stale deals, unassigned tickets
  // ────────────────────────────────────────────────────────

  todayItems = computed((): TodayItem[] => {
    const todayStr = this.isoToday();
    const staleCutoff = new Date();
    staleCutoff.setDate(staleCutoff.getDate() - 14);

    const overdueTasks: TodayItem[] = this.state.tasks()
      .filter(t => t.status !== 'Completed' && t.deadline && t.deadline < todayStr)
      .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
      .map(t => ({
        kind: 'task' as const,
        id: t.id,
        icon: 'assignment_late',
        tone: 'rose' as Tone,
        title: t.title,
        meta: `Overdue since ${this.formatDate(t.deadline)}`,
        actionLabel: 'Done',
        action: () => this.state.updateTaskStatus(t.id, 'Completed' as TaskStatus)
      }));

    const staleDeals: TodayItem[] = this.state.deals()
      .filter(d => !this.isClosed(d.stage) && new Date(d.createdAt) < staleCutoff)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(d => ({
        kind: 'deal' as const,
        id: d.id,
        icon: 'hourglass_bottom',
        tone: 'amber' as Tone,
        title: d.title,
        meta: `Idle since ${this.formatDate(d.createdAt)}`,
        actionLabel: 'Review',
        action: () => this.openDeal(d.id)
      }));

    const unassignedTickets: TodayItem[] = this.state.tickets()
      .filter(t => t.status === 'OPEN' && !t.assignedToUserId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(t => ({
        kind: 'ticket' as const,
        id: t.id,
        icon: 'support_agent',
        tone: 'sky' as Tone,
        title: t.title,
        meta: `Unassigned · opened ${this.formatDate(t.createdAt)}`,
        actionLabel: 'Take it',
        action: () =>
          this.state.updateTicket(t.id, {
            status: 'IN_PROGRESS',
            assignedToUserId: this.state.currentUserId()
          })
      }));

    // One of each kind first, then backfill by urgency so the tile is always full.
    const picks: TodayItem[] = [];
    for (const list of [overdueTasks, staleDeals, unassignedTickets]) {
      if (list[0]) picks.push(list[0]);
    }
    const rest = [...overdueTasks.slice(1), ...staleDeals.slice(1), ...unassignedTickets.slice(1)];
    while (picks.length < 4 && rest.length) picks.push(rest.shift()!);
    return picks.slice(0, 4);
  });

  // ────────────────────────────────────────────────────────
  // Pipeline
  // ────────────────────────────────────────────────────────

  private openDeals = computed(() => this.state.deals().filter(d => !this.isClosed(d.stage)));

  openDealCount = computed(() => this.openDeals().length);

  pipelineValueNum = computed(() => this.openDeals().reduce((sum, d) => sum + d.amount, 0));

  /** Stable references so the count-up directive doesn't see a "new" formatter every tick. */
  moneyFormat = (v: number) => this.money(v);
  intFormat = (v: number) => `${Math.round(v)}`;

  private pipelineSeries = computed(() =>
    this.monthlySeries(this.openDeals().map(d => ({ date: d.orderDate || d.createdAt, value: d.amount })))
  );

  pipelineDelta = computed(() => this.delta(this.pipelineSeries()));

  pipelineSpark = computed(() => this.spark(this.pipelineSeries(), 300, 62));

  topDeals = computed(() =>
    this.openDeals()
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map(d => ({ id: d.id, partner: this.partnerName(d.partnerId), amount: this.moneyCompact(d.amount) }))
  );

  // ────────────────────────────────────────────────────────
  // Late payers
  // ────────────────────────────────────────────────────────

  latePayers = computed(() => {
    const invoices = this.state.overdueInvoices();
    const series = this.monthlySeries(invoices.map(i => ({ date: i.dueDate, value: 1 })));
    const oldest = invoices
      .map(i => i.dueDate)
      .filter(Boolean)
      .sort()[0];

    return {
      count: invoices.length,
      atRisk: this.compact(invoices.reduce((sum, i) => sum + i.amount, 0)),
      oldest: oldest ? `${this.daysSince(oldest)}d` : '—',
      delta: this.delta(series, true),
      spark: this.spark(series, 160, 34)
    };
  });

  // ────────────────────────────────────────────────────────
  // Donuts
  // ────────────────────────────────────────────────────────

  private partnerDonut = computed(() =>
    this.buildDonut('partners', [
      { label: 'Customers', count: this.state.customers().length },
      { label: 'Prospects', count: this.state.prospects().length },
      { label: 'Vendors', count: this.state.vendors().length }
    ])
  );

  private taskDonut = computed(() => {
    const tasks = this.state.tasks();
    return this.buildDonut('tasks', [
      { label: 'Completed', count: tasks.filter(t => t.status === 'Completed').length },
      { label: 'In Progress', count: tasks.filter(t => t.status === 'In Progress').length },
      { label: 'Pending', count: tasks.filter(t => t.status === 'Pending').length }
    ]);
  });

  donut(id: string) {
    return id === 'partner-mix' ? this.partnerDonut() : this.taskDonut();
  }

  private buildDonut(unit: string, input: { label: string; count: number }[]) {
    const present = input.filter(s => s.count > 0);
    const total = present.reduce((sum, s) => sum + s.count, 0);
    // One hue per tile, stepped down in opacity — distinguishable without a rainbow.
    const opacities = [1, 0.62, 0.34, 0.2];

    let cumulative = 0;
    const slices: Slice[] = present.map((s, i) => {
      const pct = (s.count / (total || 1)) * 100;
      const slice: Slice = {
        label: s.label,
        count: s.count,
        pct: Math.round(pct),
        dasharray: `${pct.toFixed(2)} ${(100 - pct).toFixed(2)}`,
        dashoffset: -cumulative,
        opacity: opacities[i] ?? 0.2
      };
      cumulative += pct;
      return slice;
    });

    return { slices, total, unit };
  }

  // ────────────────────────────────────────────────────────
  // Queues
  // ────────────────────────────────────────────────────────

  private taskQueue = computed(() => {
    const pending = this.state.tasks().filter(t => t.status === 'Pending');
    const byDeadline = (a: Task, b: Task) =>
      !a.deadline ? 1 : !b.deadline ? -1 : a.deadline.localeCompare(b.deadline);

    const sections: QueueSection[] = ([
      ['Urgent', 'Urgent', 'rose'],
      ['Medium', 'Medium', 'amber'],
      ['Low', 'Low', 'slate']
    ] as const)
      .map(([key, label, tone]) => ({
        key,
        label,
        tone: tone as Tone,
        rows: pending
          .filter(t => (t.priority ?? 'Medium') === key)
          .sort(byDeadline)
          .map(t => this.queueRow(t.id, t.title, t.assignedTo || 'Unassigned', t.deadline))
      }))
      .filter(s => s.rows.length > 0);

    return {
      total: pending.length,
      sections,
      emptyText: 'No pending tasks',
      open: () => this.router.navigate(['/tasks']),
      filter: (priority: string) => {
        this.state.taskFilter.set({ priority });
        this.router.navigate(['/tasks']);
      }
    };
  });

  private ticketQueue = computed(() => {
    const pending = this.state.tickets().filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
    const byDeadline = (a: Ticket, b: Ticket) =>
      !a.deadline ? 1 : !b.deadline ? -1 : a.deadline.localeCompare(b.deadline);

    const sections: QueueSection[] = ([
      ['URGENT', 'High', 'rose'],
      ['MEDIUM', 'Medium', 'amber'],
      ['LOW', 'Low', 'slate']
    ] as const)
      .map(([key, label, tone]) => ({
        key,
        label,
        tone: tone as Tone,
        rows: pending
          .filter(t => t.priority === key)
          .sort(byDeadline)
          .map(t => this.queueRow(t.id, t.title, `#${t.id}`, t.deadline))
      }))
      .filter(s => s.rows.length > 0);

    return {
      total: pending.length,
      sections,
      emptyText: 'No open tickets',
      open: () => this.router.navigate(['/tickets']),
      filter: (key: string) => {
        this.state.ticketFilter.set({ priority: key === 'URGENT' ? 'High' : key === 'MEDIUM' ? 'Medium' : 'Low' });
        this.router.navigate(['/tickets']);
      }
    };
  });

  queue(id: string) {
    return id === 'tasks-queue' ? this.taskQueue() : this.ticketQueue();
  }

  private queueRow(id: string, title: string, sub: string, deadline?: string): QueueRow {
    return {
      id,
      title,
      sub,
      deadline: this.formatDate(deadline),
      overdue: !!deadline && deadline < this.isoToday()
    };
  }

  // ────────────────────────────────────────────────────────
  // KPIs
  // ────────────────────────────────────────────────────────

  private kpiData = computed((): Record<string, KpiData> => {
    const deals = this.state.deals();
    const campaigns = this.state.campaigns();
    const tickets = this.state.tickets();
    const prospects = this.state.partners().filter(p => p.type === 'Prospect');

    const dealValue = this.cumulative(
      this.monthlySeries(deals.map(d => ({ date: d.orderDate || d.createdAt, value: d.amount })))
    );
    const newDeals = this.monthlySeries(deals.map(d => ({ date: d.orderDate || d.createdAt, value: 1 })));
    const prospectSeries = this.monthlySeries(prospects.map(p => ({ date: p.createdAt, value: 1 })));
    const ticketSeries = this.monthlySeries(tickets.map(t => ({ date: t.createdAt, value: 1 })));
    const campaignSeries = this.monthlySeries(
      campaigns.filter(c => c.status === 'Active').map(c => ({ date: c.createdAt, value: 1 }))
    );
    const reachSeries = this.monthlySeries(campaigns.map(c => ({ date: c.createdAt, value: c.sentCount })));
    const taskSeries = this.weeklySeries(this.state.tasks().map(t => ({ date: t.createdAt, value: 1 })));
    const lostSeries = this.monthlySeries(
      deals.filter(d => d.stage === 'Closed Lost').map(d => ({ date: d.orderDate || d.createdAt, value: d.amount }))
    );
    const todaysDeals = deals
      .filter(d => d.orderDate === this.isoToday())
      .sort((a, b) => b.amount - a.amount);
    const dailyDeals = this.dailySeries(deals.map(d => ({ date: d.orderDate, value: 1 })), 14);

    const openTickets = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
    const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;

    const make = (
      label: string,
      icon: string,
      raw: number,
      format: (v: number) => string,
      hint: string,
      series: number[],
      opts: { inverted?: boolean } = {}
    ): KpiData => ({
      label,
      icon,
      raw,
      format,
      hint,
      delta: this.delta(series, opts.inverted),
      spark: this.spark(series, 90, 26)
    });

    return {
      totalDeals: make('Total Deals Value', 'payments', this.last(dealValue), v => this.moneyCompact(v), 'cumulative booked', dealValue),
      newDeals: make('New Deals', 'handshake', this.last(newDeals), this.intFormat, 'closed this month', newDeals),
      totalProspects: make('Prospects', 'person_search', prospects.length, this.intFormat, `${this.last(prospectSeries)} added this month`, prospectSeries),
      openTickets: make('Open Tickets', 'confirmation_number', openTickets, this.intFormat, 'open or in progress', ticketSeries, { inverted: true }),
      activeCampaigns: make('Active Campaigns', 'campaign', activeCampaigns, this.intFormat, 'running now', campaignSeries),
      marketingSpend: make('Campaign Reach', 'send', this.last(reachSeries), v => this.compact(v), 'messages sent this month', reachSeries),
      newTasksWeek: make('New Tasks', 'assignment_add', this.last(taskSeries), this.intFormat, 'created this week', taskSeries),
      newProspects: make('New Prospects', 'group_add', this.last(prospectSeries), this.intFormat, 'added this month', prospectSeries),
      lostProspects: make('Lost Deals', 'trending_down', this.last(lostSeries), v => this.moneyCompact(v), 'value lost this month', lostSeries, { inverted: true }),
      todaysDeal: make(
        "Today's Best Deal",
        'star',
        todaysDeals[0]?.amount ?? 0,
        v => (todaysDeals[0] ? this.moneyCompact(v) : '—'),
        todaysDeals.length ? `${todaysDeals.length} closed today` : 'nothing closed yet',
        dailyDeals
      )
    };
  });

  kpi(tileId: string): KpiData {
    const key = tileId.slice(4); // strip "kpi:"
    return (
      this.kpiData()[key] ?? {
        label: key,
        icon: 'help',
        raw: 0,
        format: () => '—',
        hint: '',
        delta: null,
        spark: { line: '', area: '' }
      }
    );
  }

  // ────────────────────────────────────────────────────────
  // Presentation helpers
  // ────────────────────────────────────────────────────────

  /** Maps a delta onto good/bad rather than up/down — fewer overdue invoices is good news. */
  dirOf(d: Delta): 'good' | 'bad' | 'flat' {
    if (d.direction === 'flat') return 'flat';
    const good = d.direction === 'up' ? !d.inverted : !!d.inverted;
    return good ? 'good' : 'bad';
  }

  arrow(d: Delta): string {
    return d.direction === 'up' ? 'arrow_upward' : d.direction === 'down' ? 'arrow_downward' : 'remove';
  }

  pctLabel(d: Delta): string {
    return `${Math.abs(d.pct)}%`;
  }

  openDeal(id: string) {
    this.router.navigate(['/sales/deals', id]);
  }

  private partnerName(id: string): string {
    return this.state.partners().find(p => p.id === id)?.name || 'Unknown partner';
  }

  private isClosed(stage: string): boolean {
    return stage === 'Closed Won' || stage === 'Closed Lost';
  }

  private isoToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  private daysSince(date: string): number {
    const d = this.parseDate(date);
    if (!d) return 0;
    return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
  }

  formatDate(date: string | undefined): string {
    if (!date) return '';
    const d = this.parseDate(date);
    return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  }

  private money(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} MAD`;
  }

  /** Compact form so a seven-figure number still fits a 190px tile instead of truncating. */
  private moneyCompact(value: number): string {
    if (!value) return '0 MAD';
    return `${this.compact(value)} MAD`;
  }

  private compact(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(value);
  }

  private last(series: number[]): number {
    return series[series.length - 1] || 0;
  }

  // ────────────────────────────────────────────────────────
  // Time series
  // ────────────────────────────────────────────────────────

  private parseDate(date: string | undefined): Date | null {
    if (!date) return null;
    const d = new Date(date.length <= 10 ? `${date}T00:00:00` : date);
    return isNaN(d.getTime()) ? null : d;
  }

  /** 12 monthly buckets, oldest first, current month last. */
  private monthlySeries(items: { date: string | undefined; value: number }[], months = 12): number[] {
    const now = new Date();
    const buckets = new Array(months).fill(0);
    for (const item of items) {
      const d = this.parseDate(item.date);
      if (!d) continue;
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      const idx = months - 1 - diff;
      if (idx >= 0 && idx < months) buckets[idx] += item.value;
    }
    return buckets;
  }

  /** 12 weekly buckets (Mon-start), oldest first, current week last. */
  private weeklySeries(items: { date: string | undefined; value: number }[], weeks = 12): number[] {
    const startOfWeek = (d: Date) => {
      const x = new Date(d);
      const day = x.getDay();
      x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const thisWeek = startOfWeek(new Date());
    const buckets = new Array(weeks).fill(0);
    for (const item of items) {
      const d = this.parseDate(item.date);
      if (!d) continue;
      const diff = Math.round((thisWeek.getTime() - startOfWeek(d).getTime()) / (7 * 86400000));
      const idx = weeks - 1 - diff;
      if (idx >= 0 && idx < weeks) buckets[idx] += item.value;
    }
    return buckets;
  }

  /** N daily buckets, oldest first, today last. */
  private dailySeries(items: { date: string | undefined; value: number }[], days = 12): number[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = new Array(days).fill(0);
    for (const item of items) {
      const d = this.parseDate(item.date);
      if (!d) continue;
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
      const idx = days - 1 - diff;
      if (idx >= 0 && idx < days) buckets[idx] += item.value;
    }
    return buckets;
  }

  private cumulative(series: number[]): number[] {
    let sum = 0;
    return series.map(v => (sum += v));
  }

  /** % change across the last two buckets. Null when there is nothing real to compare. */
  private delta(series: number[], inverted = false): Delta | null {
    if (series.length < 2) return null;
    const curr = series[series.length - 1];
    const prev = series[series.length - 2];
    if (prev === 0) {
      if (curr === 0) return null;
      return { pct: 100, direction: 'up', inverted };
    }
    const pct = Math.round(((curr - prev) / Math.abs(prev)) * 100);
    return { pct, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', inverted };
  }

  /**
   * Line + closed area path for a series. Both are precomputed here rather than called from
   * the template, so change detection never re-walks the data to redraw an unchanged chart.
   */
  private spark(values: number[], w: number, h: number): Spark {
    const trimmed = this.trimLeadingZeros(values);
    if (trimmed.length < 2) return { line: '', area: '' };
    const pad = 2;
    const max = Math.max(...trimmed, 0);
    const min = Math.min(...trimmed, 0);
    const range = max - min || 1;
    const step = w / (trimmed.length - 1);
    const y = (v: number) => pad + (h - pad * 2) - ((v - min) / range) * (h - pad * 2);

    const line = trimmed
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ');
    return { line, area: `${line} L${w},${h} L0,${h} Z` };
  }

  /**
   * Drops leading zero-only buckets (bar one, kept as a baseline anchor) so a series that's
   * mostly empty because activity only started recently doesn't plot as a flat plateau
   * punctured by a single distorted spike — the whole point of the trailing window is lost
   * once nine of twelve months carry no data.
   */
  private trimLeadingZeros(values: number[]): number[] {
    const firstNonZero = values.findIndex(v => v !== 0);
    if (firstNonZero <= 0) return values;
    return values.slice(firstNonZero - 1);
  }
}
