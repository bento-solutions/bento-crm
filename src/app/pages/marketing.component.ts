import { Component, inject, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { CrmStateService } from '../services/crm-state.service';
import { CampaignsService, Campaign } from '../services/domains';
import { WhatsAppCampaignsService } from '../services/domains/whatsapp-campaigns.service';
import { CommonModule } from '@angular/common';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { DataStatusBannerComponent } from '../shared/data-status-banner.component';
import { PaginatorComponent } from '../shared/paginator.component';
import { WhatsAppCampaignModalComponent } from '../shared/whatsapp-campaign-modal.component';
import { SimpleCampaignModalComponent } from '../shared/simple-campaign-modal.component';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { StatCardComponent } from '../shared/ui/stat-card.component';

@Component({
  selector: 'app-marketing',
  imports: [MatIconModule, CommonModule, RouterLink, CreatedByBadgeComponent, DataStatusBannerComponent, PaginatorComponent,
            WhatsAppCampaignModalComponent, SimpleCampaignModalComponent, PageHeaderComponent, EmptyStateComponent, StatCardComponent],
  template: `
    <div class="page">
      <app-page-header title="Marketing" subtitle="Plan, send and track campaigns across email, WhatsApp and SMS">
        <button actions class="btn-primary" (click)="onNewCampaign()">
          <mat-icon>add</mat-icon>
          New Campaign
        </button>
      </app-page-header>

      <app-data-status-banner [loading]="campaignsService.isLoading$()" [error]="campaignsService.error$()" />

      <div class="stat-grid">
        <app-stat-card label="Active Campaigns" [value]="activeCount()" icon="campaign" tone="amber" />
        <app-stat-card label="Messages Sent" [value]="messagesSent()" icon="send" tone="amber" />
        <app-stat-card [label]="activeTab() + ' Campaigns'" [value]="campaignCount()" [icon]="activeTab() === 'Email' ? 'email' : activeTab() === 'WhatsApp' ? 'chat' : 'sms'" tone="amber" />
      </div>

      <div class="tabs" role="tablist">
        @for (tab of channelTabs; track tab.id) {
          <button
            role="tab"
            class="tab"
            [class.is-active]="activeTab() === tab.id"
            [attr.aria-selected]="activeTab() === tab.id"
            (click)="activeTab.set(tab.id); state.breadcrumbLabel.set(tab.id); campaignsPage.set(1)"
          >
            <mat-icon>{{ tab.icon }}</mat-icon>
            {{ tab.id }}
            <span class="count-pill">{{ filteredByType(tab.id).length }}</span>
          </button>
        }
      </div>

      @if (activeTab() === 'WhatsApp' && wa.account(); as account) {
        <div class="flex items-center gap-2 text-xs text-ink-2">
          <span class="w-2 h-2 rounded-full bg-success"></span>
          <span>Connected: <span class="font-mono">{{ account.displayPhoneNumber }}</span></span>
          @if (account.provider === 'MOCK') {
            <span class="badge badge-warning">Simulated</span>
          }
        </div>
      }

      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Campaign Title</th>
              <th scope="col">Target Audience</th>
              <th scope="col">Sent/Delivery</th>
              <th scope="col">Status</th>
              <th scope="col">Created By</th>
              <th scope="col" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (campaign of paginatedCampaigns(); track campaign.id) {
              <tr>
                <td class="whitespace-nowrap">
                  <div class="text-sm font-medium text-ink flex items-center gap-2">
                    <a [routerLink]="['/campaigns', campaign.id]" class="table-name-link text-left" [title]="'View ' + campaign.title">{{campaign.title}}</a>
                    <mat-icon class="text-ink-4 icon-sm">chevron_right</mat-icon>
                  </div>
                </td>
                <td class="whitespace-nowrap">
                  <div class="text-sm text-ink-3">{{ audienceLabel(campaign) }}</div>
                </td>
                <td class="whitespace-nowrap font-mono text-ink-2">
                  {{campaign.sentCount}}
                </td>
                <td class="whitespace-nowrap">
                  <span [class]="getStatusColor(campaign.status)" class="badge">
                    {{campaign.status}}
                  </span>
                </td>
                <td class="whitespace-nowrap">
                  <app-created-by-badge [createdBy]="campaign.createdBy" [createdAt]="campaign.createdAt" />
                </td>
                <td class="whitespace-nowrap text-right" (click)="$event.stopPropagation()">
                  <div class="flex items-center justify-end gap-1">
                    @if (canWriteCampaign() && !isWhatsApp(campaign)) {
                      <button (click)="openEditCampaign(campaign)" class="btn-icon btn-sm" title="Edit Campaign">
                        <mat-icon class="icon-sm">edit</mat-icon>
                      </button>
                    }
                    @if (canDeleteCampaign()) {
                      <button (click)="openDeleteCampaignModal(campaign)" class="btn-icon btn-sm btn-danger-hover" title="Delete Campaign">
                        <mat-icon class="icon-sm">delete</mat-icon>
                      </button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="row-empty">
                  <app-empty-state icon="campaign" [title]="'No ' + activeTab() + ' campaigns yet'" [text]="'Create a campaign to reach your audience.'" />
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (filteredCampaigns().length > 0) {
          <app-paginator
            [currentPage]="campaignsPage()"
            [totalPages]="campaignsTotalPages()"
            [pageSize]="campaignsPageSize()"
            (pageChange)="campaignsPage.set($event)"
            (pageSizeChange)="campaignsPageSize.set($event)" />
        }
      </div>

      <app-whatsapp-campaign-modal
        [open]="showComposer()"
        (closed)="showComposer.set(false)"
        (created)="onCampaignCreated($event)" />

      <app-simple-campaign-modal
        [open]="showSimpleComposer()"
        [channel]="simpleComposerChannel()"
        [campaign]="editingCampaign()"
        (closeEmitted)="showSimpleComposer.set(false)"
        (saved)="refreshCampaigns()" />

      <!-- Delete Campaign Confirmation Modal -->
      @if (deleteCampaignModalOpen() && campaignToDelete()) {
        <div class="modal-backdrop">
          <div class="modal modal-sm">
            <div class="flex justify-between items-center">
              <h3 class="modal-title">Delete Campaign</h3>
              <button (click)="cancelDeleteCampaign()" class="btn-icon btn-sm">
                <mat-icon class="icon-sm">close</mat-icon>
              </button>
            </div>
            <p class="text-sm text-ink-2 leading-relaxed">
              Are you sure you want to delete this campaign?
            </p>
            <div class="bg-subtle border border-line rounded-xl px-4 py-3">
              <div class="text-sm font-semibold text-ink">{{ campaignToDelete()?.title }}</div>
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
              <button (click)="cancelDeleteCampaign()" class="btn-secondary">
                Cancel
              </button>
              <button (click)="confirmDeleteCampaign()" class="btn-danger">
                <mat-icon class="icon-sm">delete</mat-icon>
                Delete
              </button>
            </div>
          </div>
        </div>
      }
    </div>
    `})
export class MarketingComponent {
  state = inject(CrmStateService);
  campaignsService = inject(CampaignsService);
  wa = inject(WhatsAppCampaignsService);
  activeTab = signal<'Email' | 'WhatsApp' | 'SMS'>('Email');
  readonly channelTabs = [
    { id: 'Email' as const, icon: 'email' },
    { id: 'WhatsApp' as const, icon: 'chat' },
    { id: 'SMS' as const, icon: 'sms' },
  ];

  showComposer = signal(false);
  private router = inject(Router);

  showSimpleComposer = signal(false);
  simpleComposerChannel = signal<'Email' | 'SMS'>('Email');
  editingCampaign = signal<Campaign | null>(null);

  deleteCampaignModalOpen = signal(false);
  campaignToDelete = signal<Campaign | null>(null);

  campaignsPage = signal(1);
  campaignsPageSize = signal(10);
  campaignsTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredCampaigns().length / this.campaignsPageSize())));
  paginatedCampaigns = computed(() => {
    const start = (this.campaignsPage() - 1) * this.campaignsPageSize();
    return this.filteredCampaigns().slice(start, start + this.campaignsPageSize());
  });

  constructor() {
    this.campaignsService.load();
    this.wa.loadAccount();
    const tab = this.state.navigateTab();
    if (tab) {
      this.activeTab.set(tab as 'Email' | 'WhatsApp' | 'SMS');
      this.state.navigateTab.set(null);
    }
    this.state.breadcrumbLabel.set(this.activeTab());
  }

  /**
   * The API returns `channel: 'WHATSAPP'` while older seeded records carry
   * `type: 'WhatsApp'`. Matching on both keeps real and legacy rows visible in the
   * same table.
   */
  private channelOf = (c: Campaign & { channel?: string }): string => {
    const raw = c.channel ?? c.type ?? '';
    switch (String(raw).toUpperCase()) {
      case 'WHATSAPP': return 'WhatsApp';
      case 'EMAIL': return 'Email';
      case 'SMS': return 'SMS';
      default: return String(raw);
    }
  };

  filteredCampaigns = () =>
    this.campaignsService.allCampaigns().filter((c: Campaign) => this.channelOf(c) === this.activeTab());

  filteredByType = (type: string) =>
    this.campaignsService.allCampaigns().filter((c: Campaign) => this.channelOf(c) === type);

  isWhatsApp = (c: Campaign) => this.channelOf(c) === 'WhatsApp';

  audienceLabel = (c: Campaign) =>
    c.targetAudience ?? (this.isWhatsApp(c) ? 'Selected contacts' : '—');

  activeCount = computed(() =>
    this.filteredCampaigns().filter((c: Campaign) =>
      ['ACTIVE', 'SENDING', 'Active'].includes(String(c.status))).length);

  messagesSent = computed(() =>
    this.filteredCampaigns().reduce((sum: number, c: Campaign) => sum + Number(c.sentCount ?? 0), 0));

  campaignCount = computed(() => this.filteredCampaigns().length);

  onNewCampaign(): void {
    if (this.activeTab() === 'WhatsApp') {
      this.showComposer.set(true);
      return;
    }
    this.editingCampaign.set(null);
    this.simpleComposerChannel.set(this.activeTab() as 'Email' | 'SMS');
    this.showSimpleComposer.set(true);
  }

  canWriteCampaign(): boolean {
    return this.state.hasAuthority('CAMPAIGNS_WRITE');
  }

  canDeleteCampaign(): boolean {
    return this.state.hasAuthority('CAMPAIGNS_DELETE');
  }

  openEditCampaign(campaign: Campaign): void {
    if (!this.canWriteCampaign()) return;
    this.editingCampaign.set(campaign);
    this.simpleComposerChannel.set(this.activeTab() as 'Email' | 'SMS');
    this.showSimpleComposer.set(true);
  }

  openDeleteCampaignModal(campaign: Campaign): void {
    if (!this.canDeleteCampaign()) return;
    this.campaignToDelete.set(campaign);
    this.deleteCampaignModalOpen.set(true);
  }

  cancelDeleteCampaign(): void {
    this.deleteCampaignModalOpen.set(false);
    this.campaignToDelete.set(null);
  }

  confirmDeleteCampaign(): void {
    if (!this.canDeleteCampaign()) return;
    const campaign = this.campaignToDelete();
    if (campaign) {
      this.campaignsService.deleteCampaign(campaign.id);
    }
    this.deleteCampaignModalOpen.set(false);
    this.campaignToDelete.set(null);
  }

  onCampaignCreated(campaignId: string): void {
    this.refreshCampaigns();
    // The detail page is where recipients get added and (for WhatsApp) the campaign is
    // launched, so go straight there instead of leaving the agent on the list.
    this.router.navigate(['/campaigns', campaignId]);
  }

  refreshCampaigns(): void {
    this.campaignsService.isLoaded.set(false);
    this.campaignsService.load();
  }

  getStatusColor(status: string) {
    switch(String(status).toUpperCase()) {
      case 'ACTIVE': return 'badge-success';
      case 'SENDING': return 'badge-info';
      case 'COMPLETED': return 'bg-muted text-ink-2';
      case 'DRAFT': return 'bg-muted text-ink';
      default: return 'badge-info';
    }
  }
}
