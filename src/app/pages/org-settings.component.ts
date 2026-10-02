import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmStateService } from '../services/crm-state.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatCardComponent } from '../shared/ui/stat-card.component';
import { ConfirmService } from '../shared/ui/confirm.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-org-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, StatCardComponent],
  template: `
    <div class="space-y-6">

      <!-- Success Banner -->
      @if (showSuccess()) {
        <div class="alert alert-success" role="status">
          <mat-icon>check_circle</mat-icon>
          <span>Changes saved successfully.</span>
        </div>
      }

      <!-- Sections -->
      <div class="segmented self-start" role="group" aria-label="Organization sections">
        <button (click)="orgTab.set('profile')" [class.is-active]="orgTab() === 'profile'" class="segmented__item">Profile</button>
        <button (click)="orgTab.set('metrics')" [class.is-active]="orgTab() === 'metrics'" class="segmented__item">Metrics</button>
        @if (isAdmin()) {
          <button (click)="orgTab.set('danger')" [class.is-active]="orgTab() === 'danger'" class="segmented__item">Danger Zone</button>
        }
      </div>

      @if (orgTab() === 'profile') {
      <div class="card p-5 space-y-6 max-w-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-line-soft">
          <h3 class="card-title">Profile Details</h3>
          @if (isAdmin()) {
            <button
              (click)="toggleEdit()"
              class="btn-icon btn-sm"
              [title]="isEditing() ? 'Cancel editing' : 'Edit profile'" [attr.aria-label]="isEditing() ? 'Cancel editing' : 'Edit profile'"
            >
              <mat-icon class="icon-sm">{{ isEditing() ? 'close' : 'edit' }}</mat-icon>
            </button>
          }
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-subtle border border-line">
          <div class="relative group shrink-0">
            @if (state.organization().logoUrl) {
              <img
                [src]="resolvedLogoUrl()"
                [alt]="state.organization().name"
                class="card w-16 h-16 object-contain p-1"
              />
            } @else {
              <div
                [style.background-color]="state.organization().logoColor"
                class="w-16 h-16 rounded-2xl text-white font-semibold text-2xl flex items-center justify-center uppercase shadow-xs"
              >
                {{ state.organization().logoInitials }}
              </div>
            }
          </div>

          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              <span class="eyebrow">Workspace Logo</span>
              @if (isUploadingLogo()) {
                <span class="text-xs text-accent-ink flex items-center gap-1">
                  <mat-icon class="animate-spin icon-xs">refresh</mat-icon>
                  Uploading...
                </span>
              }
            </div>

            <div class="flex flex-wrap items-center gap-2 pt-1">
              <input
                #fileInput
                type="file"
                class="hidden"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                (change)="onLogoFileSelected($event)"
              />
              <button
                type="button"
                (click)="fileInput.click()"
                [disabled]="!isAdmin() || isUploadingLogo()"
                class="btn-secondary btn-sm"
              >
                <mat-icon class="text-ink-3 icon-sm">upload</mat-icon>
                <span>{{ state.organization().logoUrl ? 'Change Logo' : 'Upload Logo' }}</span>
              </button>
              @if (state.organization().logoUrl && isAdmin()) {
                <button
                  type="button"
                  (click)="removeLogo()"
                  [disabled]="isUploadingLogo()"
                  class="btn-danger-soft btn-sm"
                >
                  <mat-icon class="icon-sm">delete_outline</mat-icon>
                  <span>Remove</span>
                </button>
              }
            </div>
            <p class="text-meta text-ink-3 pt-0.5">PNG, JPG, SVG or WebP up to 5MB.</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex-1 min-w-0">
            @if (isEditing()) {
              <label for="org_name" class="field-label mb-1.5">Organization Name</label>
              <input
                id="org_name"
                [(ngModel)]="editName"
                placeholder="Organization Name"
                class="input-field w-full font-semibold"
              />
            } @else {
              <h2 class="section-title truncate">{{ state.organization().name }}</h2>
              <p class="text-xs text-ink-3 mt-0.5">ID: {{ state.organization().id }}</p>
            }
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label for="industry" class="field-label mb-1.5">Industry</label>
            @if (isEditing()) {
              <select id="industry"
                [(ngModel)]="editIndustry"
                class="input-field w-full cursor-pointer font-semibold"
              >
                <option value="Technology">Technology</option>
                <option value="Finance">Finance</option>
                <option value="Consulting">Consulting</option>
                <option value="Logistics">Logistics</option>
                <option value="Retail">Retail</option>
                <option value="Education">Education</option>
              </select>
            } @else {
              <div class="text-sm font-semibold text-ink">{{ state.organization().industry }}</div>
            }
          </div>

          <div>
            <label for="timezone" class="field-label mb-1.5">Timezone</label>
            @if (isEditing()) {
              <input
                [(ngModel)]="editTimezone"
                placeholder="e.g. Africa/Casablanca"
                class="input-field w-full"
              />
            } @else {
              <div class="text-sm font-semibold text-ink">{{ state.organization().timezone }}</div>
            }
          </div>

          <div>
            <label for="fiscal_year_start_mo" class="field-label mb-1.5">Fiscal Year Start Month</label>
            @if (isEditing()) {
              <select
                [(ngModel)]="editFiscalStart"
                class="input-field w-full cursor-pointer font-semibold"
              >
                @for (m of months; track m.value) {
                  <option [value]="m.value">{{ m.name }}</option>
                }
              </select>
            } @else {
              <div class="text-sm font-semibold text-ink">{{ getMonthName(state.organization().fiscalYearStart) }}</div>
            }
          </div>
        </div>

        @if (isEditing()) {
          <div class="pt-2">
            <button
              (click)="saveOrgDetails()"
              class="btn-primary w-full"
            >
              Save Changes
            </button>
          </div>
        }
      </div>
      }

      @if (orgTab() === 'metrics') {
      <div class="space-y-6">

        <div class="space-y-3">
          <h3 class="card-title">Team</h3>
          <div class="stat-grid">
            <app-stat-card label="Total Users" [value]="state.users().length" icon="group" tone="blue" tooltip="All member accounts" />

            <app-stat-card label="Active Users" [value]="state.activeUsers().length" icon="how_to_reg" tone="emerald" tooltip="Currently enabled accounts" />

            <app-stat-card label="Active Teams" [value]="state.teams().length" icon="groups" tone="slate" tooltip="Departments in org" />

            <app-stat-card label="Collaboration Groups" [value]="state.groups().length" icon="forum" tone="sky" tooltip="Shared chat spaces" />
          </div>
        </div>

        <div class="space-y-3">
          <h3 class="card-title">Sales &amp; Pipeline</h3>
          <div class="stat-grid">
            <app-stat-card label="Total Partners" [value]="state.partners().length" icon="handshake" tone="violet" tooltip="Leads, customers &amp; vendors" />

            <app-stat-card label="Open Deals" [value]="openDeals()" icon="point_of_sale" tone="blue" tooltip="In active pipeline" />

            <app-stat-card label="Sales This Month" [value]="formatCurrency(state.salesThisMonth())" icon="paid" tone="emerald" tooltip="Won/confirmed revenue" />

            <app-stat-card label="Win Rate" [value]="state.winRate() + '%'" icon="emoji_events" tone="amber" tooltip="Won vs lost deals" />
          </div>
        </div>

        <div class="space-y-3">
          <h3 class="card-title">Operations</h3>
          <div class="stat-grid">
            <app-stat-card label="Open Tickets" [value]="openTickets()" icon="support_agent" tone="sky" tooltip="Open or in progress" />

            <app-stat-card label="Pending Tasks" [value]="pendingTasks()" icon="checklist" tone="amber" tooltip="Across all teams" />

            <app-stat-card label="Overdue Invoices" [value]="state.overdueInvoices().length" icon="receipt_long" tone="rose" tooltip="Needs collection" />

            <app-stat-card label="Active Campaigns" [value]="activeCampaigns()" icon="campaign" tone="violet" tooltip="Currently running" />
          </div>
        </div>
      </div>
      }

      @if (orgTab() === 'danger') {
      <div class="card p-5 max-w-2xl border-danger-line">
        <h3 class="card-title text-danger-ink mb-2">Danger Zone</h3>
        <p class="text-sm text-ink-2 mb-4">Deactivating the organization will disable all user accounts and freeze CRM data collections. This action requires high administrative verification.</p>
        <button
          disabled
          class="btn-danger-soft"
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
  private notify = inject(ToastService);
  private confirmDialog = inject(ConfirmService);
  state = inject(CrmStateService);

  orgTab = signal('profile');
  isEditing = signal<boolean>(false);
  showSuccess = signal<boolean>(false);
  isUploadingLogo = signal<boolean>(false);

  resolvedLogoUrl = computed(() => {
    return this.state.resolveLogoUrl(this.state.organization().logoUrl);
  });

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

  onLogoFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    // Maximum 5MB validation
    if (file.size > 5 * 1024 * 1024) {
      this.notify.show('File is too large. Maximum size is 5MB.', { type: 'warning' });
      input.value = '';
      return;
    }

    this.isUploadingLogo.set(true);
    this.state.uploadOrganizationLogo(
      file,
      () => {
        this.isUploadingLogo.set(false);
        input.value = '';
      },
      () => {
        this.isUploadingLogo.set(false);
        input.value = '';
      }
    );
  }

  async removeLogo() {
    if (!this.isAdmin()) return;
    if (await this.confirmDialog.ask({ title: 'Remove logo?', message: 'Your workspace will fall back to its initials.', confirmLabel: 'Remove logo', danger: true })) {
      this.state.updateOrganization({ logoUrl: '' });
    }
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
