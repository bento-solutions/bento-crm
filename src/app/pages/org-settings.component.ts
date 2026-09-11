import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmStateService } from '../services/crm-state.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-org-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="space-y-8 font-sans">

      <!-- Success Banner -->
      @if (showSuccess()) {
        <div class="bg-zinc-100 border border-zinc-300 text-zinc-950 text-sm px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
          <mat-icon class="text-zinc-900 text-base w-5 h-5 flex items-center justify-center">check_circle</mat-icon>
          <span>Changes saved successfully.</span>
        </div>
      }

      <!-- Tabs -->
      <div class="flex gap-5 sm:gap-6 border-b border-zinc-200">
        <button (click)="orgTab.set('profile')" [class]="orgTab() === 'profile' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'" class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all whitespace-nowrap">
          Profile
        </button>
        <button (click)="orgTab.set('metrics')" [class]="orgTab() === 'metrics' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'" class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all whitespace-nowrap">
          Metrics
        </button>
        @if (isAdmin()) {
          <button (click)="orgTab.set('danger')" [class]="orgTab() === 'danger' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'" class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all whitespace-nowrap">
            Danger Zone
          </button>
        }
      </div>

      @if (orgTab() === 'profile') {
      <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-6 max-w-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-zinc-100">
          <h3 class="font-bold text-zinc-800 text-base">Profile Details</h3>
          @if (isAdmin()) {
            <button
              (click)="toggleEdit()"
              class="text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-lg transition-colors flex items-center cursor-pointer"
              title="Edit Profile"
            >
              <mat-icon class="text-lg w-5 h-5 flex items-center justify-center">{{ isEditing() ? 'close' : 'edit' }}</mat-icon>
            </button>
          }
        </div>

        <div class="flex items-center gap-4">
          <div
            [style.background-color]="state.organization().logoColor"
            class="w-16 h-16 rounded-2xl text-white font-extrabold text-2xl flex items-center justify-center uppercase shadow-sm shrink-0"
          >
            {{ state.organization().logoInitials }}
          </div>
          <div class="flex-1 min-w-0">
            @if (isEditing()) {
              <input
                [(ngModel)]="editName"
                placeholder="Organization Name"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-blue-600 font-semibold text-zinc-800"
              />
            } @else {
              <h2 class="text-lg font-bold text-zinc-900 truncate">{{ state.organization().name }}</h2>
              <p class="text-xs text-zinc-400 font-sans mt-0.5">ID: {{ state.organization().id }}</p>
            }
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label for="industry" class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Industry</label>
            @if (isEditing()) {
              <select id="industry"
                [(ngModel)]="editIndustry"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 font-semibold text-zinc-700 cursor-pointer"
              >
                <option value="Technology">Technology</option>
                <option value="Finance">Finance</option>
                <option value="Consulting">Consulting</option>
                <option value="Logistics">Logistics</option>
                <option value="Retail">Retail</option>
                <option value="Education">Education</option>
              </select>
            } @else {
              <div class="text-sm font-semibold text-zinc-800">{{ state.organization().industry }}</div>
            }
          </div>

          <div>
            <label for="timezone" class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Timezone</label>
            @if (isEditing()) {
              <input
                [(ngModel)]="editTimezone"
                placeholder="e.g. Africa/Casablanca"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-blue-600 text-zinc-700"
              />
            } @else {
              <div class="text-sm font-semibold text-zinc-800 font-sans">{{ state.organization().timezone }}</div>
            }
          </div>

          <div>
            <label for="fiscal_year_start_mo" class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Fiscal Year Start Month</label>
            @if (isEditing()) {
              <select
                [(ngModel)]="editFiscalStart"
                class="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-blue-600 font-semibold text-zinc-700 cursor-pointer"
              >
                @for (m of months; track m.value) {
                  <option [value]="m.value">{{ m.name }}</option>
                }
              </select>
            } @else {
              <div class="text-sm font-semibold text-zinc-800">{{ getMonthName(state.organization().fiscalYearStart) }}</div>
            }
          </div>
        </div>

        @if (isEditing()) {
          <div class="pt-2">
            <button
              (click)="saveOrgDetails()"
              class="w-full bg-zinc-900 hover:bg-zinc-950 text-white py-2 px-4 rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer font-sans"
            >
              Save Changes
            </button>
          </div>
        }
      </div>
      }

      @if (orgTab() === 'metrics') {
      <div class="space-y-8">

        <div class="space-y-3">
          <h3 class="font-bold text-zinc-800 text-base">Team</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="blue">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="All member accounts" matTooltipPosition="above">
                  Total Users
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">group</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ state.users().length }}</div>
            </div>

            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="emerald">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Currently enabled accounts" matTooltipPosition="above">
                  Active Users
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">how_to_reg</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ state.activeUsers().length }}</div>
            </div>

            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="slate">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Departments in org" matTooltipPosition="above">
                  Active Teams
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">groups</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ state.teams().length }}</div>
            </div>

            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="sky">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Shared chat spaces" matTooltipPosition="above">
                  Collaboration Groups
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">forum</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ state.groups().length }}</div>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <h3 class="font-bold text-zinc-800 text-base">Sales &amp; Pipeline</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="violet">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Leads, customers &amp; vendors" matTooltipPosition="above">
                  Total Partners
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">handshake</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ state.partners().length }}</div>
            </div>

            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="blue">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="In active pipeline" matTooltipPosition="above">
                  Open Deals
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">point_of_sale</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ openDeals() }}</div>
            </div>

            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="emerald">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Won/confirmed revenue" matTooltipPosition="above">
                  Sales This Month
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">paid</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ formatCurrency(state.salesThisMonth()) }}</div>
            </div>

            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="amber">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Won vs lost deals" matTooltipPosition="above">
                  Win Rate
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">emoji_events</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ state.winRate() }}%</div>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <h3 class="font-bold text-zinc-800 text-base">Operations</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="sky">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Open or in progress" matTooltipPosition="above">
                  Open Tickets
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">support_agent</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ openTickets() }}</div>
            </div>

            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="amber">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Across all teams" matTooltipPosition="above">
                  Pending Tasks
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">checklist</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ pendingTasks() }}</div>
            </div>

            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="rose">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Needs collection" matTooltipPosition="above">
                  Overdue Invoices
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">receipt_long</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ state.overdueInvoices().length }}</div>
            </div>

            <div class="card tone-card rounded-2xl p-4 lg:p-6 flex flex-col justify-between hover:shadow-md transition-all" data-tone="violet">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-meta font-bold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-1 cursor-help" matTooltip="Currently running" matTooltipPosition="above">
                  Active Campaigns
                  <mat-icon class="text-[13px] w-3.5 h-3.5 flex items-center justify-center text-zinc-300">info</mat-icon>
                </h4>
                <div class="h-9 w-9 tone-icon rounded-xl flex items-center justify-center">
                  <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">campaign</mat-icon>
                </div>
              </div>
              <div class="text-base sm:text-lg lg:text-xl font-bold text-zinc-900 font-sans truncate">{{ activeCampaigns() }}</div>
            </div>
          </div>
        </div>
      </div>
      }

      @if (orgTab() === 'danger') {
      <div class="bg-zinc-100 border border-zinc-300/80 rounded-2xl p-6 shadow-xs">
        <h3 class="font-bold text-zinc-950 text-base mb-2">Danger Zone</h3>
        <p class="text-xs text-zinc-900/90 mb-4">Deactivating the organization will disable all user accounts and freeze CRM data collections. This action requires high administrative verification.</p>
        <button
          disabled
          class="bg-zinc-200/50 text-rose-450 px-4 py-2.5 rounded-xl text-sm font-semibold border border-zinc-300/50 cursor-not-allowed select-none"
          title="Contact support to deactivate your organization"
        >
          Deactivate Organization
        </button>
      </div>
      }
    </div>
  `
})
export class OrgSettingsComponent {
  state = inject(CrmStateService);

  orgTab = signal('profile');
  isEditing = signal<boolean>(false);
  showSuccess = signal<boolean>(false);

  editName = '';
  editIndustry = '';
  editTimezone = '';
  editFiscalStart = 1;

  months = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' }
  ];

  isAdmin(): boolean {
    return this.state.hasAuthority('ADMIN_ACCESS');
  }

  toggleEdit() {
    if (!this.isAdmin()) return;
    if (this.isEditing()) {
      this.isEditing.set(false);
    } else {
      const org = this.state.organization();
      this.editName = org.name;
      this.editIndustry = org.industry;
      this.editTimezone = org.timezone;
      this.editFiscalStart = org.fiscalYearStart;
      this.isEditing.set(true);
    }
  }

  saveOrgDetails() {
    if (!this.isAdmin()) return;
    this.state.updateOrganization({
      name: this.editName,
      industry: this.editIndustry,
      timezone: this.editTimezone,
      fiscalYearStart: Number(this.editFiscalStart)
    });
    this.isEditing.set(false);
    this.showSuccess.set(true);
    setTimeout(() => {
      this.showSuccess.set(false);
    }, 2000);
  }

  getMonthName(val: number): string {
    return this.months.find(m => m.value === val)?.name || 'January';
  }

  openDeals = computed(() =>
    this.state.deals().filter(d => !['Closed Won', 'Closed Lost'].includes(d.stage)).length
  );

  openTickets = computed(() =>
    this.state.tickets().filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length
  );

  pendingTasks = computed(() =>
    this.state.tasks().filter(t => t.status === 'Pending' || t.status === 'In Progress').length
  );

  activeCampaigns = computed(() =>
    this.state.campaigns().filter(c => c.status === 'Active').length
  );

  formatCurrency(value: number) {
    const cur = this.state.globalCurrency();
    const locale = cur === 'MAD' ? 'fr-MA' : cur === 'EUR' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(value);
  }
}
