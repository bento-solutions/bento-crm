import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmStateService } from '../services/crm-state.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatCardComponent } from '../shared/ui/stat-card.component';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { ConfirmService } from '../shared/ui/confirm.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-org-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, StatCardComponent, PageHeaderComponent],
  template: `
    <div class="page">
      <app-page-header size="section" title="Organization" subtitle="Your workspace profile, activity and account status" />

      <div class="segmented self-start" role="group" aria-label="Organization sections">
        <button (click)="orgTab.set('profile')" [class.is-active]="orgTab() === 'profile'" class="segmented__item">Profile</button>
        <button (click)="orgTab.set('metrics')" [class.is-active]="orgTab() === 'metrics'" class="segmented__item">Metrics</button>
        @if (isAdmin()) {
          <button (click)="orgTab.set('danger')" [class.is-active]="orgTab() === 'danger'" class="segmented__item">Danger zone</button>
        }
      </div>

      @if (orgTab() === 'profile') {
      <section class="card max-w-3xl">
        <div class="card-header">
          <h3 class="card-title">Profile details</h3>
          @if (isAdmin() && !isEditing()) {
            <button (click)="toggleEdit()" class="btn-secondary btn-sm">
              <mat-icon class="icon-sm">edit</mat-icon>
              Edit
            </button>
          }
        </div>

        <div class="card-body space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center gap-4">
            @if (state.organization().logoUrl) {
              <img
                [src]="resolvedLogoUrl()"
                [alt]="state.organization().name"
                class="w-16 h-16 shrink-0 object-contain p-1 rounded-xl border border-line bg-surface"
              />
            } @else {
              <div
                [style.background-color]="state.organization().logoColor"
                class="w-16 h-16 shrink-0 rounded-xl text-white font-medium text-2xl flex items-center justify-center uppercase"
              >
                {{ state.organization().logoInitials }}
              </div>
            }

            <div class="flex-1 min-w-0 space-y-2">
              <div class="flex items-center gap-2">
                <span class="field-label">Workspace logo</span>
                @if (isUploadingLogo()) {
                  <span class="text-xs text-ink-3 flex items-center gap-1">
                    <mat-icon class="animate-spin icon-xs">refresh</mat-icon>
                    Uploading…
                  </span>
                }
              </div>
              <div class="flex flex-wrap items-center gap-2">
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
                  <mat-icon class="icon-sm">upload</mat-icon>
                  <span>{{ state.organization().logoUrl ? 'Change logo' : 'Upload logo' }}</span>
                </button>
                @if (state.organization().logoUrl && isAdmin()) {
                  <button
                    type="button"
                    (click)="removeLogo()"
                    [disabled]="isUploadingLogo()"
                    class="btn-ghost btn-sm"
                  >
                    <mat-icon class="icon-sm">delete_outline</mat-icon>
                    <span>Remove</span>
                  </button>
                }
              </div>
              <p class="field-hint">PNG, JPG, SVG or WebP up to 5MB.</p>
            </div>
          </div>

          @if (isEditing()) {
            <div class="grid gap-4 sm:grid-cols-2 pt-5 border-t border-line-soft">
              <label class="field sm:col-span-2">
                <span class="field-label">Organization name</span>
                <input [(ngModel)]="editName" placeholder="Organization name" class="input-field" />
              </label>
              <label class="field">
                <span class="field-label">Industry</span>
                <select [(ngModel)]="editIndustry" class="input-field">
                  <option value="Technology">Technology</option>
                  <option value="Finance">Finance</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Retail">Retail</option>
                  <option value="Education">Education</option>
                </select>
              </label>
              <label class="field">
                <span class="field-label">Timezone</span>
                <input [(ngModel)]="editTimezone" placeholder="e.g. Africa/Casablanca" class="input-field" />
              </label>
              <label class="field">
                <span class="field-label">Fiscal year start month</span>
                <select [(ngModel)]="editFiscalStart" class="input-field">
                  @for (m of months; track m.value) {
                    <option [value]="m.value">{{ m.name }}</option>
                  }
                </select>
              </label>
            </div>
          } @else {
            <dl class="grid gap-4 sm:grid-cols-2 pt-5 border-t border-line-soft">
              <div class="sm:col-span-2">
                <dt class="field-label mb-1">Organization name</dt>
                <dd class="text-sm text-ink">{{ state.organization().name }}</dd>
              </div>
              <div>
                <dt class="field-label mb-1">Industry</dt>
                <dd class="text-sm text-ink">{{ state.organization().industry }}</dd>
              </div>
              <div>
                <dt class="field-label mb-1">Timezone</dt>
                <dd class="text-sm text-ink">{{ state.organization().timezone }}</dd>
              </div>
              <div>
                <dt class="field-label mb-1">Fiscal year start month</dt>
                <dd class="text-sm text-ink">{{ getMonthName(state.organization().fiscalYearStart) }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="field-label mb-1">Organization ID</dt>
                <dd class="t-mono text-ink-3 break-all">{{ state.organization().id }}</dd>
              </div>
            </dl>
          }
        </div>

        @if (isEditing()) {
          <div class="card-footer">
            <button (click)="toggleEdit()" class="btn-secondary">Cancel</button>
            <button (click)="saveOrgDetails()" class="btn-primary">Save changes</button>
          </div>
        }
      </section>
      }

      @if (orgTab() === 'metrics') {
      <div class="space-y-6">

        <div class="space-y-3">
          <h3 class="card-title">Team</h3>
          <div class="stat-grid grid-cols-2 xl:grid-cols-4">
            <app-stat-card label="Total users" [value]="state.users().length" icon="group" tone="blue" tooltip="All member accounts" />

            <app-stat-card label="Active users" [value]="state.activeUsers().length" icon="how_to_reg" tone="emerald" tooltip="Currently enabled accounts" />

            <app-stat-card label="Active teams" [value]="state.teams().length" icon="groups" tone="slate" tooltip="Departments in org" />

            <app-stat-card label="Collaboration groups" [value]="state.groups().length" icon="forum" tone="sky" tooltip="Shared chat spaces" />
          </div>
        </div>

        <div class="space-y-3">
          <h3 class="card-title">Sales and pipeline</h3>
          <div class="stat-grid grid-cols-2 xl:grid-cols-4">
            <app-stat-card label="Total partners" [value]="state.partners().length" icon="handshake" tone="violet" tooltip="Leads, customers &amp; vendors" />

            <app-stat-card label="Open deals" [value]="openDeals()" icon="point_of_sale" tone="blue" tooltip="In active pipeline" />

            <app-stat-card label="Sales this month" [value]="formatCurrency(state.salesThisMonth())" icon="paid" tone="emerald" tooltip="Won/confirmed revenue" />

            <app-stat-card label="Win rate" [value]="state.winRate() + '%'" icon="emoji_events" tone="amber" tooltip="Won vs lost deals" />
          </div>
        </div>

        <div class="space-y-3">
          <h3 class="card-title">Operations</h3>
          <div class="stat-grid grid-cols-2 xl:grid-cols-4">
            <app-stat-card label="Open tickets" [value]="openTickets()" icon="support_agent" tone="sky" tooltip="Open or in progress" />

            <app-stat-card label="Pending tasks" [value]="pendingTasks()" icon="checklist" tone="amber" tooltip="Across all teams" />

            <app-stat-card label="Overdue invoices" [value]="state.overdueInvoices().length" icon="receipt_long" tone="rose" tooltip="Needs collection" />

            <app-stat-card label="Active campaigns" [value]="activeCampaigns()" icon="campaign" tone="violet" tooltip="Currently running" />
          </div>
        </div>
      </div>
      }

      @if (orgTab() === 'danger') {
      <section class="card max-w-3xl border-danger-line">
        <div class="card-body space-y-3">
          <h3 class="card-title text-danger-ink">Danger zone</h3>
          <p class="text-sm text-ink-2">Deactivating the organization will disable all user accounts and freeze CRM data collections. This action requires high administrative verification.</p>
          <button
            disabled
            class="btn-danger-soft"
            title="Contact support to deactivate your organization"
          >
            Deactivate organization
          </button>
        </div>
      </section>
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
