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

@Component({
  selector: 'app-marketing',
  imports: [MatIconModule, CommonModule, RouterLink, CreatedByBadgeComponent, DataStatusBannerComponent, PaginatorComponent,
            WhatsAppCampaignModalComponent, SimpleCampaignModalComponent],
  template: `
    <div class="space-y-8">
      <app-data-status-banner [loading]="campaignsService.isLoading$()" [error]="campaignsService.error$()" />
      <div class="flex gap-5 sm:gap-6 border-b border-zinc-200">
        <button
          (click)="activeTab.set('Email'); state.breadcrumbLabel.set('Email'); campaignsPage.set(1)"
          [class]="activeTab() === 'Email' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">email</mat-icon>
          Email
          <span class="text-xs">{{ filteredByType('Email').length }}</span>
        </button>
        <button
          (click)="activeTab.set('WhatsApp'); state.breadcrumbLabel.set('WhatsApp'); campaignsPage.set(1)"
          [class]="activeTab() === 'WhatsApp' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">chat</mat-icon>
          WhatsApp
          <span class="text-xs">{{ filteredByType('WhatsApp').length }}</span>
        </button>
        <button
          (click)="activeTab.set('SMS'); state.breadcrumbLabel.set('SMS'); campaignsPage.set(1)"
          [class]="activeTab() === 'SMS' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">sms</mat-icon>
          SMS
          <span class="text-xs">{{ filteredByType('SMS').length }}</span>
        </button>
      </div>
      <div class="flex justify-between items-center gap-3">
          @if (activeTab() === 'WhatsApp' && wa.account(); as account) {
            <div class="flex items-center gap-2 text-xs">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span class="text-zinc-600">
                Connected: <span class="font-mono">{{ account.displayPhoneNumber }}</span>
              </span>
              @if (account.provider === 'MOCK') {
                <span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold uppercase text-[10px]">Simulated</span>
              }
            </div>
          } @else {
            <span></span>
          }

          <button (click)="onNewCampaign()"
                  class="bg-zinc-900 hover:bg-zinc-950 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm shadow-lg shadow-zinc-300">
            <mat-icon class="w-5 h-5 text-[20px]! leading-none! flex items-center justify-center">add</mat-icon>
            New Campaign
          </button>
        </div>

        <!-- Overview Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="card rounded-xl p-4 lg:p-5 text-center">
            <div class="text-xl sm:text-2xl lg:text-3xl font-semibold text-zinc-900 mb-1 truncate">{{ activeCount() }}</div>
            <div class="text-xs font-bold tracking-wider text-zinc-500 uppercase">Active Campaigns</div>
          </div>
          <div class="card rounded-xl p-4 lg:p-5 text-center">
            <div class="text-xl sm:text-2xl lg:text-3xl font-semibold text-zinc-900 mb-1 truncate">{{ messagesSent() }}</div>
            <div class="text-xs font-bold tracking-wider text-zinc-500 uppercase">Messages Sent</div>
          </div>
          <div class="card rounded-xl p-4 lg:p-5 text-center">
            <div class="text-xl sm:text-2xl lg:text-3xl font-semibold text-zinc-900 mb-1 truncate">{{ campaignCount() }}</div>
            <div class="text-xs font-bold tracking-wider text-zinc-500 uppercase">{{ activeTab() }} Campaigns</div>
          </div>
        </div>

      <div class="card rounded-2xl overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-white border border-zinc-200">
            <tr>
              <th scope="col" class="px-6 py-3 text-left test-xs font-medium text-zinc-500 uppercase tracking-wider text-xs">Campaign Title</th>
              <th scope="col" class="px-6 py-3 text-left test-xs font-medium text-zinc-500 uppercase tracking-wider text-xs">Target Audience</th>
              <th scope="col" class="px-6 py-3 text-left test-xs font-medium text-zinc-500 uppercase tracking-wider text-xs">Sent/Delivery</th>
              <th scope="col" class="px-6 py-3 text-left test-xs font-medium text-zinc-500 uppercase tracking-wider text-xs">Status</th>
              <th scope="col" class="px-6 py-3 text-left test-xs font-medium text-zinc-500 uppercase tracking-wider text-xs">Created By</th>
              <th scope="col" class="px-6 py-3 text-right test-xs font-medium text-zinc-500 uppercase tracking-wider text-xs">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-slate-200">
            @for (campaign of paginatedCampaigns(); track campaign.id) {
              <tr class="hover:bg-zinc-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-zinc-900 flex items-center gap-2">
                    <a [routerLink]="['/campaigns', campaign.id]" class="table-name-link text-left" [title]="'View ' + campaign.title">{{campaign.title}}</a>
                    <mat-icon class="text-zinc-300 text-[16px]! w-4 h-4 leading-none!">chevron_right</mat-icon>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-zinc-500">{{ audienceLabel(campaign) }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-zinc-600">
                  {{campaign.sentCount}}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span [class]="getStatusColor(campaign.status)" class="px-2.5 py-1 text-xs font-medium rounded-full">
                    {{campaign.status}}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <app-created-by-badge [createdBy]="campaign.createdBy" [createdAt]="campaign.createdAt" />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right" (click)="$event.stopPropagation()">
                  <div class="flex items-center justify-end gap-1">
                    @if (canWriteCampaign() && !isWhatsApp(campaign)) {
                      <button (click)="openEditCampaign(campaign)" class="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-lg transition-colors" title="Edit Campaign">
                        <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">edit</mat-icon>
                      </button>
                    }
                    @if (canDeleteCampaign()) {
                      <button (click)="openDeleteCampaignModal(campaign)" class="text-zinc-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Delete Campaign">
                        <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">delete</mat-icon>
                      </button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-6 py-8 text-center text-zinc-500 text-sm">No {{activeTab()}} campaigns found.</td>
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
        <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white shadow-xl rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-bold text-zinc-950">Delete Campaign</h3>
              <button (click)="cancelDeleteCampaign()" class="text-zinc-400 hover:text-zinc-600 transition-colors">
                <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
              </button>
            </div>
            <p class="text-sm text-zinc-600 leading-relaxed">
              Are you sure you want to delete this campaign?
            </p>
            <div class="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
              <div class="text-sm font-semibold text-zinc-900">{{ campaignToDelete()?.title }}</div>
            </div>
            <div class="flex justify-end gap-2 pt-2 border-t border-white/30">
              <button (click)="cancelDeleteCampaign()" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">
                Cancel
              </button>
              <button (click)="confirmDeleteCampaign()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                <mat-icon class="w-4 h-4 text-[16px]! leading-none!">delete</mat-icon>
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
      case 'ACTIVE': return 'bg-emerald-50 text-emerald-700';
      case 'SENDING': return 'bg-sky-50 text-sky-700';
      case 'COMPLETED': return 'bg-zinc-100 text-zinc-700';
      case 'DRAFT': return 'bg-zinc-100 text-zinc-800';
      default: return 'bg-sky-50 text-sky-700';
    }
  }
}
