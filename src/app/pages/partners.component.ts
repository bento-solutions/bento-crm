import { Component, inject, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Lead, LeadActivity, LeadAttachment, CrmUser } from '../services/crm-state.service';
import { PartnersService, Partner } from '../services/domains/partners.service';
import { ApiService } from '../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { DataStatusBannerComponent } from '../shared/data-status-banner.component';
import { PaginatorComponent } from '../shared/paginator.component';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { StatCardComponent } from '../shared/ui/stat-card.component';
import { ConfirmService } from '../shared/ui/confirm.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-partners',
  imports: [MatIconModule, CommonModule, FormsModule, CreatedByBadgeComponent, UserAvatarComponent, DataStatusBannerComponent, PaginatorComponent, PageHeaderComponent, EmptyStateComponent, StatCardComponent],
  template: `
    <div class="page">
      <app-page-header title="Partners" subtitle="Leads, customers, prospects and vendors in one directory">
        @if (canCreate()) {
          @if (activeTab() === 'Lead') {
            <button actions class="btn-primary" (click)="openAddLeadModal()">
              <mat-icon>add</mat-icon>
              Add New Lead
            </button>
          } @else {
            <button actions class="btn-primary" (click)="openCreateModal()">
              <mat-icon>person_add</mat-icon>
              New {{activeTab()}}
            </button>
          }
        }
      </app-page-header>

      @if (state.partnersLoading()) {
        @if (activeTab() === 'Lead') {
          <app-data-status-banner [loading]="true" [variant]="'rows'" [columns]="9" [rows]="8" />
        } @else {
          <app-data-status-banner [loading]="true" [variant]="'tiles'" [tiles]="6" />
        }
      }
      @if (state.partnersError()) {
        <app-data-status-banner [error]="state.partnersError()" />
      }

      <div class="tabs" role="tablist">
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'Lead'" [attr.aria-selected]="activeTab() === 'Lead'"
                (click)="activeTab.set('Lead'); state.breadcrumbLabel.set('Leads')">
          <mat-icon>filter_alt</mat-icon>
          Leads
          <span class="count-pill">{{ state.leadsData().length }}</span>
        </button>
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'Customer'" [attr.aria-selected]="activeTab() === 'Customer'"
                (click)="activeTab.set('Customer'); state.breadcrumbLabel.set('Customers'); partnersPage.set(1)">
          <mat-icon>people</mat-icon>
          Customers
          <span class="count-pill">{{ customers().length }}</span>
        </button>
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'Prospect'" [attr.aria-selected]="activeTab() === 'Prospect'"
                (click)="activeTab.set('Prospect'); state.breadcrumbLabel.set('Prospects'); partnersPage.set(1)">
          <mat-icon>person_search</mat-icon>
          Prospects
          <span class="count-pill">{{ prospects().length }}</span>
        </button>
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'Vendor'" [attr.aria-selected]="activeTab() === 'Vendor'"
                (click)="activeTab.set('Vendor'); state.breadcrumbLabel.set('Vendors'); partnersPage.set(1)">
          <mat-icon>store</mat-icon>
          Vendors
          <span class="count-pill">{{ vendors().length }}</span>
        </button>
      </div>

      @if (!state.partnersLoading()) {
        @if (activeTab() === 'Lead') {
          <!-- Leads Management -->
          <div class="space-y-6">
            <!-- KPI Metrics Dashboard -->
            <div class="stat-grid">
              <app-stat-card label="Total Leads" [value]="totalLeadsCount()" icon="groups" tone="blue" />
              <app-stat-card label="Qualified Leads" [value]="qualifiedLeadsCount()" icon="verified_user" tone="blue" />
              <app-stat-card label="Avg Lead Score" [value]="avgLeadScore() + '%'" icon="star" tone="blue" />
              <app-stat-card label="Conversion Rate" [value]="conversionRate() + '%'" icon="trending_up" tone="blue" />
            </div>

            <!-- Filters -->
            <div class="toolbar">
              <label class="search-field">
                <mat-icon>search</mat-icon>
                <input [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event); currentPage.set(1)"
                       type="search" placeholder="Search name, company…" aria-label="Search leads" class="input-field">
              </label>
              <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); currentPage.set(1)" class="input-field" aria-label="Filter by status">
                <option value="">All Statuses</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Attempted Contact">Attempted Contact</option>
                <option value="Meeting Scheduled">Meeting Scheduled</option>
                <option value="Qualified">Qualified</option>
                <option value="Proposal Requested">Proposal Requested</option>
                <option value="Converted">Converted</option>
                <option value="Lost">Lost</option>
                <option value="Disqualified">Disqualified</option>
              </select>
              <select [ngModel]="priorityFilter()" (ngModelChange)="priorityFilter.set($event); currentPage.set(1)" class="input-field" aria-label="Filter by priority">
                <option value="">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select [ngModel]="brandFilter()" (ngModelChange)="brandFilter.set($event); currentPage.set(1)" class="input-field" aria-label="Filter by brand">
                <option value="">All Brands</option>
                @for (brand of state.brands(); track brand.id) { <option [value]="brand.id">{{ brand.name }}</option> }
              </select>
              <select [ngModel]="businessTypeFilter()" (ngModelChange)="businessTypeFilter.set($event); currentPage.set(1)" class="input-field" aria-label="Filter by business type">
                <option value="">All Business Types</option>
                @for (bt of state.businessTypes(); track bt.id) { <option [value]="bt.id">{{ bt.name }}</option> }
              </select>
              <select [ngModel]="interestedProductFilter()" (ngModelChange)="interestedProductFilter.set($event); currentPage.set(1)" class="input-field" aria-label="Filter by interested product">
                <option value="">All Interested Products</option>
                @for (brand of state.brands(); track brand.id) { <option [value]="brand.name">{{ brand.name }}</option> }
              </select>
              <span class="toolbar__count toolbar__spacer">Showing {{ pageStart() }}–{{ pageEnd() }} of {{ filteredLeads().length }} leads</span>
            </div>

            <div class="table-card">
              <!-- Table -->
              <div class="overflow-x-auto">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th scope="col" class="w-8">
                        <input type="checkbox" [checked]="paginatedLeads().length > 0 && selectedLeadIds().size === paginatedLeads().length" (change)="toggleSelectAllLeads($event)" class="cursor-pointer" />
                      </th>
                      <th scope="col">Lead</th>
                      <th scope="col">Company</th>
                      <th scope="col">Qual.</th>
                      <th scope="col">Score</th>
                      <th scope="col">Origin</th>
                      <th scope="col">Owner</th>
                      <th scope="col">Status</th>
                      <th scope="col" class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (lead of paginatedLeads(); track lead.id) {
                      <tr class="group">
                        <td class="whitespace-nowrap" (click)="$event.stopPropagation()">
                          <input type="checkbox" [checked]="isLeadSelected(lead.id)" (change)="toggleLeadSelect(lead.id, $event)" class="cursor-pointer" />
                        </td>
                        <td class="whitespace-nowrap">
                          <div class="flex items-center gap-2">
                            <div class="h-8 w-8 bg-muted text-ink font-semibold rounded-lg text-meta flex items-center justify-center shrink-0">
                              {{ getInitials(lead.name) }}
                            </div>
                            <div class="min-w-0">
                              <button (click)="selectLead(lead)" class="table-name-link text-xs font-semibold text-ink group-hover:text-ink transition-colors truncate max-w-[120px] flex items-center gap-1.5 text-left" [title]="'View ' + lead.name">
                                @if (lead.brandColor) {
                                  <span class="w-2 h-2 rounded-full shrink-0" [style.background-color]="lead.brandColor" [title]="lead.brandName"></span>
                                }
                                <span class="truncate">{{ lead.name }}</span>
                              </button>
                              <div class="text-meta text-ink-3 font-mono">#{{ lead.id.slice(0, 8) }}</div>
                            </div>
                          </div>
                        </td>
                        <td class="whitespace-nowrap">
                          <div class="text-xs font-semibold text-ink truncate max-w-[130px]">{{ lead.companyName }}</div>
                          <div class="text-meta text-ink-3 truncate max-w-[130px]">{{ lead.company?.city || 'No city' }}, {{ lead.company?.country || 'No country' }}</div>
                        </td>
                        <td class="whitespace-nowrap" (click)="$event.stopPropagation()">
                          @if (canWrite()) {
                            <select [ngModel]="lead.qualification" (ngModelChange)="onQualificationChange(lead.id, $event)" (click)="$event.stopPropagation()" [class]="getQualificationClass(lead.qualification)" class="pill-select" title="Change qualification">
                              @for (q of leadQualificationOptions; track q) { <option [value]="q">{{ q }}</option> }
                            </select>
                          } @else {
                            <span class="badge" [class]="getQualificationClass(lead.qualification)">
                              {{ lead.qualification }}
                            </span>
                          }
                          <div class="flex items-center gap-1 mt-1">
                            <span [class]="getPriorityBadge(lead.priority)" class="badge">
                              {{ lead.priority }}
                            </span>
                            <span [class]="getTempBadge(lead.temperature)" class="badge">
                              {{ lead.temperature }}
                            </span>
                          </div>
                        </td>
                        <td class="whitespace-nowrap" (click)="$event.stopPropagation()">
                          @if (canWrite() && scoreEditFor() === lead.id) {
                            <div class="flex items-center gap-1.5">
                              <input type="range" min="0" max="100" step="1" [ngModel]="scoreDraft()" (ngModelChange)="scoreDraft.set($event)" (change)="commitScore(lead.id)" class="w-20 cursor-pointer" [attr.aria-label]="'Score for ' + lead.name">
                              <span class="text-meta font-semibold text-ink-2 w-6 text-right">{{ scoreDraft() }}</span>
                            </div>
                          } @else {
                            <button (click)="canWrite() && openScoreEditor(lead, $event)" class="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-surface transition-colors" [title]="canWrite() ? 'Click to adjust score' : null">
                              <div class="w-10 bg-surface rounded-full h-1.5 overflow-hidden">
                                <div [style.width.%]="lead.score" [class]="getScoreColor(lead.score)" class="h-full rounded-full"></div>
                              </div>
                              <span class="text-meta font-semibold text-ink-2">{{ lead.score }}</span>
                            </button>
                          }
                        </td>
                        <td class="whitespace-nowrap">
                          <div class="flex items-center gap-1">
                            <span class="badge badge-neutral">
                              {{ lead.origin || lead.campaigns?.[0]?.source || '—' }}
                            </span>
                          </div>
                          <div class="text-meta text-ink-3 mt-0.5">{{ lead.campaigns?.[0]?.campaign || '—' }}</div>
                        </td>
                        <td class="whitespace-nowrap" (click)="$event.stopPropagation()">
                          @if (canWrite()) {
                            <button (click)="openOwnerMenu(lead, $event)" class="flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-surface transition-colors truncate max-w-[130px]" title="Assign owner">
                              @if (lead.assignedToUserId) {
                                <app-user-avatar [userId]="lead.assignedToUserId" [size]="20" />
                              } @else {
                                <mat-icon class="text-ink-4 shrink-0 icon-xs">person_outline</mat-icon>
                              }
                              <span class="text-xs text-ink-2 truncate">{{ state.leadOwnerName(lead) || 'Unassigned' }}</span>
                              <mat-icon class="text-ink-4 shrink-0 icon-xs">expand_more</mat-icon>
                            </button>
                          } @else {
                            <div class="text-xs text-ink-2 flex items-center gap-1 truncate max-w-[110px]">
                              <mat-icon class="text-ink-4 shrink-0 icon-xs">person_outline</mat-icon>
                              {{ state.leadOwnerName(lead) || 'Unassigned' }}
                            </div>
                          }
                        </td>
                        <td class="whitespace-nowrap" (click)="$event.stopPropagation()">
                          @if (canWrite()) {
                            <select [ngModel]="lead.status" (ngModelChange)="onStatusChange(lead.id, $event)" (click)="$event.stopPropagation()" [class]="getStatusClass(lead.status)" class="pill-select" title="Change status">
                              @for (s of leadStatusOptions; track s) { <option [value]="s">{{ s }}</option> }
                            </select>
                          } @else {
                            <span [class]="getStatusClass(lead.status)" class="badge">
                              {{ lead.status }}
                            </span>
                          }
                        </td>
                        <td class="col-actions relative">
                          <div class="inline-flex items-center gap-1">
                            @if (lead.status !== 'Converted' && canWrite()) {
                            <button (click)="$event.stopPropagation(); toggleConvertMenu(lead.id, $event)" class="btn-secondary btn-sm">
                              <mat-icon class="icon-xs">arrow_forward</mat-icon>
                              Convert
                            </button>
                            @if (activeConvertMenuId() === lead.id) {
                              <div class="menu absolute right-0 top-8 z-10 w-44">
                                <button (click)="$event.stopPropagation(); convertLeadToProspect(lead); activeConvertMenuId.set(null)" class="menu-item">
                                  <mat-icon class="text-ink-4 icon-sm">swap_horiz</mat-icon>
                                  Convert to Prospect
                                </button>
                                <button (click)="$event.stopPropagation(); markLeadAsLost(lead); activeConvertMenuId.set(null)" class="menu-item">
                                  <mat-icon class="text-ink-4 icon-sm">cancel</mat-icon>
                                  Mark as Lost
                                </button>
                              </div>
                            }
                          } @else {
                            <span class="badge badge-success">Converted</span>
                          }
                            <button (click)="$event.stopPropagation(); selectLead(lead)" class="btn-icon btn-sm" title="View lead" aria-label="View lead">
                            <mat-icon class="icon-sm">visibility</mat-icon>
                          </button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="9" class="row-empty">
                          <app-empty-state icon="people_alt" title="No leads found" text="Try resetting filters or adding a new lead record." />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Owner picker popover (fixed: avoids clipping by the table's overflow-x container) -->
              @if (ownerMenuFor(); as menuLeadId) {
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
                <div class="fixed inset-0 z-[60]" (click)="closeOwnerMenu()" (window:scroll)="closeOwnerMenu()" (window:resize)="closeOwnerMenu()">
                  <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
                  <div class="menu fixed w-64 max-h-72 overflow-y-auto" [style.left.px]="ownerMenuPos().x" [style.top.px]="ownerMenuPos().y" (click)="$event.stopPropagation()">
                    <button (click)="chooseOwner(menuLeadId, null)" class="menu-item">
                      <span class="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0"><mat-icon class="text-ink-4 icon-sm">person_off</mat-icon></span>
                      Unassigned
                    </button>
                    <div class="border-t border-line-soft my-1"></div>
                    @for (u of state.assignableMembers(); track u.id) {
                      <button (click)="chooseOwner(menuLeadId, u.id)" class="menu-item">
                        <app-user-avatar [userId]="u.id" [size]="24" />
                        <span class="flex-1 min-w-0">
                          <span class="block text-xs font-semibold text-ink truncate">{{ u.displayName }}</span>
                          <span class="block text-meta text-ink-3 truncate">{{ memberTeamName(u) }}</span>
                        </span>
                        @if (state.isMarketingMember(u)) {
                          <span class="badge shrink-0 badge-violet">Marketing</span>
                        }
                      </button>
                    } @empty {
                      <p class="px-3 py-2 text-xs text-ink-3">No members found.</p>
                    }
                  </div>
                </div>
              }

              <app-paginator
                [currentPage]="currentPage()"
                [totalPages]="totalPages()"
                [pageSize]="pageSize()"
                (pageChange)="goToPage($event)"
                (pageSizeChange)="pageSize.set($event)" />
            </div>
          </div>

          @if (selectedLeadIds().size > 0) {
            <div class="bulk-action-bar">
              <span class="font-semibold">{{ selectedLeadIds().size }} selected</span>
              <div class="bulk-action-bar__sep"></div>
              <select (change)="bulkAssignLeadOwner($event)">
                <option value="">Assign owner…</option>
                @for (u of state.assignableMembers(); track u.id) { <option [value]="u.id">{{u.displayName}}</option> }
              </select>
              <select (change)="bulkChangeLeadStage($event)">
                <option value="">Change stage…</option>
                @for (s of leadStatusOptions; track s) { <option [value]="s">{{s}}</option> }
              </select>
              <button class="bulk-action-bar__btn" (click)="bulkExportLeads()">Export CSV</button>
              <button class="bulk-action-bar__btn is-quiet" (click)="clearLeadSelection()">Clear</button>
            </div>
          }

          <!-- Slide-over details pane for lead -->
          @if (selectedLead(); as lead) {
            <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
              <div class="absolute inset-0 overflow-hidden">
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
                <div (click)="closeDetails()" class="absolute inset-0 bg-transparent"></div>
                <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                  <div class="pointer-events-auto w-screen max-w-2xl transform bg-surface shadow-xl flex flex-col h-full">
                    
                    <!-- Header -->
                    <div class="px-6 py-5 border-b border-line-soft flex items-center justify-between">
                      <div class="flex items-center gap-4">
                        <div class="h-12 w-12 bg-muted text-ink font-semibold rounded-xl flex items-center justify-center">
                          {{ getInitials(lead.name) }}
                        </div>
                        <div>
                          <h2 class="section-title" id="slide-over-title">{{ lead.name }}</h2>
                          <p class="text-xs text-ink-3"><span class="font-mono">#{{ lead.id.slice(0, 8) }}</span> &bull; {{ lead.companyName }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-3">
                        <div class="flex items-center gap-2">
                <span class="field-label">Status</span>
                <select [ngModel]="lead.status" (ngModelChange)="onStatusChange(lead.id, $event)" class="input-field input-sm w-auto cursor-pointer">
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Attempted Contact">Attempted Contact</option>
                            <option value="Meeting Scheduled">Meeting Scheduled</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Proposal Requested">Proposal Requested</option>
                            <option value="Converted">Converted</option>
                            <option value="Lost">Lost</option>
                            <option value="Disqualified">Disqualified</option>
                          </select>
                        </div>
                        <button (click)="openLeadDetail(lead)" class="px-2.5 py-1.5 rounded-lg btn-secondary text-xs font-semibold text-ink-2 hover:text-ink transition-colors flex items-center gap-1">
                          <mat-icon class="icon-xs">open_in_new</mat-icon>
                          Open page
                        </button>
                        <button (click)="closeDetails()" title="Close" class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink-2 hover:bg-muted transition-colors">
                          <mat-icon class="icon-md">close</mat-icon>
                        </button>
                      </div>
                    </div>

                    <!-- Tabs Nav -->
                    <div class="px-6 border-b border-line-soft flex gap-6">
                      <button (click)="activeDetailTab.set('info')" [class.is-active]="activeDetailTab() === 'info'" class="tab">Info</button>
                      <button (click)="activeDetailTab.set('activities')" [class.is-active]="activeDetailTab() === 'activities'" class="tab">Activities & Notes</button>
                      <button (click)="activeDetailTab.set('attachments')" [class.is-active]="activeDetailTab() === 'attachments'" class="tab">Attachments</button>
                      <button (click)="activeDetailTab.set('history')" [class.is-active]="activeDetailTab() === 'history'" class="tab">Status History</button>
                    </div>

                    <!-- Scrollable content -->
                    <div class="flex-1 overflow-y-auto p-6 space-y-6">
                      @if (activeDetailTab() === 'info') {
                        <div class="space-y-6">
                          <div class="card p-4 space-y-3">
                            <h3 class="eyebrow">Basic Information</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                              <div><div class="eyebrow">Lead Name</div><div class="font-semibold text-ink mt-0.5">{{ lead.name }}</div></div>
                              <div><div class="eyebrow">Company</div><div class="font-semibold text-ink mt-0.5">{{ lead.companyName }}</div></div>
                              <div><div class="eyebrow">Assigned Salesperson</div><div class="font-semibold text-ink mt-0.5">{{ lead.assignedSalesperson || 'Unassigned' }}</div></div>
                              <div><div class="eyebrow">Sales Team</div><div class="font-semibold text-ink mt-0.5">{{ lead.salesTeam || '—' }}</div></div>
                              <div><div class="eyebrow">Email</div><a href="mailto:{{ lead.contacts?.[0]?.email }}" class="font-semibold text-ink hover:underline mt-0.5 block">{{ lead.contacts?.[0]?.email || '—' }}</a></div>
                              <div><div class="eyebrow">Phone</div><div class="font-semibold text-ink mt-0.5">{{ lead.contacts?.[0]?.phone || '—' }}</div></div>
                              @if (lead.contacts?.[0]?.website; as web) {
                                <div><div class="eyebrow">Website</div><a href="http://{{web}}" target="_blank" class="font-semibold text-ink hover:underline mt-0.5 block">{{ web }}</a></div>
                              }
                              @if (lead.contacts?.[0]?.linkedin; as li) {
                                <div><div class="eyebrow">LinkedIn</div><a href="http://{{li}}" target="_blank" class="font-semibold text-ink hover:underline mt-0.5 block">{{ li }}</a></div>
                              }
                            </div>
                          </div>
                          <div class="card p-4 space-y-3">
                            <h3 class="eyebrow">Attribution</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div class="eyebrow">Brand</div>
                                <div class="font-semibold text-ink mt-0.5 flex items-center gap-1.5">
                                  @if (lead.brandColor) { <span class="w-2 h-2 rounded-full shrink-0" [style.background-color]="lead.brandColor"></span> }
                                  {{ lead.brandName || '—' }}
                                </div>
                              </div>
                              <div><div class="eyebrow">Business Type</div><div class="font-semibold text-ink mt-0.5">{{ lead.businessTypeName || '—' }}</div></div>
                            </div>
                          </div>
                          <div class="card p-4 space-y-3">
                            <h3 class="eyebrow">Company Information</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                              <div><div class="eyebrow">Industry</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.industry || '—' }}</div></div>
                              <div><div class="eyebrow">Company Size</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.size || '—' }}</div></div>
                              <div><div class="eyebrow">Annual Revenue</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.annualRevenue || '—' }}</div></div>
                              <div><div class="eyebrow">Offices Count</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.officesCount || '—' }}</div></div>
                              <div class="col-span-2"><div class="eyebrow">Address</div><div class="font-semibold text-ink mt-0.5">{{ lead.company?.address || '—' }}, {{ lead.company?.city || '—' }}, {{ lead.company?.country || '—' }}</div></div>
                            </div>
                          </div>
                          <div class="card p-4 space-y-3">
                            <h3 class="eyebrow">Origin & Marketing Campaign</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                              <div><div class="eyebrow">Origin</div><div class="font-semibold text-ink mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div></div>
                              <div><div class="eyebrow">Campaign</div><div class="font-semibold text-ink mt-0.5">{{ lead.campaigns?.[0]?.campaign || '—' }}</div></div>
                              @if (lead.campaigns?.[0]?.referralPartner) { <div><div class="eyebrow">Referral Partner</div><div class="font-semibold text-ink mt-0.5">{{ lead.campaigns?.[0]?.referralPartner }}</div></div> }
                              @if (lead.campaigns?.[0]?.tradeShow) { <div><div class="eyebrow">Trade Show</div><div class="font-semibold text-ink mt-0.5">{{ lead.campaigns?.[0]?.tradeShow }}</div></div> }
                            </div>
                          </div>
                          <div class="card p-4 space-y-3">
                            <h3 class="eyebrow">Key Stakeholders (B2B)</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                              <div><div class="eyebrow">Decision Maker</div><div class="font-semibold text-ink mt-0.5">{{ lead.decisionMaker || '—' }}</div></div>
                              <div><div class="eyebrow">Influencer</div><div class="font-semibold text-ink mt-0.5">{{ lead.influencer || '—' }}</div></div>
                              <div><div class="eyebrow">Finance Contact</div><div class="font-semibold text-ink mt-0.5">{{ lead.financeContact || '—' }}</div></div>
                              <div><div class="eyebrow">Technical Contact</div><div class="font-semibold text-ink mt-0.5">{{ lead.technicalContact || '—' }}</div></div>
                            </div>
                          </div>
                          <div class="card p-4 space-y-3">
                            <h3 class="eyebrow">Audit Trail</h3>
                            <div class="grid grid-cols-2 gap-4 text-meta text-ink-3">
                              <div><div>Created By</div><div class="mt-0.5"><app-created-by-badge [createdBy]="lead.createdBy" [createdAt]="lead.createdDate" /></div></div>
                              <div><div>Modified Date</div><div class="font-semibold text-ink-2 mt-0.5">{{ lead.modifiedDate }} by <app-user-avatar [userId]="lead.modifiedBy" [size]="20" /> {{ getUserName(lead.modifiedBy) }}</div></div>
                            </div>
                          </div>
                        </div>
                      }

                      @if (activeDetailTab() === 'activities') {
                        <div class="space-y-6">
                          <div class="card p-4 space-y-3 text-sm">
                            <h3 class="eyebrow">Lead Qualification & Sales Potential</h3>
                            <div class="grid grid-cols-2 gap-4">
                              <div><div class="eyebrow">Interested Product</div><div class="font-semibold text-ink mt-0.5">{{ lead.productInterests?.[0]?.product || '—' }}</div></div>
                              <div><div class="eyebrow">Solution</div><div class="font-semibold text-ink-2 mt-0.5">{{ lead.productInterests?.[0]?.solution || '—' }}</div></div>
                              <div><div class="eyebrow">Origin</div><div class="font-semibold text-ink mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div></div>
                              <div><div class="eyebrow">Deal Probability</div><div class="font-semibold text-ink-2 mt-0.5">{{ lead.probability || '0' }}%</div></div>
                            </div>
                          </div>
                          <div class="space-y-2">
                            <label for="notes_comments" class="field-label">Notes & Comments</label>
                            <div class="card p-4 text-sm text-ink-2 leading-relaxed whitespace-pre-line">
                              {{ lead.notes || 'No notes added for this lead yet.' }}
                            </div>
                          </div>
                          <div class="card p-4 space-y-3">
                            <h3 class="eyebrow">Log New Activity</h3>
                            <div class="grid grid-cols-2 gap-3">
                              <div><label for="type" class="field-label mb-1.5">Type</label>
                                <select id="type" [(ngModel)]="newActivity.type" class="input-field w-full">
                                  <option value="Call">Call</option><option value="Email">Email</option><option value="Meeting">Meeting</option><option value="Note">Note</option><option value="Task">Task</option>
                                </select></div>
                              <div><label for="date" class="field-label mb-1.5">Date</label>
                                <input id="date" [(ngModel)]="newActivity.date" type="date" class="input-field w-full"></div>
                            </div>
                            <div><label for="summary" class="field-label mb-1.5">Summary</label>
                              <input id="summary" [(ngModel)]="newActivity.summary" type="text" placeholder="e.g. Discussed pricing options" class="input-field w-full"></div>
                            <div><label for="details_optional" class="field-label mb-1.5">Details (Optional)</label>
                              <textarea id="details_optional" [(ngModel)]="newActivity.detail" rows="2" placeholder="More detailed recap..." class="input-field w-full"></textarea></div>
                            <div class="flex justify-end pt-2">
                              <button (click)="submitActivity(lead.id)" class="btn-primary btn-sm">Log Activity</button>
                            </div>
                          </div>
                          <div class="space-y-4">
                            <h3 class="eyebrow">Interactions Timeline</h3>
                            <div class="space-y-4">
                              @for (act of lead.activities; track act.id) {
                                <div class="flex gap-4 items-start border-l-2 border-line-soft pl-4 relative">
                                  <div class="absolute -left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-line-soft flex items-center justify-center" [class]="getActivityIconClass(act.type)"></div>
                                  <div class="flex-1 space-y-1">
                                    <div class="flex justify-between items-center">
                                      <span class="text-xs font-semibold text-ink">{{ act.summary }}</span>
                                      <span class="text-meta text-ink-3 font-medium">{{ act.date }}</span>
                                    </div>
                                    @if (act.detail) { <p class="text-xs text-ink-3 leading-relaxed">{{ act.detail }}</p> }
                                    <div class="text-meta font-semibold text-ink-3 flex items-center gap-1">
                                      <span class="badge">{{ act.type }}</span>
                                      @if (act.assignedTo) { <span>Assigned: {{ act.assignedTo }}</span> }
                                    </div>
                                  </div>
                                </div>
                              } @empty { <p class="text-xs text-ink-3 text-center py-4">No logged interactions yet.</p> }
                            </div>
                          </div>
                        </div>
                      }

                      @if (activeDetailTab() === 'attachments') {
                        <div class="space-y-6">
                          <div class="card p-4 space-y-3">
                            <h3 class="eyebrow">Upload Document</h3>
                            <div class="flex gap-3 items-center">
                              <input type="file" (change)="onFileSelected($event, lead.id)" class="flex-1 text-xs">
                              @if (uploading()) { <span class="text-meta text-ink-3">Uploading&hellip;</span> }
                            </div>
                          </div>
                          <div class="space-y-3">
                            <h3 class="eyebrow">Uploaded Files</h3>
                            <div class="card divide-y divide-line-soft overflow-hidden">
                              @for (file of lead.attachments; track file.id) {
                                <div class="px-4 py-3 flex justify-between items-center text-xs">
                                  <div class="flex items-center gap-2.5">
                                    <mat-icon class="text-ink-4 icon-md">insert_drive_file</mat-icon>
                                    <div>
                                      <div class="font-semibold text-ink">
                                        @if (file.fileId) {
                                          <a href="" (click)="downloadAttachment($event, file)" class="hover:underline">{{ file.fileName }}</a>
                                        } @else { {{ file.fileName }} }
                                      </div>
                                      <div class="text-meta text-ink-3">Uploaded: {{ file.uploadedAt }} &bull; {{ file.fileSize || 'N/A' }}</div>
                                    </div>
                                  </div>
                                  <button title="Delete attachment" (click)="deleteAttachment(lead.id, file)" class="btn-icon btn-sm"><mat-icon class="icon-sm">delete_outline</mat-icon></button>
                                </div>
                              } @empty { <p class="text-xs text-ink-3 text-center py-6">No attachments uploaded yet.</p> }
                            </div>
                          </div>
                        </div>
                      }

                      @if (activeDetailTab() === 'history') {
                        <div class="space-y-4">
                          <h3 class="eyebrow">Status Transition Log</h3>
                          <div class="space-y-4">
                            @for (hist of lead.statusHistory; track $index) {
                              <div class="flex gap-4 items-start pl-4 border-l-2 border-line-soft relative">
                                <div class="absolute -left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-line-soft bg-muted"></div>
                                <div class="flex-1 text-xs">
                                  <div class="flex justify-between font-semibold text-ink">
                                    <span>Status updated to: {{ hist.status }}</span>
                                    <span class="text-meta text-ink-3 font-medium">{{ hist.timestamp }}</span>
                                  </div>
                                  <div class="text-meta text-ink-3 font-medium mt-0.5">Changed by: {{ hist.user }}</div>
                                </div>
                              </div>
                            } @empty { <p class="text-xs text-ink-3 text-center py-4">No status changes logged.</p> }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Add Lead Modal -->
          @if (addLeadModalOpen()) {
            <div class="modal-backdrop">
              <div class="modal modal-lg">
                <div class="flex justify-between items-center pb-3 border-b border-line-soft">
                  <h3 class="modal-title">Add New Lead Record</h3>
                  <button (click)="addLeadModalOpen.set(false)" class="w-8 h-8 rounded-lg btn-secondary flex items-center justify-center text-ink-3 hover:text-ink-2">
                    <mat-icon class="icon-md">close</mat-icon>
                  </button>
                </div>
                <div class="space-y-4 text-xs">
                  <div class="space-y-2.5">
                    <h4 class="eyebrow">1. Basic Information</h4>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label for="lead_name" class="field-label mb-1.5">Lead Name*</label><input [(ngModel)]="newLead.name" type="text" placeholder="e.g. John Doe" class="input-field w-full"></div>
                      <div><label for="company_name" class="field-label mb-1.5">Company Name*</label><input id="lead_name" [(ngModel)]="newLead.companyName" type="text" placeholder="e.g. Acmo Group" class="input-field w-full"></div>
                      <div><label for="email" class="field-label mb-1.5">Email</label><input id="company_name" [(ngModel)]="newLead.email" type="email" placeholder="e.g. email@acmo.com" class="input-field w-full"></div>
                      <div><label for="phone" class="field-label mb-1.5">Phone</label><input id="email" [(ngModel)]="newLead.phone" type="text" placeholder="e.g. +212-6..." class="input-field w-full"></div>
                    </div>
                  </div>
                  <div class="space-y-2.5">
                    <h4 class="eyebrow">2. Company Information</h4>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label for="industry" class="field-label mb-1.5">Industry</label><input [(ngModel)]="newLead.industry" type="text" placeholder="e.g. Healthcare" class="input-field w-full"></div>
                      <div><label for="company_size" class="field-label mb-1.5">Company Size</label><input id="industry" [(ngModel)]="newLead.companySize" type="text" placeholder="e.g. 200 employees" class="input-field w-full"></div>
                      <div><label for="city" class="field-label mb-1.5">City</label><input id="company_size" [(ngModel)]="newLead.city" type="text" placeholder="Casablanca" class="input-field w-full"></div>
                      <div><label for="country" class="field-label mb-1.5">Country</label><input id="city" [(ngModel)]="newLead.country" type="text" placeholder="Morocco" class="input-field w-full"></div>
                    </div>
                  </div>
                  <div class="space-y-2.5">
                    <h4 class="eyebrow">3. Qualification & Source</h4>
                    <div class="grid grid-cols-3 gap-3">
                      <div><label for="status" class="field-label mb-1.5">Status</label>
                        <select id="status" [(ngModel)]="newLead.status" class="input-field w-full">
                          <option value="New">New</option><option value="Contacted">Contacted</option><option value="Attempted Contact">Attempted Contact</option>
                          <option value="Meeting Scheduled">Meeting Scheduled</option><option value="Qualified">Qualified</option><option value="Proposal Requested">Proposal Requested</option>
                          <option value="Converted">Converted</option><option value="Lost">Lost</option><option value="Disqualified">Disqualified</option>
                        </select></div>
                      <div><label for="priority" class="field-label mb-1.5">Priority</label>
                        <select id="priority" [(ngModel)]="newLead.priority" class="input-field w-full">
                          <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                        </select></div>
                      <div><label for="temperature" class="field-label mb-1.5">Temperature</label>
                        <select id="temperature" [(ngModel)]="newLead.temperature" class="input-field w-full">
                          <option value="Cold">Cold</option><option value="Warm">Warm</option><option value="Hot">Hot</option>
                        </select></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label for="origin" class="field-label mb-1.5">Origin</label>
                        <select id="origin" [(ngModel)]="newLead.origin" class="input-field w-full">
                          <option value="Landing Page">Landing Page</option>
                          <option value="Marketing Campaign">Marketing Campaign</option>
                          <option value="Email">Email</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div><label for="assigned_salesperson" class="field-label mb-1.5">Assigned Salesperson</label>
                        <select id="assigned_salesperson" [(ngModel)]="newLead.assignedSalesperson" class="input-field w-full">
                          <option value="">-- Unassigned --</option>
                          @for (user of state.users(); track user.name) {
                            <option [value]="user.name">{{ user.name }} ({{ user.role }})</option>
                          }
                        </select></div>
                    </div>
                  </div>
                  <div class="space-y-2.5">
                    <h4 class="eyebrow">4. Brand & Business Type</h4>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label for="brand" class="field-label mb-1.5">Brand</label>
                        <select id="brand" [(ngModel)]="newLead.brandId" class="input-field w-full">
                          @for (brand of state.brands(); track brand.id) { <option [value]="brand.id">{{ brand.name }}</option> }
                        </select></div>
                      <div><label for="business_type" class="field-label mb-1.5">Business Type</label>
                        <select id="business_type" [(ngModel)]="newLead.businessTypeId" class="input-field w-full">
                          <option value="">-- Not set --</option>
                          @for (bt of state.businessTypes(); track bt.id) { <option [value]="bt.id">{{ bt.name }}</option> }
                        </select></div>
                      <div class="col-span-2"><label for="product_interest" class="field-label mb-1.5">Interested Product</label>
                        <select id="product_interest" [(ngModel)]="newLead.interestedProduct" class="input-field w-full">
                          <option value="">-- Not set --</option>
                          @for (brand of state.brands(); track brand.id) { <option [value]="brand.name">{{ brand.name }}</option> }
                        </select></div>
                    </div>
                  </div>
                  <div><label for="notes" class="field-label mb-1.5">Notes</label>
                    <textarea id="notes" [(ngModel)]="newLead.notes" rows="3" placeholder="Evaluate legacy systems, downtime concerns, etc." class="input-field w-full"></textarea></div>
                </div>
                <div class="flex justify-end gap-2 pt-3 border-t border-line-soft text-xs">
                  <button (click)="addLeadModalOpen.set(false)" class="px-4 py-2 btn-secondary rounded-lg text-ink-2 font-semibold">Cancel</button>
                  <button (click)="saveLead()" class="btn-primary">Save Lead Record</button>
                </div>
              </div>
            </div>
          }
        } @else {
          <!-- View toggle (cards / table) for non-Lead tabs -->
          <div class="toolbar">
            <div class="segmented" role="group" aria-label="Directory view">
              <button class="segmented__item" [class.is-active]="partnerView() === 'cards'" [attr.aria-pressed]="partnerView() === 'cards'" (click)="partnerView.set('cards')" title="Card view">
                <mat-icon>grid_view</mat-icon>
                Cards
              </button>
              <button class="segmented__item" [class.is-active]="partnerView() === 'table'" [attr.aria-pressed]="partnerView() === 'table'" (click)="partnerView.set('table')" title="Table view">
                <mat-icon>table_rows</mat-icon>
                Table
              </button>
            </div>
            <span class="toolbar__count toolbar__spacer">{{ filteredPartners().length }} {{ activeTab() }}{{ filteredPartners().length === 1 ? '' : 's' }}</span>
          </div>

          @if (partnerView() === 'table') {
            <!-- Table view for non-Lead tabs -->
            <div class="table-card">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col" class="w-8">
                      <input type="checkbox" [checked]="paginatedPartners().length > 0 && selectedPartnerIds().size === paginatedPartners().length" (change)="toggleSelectAllPartners($event)" class="cursor-pointer" />
                    </th>
                    <th scope="col">{{ activeTab() }}</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created</th>
                    <th scope="col" class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (partner of paginatedPartners(); track partner.id) {
                    <tr>
                      <td class="whitespace-nowrap">
                        <input type="checkbox" [checked]="isPartnerSelected(partner.id)" (change)="togglePartnerSelect(partner.id, $event)" class="cursor-pointer" />
                      </td>
                      <td class="whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <div class="h-8 w-8 bg-muted text-ink font-semibold rounded-lg text-meta flex items-center justify-center shrink-0">
                            {{ partner.name.substring(0, 2).toUpperCase() }}
                          </div>
                          <div class="min-w-0">
                            @if (partner.type === 'Vendor') {
                              <div class="text-xs font-semibold text-ink truncate max-w-[160px]">{{ partner.name }}</div>
                            } @else {
                              <button (click)="openPartnerPrimary(partner)" class="table-name-link text-xs font-semibold text-ink truncate max-w-[160px] block text-left" [title]="partner.type === 'Customer' ? 'View customer card' : 'Convert to customer'">{{ partner.name }}</button>
                            }
                            <div class="text-meta text-ink-3 truncate max-w-[160px]">{{ partner.city || 'No city' }}</div>
                          </div>
                        </div>
                      </td>
                      <td class="whitespace-nowrap">
                        <div class="text-xs text-ink-2 truncate max-w-[180px]">{{ partner.email || '—' }}</div>
                        <div class="text-meta text-ink-3 font-mono">{{ partner.phone || '' }}</div>
                      </td>
                      <td class="whitespace-nowrap">
                        <div class="text-xs text-ink-2 truncate max-w-[130px]">{{ partner.assignedTo ? getUserName(partner.assignedTo) : 'Unassigned' }}</div>
                      </td>
                      <td class="whitespace-nowrap">
                        <span [class]="getPartnerStatusClass(partner.status)" class="badge">
                          {{ partner.status || '—' }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap">
                        <app-created-by-badge [createdBy]="partner.createdBy" [createdAt]="partner.createdAt" />
                      </td>
                      <td class="whitespace-nowrap text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          @if (partner.type === 'Customer') {
                            <button (click)="openCustomerCard(partner.id)" title="View Customer Card" class="btn-icon btn-sm">
                              <mat-icon class="icon-sm">visibility</mat-icon>
                            </button>
                          }
                          @if (partner.type === 'Prospect' && canWrite()) {
                            <button (click)="openConvertModal(partner)" title="Convert to Customer" class="btn-icon btn-sm">
                              <mat-icon class="icon-sm">published_with_changes</mat-icon>
                            </button>
                          }
                          @if (state.currentUserPermissions().canDeleteRecords) {
                            <button (click)="deletePartner(partner)" title="Delete" class="btn-icon btn-sm btn-danger-hover" aria-label="Delete">
                              <mat-icon class="icon-sm">delete</mat-icon>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="row-empty">
                        <app-empty-state icon="groups" [title]="'No ' + activeTab() + 's found'" text="Add one with the button above, or adjust your search." />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
          <!-- Card grid for non-Lead tabs -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (partner of paginatedPartners(); track partner.id) {
              <div class="card p-5 relative flex flex-col justify-between">
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
                <label for="label_20" class="absolute top-3 left-3 z-10" (click)="$event.stopPropagation()">
                  <input id="label_20" type="checkbox" [checked]="isPartnerSelected(partner.id)" (change)="togglePartnerSelect(partner.id, $event)" class="cursor-pointer" />
                </label>
                <div>
                  <div class="flex items-start justify-between mb-4">
                    <div class="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-ink-2">
                      {{partner.name.substring(0,2).toUpperCase()}}
                    </div>
                    <span class="badge"
                      [class]="partner.type === 'Customer' ? 'badge-success' : (partner.type === 'Prospect' ? 'badge-info' : (partner.type === 'Vendor' ? 'badge-violet' : 'badge-neutral'))">
                      {{partner.type}}
                    </span>
                  </div>
                  <h3 class="modal-title truncate mb-1">{{partner.name}}</h3>
                  <span class="badge badge-neutral mb-4">
                    <mat-icon class="mr-1 icon-xs">location_on</mat-icon> {{partner.city || 'Casablanca'}}
                  </span>
                  
                  @if(partner.type === 'Lead') {
                    <div class="flex gap-2 flex-wrap mb-4">
                      @if (partner.score) {
                        <span class="badge" [class]="partner.score > 70 ? 'badge-success' : 'badge-warning'">
                          Score: {{partner.score}}
                        </span>
                      }
                      @if (partner.source) {
                        <span class="badge badge-neutral">
                          {{partner.source}}
                        </span>
                      }
                      @if (partner.assignedTo) {
                        <span class="badge badge-neutral flex items-center gap-1">
                          <mat-icon class="icon-xs">person</mat-icon> {{partner.assignedTo}}
                        </span>
                      }
                    </div>
                  }
                  
                  <div class="space-y-2 mt-2">
                    <div class="flex items-center text-sm text-ink-3">
                      <mat-icon class="mr-2 icon-sm">email</mat-icon>
                      {{partner.email || 'N/A'}}
                    </div>
                    <div class="flex items-center text-sm text-ink-3">
                      <mat-icon class="mr-2 icon-sm">phone</mat-icon>
                      <span class="font-mono">{{partner.phone || 'N/A'}}</span>
                    </div>
                  </div>

                  @if(partner.comments) {
                    <div class="mt-4 pt-4 border-t border-line-soft text-xs text-ink-3">
                      <strong class="text-ink-2">Notes:</strong> {{partner.comments}}
                    </div>
                  }

                  <div class="mt-4 pt-4 border-t border-line-soft">
                    <app-created-by-badge [createdBy]="partner.createdBy" [createdAt]="partner.createdAt" />
                  </div>

                  @let partnerInvoices = getPartnerInvoices(partner.id);
                  @if (partnerInvoices.length > 0) {
                    <div class="mt-4 pt-4 border-t border-line-soft space-y-1.5">
                      <span class="eyebrow">Invoices / الفواتير</span>
                      <div class="space-y-1">
                        @for (inv of partnerInvoices; track inv.id) {
                          <div class="flex justify-between items-center text-xs">
                            <span class="text-ink-2 font-mono">Invoice #{{ inv.id.slice(0, 8) }}</span>
                            <span class="font-semibold" [class]="inv.status === 'Paid' ? 'text-success-ink' : (inv.status === 'Overdue' ? 'text-danger-ink' : 'text-ink')">
                              {{formatCurrency(inv.amount)}} ({{inv.status}})
                            </span>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>

                <div class="mt-6 pt-4 border-t border-line-soft flex gap-2">
                  @if(partner.type === 'Lead' && canWrite()) {
                    <button (click)="state.updatePartner(partner.id, { status: 'prospect' })" class="w-full btn-secondary rounded-xl px-3 py-2 text-sm font-semibold text-ink transition-all flex items-center justify-center">
                      <mat-icon class="mr-2 icon-sm">arrow_forward</mat-icon>
                      Convert to Prospect
                    </button>
                  }
                  @if(partner.type === 'Prospect' && canWrite()) {
                    <button (click)="openConvertModal(partner)" class="w-full btn-secondary rounded-xl px-3 py-2 text-sm font-semibold text-ink transition-all flex items-center justify-center">
                      <mat-icon class="mr-2 icon-sm">published_with_changes</mat-icon>
                      Convert to Customer
                    </button>
                  }
                  @if(partner.type === 'Customer') {
                    <button (click)="openCustomerCard(partner.id)" class="btn-secondary btn-block">
                      <mat-icon class="mr-2 icon-sm">visibility</mat-icon>
                      View Customer Card
                    </button>
                  }
                  @if (state.currentUserPermissions().canDeleteRecords) {
                    <button (click)="deletePartner(partner)" title="Delete" class="btn-icon btn-sm btn-danger-hover shrink-0">
  <mat-icon class="icon-sm">delete</mat-icon>
</button>
                  }
                </div>
              </div>
            } @empty {
              <div class="col-span-full text-center py-12 text-ink-3">
                No {{activeTab()}}s found in the directory.
              </div>
            }
          </div>
          }

          @if (filteredPartners().length > 0) {
            <app-paginator
              [currentPage]="partnersPage()"
              [totalPages]="partnersTotalPages()"
              [pageSize]="partnersPageSize()"
              (pageChange)="partnersPage.set($event)"
              (pageSizeChange)="partnersPageSize.set($event)" />
          }

          @if (selectedPartnerIds().size > 0) {
            <div class="bulk-action-bar">
              <span class="font-semibold">{{ selectedPartnerIds().size }} selected</span>
              <div class="bulk-action-bar__sep"></div>
              <select (change)="bulkAssignPartnerOwner($event)">
                <option value="">Assign owner…</option>
                @for (u of state.users(); track u.id) { <option [value]="u.name">{{u.name}}</option> }
              </select>
              <select (change)="bulkChangePartnerStage($event)">
                <option value="">Change stage…</option>
                @for (s of partnerStatusOptions; track s) { <option [value]="s">{{s}}</option> }
              </select>
              <button class="bulk-action-bar__btn" (click)="bulkExportPartners()">Export CSV</button>
              <button class="bulk-action-bar__btn is-quiet" (click)="clearPartnerSelection()">Clear</button>
            </div>
          }

          <!-- Create Partner Modal -->
          @if (showCreateModal()) {
            <div class="modal-backdrop">
              <div class="modal modal-md">
                <div class="flex justify-between items-center pb-2 border-b border-line-soft">
                  <h3 class="modal-title">Add New {{newPartner.type}}</h3>
                  <button (click)="showCreateModal.set(false)" class="w-8 h-8 rounded-lg btn-secondary flex items-center justify-center text-ink-3 hover:text-ink-2">
                    <mat-icon class="icon-md">close</mat-icon>
                  </button>
                </div>
                
                <form (ngSubmit)="savePartner()" class="space-y-4">
                  <div>
                    <label for="partner_type" class="field-label mb-1.5">Partner Type</label>
                    <select id="partner_type" [(ngModel)]="newPartner.type" name="type" class="input-field w-full">
                      <option value="Lead">Lead</option>
                      <option value="Prospect">Prospect</option>
                      <option value="Customer">Customer</option>
                      <option value="Vendor">Vendor</option>
                    </select>
                  </div>

                  <div>
                    <label for="company_contact_name" class="field-label mb-1.5">Company / Contact Name</label>
                    <input id="company_contact_name" [(ngModel)]="newPartner.name" name="name" type="text" placeholder="e.g. Casablanca Technologies" required class="input-field w-full">
                  </div>

                  <div>
                    <label for="email" class="field-label mb-1.5">Email</label>
                    <input id="email" [(ngModel)]="newPartner.email" name="email" type="email" placeholder="e.g. contact@domain.ma" class="input-field w-full">
                  </div>

                  <div>
                    <label for="phone" class="field-label mb-1.5">Phone</label>
                    <input id="phone" [(ngModel)]="newPartner.phone" name="phone" type="text" placeholder="e.g. +212-522-XXXXXX" class="input-field w-full">
                  </div>

                  <div>
                    <label for="city" class="field-label mb-1.5">City</label>
                    <select id="city" [(ngModel)]="newPartner.city" name="city" class="input-field w-full">
                      <option value="Casablanca">Casablanca</option>
                      <option value="Rabat">Rabat</option>
                      <option value="Marrakech">Marrakech</option>
                      <option value="Tangier">Tangier</option>
                      <option value="Fès">Fès</option>
                    </select>
                  </div>

                  @if (newPartner.type === 'Customer') {
                    <div>
                      <label for="ice_15_digits" class="field-label mb-1.5">ICE (15 digits) *</label>
                      <input id="ice_15_digits" [(ngModel)]="newPartner.ICE" name="ICE" type="text" maxlength="15" placeholder="e.g. 123456789012345" required class="input-field w-full font-mono">
                    </div>
                    <div>
                      <label for="identifiant_fiscal_i" class="field-label mb-1.5">Identifiant Fiscal (IF) *</label>
                      <input id="identifiant_fiscal_i" [(ngModel)]="newPartner.IF" name="IF" type="text" placeholder="e.g. 12345678" required class="input-field w-full font-mono">
                    </div>
                    <div>
                      <label for="registre_de_commerce" class="field-label mb-1.5">Registre de Commerce (RC) *</label>
                      <input id="registre_de_commerce" [(ngModel)]="newPartner.RC" name="RC" type="text" placeholder="e.g. 123456" required class="input-field w-full font-mono">
                    </div>
                  }

                  @if (newPartner.type === 'Lead') {
                    <div>
                      <label for="lead_score_0_100" class="field-label mb-1.5">Lead Score (0-100)</label>
                      <input id="lead_score_0_100" [(ngModel)]="newPartner.score" name="score" type="number" min="0" max="100" placeholder="e.g. 85" class="input-field w-full">
                    </div>
                    <div>
                      <label for="lead_source" class="field-label mb-1.5">Lead Source</label>
                      <select id="lead_source" [(ngModel)]="newPartner.source" name="source" class="input-field w-full">
                        <option value="Website form">Website form</option>
                        <option value="Trade show">Trade show</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Marketing campaign">Marketing campaign</option>
                        <option value="Referral">Referral</option>
                      </select>
                    </div>
                    <div>
                      <label for="assigned_salesperson" class="field-label mb-1.5">Assigned Salesperson</label>
                      <select id="assigned_salesperson" [(ngModel)]="newPartner.assignedTo" name="assignedTo" class="input-field w-full">
                        <option value="">-- Unassigned --</option>
                        @for (user of state.users(); track user.name) {
                          <option [value]="user.name">{{user.name}} ({{user.team}})</option>
                        }
                      </select>
                    </div>
                  }

                  <div>
                    <label for="comments_notes" class="field-label mb-1.5">Comments / Notes</label>
                    <textarea id="comments_notes" [(ngModel)]="newPartner.comments" name="comments" rows="3" placeholder="Additional details..." class="input-field w-full"></textarea>
                  </div>

                  <div class="flex justify-end gap-2 pt-4 border-t border-line-soft">
                    <button type="button" (click)="showCreateModal.set(false)" class="px-4 py-2 btn-secondary rounded-xl text-ink-2 text-sm font-semibold">Cancel</button>
                    <button type="submit" class="btn-primary">Save Partner</button>
                  </div>
                </form>
              </div>
            </div>
          }
        }
      }

    </div>
  `
})
export class PartnersComponent {
  private notify = inject(ToastService);
  private confirmDialog = inject(ConfirmService);
  state = inject(CrmStateService);
  partnersService = inject(PartnersService);
  api = inject(ApiService);
  router = inject(Router);
  uploading = signal(false);
  activeTab = signal<'Lead' | 'Customer' | 'Prospect' | 'Vendor'>('Lead');
  showCreateModal = signal(false);

  canCreate(): boolean {
    return this.state.hasAuthority('PARTNERS_CREATE');
  }

  canWrite(): boolean {
    return this.state.hasAuthority('PARTNERS_WRITE');
  }

  async deletePartner(partner: { id: string; name: string }) {
    if (!this.state.hasAuthority('PARTNERS_DELETE')) return;
    if (await this.confirmDialog.ask({ title: 'Delete partner?', message: `"${partner.name}" will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete partner', danger: true })) {
      this.state.deletePartner(partner.id);
    }
  }

  // Leads-specific state
  searchQuery = signal('');
  statusFilter = signal('');
  priorityFilter = signal('');
  brandFilter = signal('');
  businessTypeFilter = signal('');
  interestedProductFilter = signal('');
  selectedLead = signal<Lead | null>(null);
  activeDetailTab = signal<'info' | 'activities' | 'attachments' | 'history'>('info');
  activeConvertMenuId = signal<string | null>(null);
  addLeadModalOpen = signal(false);
  pageSize = signal(10);
  currentPage = signal(1);

  // Lead bulk selection
  selectedLeadIds = signal<Set<string>>(new Set());
  leadStatusOptions = ['New','Contacted','Attempted Contact','Meeting Scheduled','Qualified','Proposal Requested','Converted','Lost','Disqualified'];
  leadQualificationOptions: Lead['qualification'][] = ['Qualified','Unqualified','Pending'];

  // Inline table editors state (score slider / owner picker)
  scoreEditFor = signal<string | null>(null);
  scoreDraft = signal<number>(0);
  ownerMenuFor = signal<string | null>(null);
  ownerMenuPos = signal({ x: 0, y: 0 });

  // Partner (Customer/Prospect/Vendor) bulk selection
  selectedPartnerIds = signal<Set<string>>(new Set());
  partnerStatusOptions: ('prospect' | 'active' | 'inactive' | 'archived')[] = ['prospect', 'active', 'inactive', 'archived'];

  newActivity = {
    type: 'Call' as LeadActivity['type'],
    date: new Date().toISOString().split('T')[0],
    summary: '',
    detail: ''
  };

  newLead = {
    name: '',
    companyName: '',
    email: '',
    phone: '',
    industry: '',
    companySize: '',
    city: '',
    country: '',
    status: 'New' as Lead['status'],
    priority: 'Medium' as Lead['priority'],
    temperature: 'Warm' as Lead['temperature'],
    origin: 'Landing Page' as Lead['origin'],
    interestedProduct: '',
    brandId: '',
    businessTypeId: '',
    assignedSalesperson: '',
    notes: ''
  };

  constructor() {
    this.partnersService.load();
    this.state.loadPartners();
    effect(() => {
      const tab = this.state.navigateTab();
      if (tab) {
        this.activeTab.set(tab as 'Lead' | 'Customer' | 'Prospect' | 'Vendor');
        this.state.breadcrumbLabel.set(tab === 'Lead' ? 'Leads' : tab === 'Customer' ? 'Customers' : tab === 'Prospect' ? 'Prospects' : 'Vendors');
        this.state.navigateTab.set(null);
      }
    });
    const label = this.activeTab() === 'Lead' ? 'Leads' : this.activeTab() === 'Customer' ? 'Customers' : this.activeTab() === 'Prospect' ? 'Prospects' : 'Vendors';
    this.state.breadcrumbLabel.set(label);
    effect(() => {
      if (this.currentPage() > this.totalPages()) {
        this.currentPage.set(this.totalPages());
      }
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('click', () => {
        this.activeConvertMenuId.set(null);
      });
    }
    effect(() => {
      const action = this.state.pendingQuickAction();
      if (action?.id === 'new-partner') {
        this.state.partnersSubTab.set('Customer');
        this.activeTab.set('Customer');
        this.openCreateModal();
        this.state.pendingQuickAction.set(null);
      }
    });
  }

  // Derived partner types - keep as computed derived from CrmStateService for now
  // since PartnersService doesn't support type filtering. These will be refactored
  // once PartnersService adds support for partner type/role classification.
  customers = computed(() => this.state.partners().filter(p => p.type === 'Customer'));
  prospects = computed(() => this.state.partners().filter(p => p.type === 'Prospect'));
  vendors = computed(() => this.state.partners().filter(p => p.type === 'Vendor'));

  // Leads KPI computed
  totalLeadsCount = computed(() => this.state.leadsData().length);
  qualifiedLeadsCount = computed(() => this.state.leadsData().filter(l => l.status === 'Qualified').length);
  avgLeadScore = computed(() => {
    const list = this.state.leadsData();
    if (list.length === 0) return 0;
    const total = list.reduce((sum, l) => sum + l.score, 0);
    return Math.round(total / list.length);
  });
  conversionRate = computed(() => {
    const total = this.state.leadsData().length;
    if (total === 0) return 0;
    const converted = this.state.leadsData().filter(l => l.status === 'Converted').length;
    return Math.round((converted / total) * 100);
  });

  // Filtered Leads
  filteredLeads = computed(() => {
    let list = this.state.leadsData();
    if (this.statusFilter()) {
      list = list.filter(l => l.status === this.statusFilter());
    }
    if (this.priorityFilter()) {
      list = list.filter(l => l.priority === this.priorityFilter());
    }
    if (this.brandFilter()) {
      list = list.filter(l => l.brandId === this.brandFilter());
    }
    if (this.businessTypeFilter()) {
      list = list.filter(l => l.businessTypeId === this.businessTypeFilter());
    }
    if (this.interestedProductFilter()) {
      list = list.filter(l => (l.productInterests || []).some(pi => pi.product === this.interestedProductFilter()));
    }
    if (this.searchQuery().trim()) {
      const q = this.searchQuery().toLowerCase();
      list = list.filter(l => 
        l.name.toLowerCase().includes(q) || 
        l.companyName.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      );
    }
    return list;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredLeads().length / this.pageSize())));
  paginatedLeads = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredLeads().slice(start, start + this.pageSize());
  });
  pageStart = computed(() => (this.currentPage() - 1) * this.pageSize() + 1);
  pageEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredLeads().length));

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  // Lead bulk selection
  toggleLeadSelect(id: string, event: Event) {
    event.stopPropagation();
    const next = new Set(this.selectedLeadIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedLeadIds.set(next);
  }

  isLeadSelected(id: string): boolean {
    return this.selectedLeadIds().has(id);
  }

  toggleSelectAllLeads(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedLeadIds.set(new Set(this.paginatedLeads().map(l => l.id)));
    } else {
      this.selectedLeadIds.set(new Set());
    }
  }

  clearLeadSelection() {
    this.selectedLeadIds.set(new Set());
  }

  bulkAssignLeadOwner(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (!value) return;
    const ids = this.selectedLeadIds();
    for (const id of ids) {
      this.state.assignLead(id, value);
    }
    select.value = '';
  }

  bulkChangeLeadStage(event: Event) {
    const value = (event.target as HTMLSelectElement).value as Lead['status'];
    if (!value) return;
    const ids = this.selectedLeadIds();
    for (const id of ids) {
      this.state.updateLeadStatus(id, value);
    }
    (event.target as HTMLSelectElement).value = '';
  }

  bulkExportLeads() {
    const ids = this.selectedLeadIds();
    const rows = this.state.leadsData().filter(l => ids.has(l.id));
    const header = ['Name', 'Company', 'Status', 'Score', 'Owner'];
    const csvRows = [header.join(',')];
    for (const l of rows) {
      const cells = [l.name, l.companyName, l.status, String(l.score), l.assignedSalesperson || ''];
      csvRows.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
    }
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  openLeadDetail(lead: Lead) {
    this.router.navigate(['/partners/lead', lead.id]);
  }

  openCreateModal() {
    if (!this.canCreate()) return;
    this.newPartner.id = undefined;
    this.newPartner.type = this.activeTab();
    this.showCreateModal.set(true);
  }

  openConvertModal(partner: Partner | Lead) {
    if (!this.canWrite()) return;
    this.newPartner = {
      id: partner.id,
      name: partner.name,
      type: 'Customer',
      email: partner.email || '',
      phone: partner.phone || '',
      city: partner.city || 'Casablanca',
      comments: partner.comments || '',
      ICE: '',
      IF: '',
      RC: '',
      score: undefined,
      source: 'Website form',
      assignedTo: ''
    };
    this.showCreateModal.set(true);
  }

  openCustomerCard(partnerId: string) {
    this.router.navigate(['/partners', partnerId, 'customer-card']);
  }

  /** Table-view name click: same primary destination as the card's main button. Vendors have no detail view. */
  openPartnerPrimary(partner: Partner | Lead) {
    if (partner.type === 'Customer') this.openCustomerCard(partner.id);
    else if (partner.type === 'Prospect') this.openConvertModal(partner);
  }

  getPartnerStatusClass(status?: string): string {
    switch (status) {
      case 'active': return 'badge-success';
      case 'prospect': return 'badge-info';
      case 'inactive': return 'bg-muted text-ink-2 border-line';
      case 'archived': return 'bg-muted text-ink-3 border-line';
      default: return 'bg-muted text-ink-2 border-line';
    }
  }

  newPartner = {
    id: '' as string | undefined,
    name: '',
    type: 'Lead' as 'Lead' | 'Prospect' | 'Customer' | 'Vendor',
    email: '',
    phone: '',
    city: 'Casablanca',
    comments: '',
    ICE: '',
    IF: '',
    RC: '',
    score: undefined as number | undefined,
    source: 'Website form' as 'Website form' | 'Trade show' | 'LinkedIn' | 'Marketing campaign' | 'Referral',
    assignedTo: ''
  };

  filteredPartners = () => {
    if (this.activeTab() === 'Lead') {
      return this.state.leadsData();
    }
    // Note: Using state.partners() for type-based filtering since PartnersService
    // Partner model doesn't include type field. For full PartnersService integration,
    // the service should be extended to support partner type/role classification.
    return this.state.partners().filter(p => p.type === this.activeTab());
  };

  partnersPage = signal(1);
  partnersPageSize = signal(20);
  /** Cards vs table layout for the Customer/Prospect/Vendor tabs. */
  partnerView = signal<'cards' | 'table'>('cards');  partnersTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredPartners().length / this.partnersPageSize())));
  paginatedPartners = computed(() => {
    const start = (this.partnersPage() - 1) * this.partnersPageSize();
    return this.filteredPartners().slice(start, start + this.partnersPageSize());
  });

  getPartnerInvoices(partnerId: string) {
    return this.state.invoices().filter(i => i.partnerId === partnerId);
  }

  formatCurrency(value: number) {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(value);
  }

  // Partner (Customer/Prospect/Vendor) bulk selection
  togglePartnerSelect(id: string, event: Event) {
    event.stopPropagation();
    const next = new Set(this.selectedPartnerIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedPartnerIds.set(next);
  }

  isPartnerSelected(id: string): boolean {
    return this.selectedPartnerIds().has(id);
  }

  toggleSelectAllPartners(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedPartnerIds.set(new Set(this.paginatedPartners().map(p => p.id)));
    } else {
      this.selectedPartnerIds.set(new Set());
    }
  }

  clearPartnerSelection() {
    this.selectedPartnerIds.set(new Set());
  }

  bulkAssignPartnerOwner(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) return;
    const ids = this.selectedPartnerIds();
    for (const id of ids) {
      this.state.updatePartner(id, { assignedTo: value });
    }
    (event.target as HTMLSelectElement).value = '';
  }

  bulkChangePartnerStage(event: Event) {
    const value = (event.target as HTMLSelectElement).value as Partner['status'];
    if (!value) return;
    const ids = this.selectedPartnerIds();
    for (const id of ids) {
      this.state.updatePartner(id, { status: value });
    }
    (event.target as HTMLSelectElement).value = '';
  }

  bulkExportPartners() {
    const ids = this.selectedPartnerIds();
    const rows = this.state.partners().filter(p => ids.has(p.id));
    const header = ['Name', 'Type', 'Status', 'Email', 'Phone'];
    const csvRows = [header.join(',')];
    for (const p of rows) {
      const cells = [p.name, p.type, p.status || '', p.email || '', p.phone || ''];
      csvRows.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
    }
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'partners-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  savePartner() {
    const allowed = this.newPartner.id ? this.canWrite() : this.canCreate();
    if (allowed && this.newPartner.name.trim()) {
      if (this.newPartner.type === 'Customer') {
        if (!this.newPartner.ICE || this.newPartner.ICE.length !== 15) { this.notify.show('ICE must be exactly 15 digits.', { type: 'warning' }); return; }
        if (!this.newPartner.IF || !this.newPartner.IF.trim()) { this.notify.show('IF is required.', { type: 'warning' }); return; }
        if (!this.newPartner.RC || !this.newPartner.RC.trim()) { this.notify.show('RC is required.', { type: 'warning' }); return; }
      }

      if (this.newPartner.id) {
        this.state.updatePartner(this.newPartner.id, { status: 'active' });
      } else {
        const fiscal = this.newPartner.type === 'Customer'
          ? { ice: this.newPartner.ICE, ifField: this.newPartner.IF, rc: this.newPartner.RC }
          : undefined;
        this.state.addPartner({
          type: this.newPartner.type,
          name: this.newPartner.name,
          email: this.newPartner.email,
          phone: this.newPartner.phone,
          city: this.newPartner.city,
          comments: this.newPartner.comments,
          status: 'active'
        } as Omit<Partner, 'id' | 'createdAt' | 'createdBy'>, fiscal);
      }

      this.activeTab.set(this.newPartner.type);
      this.showCreateModal.set(false);
      this.newPartner = {
        id: undefined,
        name: '',
        type: 'Lead',
        email: '',
        phone: '',
        city: 'Casablanca',
        comments: '',
        ICE: '',
        IF: '',
        RC: '',
        score: undefined,
        source: 'Website form',
        assignedTo: ''
      };
    }
  }

  // Leads methods
  toggleConvertMenu(leadId: string, event: Event) {
    event.stopPropagation();
    if (this.activeConvertMenuId() === leadId) {
      this.activeConvertMenuId.set(null);
    } else {
      this.activeConvertMenuId.set(leadId);
    }
  }

  markLeadAsLost(lead: Lead) {
    if (!this.canWrite()) return;
    this.state.updateLeadStatus(lead.id, 'Lost');
  }

  convertLeadToProspect(lead: Lead) {
    if (!this.canWrite()) return;
    this.state.convertLeadDataToProspect(lead);
  }

  selectLead(lead: Lead) {
    this.selectedLead.set(lead);
    this.state.loadLeadDetails(lead.id);
    this.activeDetailTab.set('info');
    this.newActivity = {
      type: 'Call',
      date: new Date().toISOString().split('T')[0],
      summary: '',
      detail: ''
    };
  }

  closeDetails() {
    this.selectedLead.set(null);
  }

  onStatusChange(leadId: string, status: Lead['status']) {
    this.state.updateLeadStatus(leadId, status);
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) {
      this.selectedLead.set(updated);
    }
  }

  submitActivity(leadId: string) {
    if (!this.canWrite() || !this.newActivity.summary.trim()) return;
    this.state.addLeadActivity(leadId, {
      type: this.newActivity.type,
      date: this.newActivity.date,
      summary: this.newActivity.summary,
      detail: this.newActivity.detail,
      assignedTo: 'Achraf (Manager)'
    });
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) {
      this.selectedLead.set(updated);
    }
    this.newActivity = {
      type: 'Call',
      date: new Date().toISOString().split('T')[0],
      summary: '',
      detail: ''
    };
  }

  onFileSelected(event: Event, leadId: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.canWrite()) return;
    if (!this.state.isPersistedPartnerId(leadId)) {
      // Lead not yet persisted (local-only id): keep the attachment local-only.
      this.state.addLeadAttachment(leadId, {
        fileName: file.name,
        fileSize: this.formatFileSize(file.size),
        uploadedAt: new Date().toISOString().split('T')[0]
      });
      input.value = '';
      return;
    }
    this.uploading.set(true);
    this.api.uploadFile(file, 'PARTNER', leadId).subscribe({
      next: (dto) => {
        this.uploading.set(false);
        this.state.addLeadAttachment(leadId, {
          fileName: dto.fileName,
          fileSize: this.formatFileSize(dto.sizeBytes),
          uploadedAt: new Date().toISOString().split('T')[0],
          fileId: dto.id
        });
        const updated = this.state.leadsData().find(l => l.id === leadId);
        if (updated) {
          this.selectedLead.set(updated);
        }
        input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        input.value = '';
      }
    });
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  downloadAttachment(event: Event, file: LeadAttachment): void {
    event.preventDefault();
    if (!file.fileId) return;
    this.api.downloadStoredFile(file.fileId).subscribe({
      next: (blob) => this.api.downloadBlob(blob, file.fileName),
      error: () => { /* handle error */ }
    });
  }

  deleteAttachment(leadId: string, file: LeadAttachment) {
    if (!this.canWrite()) return;
    this.state.removeLeadAttachment(leadId, file.id);
    if (file.fileId) {
      this.api.deleteFile(file.fileId).subscribe({ error: () => { /* handle error */ } });
    }
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) {
      this.selectedLead.set(updated);
    }
  }

  openAddLeadModal() {
    if (!this.canCreate()) return;
    this.newLead = {
      name: '',
      companyName: '',
      email: '',
      phone: '',
      industry: '',
      companySize: '',
      city: '',
      country: '',
      status: 'New',
      priority: 'Medium',
      temperature: 'Warm',
      origin: 'Landing Page',
      interestedProduct: '',
      brandId: this.state.brands().find(b => b.isDefault)?.id || this.state.brands()[0]?.id || '',
      businessTypeId: '',
      assignedSalesperson: this.state.users()[0]?.name || '',
      notes: ''
    };
    this.addLeadModalOpen.set(true);
  }

  saveLead() {
    if (!this.canCreate()) return;
    if (!this.newLead.name.trim() || !this.newLead.companyName.trim()) {
      this.notify.show('Lead name and company name are required.', { type: 'warning' });
      return;
    }
    const randomScore = Math.floor(Math.random() * 40) + 50;
    const assignee = this.state.users().find(u => u.name === this.newLead.assignedSalesperson);
    this.state.addLead({
      name: this.newLead.name,
      companyName: this.newLead.companyName,
      status: this.newLead.status,
      qualification: this.newLead.status === 'Qualified' ? 'Qualified' : 'Pending',
      priority: this.newLead.priority,
      origin: this.newLead.origin,
      score: randomScore,
      temperature: this.newLead.temperature,
      stage: 'Discovery Meeting',
      assignedSalesperson: this.newLead.assignedSalesperson,
      assignedToUserId: assignee?.id,
      salesTeam: 'Enterprise Sales',
      territory: this.newLead.country || 'International',
      businessUnit: 'Cloud Solutions',
      decisionMaker: 'IT Manager',
      probability: this.newLead.status === 'Qualified' ? 70 : 30,
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: this.newLead.notes,
      brandId: this.newLead.brandId || undefined,
      businessTypeId: this.newLead.businessTypeId || undefined,
      company: {
        industry: this.newLead.industry,
        size: this.newLead.companySize,
        city: this.newLead.city,
        country: this.newLead.country,
        address: 'Main Office Address'
      },
      contacts: [
        {
          id: 'lc-' + Date.now(),
          name: this.newLead.name,
          email: this.newLead.email,
          phone: this.newLead.phone,
          mobile: this.newLead.phone
        }
      ],
      campaigns: [
        {
          source: this.newLead.origin ?? '',
          campaign: 'General Lead Capture'
        }
      ],
      productInterests: this.newLead.interestedProduct
        ? [{ product: this.newLead.interestedProduct, solution: 'Cloud Solution Integration' }]
        : []
    });
    this.addLeadModalOpen.set(false);
  }

  // Helpers
  getInitials(name: string): string {
    if (!name) return 'LD';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getQualificationClass(qualification: string): string {
    switch (qualification) {
      case 'Qualified': return 'badge-success';
      case 'Unqualified': return 'badge-danger';
      default: return 'badge-warning';
    }
  }

  // Inline table editors (qualification / score / owner)
  onQualificationChange(leadId: string, value: Lead['qualification']) {
    if (!this.canWrite()) return;
    this.state.updateLead(leadId, { qualification: value });
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) this.selectedLead.set(updated);
  }

  openScoreEditor(lead: Lead, event: Event) {
    event.stopPropagation();
    if (!this.canWrite()) return;
    this.scoreDraft.set(lead.score);
    this.scoreEditFor.set(lead.id);
  }

  commitScore(leadId: string) {
    this.state.updateLead(leadId, { score: this.scoreDraft() });
    this.scoreEditFor.set(null);
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) this.selectedLead.set(updated);
  }

  openOwnerMenu(lead: Lead, event: MouseEvent) {
    event.stopPropagation();
    if (!this.canWrite()) return;
    const width = 256;
    const height = 300;
    const x = Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8));
    const below = event.clientY + 12;
    const y = below + height > window.innerHeight - 8 ? Math.max(8, event.clientY - height - 8) : below;
    this.ownerMenuPos.set({ x, y });
    this.scoreEditFor.set(null);
    this.ownerMenuFor.set(lead.id);
  }

  closeOwnerMenu() {
    this.ownerMenuFor.set(null);
  }

  chooseOwner(leadId: string, userId: string | null) {
    this.state.assignLead(leadId, userId);
    this.ownerMenuFor.set(null);
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) this.selectedLead.set(updated);
  }

  memberTeamName(user: CrmUser): string {
    return this.state.teams().find(t => t.id === user.teamId)?.name || '';
  }

  getUserName(userId: string): string {
    return this.state.users().find(u => u.id === userId)?.displayName || userId;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'New': return 'bg-muted text-ink-2';
      case 'Contacted': return 'badge-info';
      case 'Attempted Contact': return 'badge-info';
      case 'Meeting Scheduled': return 'badge-violet';
      case 'Qualified': return 'badge-violet';
      case 'Proposal Requested': return 'badge-violet';
      case 'Converted': return 'badge-success';
      case 'Lost': return 'badge-danger';
      case 'Disqualified': return 'badge-danger';
      default: return 'bg-muted text-ink';
    }
  }

  getPriorityBadge(priority: string): string {
    switch(priority) {
      case 'High': return 'badge-danger';
      case 'Medium': return 'badge-warning';
      case 'Low': return 'bg-subtle text-ink-2 border border-line-soft';
      default: return 'bg-subtle text-ink-2';
    }
  }

  getTempBadge(temp: string): string {
    switch(temp) {
      case 'Hot': return 'badge-danger';
      case 'Warm': return 'badge-warning';
      case 'Cold': return 'badge-info';
      default: return 'bg-subtle text-ink-2';
    }
  }

  getScoreColor(score: number): string {
    if (score >= 80) return 'bg-success';
    if (score >= 50) return 'bg-warning';
    return 'bg-ink-4';
  }

  getActivityIconClass(type: string): string {
    switch(type) {
      case 'Call': return 'bg-ink-2 border-line-strong';
      case 'Email': return 'bg-ink-2 border-line-strong';
      case 'Meeting': return 'bg-ink-2 border-line-strong';
      case 'Task': return 'bg-ink-2 border-line-strong';
      default: return 'bg-ink-3 border-line';
    }
  }
}
