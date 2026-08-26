import { Component, inject, ViewChild, ElementRef, AfterViewInit, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrmStateService } from '../services/crm-state.service';
import { CommonModule } from '@angular/common';
import { Customer360Component } from './customer-360-card.component';

declare let Chart: unknown;

@Component({
  selector: 'app-analytics',
  imports: [MatIconModule, MatTooltipModule, CommonModule, Customer360Component],
  template: `
    <div class="space-y-8">

      <div class="flex gap-5 sm:gap-6 border-b border-zinc-200">
        <button
          (click)="activeTab.set('overview'); state.breadcrumbLabel.set('Overview')"
          [class]="activeTab() === 'overview' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">dashboard</mat-icon>
          Overview
          <span class="text-xs">{{ state.deals().length }}</span>
        </button>
        <button
          (click)="activeTab.set('customers360'); state.breadcrumbLabel.set('Customers 360')"
          [class]="activeTab() === 'customers360' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">contact_page</mat-icon>
          Customers 360°
          <span class="text-xs">{{ state.customers().length }}</span>
        </button>
      </div>

      <!-- ────────────────────────────────────────────────────────
           OVERVIEW TAB (CSS hidden to preserve Chart.js canvases)
           ──────────────────────────────────────────────────────── -->
      <div [class.hidden]="activeTab() !== 'overview'" class="space-y-8">

        <!-- New KPI Row — Deal & Prospect Intelligence -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

          <!-- Card 1: New Deals -->
          <div class="card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans">New Deals</h3>
              <div class="h-9 w-9 icon-badge-primary rounded-xl flex items-center justify-center">
                <mat-icon class="text-base" style="width:18px;height:18px;font-size:18px;display:flex;align-items:center">handshake</mat-icon>
              </div>
            </div>
            <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ newDealsKPI().count }} <span class="text-sm font-semibold text-zinc-400 font-sans">deals</span></div>
            <div class="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between">
              <div class="text-meta text-zinc-900 font-bold flex items-center gap-0.5 font-sans">
                <mat-icon class="text-[12px]" style="width:12px;height:12px;font-size:12px;display:flex;align-items:center">trending_up</mat-icon> This month's profit
              </div>
              <span class="text-meta font-bold font-sans text-zinc-700">{{ newDealsKPI().profit | number:'1.0-0' }} <span class="text-zinc-400 font-normal">{{ state.globalCurrency() }}</span></span>
            </div>
          </div>

          <!-- Card 2: New Prospects -->
          <div class="card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans">New Prospects</h3>
              <div class="h-9 w-9 icon-badge-primary rounded-xl flex items-center justify-center">
                <mat-icon class="text-base" style="width:18px;height:18px;font-size:18px;display:flex;align-items:center">group_add</mat-icon>
              </div>
            </div>
            <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ newProspectsKPI().count }} <span class="text-sm font-semibold text-zinc-400 font-sans">prospects</span></div>
            <div class="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between">
              <div class="text-meta text-zinc-900 font-bold flex items-center gap-0.5 font-sans">
                <mat-icon class="text-[12px]" style="width:12px;height:12px;font-size:12px;display:flex;align-items:center">insights</mat-icon> Pipeline potential
              </div>
              <span class="text-meta font-bold font-sans text-zinc-700">{{ newProspectsKPI().potential | number:'1.0-0' }} <span class="text-zinc-400 font-normal">{{ state.globalCurrency() }}</span></span>
            </div>
          </div>

          <!-- Card 3: Lost Prospects -->
          <div class="card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans">Lost Prospects</h3>
              <div class="h-9 w-9 icon-badge-primary rounded-xl flex items-center justify-center">
                <mat-icon class="text-base" style="width:18px;height:18px;font-size:18px;display:flex;align-items:center">do_not_disturb_on</mat-icon>
              </div>
            </div>
            <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ lostProspectsKPI().count }} <span class="text-sm font-semibold text-zinc-400 font-sans">closed lost</span></div>
            <div class="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between">
              <div class="text-meta text-zinc-700 font-bold flex items-center gap-0.5 font-sans">
                <mat-icon class="text-[12px]" style="width:12px;height:12px;font-size:12px;display:flex;align-items:center">trending_down</mat-icon> Value lost
              </div>
              <span class="text-meta font-bold font-sans text-zinc-700">{{ lostProspectsKPI().potentialLost | number:'1.0-0' }} <span class="text-zinc-400 font-normal">{{ state.globalCurrency() }}</span></span>
            </div>
          </div>

          <!-- Card 4: Today's Deal -->
          <div class="card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans">Today's Deal</h3>
              <div class="h-9 w-9 icon-badge-primary rounded-xl flex items-center justify-center">
                <mat-icon class="text-base" style="width:18px;height:18px;font-size:18px;display:flex;align-items:center">star</mat-icon>
              </div>
            </div>
            @if (todaysDealKPI(); as deal) {
              <div class="text-base font-bold text-zinc-900 font-sans truncate" [title]="deal.name">{{ deal.name }}</div>
              <div class="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between">
                <div class="text-meta text-zinc-900 font-bold flex items-center gap-0.5 font-sans">
                  <mat-icon class="text-[12px]" style="width:12px;height:12px;font-size:12px;display:flex;align-items:center">bolt</mat-icon> Deal value
                </div>
                <span class="text-meta font-bold font-sans text-zinc-700">{{ deal.profit | number:'1.0-0' }} <span class="text-zinc-400 font-normal">{{ state.globalCurrency() }}</span></span>
              </div>
            } @else {
              <div class="text-sm font-semibold text-zinc-400 font-sans">No transactions today</div>
              <div class="mt-2 pt-2 border-t border-zinc-100">
                <div class="text-meta text-zinc-300 font-bold flex items-center gap-0.5 font-sans">
                  <mat-icon class="text-[12px]" style="width:12px;height:12px;font-size:12px;display:flex;align-items:center">bolt</mat-icon> Check back later
                </div>
              </div>
            }
          </div>

        </div><!-- /new KPI row -->

        <!-- Currency Toggle — matches tab switcher style -->
        <div class="flex items-center gap-2">
          <span class="text-meta text-zinc-400 font-sans uppercase tracking-wider mr-1">Currency</span>
          <div class="flex gap-1 bg-white border border-zinc-200 p-1 rounded-xl">
            @for (cur of ['MAD', 'USD', 'EUR']; track cur) {
              <button
                id="currency-toggle-{{ cur }}"
                (click)="state.globalCurrency.set(cur)"
                [class]="state.globalCurrency() === cur
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-700'"
                class="px-3 py-1.5 rounded-lg text-meta font-bold font-sans transition-all duration-150 cursor-pointer focus:outline-none"
              >{{ cur }}</button>
            }
          </div>
        </div>


        <!-- KPI Summary Cards (4 Columns) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Sales This Month -->
          <div class="card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Current month won / confirmed deals" matTooltipPosition="above">
                Sales This Month
                <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
              </h3>
              <div class="h-9 w-9 icon-badge-primary rounded-xl flex items-center justify-center">
                <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">paid</mat-icon>
              </div>
            </div>
            <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ formatCurrency(state.salesThisMonth()) }}</div>
          </div>

          <!-- Conversion Rate -->
          <div class="card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Share of pipeline still active vs total pipeline" matTooltipPosition="above">
                Conversion Rate
                <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
              </h3>
              <div class="h-9 w-9 icon-badge-primary rounded-xl flex items-center justify-center">
                <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">query_stats</mat-icon>
              </div>
            </div>
            <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ state.conversionRate() }}%</div>
          </div>

          <!-- Win Rate -->
          <div class="card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Won deals vs lost deals" matTooltipPosition="above">
                Win Rate
                <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
              </h3>
              <div class="h-9 w-9 icon-badge-primary rounded-xl flex items-center justify-center">
                <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">emoji_events</mat-icon>
              </div>
            </div>
            <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ state.winRate() }}%</div>
          </div>

          <!-- Average Deal Size -->
          <div class="card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Average value per deal, excludes lost opportunities" matTooltipPosition="above">
                Avg Deal Size
                <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
              </h3>
              <div class="h-9 w-9 icon-badge-primary rounded-xl flex items-center justify-center">
                <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">monetization_on</mat-icon>
              </div>
            </div>
            <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ formatCurrency(state.avgDealSize()) }}</div>
          </div>
        </div>

        <!-- Charts Section (2 Columns) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Sales Forecasting -->
          <div class="card rounded-2xl p-6 space-y-4">
            <div>
              <h3 class="text-base font-semibold text-zinc-900 font-sans flex items-center gap-1.5 cursor-help w-fit" matTooltip="Expected monthly revenue per salesperson (excludes lost deals)" matTooltipPosition="above">
                Sales Forecasting
                <mat-icon class="text-[14px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
              </h3>
            </div>
            <div class="h-64 relative">
              <canvas #forecastChart></canvas>
            </div>
          </div>

          <!-- Sales by Region -->
          <div class="card rounded-2xl p-6 space-y-4">
            <div>
              <h3 class="text-base font-semibold text-zinc-900 font-sans flex items-center gap-1.5 cursor-help w-fit" matTooltip="Total won &amp; confirmed sales volume by geographical region" matTooltipPosition="above">
                Sales by Region
                <mat-icon class="text-[14px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
              </h3>
            </div>
            <div class="h-64 relative">
              <canvas #regionChart></canvas>
            </div>
          </div>
        </div>

        <!-- Lists & Table Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Top Customers -->
          <div class="card rounded-2xl p-6 space-y-4">
            <div>
              <h3 class="text-base font-semibold text-zinc-900 font-sans flex items-center gap-1.5 cursor-help w-fit" matTooltip="Ranked by total confirmed deal value" matTooltipPosition="above">
                Top Customers
                <mat-icon class="text-[14px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
              </h3>
            </div>
            <div class="space-y-3 pt-2">
              @for (cust of state.topCustomers(); track cust.name) {
                <div class="flex items-center justify-between gap-4 p-2.5 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <div class="flex items-center gap-3 shrink-0">
                    <div class="w-8 h-8 rounded-full bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-xs shrink-0 uppercase font-sans">
                      {{ cust.name.substring(0, 2) }}
                    </div>
                    <div>
                      <span class="font-bold text-xs text-zinc-800 block font-sans">{{ cust.name }}</span>
                      <span class="text-meta text-zinc-400 font-semibold font-sans">{{ cust.dealCount }} won deals</span>
                    </div>
                  </div>
                  <span class="font-bold font-sans text-xs text-zinc-900 shrink-0">{{ formatCurrency(cust.totalValue) }}</span>
                </div>
              } @empty {
                <div class="text-center py-8 text-zinc-400 text-xs font-sans">No customer sales data available.</div>
              }
            </div>
          </div>

          <!-- Lost Opportunities -->
          <div class="card rounded-2xl p-6 space-y-4">
            <div>
              <h3 class="text-base font-semibold text-zinc-900 font-sans flex items-center gap-1.5 cursor-help w-fit" matTooltip="Pipelines marked as Closed Lost" matTooltipPosition="above">
                Lost Opportunities
                <mat-icon class="text-[14px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
              </h3>
            </div>
            <div class="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-white border border-zinc-200">
                  <tr>
                    <th scope="col" class="px-4 py-2.5 text-left font-bold text-meta text-zinc-500 uppercase tracking-wider font-sans">Opportunity</th>
                    <th scope="col" class="px-4 py-2.5 text-left font-bold text-meta text-zinc-500 uppercase tracking-wider font-sans">Owner</th>
                    <th scope="col" class="px-4 py-2.5 text-right font-bold text-meta text-zinc-500 uppercase tracking-wider font-sans">Value</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-200 text-xs">
                  @for (lost of state.lostOpportunities(); track lost.id) {
                    <tr class="hover:bg-zinc-50 transition-colors">
                      <td class="px-4 py-2.5">
                        <span class="font-bold text-zinc-800 block truncate max-w-[160px] font-sans">{{ lost.title }}</span>
                        <span class="text-meta text-zinc-400 font-sans">{{ getPartnerName(lost.partnerId) }}</span>
                      </td>
                      <td class="px-4 py-2.5 text-zinc-500 font-medium font-sans">
                        {{ lost.salesPerson || 'Unassigned' }}
                      </td>
                      <td class="px-4 py-2.5 text-right font-bold font-sans text-zinc-600">
                        {{ formatCurrency(lost.amount) }}
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3" class="px-4 py-6 text-center text-zinc-400 text-xs font-medium font-sans">No lost opportunities logged. Great job!</td>
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
          <div class="card rounded-[32px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 class="text-xl font-bold text-zinc-900 font-sans">Customer 360° Profile</h3>
              <p class="text-sm text-zinc-500 mt-1 font-sans">Select a customer to view their complete profile and interaction history.</p>
            </div>
            <div class="relative shrink-0">
              <select
                id="customer-selector"
                [value]="selectedCustomerId() || ''"
                (change)="onCustomerChange($event)"
                class="w-64 pl-4 pr-10 py-3 text-sm bg-white border border-zinc-200 rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-900 hover:bg-white/80 transition-colors font-sans font-bold text-zinc-900 appearance-none cursor-pointer border border-white"
              >
                @for (p of getCustomers(); track p.id) {
                  <option [value]="p.id">{{ p.name }}</option>
                }
              </select>
              <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-400">
                <mat-icon style="font-size:18px;width:18px;height:18px">keyboard_arrow_down</mat-icon>
              </div>
            </div>
          </div>

          @if (selectedCustomer360(); as view) {
            <app-customer-360 [view]="view" />
          } @else {
            <!-- No customer selected / no data -->
            <div class="card rounded-2xl p-16 flex flex-col items-center justify-center text-center">
              <div class="w-16 h-16 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mb-4">
                <mat-icon style="font-size:32px;width:32px;height:32px">contact_page</mat-icon>
              </div>
              <h3 class="text-base font-bold text-zinc-900 font-sans">No Profile Found</h3>
              <p class="text-xs text-zinc-500 mt-1 font-sans max-w-xs">
                Select a customer from the dropdown above to view their unified 360° profile.
              </p>
            </div>
          }

        </div>
      }<!-- /customers360 -->

    </div>
  `
})
export class AnalyticsComponent implements AfterViewInit {
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

  forecastChartInstance: unknown;
  regionChartInstance: unknown;

  constructor() {
    // Auto-select first customer for immediate richness
    const first = this.state.partners().find(p => p.type === 'Customer');
    if (first) this.selectedCustomerId.set(first.id);
  }

  ngAfterViewInit() {
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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Awaiting Invoicing':
      case 'Invoiced':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'New':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Proposal sent':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'Closed Lost':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-zinc-50 text-zinc-700 border-zinc-100';
    }
  }

  getTicketStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'In Progress':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Open':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-zinc-50 text-zinc-700 border-zinc-100';
    }
  }

  getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'High': return 'bg-red-50 text-red-700 border-red-200';
      case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low': return 'bg-zinc-50 text-zinc-600 border-zinc-200';
      default: return 'bg-zinc-50 text-zinc-700 border-zinc-100';
    }
  }

  getInvoiceStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Paid': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Overdue': return 'bg-red-50 text-red-700 border-red-200';
      case 'Draft': return 'bg-zinc-50 text-zinc-600 border-zinc-200';
      default: return 'bg-zinc-50 text-zinc-700 border-zinc-100';
    }
  }

  // ── Charts ─────────────────────────────────────────────────
  initForecastChart() {
    const ctx = this.forecastCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const forecastData = this.state.salesForecast();
    const months = Array.from(new Set(forecastData.map(d => d.month))).sort();
    const reps = Array.from(new Set(forecastData.map(d => d.salesperson)));

    const colors = [
      'rgba(59, 130, 246, 1)',
      'rgba(147, 51, 234, 1)',
      'rgba(236, 72, 153, 1)',
      'rgba(16, 185, 129, 1)'
    ];

    const datasets = reps.map((rep, idx) => {
      const dataPoints = months.map(m => {
        const match = forecastData.find(d => d.month === m && d.salesperson === rep);
        return match ? match.total : 0;
      });
      return {
        label: rep,
        data: dataPoints,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length].replace(', 1)', ', 0.05)'),
        borderWidth: 2,
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
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Outfit, Inter, sans-serif', size: 10 } } }
        },
        scales: {
          y: {
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'Outfit, Inter, sans-serif', size: 9 }, callback: (val: number) => this.formatCompactMAD(val) }
          },
          x: { grid: { display: false }, ticks: { font: { family: 'Outfit, Inter, sans-serif', size: 9 } } }
        }
      }
    });
  }

  initRegionChart() {
    const ctx = this.regionCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const regionData = this.state.dealsByRegion();

    this.regionChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: regionData.map(r => r.region),
        datasets: [{
          label: 'Won/Confirmed Revenue',
          data: regionData.map(r => r.total),
          backgroundColor: 'rgba(59, 130, 246, 0.85)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1.5,
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
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'Outfit, Inter, sans-serif', size: 9 }, callback: (val: number) => this.formatCompactMAD(val) }
          },
          y: { grid: { display: false }, ticks: { font: { family: 'Outfit, Inter, sans-serif', size: 9 } } }
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
