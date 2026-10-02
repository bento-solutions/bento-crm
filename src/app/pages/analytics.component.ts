import { Component, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrmStateService } from '../services/crm-state.service';
import { CommonModule } from '@angular/common';
import { Customer360Component } from './customer-360-card.component';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { StatCardComponent } from '../shared/ui/stat-card.component';
import { readChartTheme, withAlpha, onThemeChange } from '../shared/ui/chart-theme';

// Chart.js is loaded globally via a <script> tag (no npm package / types). Only the constructor
// is used here, and instances are never read back, so a minimal structural type is enough.
type ChartConstructor = new (ctx: CanvasRenderingContext2D | HTMLCanvasElement, config: unknown) => { destroy(): void };
declare let Chart: ChartConstructor;
interface ChartLike { destroy(): void }

@Component({
  selector: 'app-analytics',
  imports: [MatIconModule, MatTooltipModule, CommonModule, Customer360Component, PageHeaderComponent, StatCardComponent],
  template: `
    <div class="page">
      <app-page-header title="Analytics" subtitle="Sales performance, forecasts and customer insight">
        @if (activeTab() === 'overview') {
          <div actions class="flex items-center gap-2">
            <span class="eyebrow">Currency</span>
            <div class="segmented" role="group" aria-label="Display currency">
              @for (cur of ['MAD', 'USD', 'EUR']; track cur) {
                <button
                  id="currency-toggle-{{ cur }}"
                  class="segmented__item"
                  [class.is-active]="state.globalCurrency() === cur"
                  [attr.aria-pressed]="state.globalCurrency() === cur"
                  (click)="state.globalCurrency.set(cur)"
                >{{ cur }}</button>
              }
            </div>
          </div>
        }
      </app-page-header>

      <div class="tabs" role="tablist">
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'overview'" [attr.aria-selected]="activeTab() === 'overview'"
                (click)="activeTab.set('overview'); state.breadcrumbLabel.set('Overview')">
          <mat-icon>dashboard</mat-icon>
          Overview
        </button>
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'customers360'" [attr.aria-selected]="activeTab() === 'customers360'"
                (click)="activeTab.set('customers360'); state.breadcrumbLabel.set('Customers 360')">
          <mat-icon>contact_page</mat-icon>
          Customers 360°
          <span class="count-pill">{{ state.customers().length }}</span>
        </button>
      </div>

      <!-- ────────────────────────────────────────────────────────
           OVERVIEW TAB (CSS hidden to preserve Chart.js canvases)
           ──────────────────────────────────────────────────────── -->
      <div [class.hidden]="activeTab() !== 'overview'" class="space-y-6">

        <!-- Activity -->
        <div class="stat-grid">
          <app-stat-card label="New Deals" [value]="newDealsKPI().count" unit="deals" icon="handshake" tone="violet"
                         [hint]="(newDealsKPI().profit | number:'1.0-0') + ' ' + state.globalCurrency() + ' this month'" />
          <app-stat-card label="New Prospects" [value]="newProspectsKPI().count" unit="prospects" icon="group_add" tone="blue"
                         [hint]="(newProspectsKPI().potential | number:'1.0-0') + ' ' + state.globalCurrency() + ' pipeline potential'" />
          <app-stat-card label="Lost Prospects" [value]="lostProspectsKPI().count" unit="closed lost" icon="trending_down" tone="rose"
                         [hint]="(lostProspectsKPI().potentialLost | number:'1.0-0') + ' ' + state.globalCurrency() + ' value lost'" />
          @if (todaysDealKPI(); as deal) {
            <app-stat-card label="Today's Deal" [value]="deal.name" icon="star" tone="violet"
                           [hint]="(deal.profit | number:'1.0-0') + ' ' + state.globalCurrency() + ' deal value'" />
          } @else {
            <app-stat-card label="Today's Deal" value="—" icon="star" tone="violet" hint="No transactions today" />
          }
        </div>

        <!-- Performance -->
        <div class="stat-grid">
          <app-stat-card label="Sales This Month" [value]="formatCurrency(state.salesThisMonth())" icon="paid" tone="violet"
                         tooltip="Current month won / confirmed deals" />
          <app-stat-card label="Conversion Rate" [value]="state.conversionRate() + '%'" icon="query_stats" tone="blue"
                         tooltip="Share of pipeline still active vs total pipeline" />
          <app-stat-card label="Win Rate" [value]="state.winRate() + '%'" icon="emoji_events" tone="violet"
                         tooltip="Won deals vs lost deals" />
          <app-stat-card label="Avg Deal Size" [value]="formatCurrency(state.avgDealSize())" icon="monetization_on" tone="violet"
                         tooltip="Average value per deal, excludes lost opportunities" />
        </div>

        <!-- Charts Section (2 Columns) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section class="card">
            <header class="card-header">
              <h3 class="card-title">Sales Forecasting</h3>
              <mat-icon class="icon-sm text-ink-4 cursor-help" matTooltip="Expected monthly revenue per salesperson (excludes lost deals)" matTooltipPosition="above">info</mat-icon>
            </header>
            <div class="card-body">
              <div class="h-64 relative">
                <canvas #forecastChart></canvas>
              </div>
            </div>
          </section>

          <section class="card">
            <header class="card-header">
              <h3 class="card-title">Sales by Region</h3>
              <mat-icon class="icon-sm text-ink-4 cursor-help" matTooltip="Total won &amp; confirmed sales volume by geographical region" matTooltipPosition="above">info</mat-icon>
            </header>
            <div class="card-body">
              <div class="h-64 relative">
                <canvas #regionChart></canvas>
              </div>
            </div>
          </section>
        </div>

        <!-- Lists & Table Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Top Customers -->
          <div class="card p-5 space-y-4">
            <div>
              <h3 class="card-title flex items-center gap-1.5 cursor-help w-fit" matTooltip="Ranked by total confirmed deal value" matTooltipPosition="above">
                Top Customers
                <mat-icon class="text-ink-4 icon-xs">info</mat-icon>
              </h3>
            </div>
            <div class="space-y-3 pt-2">
              @for (cust of state.topCustomers(); track cust.name) {
                <div class="flex items-center justify-between gap-4 p-2.5 rounded-lg border border-line-soft hover:bg-subtle transition-colors">
                  <div class="flex items-center gap-3 shrink-0">
                    <div class="w-8 h-8 rounded-full bg-muted text-ink flex items-center justify-center font-semibold text-xs shrink-0 uppercase">
                      {{ cust.name.substring(0, 2) }}
                    </div>
                    <div>
                      <span class="font-semibold text-xs text-ink block">{{ cust.name }}</span>
                      <span class="text-meta text-ink-3 font-semibold">{{ cust.dealCount }} won deals</span>
                    </div>
                  </div>
                  <span class="font-semibold text-xs text-ink shrink-0">{{ formatCurrency(cust.totalValue) }}</span>
                </div>
              } @empty {
                <div class="text-center py-8 text-ink-3 text-xs">No customer sales data available.</div>
              }
            </div>
          </div>

          <!-- Lost Opportunities -->
          <div class="card p-5 space-y-4">
            <div>
              <h3 class="card-title flex items-center gap-1.5 cursor-help w-fit" matTooltip="Pipelines marked as Closed Lost" matTooltipPosition="above">
                Lost Opportunities
                <mat-icon class="text-ink-4 icon-xs">info</mat-icon>
              </h3>
            </div>
            <div class="table-card">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Opportunity</th>
                    <th scope="col">Owner</th>
                    <th scope="col" class="text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  @for (lost of state.lostOpportunities(); track lost.id) {
                    <tr>
                      <td>
                        <span class="font-semibold text-ink block truncate max-w-[160px]">{{ lost.title }}</span>
                        <span class="text-meta text-ink-3">{{ getPartnerName(lost.partnerId) }}</span>
                      </td>
                      <td class="text-ink-3">
                        {{ lost.salesPerson || 'Unassigned' }}
                      </td>
                      <td class="text-right text-ink-2">
                        {{ formatCurrency(lost.amount) }}
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3" class="text-center text-ink-3">No lost opportunities logged. Great job!</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div><!-- /overview -->

      <!-- ────────────────────────────────────────────────────────
           CUSTOMERS 360° TAB
           ──────────────────────────────────────────────────────── -->
      @if (activeTab() === 'customers360') {
        <div class="space-y-6">

          <!-- Customer Selector Banner -->
          <div class="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 class="modal-title">Customer 360° Profile</h3>
              <p class="text-sm text-ink-3 mt-1">Select a customer to view their complete profile and interaction history.</p>
            </div>
            <div class="relative shrink-0">
              <select
                id="customer-selector"
                [value]="selectedCustomerId() || ''"
                (change)="onCustomerChange($event)"
                class="input-field w-64 pl-4 pr-10 cursor-pointer"
              >
                @for (p of getCustomers(); track p.id) {
                  <option [value]="p.id">{{ p.name }}</option>
                }
              </select>
              <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-ink-3">
                <mat-icon>keyboard_arrow_down</mat-icon>
              </div>
            </div>
          </div>

          @if (selectedCustomer360(); as view) {
            <app-customer-360 [view]="view" />
          } @else {
            <!-- No customer selected / no data -->
            <div class="card p-16 flex flex-col items-center justify-center text-center">
              <div class="w-16 h-16 bg-muted text-ink-3 rounded-full flex items-center justify-center mb-4">
                <mat-icon>contact_page</mat-icon>
              </div>
              <h3 class="card-title">No Profile Found</h3>
              <p class="text-xs text-ink-3 mt-1 max-w-xs">
                Select a customer from the dropdown above to view their unified 360° profile.
              </p>
            </div>
          }

        </div>
      }<!-- /customers360 -->

    </div>
  `
})
export class AnalyticsComponent implements AfterViewInit, OnDestroy {
  state = inject(CrmStateService);

  // ── Sub-tab state ──────────────────────────────────────────
  activeTab = signal<'overview' | 'customers360'>('overview');

  // ── Customer 360 state ─────────────────────────────────────
  selectedCustomerId = signal<string | null>(null);

  selectedCustomer360 = computed(() => {
    const id = this.selectedCustomerId();
    return id ? this.state.getCustomer360(id) : null;
  });

  // ── New KPI Computed Signals ────────────────────────────────

  /** Deals created in the current calendar month */
  newDealsKPI = computed(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const periodDeals = this.state.deals().filter(d => {
      if (!d.orderDate) return false;
      const dt = new Date(d.orderDate);
      return dt.getFullYear() === year && dt.getMonth() === month;
    });
    return {
      count: periodDeals.length,
      profit: periodDeals.reduce((s, d) => s + d.amount, 0)
    };
  });

  /** Partners with type === 'Prospect', aggregating linked proposal opportunity values */
  newProspectsKPI = computed(() => {
    const prospects = this.state.partners().filter(p => p.type === 'Prospect');
    const proposals = this.state.proposals();
    const potential = prospects.reduce((sum, p) => {
      const linked = proposals.filter(pr => pr.partnerId === p.id);
      const val = linked.reduce((s, pr) => s + (pr.opportunityValue ?? pr.amount ?? 0), 0);
      return sum + val;
    }, 0);
    return { count: prospects.length, potential };
  });

  /** Deals with stage 'Closed Lost' — count and total value lost */
  lostProspectsKPI = computed(() => {
    const lost = this.state.deals().filter(d => d.stage === 'Closed Lost');
    return {
      count: lost.length,
      potentialLost: lost.reduce((s, d) => s + d.amount, 0)
    };
  });

  /** Highest-value deal with an orderDate matching today */
  todaysDealKPI = computed((): { name: string; profit: number } | null => {
    const today = new Date().toISOString().split('T')[0];
    const todays = this.state.deals()
      .filter(d => d.orderDate === today)
      .sort((a, b) => b.amount - a.amount);
    if (!todays.length) return null;
    const top = todays[0];
    return {
      name: top.customerAccount || top.title,
      profit: top.amount
    };
  });

  // ── Chart refs ─────────────────────────────────────────────
  @ViewChild('forecastChart') forecastCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('regionChart') regionCanvas!: ElementRef<HTMLCanvasElement>;

  forecastChartInstance?: ChartLike;
  regionChartInstance?: ChartLike;
  private stopThemeWatch?: () => void;

  constructor() {
    // Auto-select first customer for immediate richness
    const first = this.state.partners().find(p => p.type === 'Customer');
    if (first) this.selectedCustomerId.set(first.id);
  }

  ngAfterViewInit() {
    this.buildCharts();
    // Chart.js bakes colours in at construction, so a theme switch rebuilds both charts.
    this.stopThemeWatch = onThemeChange(() => this.buildCharts());
  }

  ngOnDestroy() {
    this.stopThemeWatch?.();
    this.forecastChartInstance?.destroy();
    this.regionChartInstance?.destroy();
  }

  private buildCharts() {
    this.forecastChartInstance?.destroy();
    this.regionChartInstance?.destroy();
    this.initForecastChart();
    this.initRegionChart();
  }

  // ── Helpers ────────────────────────────────────────────────
  getCustomers() {
    return this.state.partners().filter(p => p.type === 'Customer');
  }

  onCustomerChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedCustomerId.set(val || null);
  }

  // ── Badge helpers ──────────────────────────────────────────
  getStageBadgeClass(stage: string): string {
    switch (stage) {
      case 'Confirmed':
      case 'Closed Won':
        return 'badge-success';
      case 'Awaiting Invoicing':
      case 'Invoiced':
        return 'badge-info';
      case 'New':
        return 'bg-muted text-ink-2 border-line';
      case 'Proposal sent':
        return 'badge-violet';
      case 'Closed Lost':
        return 'badge-danger';
      default:
        return 'bg-subtle text-ink-2 border-line-soft';
    }
  }

  getTicketStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return 'badge-success';
      case 'In Progress':
        return 'badge-info';
      case 'Open':
        return 'badge-warning';
      default:
        return 'bg-subtle text-ink-2 border-line-soft';
    }
  }

  getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'High': return 'badge-danger';
      case 'Medium': return 'badge-warning';
      case 'Low': return 'bg-subtle text-ink-2 border-line';
      default: return 'bg-subtle text-ink-2 border-line-soft';
    }
  }

  getInvoiceStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Paid': return 'badge-success';
      case 'Pending': return 'badge-warning';
      case 'Overdue': return 'badge-danger';
      case 'Draft': return 'bg-subtle text-ink-2 border-line';
      default: return 'bg-subtle text-ink-2 border-line-soft';
    }
  }

  // ── Charts ─────────────────────────────────────────────────
  initForecastChart() {
    const ctx = this.forecastCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const forecastData = this.state.salesForecast();
    const months = Array.from(new Set(forecastData.map(d => d.month))).sort();
    const reps = Array.from(new Set(forecastData.map(d => d.salesperson)));

    const theme = readChartTheme();
    const colors = theme.series;

    const datasets = reps.map((rep, idx) => {
      const dataPoints = months.map(m => {
        const match = forecastData.find(d => d.month === m && d.salesperson === rep);
        return match ? match.total : 0;
      });
      return {
        label: rep,
        data: dataPoints,
        borderColor: colors[idx % colors.length],
        backgroundColor: withAlpha(colors[idx % colors.length], 0.08),
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: true
      };
    });

    this.forecastChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months.map(m => {
          const parts = m.split('-');
          if (parts.length === 2) {
            const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
          }
          return m;
        }),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: theme.text, font: { family: theme.font, size: 12 } } }
        },
        scales: {
          y: {
            grid: { color: theme.grid },
            border: { display: false },
            ticks: { color: theme.text, font: { family: theme.font, size: 11 }, callback: (val: number) => this.formatCompactMAD(val) }
          },
          x: { grid: { display: false }, border: { color: theme.grid }, ticks: { color: theme.text, font: { family: theme.font, size: 11 } } }
        }
      }
    });
  }

  initRegionChart() {
    const ctx = this.regionCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const regionData = this.state.dealsByRegion();
    const theme = readChartTheme();

    this.regionChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: regionData.map(r => r.region),
        datasets: [{
          label: 'Won/Confirmed Revenue',
          data: regionData.map(r => r.total),
          backgroundColor: withAlpha(theme.series[0], 0.85),
          borderColor: theme.series[0],
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: theme.grid },
            border: { display: false },
            ticks: { color: theme.text, font: { family: theme.font, size: 11 }, callback: (val: number) => this.formatCompactMAD(val) }
          },
          y: { grid: { display: false }, border: { color: theme.grid }, ticks: { color: theme.text, font: { family: theme.font, size: 11 } } }
        }
      }
    });
  }

  // ── Formatters ─────────────────────────────────────────────
  formatCurrency(value: number) {
    const cur = this.state.globalCurrency();
    const locale = cur === 'MAD' ? 'fr-MA' : cur === 'EUR' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(value);
  }

  formatCompactMAD(value: number) {
    const cur = this.state.globalCurrency();
    const suffix = cur === 'MAD' ? ' DH' : cur === 'EUR' ? ' €' : ' $';
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M' + suffix;
    if (value >= 1000) return (value / 1000).toFixed(0) + 'k' + suffix;
    return value + suffix;
  }

  getPartnerName(id: string) {
    return this.state.partners().find(p => p.id === id)?.name || 'Unknown';
  }
}
