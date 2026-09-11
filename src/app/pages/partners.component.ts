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

@Component({
  selector: 'app-partners',
  imports: [MatIconModule, CommonModule, FormsModule, CreatedByBadgeComponent, UserAvatarComponent, DataStatusBannerComponent, PaginatorComponent],
  template: `
    <div class="space-y-8">
      @if (state.partnersLoading()) {
        @if (activeTab() === 'Lead') {
          <app-data-status-banner [loading]="true" [variant]="'rows'" [columns]="10" [rows]="8" />
        } @else {
          <app-data-status-banner [loading]="true" [variant]="'tiles'" [tiles]="6" />
        }
      }
      @if (state.partnersError()) {
        <app-data-status-banner [error]="state.partnersError()" />
      }
      <div class="flex gap-5 sm:gap-6 border-b border-zinc-200">
        <button
          (click)="activeTab.set('Lead'); state.breadcrumbLabel.set('Leads')"
          [class]="activeTab() === 'Lead' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">filter_alt</mat-icon>
          Leads
          <span class="text-xs">{{ state.leadsData().length }}</span>
        </button>
        <button
          (click)="activeTab.set('Customer'); state.breadcrumbLabel.set('Customers'); partnersPage.set(1)"
          [class]="activeTab() === 'Customer' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">people</mat-icon>
          Customers
          <span class="text-xs">{{ customers().length }}</span>
        </button>
        <button
          (click)="activeTab.set('Prospect'); state.breadcrumbLabel.set('Prospects'); partnersPage.set(1)"
          [class]="activeTab() === 'Prospect' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">person_search</mat-icon>
          Prospects
          <span class="text-xs">{{ prospects().length }}</span>
        </button>
        <button
          (click)="activeTab.set('Vendor'); state.breadcrumbLabel.set('Vendors'); partnersPage.set(1)"
          [class]="activeTab() === 'Vendor' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">store</mat-icon>
          Vendors
          <span class="text-xs">{{ vendors().length }}</span>
        </button>
      </div>

      <!-- Page Header actions -->
      <div class="flex justify-end">
        @if (canCreate()) {
        @if (activeTab() === 'Lead') {
          <button (click)="openAddLeadModal()" class="bg-zinc-900 hover:bg-zinc-950 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-zinc-300">
            <mat-icon class="w-5 h-5 text-[20px]! leading-none! flex items-center justify-center">add</mat-icon>
            Add New Lead
          </button>
        } @else {
          <button (click)="openCreateModal()" class="bg-zinc-900 hover:bg-zinc-950 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-zinc-300">
            <mat-icon class="w-5 h-5 text-[20px]! leading-none! flex items-center justify-center">person_add</mat-icon>
            New {{activeTab()}}
          </button>
        }
        }
      </div>

      @if (!state.partnersLoading()) {
        @if (activeTab() === 'Lead') {
          <!-- Leads Management -->
          <div class="space-y-6">
            <!-- KPI Metrics Dashboard -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="card rounded-2xl p-4 lg:p-5 flex items-center justify-between">
                <div class="space-y-1">
                  <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Leads</span>
                  <div class="text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 truncate">{{ totalLeadsCount() }}</div>
                </div>
                <div class="p-3 icon-badge-primary rounded-xl">
                  <mat-icon class="w-6 h-6 text-[24px]! leading-none!">people_outline</mat-icon>
                </div>
              </div>
              <div class="card rounded-2xl p-4 lg:p-5 flex items-center justify-between">
                <div class="space-y-1">
                  <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Qualified Leads</span>
                  <div class="text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 truncate">{{ qualifiedLeadsCount() }}</div>
                </div>
                <div class="p-3 icon-badge-primary rounded-xl">
                  <mat-icon class="w-6 h-6 text-[24px]! leading-none!">verified_user</mat-icon>
                </div>
              </div>
              <div class="card rounded-2xl p-4 lg:p-5 flex items-center justify-between">
                <div class="space-y-1">
                  <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Avg Lead Score</span>
                  <div class="text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 truncate">{{ avgLeadScore() }}%</div>
                </div>
                <div class="p-3 icon-badge-primary rounded-xl">
                  <mat-icon class="w-6 h-6 text-[24px]! leading-none!">star_outline</mat-icon>
                </div>
              </div>
              <div class="card rounded-2xl p-4 lg:p-5 flex items-center justify-between">
                <div class="space-y-1">
                  <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Conversion Rate</span>
                  <div class="text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 truncate">{{ conversionRate() }}%</div>
                </div>
                <div class="p-3 icon-badge-primary rounded-xl">
                  <mat-icon class="w-6 h-6 text-[24px]! leading-none!">trending_up</mat-icon>
                </div>
              </div>
            </div>

            <!-- Filters & Data Table -->
            <div class="card rounded-2xl overflow-hidden">
              <div class="p-5 border-b border-white/30 flex flex-wrap gap-4 items-center justify-between">
                <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <div class="relative flex-1 sm:w-64">
                    <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 pointer-events-none">
                      <mat-icon class="w-5 h-5 text-[20px]!">search</mat-icon>
                    </span>
                    <input
                      [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event); currentPage.set(1)"
                      type="text"
                      placeholder="Search name, company..."
                      class="w-full input-field rounded-xl pl-10! pr-4! py-2! text-sm outline-none placeholder:text-zinc-400"
                    >
                  </div>
                  <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); currentPage.set(1)" class="input-field rounded-xl px-3 py-2 text-sm outline-none bg-transparent">
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
                  <select [ngModel]="priorityFilter()" (ngModelChange)="priorityFilter.set($event); currentPage.set(1)" class="input-field rounded-xl px-3 py-2 text-sm outline-none bg-transparent">
                    <option value="">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div class="text-xs text-zinc-400 font-semibold uppercase">
                  Showing {{ pageStart() }}-{{ pageEnd() }} of {{ filteredLeads().length }} leads
                </div>
              </div>

              <!-- Table -->
              <div class="overflow-x-auto">
                <table class="min-w-full">
                  <thead>
                    <tr class="border-b border-white/20">
                      <th scope="col" class="px-3 py-3 text-left w-8">
                        <input type="checkbox" [checked]="paginatedLeads().length > 0 && selectedLeadIds().size === paginatedLeads().length" (change)="toggleSelectAllLeads($event)" class="w-4 h-4 rounded border-zinc-300 cursor-pointer" />
                      </th>
                      <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Lead</th>
                      <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Company</th>
                      <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Qual.</th>
                      <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Score</th>
                      <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Origin</th>
                      <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Owner</th>
                      <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                      <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Action</th>
                      <th scope="col" class="px-3 py-3 text-center text-meta font-bold text-zinc-400 uppercase tracking-wider">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (lead of paginatedLeads(); track lead.id) {
                      <tr class="border-b border-white/10 hover:bg-white/30 transition-colors group">
                        <td class="px-3 py-2.5 whitespace-nowrap" (click)="$event.stopPropagation()">
                          <input type="checkbox" [checked]="isLeadSelected(lead.id)" (change)="toggleLeadSelect(lead.id, $event)" class="w-4 h-4 rounded border-zinc-300 cursor-pointer" />
                        </td>
                        <td class="px-3 py-2.5 whitespace-nowrap">
                          <div class="flex items-center gap-2">
                            <div class="h-8 w-8 bg-zinc-100 text-zinc-950 font-bold rounded-lg text-meta flex items-center justify-center shrink-0">
                              {{ getInitials(lead.name) }}
                            </div>
                            <div class="min-w-0">
                              <button (click)="selectLead(lead)" class="table-name-link text-xs font-semibold text-zinc-900 group-hover:text-zinc-900 transition-colors truncate max-w-[120px] block text-left" [title]="'View ' + lead.name">{{ lead.name }}</button>
                              <div class="text-meta text-zinc-400">{{ lead.id }}</div>
                            </div>
                          </div>
                        </td>
                        <td class="px-3 py-2.5 whitespace-nowrap">
                          <div class="text-xs font-semibold text-zinc-800 truncate max-w-[130px]">{{ lead.companyName }}</div>
                          <div class="text-meta text-zinc-400 truncate max-w-[130px]">{{ lead.company?.city || 'No city' }}, {{ lead.company?.country || 'No country' }}</div>
                        </td>
                        <td class="px-3 py-2.5 whitespace-nowrap" (click)="$event.stopPropagation()">
                          @if (canWrite()) {
                            <select [ngModel]="lead.qualification" (ngModelChange)="onQualificationChange(lead.id, $event)" (click)="$event.stopPropagation()" [class]="getQualificationClass(lead.qualification)" class="px-1.5 py-0.5 text-meta font-bold uppercase rounded-md badge border cursor-pointer focus:outline-none" title="Change qualification">
                              @for (q of leadQualificationOptions; track q) { <option [value]="q">{{ q }}</option> }
                            </select>
                          } @else {
                            <span class="px-1.5 py-0.5 text-meta font-bold uppercase rounded-md badge border" [class]="getQualificationClass(lead.qualification)">
                              {{ lead.qualification }}
                            </span>
                          }
                          <div class="flex items-center gap-1 mt-1">
                            <span [class]="getPriorityBadge(lead.priority)" class="px-1.5 py-0.5 text-meta font-bold uppercase rounded-md badge">
                              {{ lead.priority }}
                            </span>
                            <span [class]="getTempBadge(lead.temperature)" class="px-1.5 py-0.5 text-meta font-bold uppercase rounded-md badge">
                              {{ lead.temperature }}
                            </span>
                          </div>
                        </td>
                        <td class="px-3 py-2.5 whitespace-nowrap" (click)="$event.stopPropagation()">
                          @if (canWrite() && scoreEditFor() === lead.id) {
                            <div class="flex items-center gap-1.5">
                              <input type="range" min="0" max="100" step="1" [ngModel]="scoreDraft()" (ngModelChange)="scoreDraft.set($event)" (change)="commitScore(lead.id)" class="w-20 accent-zinc-900 cursor-pointer" [attr.aria-label]="'Score for ' + lead.name">
                              <span class="text-meta font-bold text-zinc-700 w-6 text-right">{{ scoreDraft() }}</span>
                            </div>
                          } @else {
                            <button (click)="canWrite() && openScoreEditor(lead, $event)" class="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-white/40 transition-colors" [title]="canWrite() ? 'Click to adjust score' : null">
                              <div class="w-10 bg-white/30 rounded-full h-1.5 overflow-hidden">
                                <div [style.width.%]="lead.score" [class]="getScoreColor(lead.score)" class="h-full rounded-full"></div>
                              </div>
                              <span class="text-meta font-bold text-zinc-700">{{ lead.score }}</span>
                            </button>
                          }
                        </td>
                        <td class="px-3 py-2.5 whitespace-nowrap">
                          <div class="flex items-center gap-1">
                            <span class="px-1.5 py-0.5 text-meta font-semibold rounded-md badge text-zinc-700">
                              {{ lead.origin || lead.campaigns?.[0]?.source || '—' }}
                            </span>
                          </div>
                          <div class="text-meta text-zinc-400 mt-0.5">{{ lead.campaigns?.[0]?.campaign || '—' }}</div>
                        </td>
                        <td class="px-3 py-2.5 whitespace-nowrap" (click)="$event.stopPropagation()">
                          @if (canWrite()) {
                            <button (click)="openOwnerMenu(lead, $event)" class="flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-white/40 transition-colors truncate max-w-[130px]" title="Assign owner">
                              @if (lead.assignedToUserId) {
                                <app-user-avatar [userId]="lead.assignedToUserId" [size]="20" />
                              } @else {
                                <mat-icon class="w-3 h-3 text-[12px]! text-zinc-400 shrink-0">person_outline</mat-icon>
                              }
                              <span class="text-xs text-zinc-600 truncate">{{ state.leadOwnerName(lead) || 'Unassigned' }}</span>
                              <mat-icon class="w-3 h-3 text-[12px]! text-zinc-400 shrink-0">expand_more</mat-icon>
                            </button>
                          } @else {
                            <div class="text-xs text-zinc-600 flex items-center gap-1 truncate max-w-[110px]">
                              <mat-icon class="w-3 h-3 text-[12px]! text-zinc-400 shrink-0">person_outline</mat-icon>
                              {{ state.leadOwnerName(lead) || 'Unassigned' }}
                            </div>
                          }
                        </td>
                        <td class="px-3 py-2.5 whitespace-nowrap" (click)="$event.stopPropagation()">
                          @if (canWrite()) {
                            <select [ngModel]="lead.status" (ngModelChange)="onStatusChange(lead.id, $event)" (click)="$event.stopPropagation()" [class]="getStatusClass(lead.status)" class="px-2 py-0.5 text-meta font-semibold rounded-full badge whitespace-nowrap border cursor-pointer focus:outline-none" title="Change status">
                              @for (s of leadStatusOptions; track s) { <option [value]="s">{{ s }}</option> }
                            </select>
                          } @else {
                            <span [class]="getStatusClass(lead.status)" class="px-2 py-0.5 text-meta font-semibold rounded-full badge whitespace-nowrap">
                              {{ lead.status }}
                            </span>
                          }
                        </td>
                        <td class="px-3 py-2.5 whitespace-nowrap relative">
                          @if (lead.status !== 'Converted' && canWrite()) {
                            <button (click)="$event.stopPropagation(); toggleConvertMenu(lead.id, $event)" class="btn-secondary rounded-lg px-2 py-1 text-meta font-semibold text-zinc-900 transition-all flex items-center gap-1 whitespace-nowrap">
                              <mat-icon class="text-[12px] w-3 h-3">arrow_forward</mat-icon>
                              Convert
                            </button>
                            @if (activeConvertMenuId() === lead.id) {
                              <div class="absolute right-0 top-8 bg-white border border-zinc-200 rounded-xl shadow-lg py-1.5 z-10 w-44 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                                <button (click)="$event.stopPropagation(); convertLeadToProspect(lead); activeConvertMenuId.set(null)" class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 font-medium cursor-pointer">
                                  <mat-icon class="text-zinc-400 text-sm w-4 h-4">swap_horiz</mat-icon>
                                  Convert to Prospect
                                </button>
                                <button (click)="$event.stopPropagation(); markLeadAsLost(lead); activeConvertMenuId.set(null)" class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 font-medium cursor-pointer">
                                  <mat-icon class="text-zinc-400 text-sm w-4 h-4">cancel</mat-icon>
                                  Mark as Lost
                                </button>
                              </div>
                            }
                          } @else {
                            <span class="px-2 py-1 text-meta font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">Converted</span>
                          }
                        </td>
                        <td class="px-3 py-2.5 whitespace-nowrap text-center">
                          <button (click)="$event.stopPropagation(); selectLead(lead)" class="w-8 h-8 shrink-0 rounded-lg bg-white flex items-center justify-center text-[#378ADD] hover:text-[#2E5AAC] hover:bg-zinc-50 transition-all mx-auto" title="View">
                            <mat-icon class="text-[18px] w-[18px] h-[18px] flex items-center justify-center">visibility</mat-icon>
                          </button>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="10" class="px-6 py-12 text-center text-zinc-400">
                          <mat-icon class="text-[48px]! w-12 h-12 mb-3 text-zinc-300 block mx-auto">people_alt</mat-icon>
                          <p class="font-semibold text-zinc-500">No leads found</p>
                          <p class="text-xs text-zinc-400 mt-1">Try resetting filters or adding a new lead record.</p>
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
                  <div class="fixed bg-white border border-zinc-200 rounded-xl shadow-xl py-1.5 w-64 max-h-72 overflow-y-auto" [style.left.px]="ownerMenuPos().x" [style.top.px]="ownerMenuPos().y" (click)="$event.stopPropagation()">
                    <button (click)="chooseOwner(menuLeadId, null)" class="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-zinc-50 text-left text-xs font-semibold text-zinc-500">
                      <span class="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center shrink-0"><mat-icon class="text-zinc-400 text-[16px]! w-4 h-4">person_off</mat-icon></span>
                      Unassigned
                    </button>
                    <div class="border-t border-zinc-100 my-1"></div>
                    @for (u of state.assignableMembers(); track u.id) {
                      <button (click)="chooseOwner(menuLeadId, u.id)" class="flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-zinc-50 text-left">
                        <app-user-avatar [userId]="u.id" [size]="24" />
                        <span class="flex-1 min-w-0">
                          <span class="block text-xs font-semibold text-zinc-800 truncate">{{ u.displayName }}</span>
                          <span class="block text-[10px] text-zinc-400 truncate">{{ memberTeamName(u) }}</span>
                        </span>
                        @if (state.isMarketingMember(u)) {
                          <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 shrink-0">Marketing</span>
                        }
                      </button>
                    } @empty {
                      <p class="px-3 py-2 text-xs text-zinc-400">No members found.</p>
                    }
                  </div>
                </div>
              }

              <!-- Pagination -->
              <div class="px-5 py-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span>Rows per page:</span>
                  <select [ngModel]="pageSize()" (ngModelChange)="pageSize.set($event); currentPage.set(1)" class="input-field rounded-lg px-2 py-1 text-xs outline-none bg-transparent">
                    <option [value]="5">5</option>
                    <option [value]="10">10</option>
                    <option [value]="20">20</option>
                    <option [value]="50">50</option>
                  </select>
                </div>
                <div class="flex items-center gap-1">
                  <button (click)="goToPage(1)" [disabled]="currentPage() === 1" title="First page" class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all" [class]="currentPage() === 1 ? 'text-zinc-300 cursor-not-allowed' : 'btn-secondary text-zinc-600 hover:text-zinc-900'">
                    <mat-icon class="text-[14px]! w-3.5 h-3.5">first_page</mat-icon>
                  </button>
                  <button (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 1" title="Previous page" class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all" [class]="currentPage() === 1 ? 'text-zinc-300 cursor-not-allowed' : 'btn-secondary text-zinc-600 hover:text-zinc-900'">
                    <mat-icon class="text-[14px]! w-3.5 h-3.5">chevron_left</mat-icon>
                  </button>
                  <span class="text-xs text-zinc-500 font-semibold px-2">
                    Page {{ currentPage() }} of {{ totalPages() }}
                  </span>
                  <button (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() === totalPages()" title="Next page" class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all" [class]="currentPage() === totalPages() ? 'text-zinc-300 cursor-not-allowed' : 'btn-secondary text-zinc-600 hover:text-zinc-900'">
                    <mat-icon class="text-[14px]! w-3.5 h-3.5">chevron_right</mat-icon>
                  </button>
                  <button (click)="goToPage(totalPages())" [disabled]="currentPage() === totalPages()" title="Last page" class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all" [class]="currentPage() === totalPages() ? 'text-zinc-300 cursor-not-allowed' : 'btn-secondary text-zinc-600 hover:text-zinc-900'">
                    <mat-icon class="text-[14px]! w-3.5 h-3.5">last_page</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>

          @if (selectedLeadIds().size > 0) {
            <div class="bulk-action-bar">
              <span class="text-body font-semibold">{{ selectedLeadIds().size }} selected</span>
              <div class="w-px h-4 bg-white/20"></div>
              <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkAssignLeadOwner($event)">
                <option value="">Assign owner…</option>
                @for (u of state.assignableMembers(); track u.id) { <option [value]="u.id">{{u.displayName}}</option> }
              </select>
              <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkChangeLeadStage($event)">
                <option value="">Change stage…</option>
                @for (s of leadStatusOptions; track s) { <option [value]="s">{{s}}</option> }
              </select>
              <button class="text-body font-semibold px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors" (click)="bulkExportLeads()">Export CSV</button>
              <button class="text-meta ml-2 opacity-70 hover:opacity-100 transition-opacity" (click)="clearLeadSelection()">Clear</button>
            </div>
          }

          <!-- Slide-over details pane for lead -->
          @if (selectedLead(); as lead) {
            <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
              <div class="absolute inset-0 overflow-hidden">
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
                <div (click)="closeDetails()" class="absolute inset-0 bg-transparent"></div>
                <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                  <div class="pointer-events-auto w-screen max-w-2xl transform bg-white shadow-xl flex flex-col h-full">
                    
                    <!-- Header -->
                    <div class="px-6 py-5 border-b border-white/20 flex items-center justify-between">
                      <div class="flex items-center gap-4">
                        <div class="h-12 w-12 bg-zinc-100 text-zinc-950 font-extrabold rounded-xl flex items-center justify-center">
                          {{ getInitials(lead.name) }}
                        </div>
                        <div>
                          <h2 class="text-xl font-bold text-zinc-900" id="slide-over-title">{{ lead.name }}</h2>
                          <p class="text-xs text-zinc-400 font-semibold">{{ lead.id }} &bull; {{ lead.companyName }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-3">
                        <div class="flex items-center gap-1.5 badge rounded-lg px-2 py-1">
                          <span class="text-meta uppercase font-bold text-zinc-400">Status:</span>
                          <select [ngModel]="lead.status" (ngModelChange)="onStatusChange(lead.id, $event)" class="text-xs font-semibold text-zinc-700 bg-transparent border-none focus:outline-none cursor-pointer">
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
                        <button (click)="openLeadDetail(lead)" class="px-2.5 py-1.5 rounded-lg btn-secondary text-xs font-semibold text-zinc-700 hover:text-zinc-900 transition-colors flex items-center gap-1">
                          <mat-icon class="text-[14px]! w-3.5 h-3.5">open_in_new</mat-icon>
                          Open page
                        </button>
                        <button (click)="closeDetails()" title="Close" class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                          <mat-icon class="text-[20px] w-[20px] h-[20px] flex items-center justify-center">close</mat-icon>
                        </button>
                      </div>
                    </div>

                    <!-- Tabs Nav -->
                    <div class="px-6 border-b border-white/20 flex gap-6">
                      <button (click)="activeDetailTab.set('info')" [class]="activeDetailTab() === 'info' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'" class="py-3 border-b-2 text-sm font-semibold transition-all">Info</button>
                      <button (click)="activeDetailTab.set('activities')" [class]="activeDetailTab() === 'activities' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'" class="py-3 border-b-2 text-sm font-semibold transition-all">Activities & Notes</button>
                      <button (click)="activeDetailTab.set('attachments')" [class]="activeDetailTab() === 'attachments' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'" class="py-3 border-b-2 text-sm font-semibold transition-all">Attachments</button>
                      <button (click)="activeDetailTab.set('history')" [class]="activeDetailTab() === 'history' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'" class="py-3 border-b-2 text-sm font-semibold transition-all">Status History</button>
                    </div>

                    <!-- Scrollable content -->
                    <div class="flex-1 overflow-y-auto p-6 space-y-6">
                      @if (activeDetailTab() === 'info') {
                        <div class="space-y-6">
                          <div class="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                            <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Basic Information</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Lead Name</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.name }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Company</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.companyName }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Assigned Salesperson</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.assignedSalesperson || 'Unassigned' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Sales Team</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.salesTeam || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Email</div><a href="mailto:{{ lead.contacts?.[0]?.email }}" class="font-semibold text-zinc-900 hover:underline mt-0.5 block">{{ lead.contacts?.[0]?.email || '—' }}</a></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Phone</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.contacts?.[0]?.phone || '—' }}</div></div>
                              @if (lead.contacts?.[0]?.website; as web) {
                                <div><div class="text-meta uppercase font-semibold text-zinc-400">Website</div><a href="http://{{web}}" target="_blank" class="font-semibold text-zinc-900 hover:underline mt-0.5 block">{{ web }}</a></div>
                              }
                              @if (lead.contacts?.[0]?.linkedin; as li) {
                                <div><div class="text-meta uppercase font-semibold text-zinc-400">LinkedIn</div><a href="http://{{li}}" target="_blank" class="font-semibold text-zinc-900 hover:underline mt-0.5 block">{{ li }}</a></div>
                              }
                            </div>
                          </div>
                          <div class="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                            <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Company Information</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Industry</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.industry || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Company Size</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.size || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Annual Revenue</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.annualRevenue || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Offices Count</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.officesCount || '—' }}</div></div>
                              <div class="col-span-2"><div class="text-meta uppercase font-semibold text-zinc-400">Address</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.address || '—' }}, {{ lead.company?.city || '—' }}, {{ lead.company?.country || '—' }}</div></div>
                            </div>
                          </div>
                          <div class="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                            <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Origin & Marketing Campaign</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Origin</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Campaign</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.campaigns?.[0]?.campaign || '—' }}</div></div>
                              @if (lead.campaigns?.[0]?.referralPartner) { <div><div class="text-meta uppercase font-semibold text-zinc-400">Referral Partner</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.campaigns?.[0]?.referralPartner }}</div></div> }
                              @if (lead.campaigns?.[0]?.tradeShow) { <div><div class="text-meta uppercase font-semibold text-zinc-400">Trade Show</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.campaigns?.[0]?.tradeShow }}</div></div> }
                            </div>
                          </div>
                          <div class="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                            <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Key Stakeholders (B2B)</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Decision Maker</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.decisionMaker || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Influencer</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.influencer || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Finance Contact</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.financeContact || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Technical Contact</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.technicalContact || '—' }}</div></div>
                            </div>
                          </div>
                          <div class="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                            <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Audit Trail</h3>
                            <div class="grid grid-cols-2 gap-4 text-meta text-zinc-500">
                              <div><div>Created By</div><div class="mt-0.5"><app-created-by-badge [createdBy]="lead.createdBy" [createdAt]="lead.createdDate" /></div></div>
                              <div><div>Modified Date</div><div class="font-semibold text-zinc-700 mt-0.5">{{ lead.modifiedDate }} by <app-user-avatar [userId]="lead.modifiedBy" [size]="20" /> {{ getUserName(lead.modifiedBy) }}</div></div>
                            </div>
                          </div>
                        </div>
                      }

                      @if (activeDetailTab() === 'activities') {
                        <div class="space-y-6">
                          <div class="bg-white border border-zinc-200 rounded-xl p-4 space-y-3 text-sm">
                            <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Lead Qualification & Sales Potential</h3>
                            <div class="grid grid-cols-2 gap-4">
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Interested Product</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.productInterests?.[0]?.product || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Solution</div><div class="font-semibold text-zinc-700 mt-0.5">{{ lead.productInterests?.[0]?.solution || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Origin</div><div class="font-bold text-zinc-950 mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div></div>
                              <div><div class="text-meta uppercase font-semibold text-zinc-400">Deal Probability</div><div class="font-semibold text-zinc-700 mt-0.5">{{ lead.probability || '0' }}%</div></div>
                            </div>
                          </div>
                          <div class="space-y-2">
                            <label for="notes_comments" class="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Notes & Comments</label>
                            <div class="bg-white border border-zinc-200 rounded-xl p-4 text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
                              {{ lead.notes || 'No notes added for this lead yet.' }}
                            </div>
                          </div>
                          <div class="card rounded-xl p-4 space-y-3">
                            <h3 class="text-xs font-bold text-zinc-700 uppercase">Log New Activity</h3>
                            <div class="grid grid-cols-2 gap-3">
                              <div><label for="type" class="block text-meta uppercase font-semibold text-zinc-400 mb-1">Type</label>
                                <select id="type" [(ngModel)]="newActivity.type" class="w-full input-field rounded-lg p-2 text-xs outline-none bg-transparent">
                                  <option value="Call">Call</option><option value="Email">Email</option><option value="Meeting">Meeting</option><option value="Note">Note</option><option value="Task">Task</option>
                                </select></div>
                              <div><label for="date" class="block text-meta uppercase font-semibold text-zinc-400 mb-1">Date</label>
                                <input id="date" [(ngModel)]="newActivity.date" type="date" class="w-full input-field rounded-lg p-1.5 text-xs outline-none"></div>
                            </div>
                            <div><label for="summary" class="block text-meta uppercase font-semibold text-zinc-400 mb-1">Summary</label>
                              <input id="summary" [(ngModel)]="newActivity.summary" type="text" placeholder="e.g. Discussed pricing options" class="w-full input-field rounded-lg p-2 text-xs outline-none"></div>
                            <div><label for="details_optional" class="block text-meta uppercase font-semibold text-zinc-400 mb-1">Details (Optional)</label>
                              <textarea id="details_optional" [(ngModel)]="newActivity.detail" rows="2" placeholder="More detailed recap..." class="w-full input-field rounded-lg p-2 text-xs outline-none"></textarea></div>
                            <div class="flex justify-end pt-2">
                              <button (click)="submitActivity(lead.id)" class="bg-zinc-800/80 hover:bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm">Log Activity</button>
                            </div>
                          </div>
                          <div class="space-y-4">
                            <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Interactions Timeline</h3>
                            <div class="space-y-4">
                              @for (act of lead.activities; track act.id) {
                                <div class="flex gap-4 items-start border-l-2 border-white/30 pl-4 relative">
                                  <div class="absolute -left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-white flex items-center justify-center" [class]="getActivityIconClass(act.type)"></div>
                                  <div class="flex-1 space-y-1">
                                    <div class="flex justify-between items-center">
                                      <span class="text-xs font-semibold text-zinc-800">{{ act.summary }}</span>
                                      <span class="text-meta text-zinc-400 font-medium">{{ act.date }}</span>
                                    </div>
                                    @if (act.detail) { <p class="text-xs text-zinc-500 leading-relaxed">{{ act.detail }}</p> }
                                    <div class="text-meta font-semibold text-zinc-400 flex items-center gap-1">
                                      <span class="px-1.5 py-0.5 rounded badge">{{ act.type }}</span>
                                      @if (act.assignedTo) { <span>Assigned: {{ act.assignedTo }}</span> }
                                    </div>
                                  </div>
                                </div>
                              } @empty { <p class="text-xs text-zinc-400 text-center py-4">No logged interactions yet.</p> }
                            </div>
                          </div>
                        </div>
                      }

                      @if (activeDetailTab() === 'attachments') {
                        <div class="space-y-6">
                          <div class="card rounded-xl p-4 space-y-3">
                            <h3 class="text-xs font-bold text-zinc-700 uppercase">Upload Document</h3>
                            <div class="flex gap-3 items-center">
                              <input type="file" (change)="onFileSelected($event, lead.id)" class="flex-1 text-xs">
                              @if (uploading()) { <span class="text-meta text-zinc-400">Uploading&hellip;</span> }
                            </div>
                          </div>
                          <div class="space-y-3">
                            <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Uploaded Files</h3>
                            <div class="divide-y divide-white/20 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                              @for (file of lead.attachments; track file.id) {
                                <div class="px-4 py-3 flex justify-between items-center text-xs">
                                  <div class="flex items-center gap-2.5">
                                    <mat-icon class="text-zinc-400 text-[20px]! w-5 h-5">insert_drive_file</mat-icon>
                                    <div>
                                      <div class="font-semibold text-zinc-800">
                                        @if (file.fileId) {
                                          <a [href]="getDownloadUrl(file.fileId)" target="_blank" class="hover:underline">{{ file.fileName }}</a>
                                        } @else { {{ file.fileName }} }
                                      </div>
                                      <div class="text-meta text-zinc-400">Uploaded: {{ file.uploadedAt }} &bull; {{ file.fileSize || 'N/A' }}</div>
                                    </div>
                                  </div>
                                  <button title="Delete attachment" (click)="deleteAttachment(lead.id, file)" class="text-zinc-400 hover:text-zinc-900 transition-colors"><mat-icon class="text-[16px]! w-4 h-4">delete_outline</mat-icon></button>
                                </div>
                              } @empty { <p class="text-xs text-zinc-400 text-center py-6">No attachments uploaded yet.</p> }
                            </div>
                          </div>
                        </div>
                      }

                      @if (activeDetailTab() === 'history') {
                        <div class="space-y-4">
                          <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Status Transition Log</h3>
                          <div class="space-y-4">
                            @for (hist of lead.statusHistory; track $index) {
                              <div class="flex gap-4 items-start pl-4 border-l-2 border-white/30 relative">
                                <div class="absolute -left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-zinc-100"></div>
                                <div class="flex-1 text-xs">
                                  <div class="flex justify-between font-semibold text-zinc-800">
                                    <span>Status updated to: {{ hist.status }}</span>
                                    <span class="text-meta text-zinc-400 font-medium">{{ hist.timestamp }}</span>
                                  </div>
                                  <div class="text-meta text-zinc-400 font-medium mt-0.5">Changed by: {{ hist.user }}</div>
                                </div>
                              </div>
                            } @empty { <p class="text-xs text-zinc-400 text-center py-4">No status changes logged.</p> }
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
            <div class="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-sm flex items-center justify-center p-4">
              <div class="bg-white shadow-xl rounded-2xl max-w-lg w-full p-6 space-y-4 overflow-y-auto max-h-[90vh]">
                <div class="flex justify-between items-center pb-3 border-b border-white/20">
                  <h3 class="text-lg font-bold text-zinc-900">Add New Lead Record</h3>
                  <button (click)="addLeadModalOpen.set(false)" class="w-8 h-8 rounded-lg btn-secondary flex items-center justify-center text-zinc-400 hover:text-zinc-600">
                    <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
                  </button>
                </div>
                <div class="space-y-4 text-xs font-sans">
                  <div class="space-y-2.5">
                    <h4 class="font-bold text-zinc-950 uppercase tracking-wider text-meta">1. Basic Information</h4>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label for="lead_name" class="block font-semibold text-zinc-500 mb-1">Lead Name*</label><input [(ngModel)]="newLead.name" type="text" placeholder="e.g. John Doe" class="w-full input-field rounded-lg p-2 outline-none"></div>
                      <div><label for="company_name" class="block font-semibold text-zinc-500 mb-1">Company Name*</label><input id="lead_name" [(ngModel)]="newLead.companyName" type="text" placeholder="e.g. Acmo Group" class="w-full input-field rounded-lg p-2 outline-none"></div>
                      <div><label for="email" class="block font-semibold text-zinc-500 mb-1">Email</label><input id="company_name" [(ngModel)]="newLead.email" type="email" placeholder="e.g. email@acmo.com" class="w-full input-field rounded-lg p-2 outline-none"></div>
                      <div><label for="phone" class="block font-semibold text-zinc-500 mb-1">Phone</label><input id="email" [(ngModel)]="newLead.phone" type="text" placeholder="e.g. +212-6..." class="w-full input-field rounded-lg p-2 outline-none"></div>
                    </div>
                  </div>
                  <div class="space-y-2.5">
                    <h4 class="font-bold text-zinc-950 uppercase tracking-wider text-meta">2. Company Information</h4>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label for="industry" class="block font-semibold text-zinc-500 mb-1">Industry</label><input [(ngModel)]="newLead.industry" type="text" placeholder="e.g. Healthcare" class="w-full input-field rounded-lg p-2 outline-none"></div>
                      <div><label for="company_size" class="block font-semibold text-zinc-500 mb-1">Company Size</label><input id="industry" [(ngModel)]="newLead.companySize" type="text" placeholder="e.g. 200 employees" class="w-full input-field rounded-lg p-2 outline-none"></div>
                      <div><label for="city" class="block font-semibold text-zinc-500 mb-1">City</label><input id="company_size" [(ngModel)]="newLead.city" type="text" placeholder="Casablanca" class="w-full input-field rounded-lg p-2 outline-none"></div>
                      <div><label for="country" class="block font-semibold text-zinc-500 mb-1">Country</label><input id="city" [(ngModel)]="newLead.country" type="text" placeholder="Morocco" class="w-full input-field rounded-lg p-2 outline-none"></div>
                    </div>
                  </div>
                  <div class="space-y-2.5">
                    <h4 class="font-bold text-zinc-950 uppercase tracking-wider text-meta">3. Qualification & Source</h4>
                    <div class="grid grid-cols-3 gap-3">
                      <div><label for="status" class="block font-semibold text-zinc-500 mb-1">Status</label>
                        <select id="status" [(ngModel)]="newLead.status" class="w-full input-field rounded-lg p-2 outline-none bg-transparent">
                          <option value="New">New</option><option value="Contacted">Contacted</option><option value="Attempted Contact">Attempted Contact</option>
                          <option value="Meeting Scheduled">Meeting Scheduled</option><option value="Qualified">Qualified</option><option value="Proposal Requested">Proposal Requested</option>
                          <option value="Converted">Converted</option><option value="Lost">Lost</option><option value="Disqualified">Disqualified</option>
                        </select></div>
                      <div><label for="priority" class="block font-semibold text-zinc-500 mb-1">Priority</label>
                        <select id="priority" [(ngModel)]="newLead.priority" class="w-full input-field rounded-lg p-2 outline-none bg-transparent">
                          <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                        </select></div>
                      <div><label for="temperature" class="block font-semibold text-zinc-500 mb-1">Temperature</label>
                        <select id="temperature" [(ngModel)]="newLead.temperature" class="w-full input-field rounded-lg p-2 outline-none bg-transparent">
                          <option value="Cold">Cold</option><option value="Warm">Warm</option><option value="Hot">Hot</option>
                        </select></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div><label for="origin" class="block font-semibold text-zinc-500 mb-1">Origin</label>
                        <select id="origin" [(ngModel)]="newLead.origin" class="w-full input-field rounded-lg p-2 outline-none bg-transparent">
                          <option value="Landing Page">Landing Page</option>
                          <option value="Marketing Campaign">Marketing Campaign</option>
                          <option value="Email">Email</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div><label for="product_interest" class="block font-semibold text-zinc-500 mb-1">Product Interest</label><input [(ngModel)]="newLead.interestedProduct" type="text" placeholder="e.g. Cloud Hosting" class="w-full input-field rounded-lg p-2 outline-none"></div>
                      <div><label for="assigned_salesperson" class="block font-semibold text-zinc-500 mb-1">Assigned Salesperson</label>
                        <select id="assigned_salesperson" [(ngModel)]="newLead.assignedSalesperson" class="w-full input-field rounded-lg p-2 outline-none bg-transparent">
                          <option value="">-- Unassigned --</option>
                          @for (user of state.users(); track user.name) {
                            <option [value]="user.name">{{ user.name }} ({{ user.role }})</option>
                          }
                        </select></div>
                    </div>
                  </div>
                  <div><label for="notes" class="block font-semibold text-zinc-500 mb-1">Notes</label>
                    <textarea id="notes" [(ngModel)]="newLead.notes" rows="3" placeholder="Evaluate legacy systems, downtime concerns, etc." class="w-full input-field rounded-lg p-2 outline-none"></textarea></div>
                </div>
                <div class="flex justify-end gap-2 pt-3 border-t border-white/20 text-xs">
                  <button (click)="addLeadModalOpen.set(false)" class="px-4 py-2 btn-secondary rounded-lg text-zinc-600 font-semibold">Cancel</button>
                  <button (click)="saveLead()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white font-semibold rounded-lg shadow-lg shadow-zinc-300">Save Lead Record</button>
                </div>
              </div>
            </div>
          }
        } @else {
          <!-- View toggle (cards / table) for non-Lead tabs -->
          <div class="flex items-center justify-between px-1 pb-3">
            <span class="text-xs text-zinc-400 font-semibold uppercase tracking-wider">{{ filteredPartners().length }} {{ activeTab() }}s</span>
            <div class="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
              <button (click)="partnerView.set('cards')" [class]="partnerView() === 'cards' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'" class="p-1.5 rounded-md transition-colors" title="Card view">
                <mat-icon class="text-[18px] w-[18px] h-[18px] flex items-center justify-center">grid_view</mat-icon>
              </button>
              <button (click)="partnerView.set('table')" [class]="partnerView() === 'table' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'" class="p-1.5 rounded-md transition-colors" title="Table view">
                <mat-icon class="text-[18px] w-[18px] h-[18px] flex items-center justify-center">table_rows</mat-icon>
              </button>
            </div>
          </div>

          @if (partnerView() === 'table') {
            <!-- Table view for non-Lead tabs -->
            <div class="overflow-x-auto">
              <table class="min-w-full">
                <thead>
                  <tr class="border-b border-white/20">
                    <th scope="col" class="px-3 py-3 text-left w-8">
                      <input type="checkbox" [checked]="paginatedPartners().length > 0 && selectedPartnerIds().size === paginatedPartners().length" (change)="toggleSelectAllPartners($event)" class="w-4 h-4 rounded border-zinc-300 cursor-pointer" />
                    </th>
                    <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">{{ activeTab() }}</th>
                    <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Contact</th>
                    <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Owner</th>
                    <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                    <th scope="col" class="px-3 py-3 text-left text-meta font-bold text-zinc-400 uppercase tracking-wider">Created</th>
                    <th scope="col" class="px-3 py-3 text-right text-meta font-bold text-zinc-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (partner of paginatedPartners(); track partner.id) {
                    <tr class="border-b border-white/10 hover:bg-white/30 transition-colors">
                      <td class="px-3 py-2.5 whitespace-nowrap">
                        <input type="checkbox" [checked]="isPartnerSelected(partner.id)" (change)="togglePartnerSelect(partner.id, $event)" class="w-4 h-4 rounded border-zinc-300 cursor-pointer" />
                      </td>
                      <td class="px-3 py-2.5 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <div class="h-8 w-8 bg-zinc-100 text-zinc-950 font-bold rounded-lg text-meta flex items-center justify-center shrink-0">
                            {{ partner.name.substring(0, 2).toUpperCase() }}
                          </div>
                          <div class="min-w-0">
                            @if (partner.type === 'Vendor') {
                              <div class="text-xs font-semibold text-zinc-900 truncate max-w-[160px]">{{ partner.name }}</div>
                            } @else {
                              <button (click)="openPartnerPrimary(partner)" class="table-name-link text-xs font-semibold text-zinc-900 truncate max-w-[160px] block text-left" [title]="partner.type === 'Customer' ? 'View customer card' : 'Convert to customer'">{{ partner.name }}</button>
                            }
                            <div class="text-meta text-zinc-400 truncate max-w-[160px]">{{ partner.city || 'No city' }}</div>
                          </div>
                        </div>
                      </td>
                      <td class="px-3 py-2.5 whitespace-nowrap">
                        <div class="text-xs text-zinc-700 truncate max-w-[180px]">{{ partner.email || '—' }}</div>
                        <div class="text-meta text-zinc-400 font-mono">{{ partner.phone || '' }}</div>
                      </td>
                      <td class="px-3 py-2.5 whitespace-nowrap">
                        <div class="text-xs text-zinc-600 truncate max-w-[130px]">{{ partner.assignedTo ? getUserName(partner.assignedTo) : 'Unassigned' }}</div>
                      </td>
                      <td class="px-3 py-2.5 whitespace-nowrap">
                        <span [class]="getPartnerStatusClass(partner.status)" class="px-2 py-0.5 text-meta font-bold uppercase tracking-wider rounded-full border whitespace-nowrap">
                          {{ partner.status || '—' }}
                        </span>
                      </td>
                      <td class="px-3 py-2.5 whitespace-nowrap">
                        <app-created-by-badge [createdBy]="partner.createdBy" [createdAt]="partner.createdAt" />
                      </td>
                      <td class="px-3 py-2.5 whitespace-nowrap text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          @if (partner.type === 'Customer') {
                            <button (click)="openCustomerCard(partner.id)" title="View Customer Card" class="w-8 h-8 shrink-0 rounded-lg bg-white flex items-center justify-center text-[#378ADD] hover:text-[#2E5AAC] hover:bg-zinc-50 transition-all">
                              <mat-icon class="text-[18px] w-[18px] h-[18px] flex items-center justify-center">visibility</mat-icon>
                            </button>
                          }
                          @if (partner.type === 'Prospect' && canWrite()) {
                            <button (click)="openConvertModal(partner)" title="Convert to Customer" class="w-8 h-8 shrink-0 rounded-lg bg-white flex items-center justify-center text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 transition-all">
                              <mat-icon class="text-[18px] w-[18px] h-[18px] flex items-center justify-center">published_with_changes</mat-icon>
                            </button>
                          }
                          @if (state.currentUserPermissions().canDeleteRecords) {
                            <button (click)="deletePartner(partner)" title="Delete" class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-zinc-50 hover:bg-red-50 hover:text-red-600 border border-zinc-200 hover:border-red-200 text-zinc-500 transition-all">
                              <mat-icon class="text-[16px] w-4 h-4">delete</mat-icon>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="px-6 py-12 text-center text-zinc-500">
                        No {{activeTab()}}s found in the directory.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
          <!-- Card grid for non-Lead tabs -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            @for (partner of paginatedPartners(); track partner.id) {
              <div class="card rounded-2xl p-6 relative flex flex-col justify-between">
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
                <label for="label_20" class="absolute top-3 left-3 z-10" (click)="$event.stopPropagation()">
                  <input id="label_20" type="checkbox" [checked]="isPartnerSelected(partner.id)" (change)="togglePartnerSelect(partner.id, $event)" class="w-4 h-4 rounded border-zinc-300 cursor-pointer" />
                </label>
                <div>
                  <div class="flex items-start justify-between mb-4">
                    <div class="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center text-lg font-bold text-zinc-600">
                      {{partner.name.substring(0,2).toUpperCase()}}
                    </div>
                    <span class="px-2.5 py-1 text-meta font-bold uppercase tracking-wider rounded-full badge"
                      [class]="partner.type === 'Lead' ? 'text-zinc-950' : (partner.type === 'Customer' ? 'text-zinc-950' : (partner.type === 'Prospect' ? 'text-zinc-950' : 'text-zinc-950'))">
                      {{partner.type}}
                    </span>
                  </div>
                  <h3 class="text-lg font-bold text-zinc-900 truncate mb-1">{{partner.name}}</h3>
                  <span class="inline-flex items-center text-xs badge text-zinc-600 px-2 py-0.5 rounded mb-4">
                    <mat-icon class="text-[12px] w-3 h-3 mr-1">location_on</mat-icon> {{partner.city || 'Casablanca'}}
                  </span>
                  
                  @if(partner.type === 'Lead') {
                    <div class="flex gap-2 flex-wrap mb-4">
                      @if (partner.score) {
                        <span class="px-2 py-0.5 text-meta font-bold rounded uppercase tracking-wider badge" [class]="partner.score > 70 ? 'text-zinc-950' : 'text-zinc-950'">
                          Score: {{partner.score}}
                        </span>
                      }
                      @if (partner.source) {
                        <span class="px-2 py-0.5 text-meta font-bold uppercase tracking-wider badge text-zinc-900">
                          {{partner.source}}
                        </span>
                      }
                      @if (partner.assignedTo) {
                        <span class="px-2 py-0.5 text-meta font-bold uppercase tracking-wider badge text-zinc-600 flex items-center gap-1">
                          <mat-icon class="text-[12px] w-3 h-3">person</mat-icon> {{partner.assignedTo}}
                        </span>
                      }
                    </div>
                  }
                  
                  <div class="space-y-2 mt-2">
                    <div class="flex items-center text-sm text-zinc-500">
                      <mat-icon class="mr-2 text-[16px] w-4 h-4">email</mat-icon>
                      {{partner.email || 'N/A'}}
                    </div>
                    <div class="flex items-center text-sm text-zinc-500">
                      <mat-icon class="mr-2 text-[16px] w-4 h-4">phone</mat-icon>
                      <span class="font-mono">{{partner.phone || 'N/A'}}</span>
                    </div>
                  </div>

                  @if(partner.comments) {
                    <div class="mt-4 pt-4 border-t border-white/30 text-xs text-zinc-500">
                      <strong class="text-zinc-700">Notes:</strong> {{partner.comments}}
                    </div>
                  }

                  <div class="mt-4 pt-4 border-t border-white/30">
                    <app-created-by-badge [createdBy]="partner.createdBy" [createdAt]="partner.createdAt" />
                  </div>

                  @let partnerInvoices = getPartnerInvoices(partner.id);
                  @if (partnerInvoices.length > 0) {
                    <div class="mt-4 pt-4 border-t border-white/30 space-y-1.5">
                      <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Invoices / الفواتير</span>
                      <div class="space-y-1">
                        @for (inv of partnerInvoices; track inv.id) {
                          <div class="flex justify-between items-center text-xs">
                            <span class="text-zinc-600 font-mono">Invoice #{{inv.id}}</span>
                            <span class="font-semibold" [class]="inv.status === 'Paid' ? 'text-zinc-900' : (inv.status === 'Overdue' ? 'text-zinc-900' : 'text-zinc-900')">
                              {{formatCurrency(inv.amount)}} ({{inv.status}})
                            </span>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>

                <div class="mt-6 pt-4 border-t border-white/30 flex gap-2">
                  @if(partner.type === 'Lead' && canWrite()) {
                    <button (click)="state.updatePartner(partner.id, { status: 'prospect' })" class="w-full btn-secondary rounded-xl px-3 py-2 text-sm font-semibold text-zinc-900 transition-all flex items-center justify-center">
                      <mat-icon class="mr-2 text-[16px] w-4 h-4">arrow_forward</mat-icon>
                      Convert to Prospect
                    </button>
                  }
                  @if(partner.type === 'Prospect' && canWrite()) {
                    <button (click)="openConvertModal(partner)" class="w-full btn-secondary rounded-xl px-3 py-2 text-sm font-semibold text-zinc-900 transition-all flex items-center justify-center">
                      <mat-icon class="mr-2 text-[16px] w-4 h-4">published_with_changes</mat-icon>
                      Convert to Customer
                    </button>
                  }
                  @if(partner.type === 'Customer') {
                    <button (click)="openCustomerCard(partner.id)" class="w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all flex items-center justify-center bg-[#378ADD]/10 text-[#378ADD] hover:bg-[#378ADD]/20 border border-[#378ADD]/30">
                      <mat-icon class="mr-2 text-[16px] w-4 h-4">visibility</mat-icon>
                      View Customer Card
                    </button>
                  }
                  @if (state.currentUserPermissions().canDeleteRecords) {
                    <button (click)="deletePartner(partner)" title="Delete" class="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-all flex items-center justify-center bg-zinc-50 hover:bg-red-50 hover:text-red-600 border border-zinc-200 hover:border-red-200 text-zinc-500">
                      <mat-icon class="text-[16px] w-4 h-4">delete</mat-icon>
                    </button>
                  }
                </div>
              </div>
            } @empty {
              <div class="col-span-full text-center py-12 text-zinc-500">
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
              <span class="text-body font-semibold">{{ selectedPartnerIds().size }} selected</span>
              <div class="w-px h-4 bg-white/20"></div>
              <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkAssignPartnerOwner($event)">
                <option value="">Assign owner…</option>
                @for (u of state.users(); track u.id) { <option [value]="u.name">{{u.name}}</option> }
              </select>
              <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkChangePartnerStage($event)">
                <option value="">Change stage…</option>
                @for (s of partnerStatusOptions; track s) { <option [value]="s">{{s}}</option> }
              </select>
              <button class="text-body font-semibold px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors" (click)="bulkExportPartners()">Export CSV</button>
              <button class="text-meta ml-2 opacity-70 hover:opacity-100 transition-opacity" (click)="clearPartnerSelection()">Clear</button>
            </div>
          }

          <!-- Create Partner Modal -->
          @if (showCreateModal()) {
            <div class="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-sm flex items-center justify-center p-4">
              <div class="bg-white shadow-xl rounded-2xl max-w-md w-full p-6 space-y-6">
                <div class="flex justify-between items-center pb-2 border-b border-white/20">
                  <h3 class="text-lg font-bold text-zinc-900">Add New {{newPartner.type}}</h3>
                  <button (click)="showCreateModal.set(false)" class="w-8 h-8 rounded-lg btn-secondary flex items-center justify-center text-zinc-400 hover:text-zinc-600">
                    <mat-icon class="text-[20px]! w-5 h-5">close</mat-icon>
                  </button>
                </div>
                
                <form (ngSubmit)="savePartner()" class="space-y-4">
                  <div>
                    <label for="partner_type" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Partner Type</label>
                    <select id="partner_type" [(ngModel)]="newPartner.type" name="type" class="w-full input-field rounded-xl p-2.5 text-sm outline-none bg-transparent">
                      <option value="Lead">Lead</option>
                      <option value="Prospect">Prospect</option>
                      <option value="Customer">Customer</option>
                      <option value="Vendor">Vendor</option>
                    </select>
                  </div>

                  <div>
                    <label for="company_contact_name" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Company / Contact Name</label>
                    <input id="company_contact_name" [(ngModel)]="newPartner.name" name="name" type="text" placeholder="e.g. Casablanca Technologies" required class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
                  </div>

                  <div>
                    <label for="email" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Email</label>
                    <input id="email" [(ngModel)]="newPartner.email" name="email" type="email" placeholder="e.g. contact@domain.ma" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
                  </div>

                  <div>
                    <label for="phone" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Phone</label>
                    <input id="phone" [(ngModel)]="newPartner.phone" name="phone" type="text" placeholder="e.g. +212-522-XXXXXX" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
                  </div>

                  <div>
                    <label for="city" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">City</label>
                    <select id="city" [(ngModel)]="newPartner.city" name="city" class="w-full input-field rounded-xl p-2.5 text-sm outline-none bg-transparent">
                      <option value="Casablanca">Casablanca</option>
                      <option value="Rabat">Rabat</option>
                      <option value="Marrakech">Marrakech</option>
                      <option value="Tangier">Tangier</option>
                      <option value="Fès">Fès</option>
                    </select>
                  </div>

                  @if (newPartner.type === 'Customer') {
                    <div>
                      <label for="ice_15_digits" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">ICE (15 digits) *</label>
                      <input id="ice_15_digits" [(ngModel)]="newPartner.ICE" name="ICE" type="text" maxlength="15" placeholder="e.g. 123456789012345" required class="w-full input-field rounded-xl p-2.5 text-sm outline-none font-mono">
                    </div>
                    <div>
                      <label for="identifiant_fiscal_i" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Identifiant Fiscal (IF) *</label>
                      <input id="identifiant_fiscal_i" [(ngModel)]="newPartner.IF" name="IF" type="text" placeholder="e.g. 12345678" required class="w-full input-field rounded-xl p-2.5 text-sm outline-none font-mono">
                    </div>
                    <div>
                      <label for="registre_de_commerce" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Registre de Commerce (RC) *</label>
                      <input id="registre_de_commerce" [(ngModel)]="newPartner.RC" name="RC" type="text" placeholder="e.g. 123456" required class="w-full input-field rounded-xl p-2.5 text-sm outline-none font-mono">
                    </div>
                  }

                  @if (newPartner.type === 'Lead') {
                    <div>
                      <label for="lead_score_0_100" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Lead Score (0-100)</label>
                      <input id="lead_score_0_100" [(ngModel)]="newPartner.score" name="score" type="number" min="0" max="100" placeholder="e.g. 85" class="w-full input-field rounded-xl p-2.5 text-sm outline-none">
                    </div>
                    <div>
                      <label for="lead_source" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Lead Source</label>
                      <select id="lead_source" [(ngModel)]="newPartner.source" name="source" class="w-full input-field rounded-xl p-2.5 text-sm outline-none bg-transparent">
                        <option value="Website form">Website form</option>
                        <option value="Trade show">Trade show</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Marketing campaign">Marketing campaign</option>
                        <option value="Referral">Referral</option>
                      </select>
                    </div>
                    <div>
                      <label for="assigned_salesperson" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Assigned Salesperson</label>
                      <select id="assigned_salesperson" [(ngModel)]="newPartner.assignedTo" name="assignedTo" class="w-full input-field rounded-xl p-2.5 text-sm outline-none bg-transparent">
                        <option value="">-- Unassigned --</option>
                        @for (user of state.users(); track user.name) {
                          <option [value]="user.name">{{user.name}} ({{user.team}})</option>
                        }
                      </select>
                    </div>
                  }

                  <div>
                    <label for="comments_notes" class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Comments / Notes</label>
                    <textarea id="comments_notes" [(ngModel)]="newPartner.comments" name="comments" rows="3" placeholder="Additional details..." class="w-full input-field rounded-xl p-2.5 text-sm outline-none"></textarea>
                  </div>

                  <div class="flex justify-end gap-2 pt-4 border-t border-white/20">
                    <button type="button" (click)="showCreateModal.set(false)" class="px-4 py-2 btn-secondary rounded-xl text-zinc-600 text-sm font-semibold">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-xl shadow-lg shadow-zinc-300">Save Partner</button>
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

  deletePartner(partner: { id: string; name: string }) {
    if (!this.state.hasAuthority('PARTNERS_DELETE')) return;
    if (confirm(`Delete "${partner.name}"? This cannot be undone.`)) {
      this.state.deletePartner(partner.id);
    }
  }

  // Leads-specific state
  searchQuery = signal('');
  statusFilter = signal('');
  priorityFilter = signal('');
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
      case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'prospect': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'inactive': return 'bg-zinc-100 text-zinc-600 border-zinc-200';
      case 'archived': return 'bg-zinc-100 text-zinc-400 border-zinc-200';
      default: return 'bg-zinc-100 text-zinc-600 border-zinc-200';
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
        if (!this.newPartner.ICE || this.newPartner.ICE.length !== 15) { alert('ICE must be exactly 15 digits.'); return; }
        if (!this.newPartner.IF || !this.newPartner.IF.trim()) { alert('IF is required.'); return; }
        if (!this.newPartner.RC || !this.newPartner.RC.trim()) { alert('RC is required.'); return; }
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

  getDownloadUrl(fileId: string): string {
    return this.api.getFileDownloadUrl(fileId);
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
      assignedSalesperson: this.state.users()[0]?.name || '',
      notes: ''
    };
    this.addLeadModalOpen.set(true);
  }

  saveLead() {
    if (!this.canCreate()) return;
    if (!this.newLead.name.trim() || !this.newLead.companyName.trim()) {
      alert('Lead Name and Company Name are required.');
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
      productInterests: [
        {
          product: this.newLead.interestedProduct,
          solution: 'Cloud Solution Integration'
        }
      ]
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
      case 'Qualified': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Unqualified': return 'bg-red-50 text-red-600 border-red-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
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
      case 'New': return 'bg-slate-100 text-slate-700';
      case 'Contacted': return 'bg-sky-50 text-sky-700';
      case 'Attempted Contact': return 'bg-sky-50 text-sky-700';
      case 'Meeting Scheduled': return 'bg-indigo-50 text-indigo-700';
      case 'Qualified': return 'bg-violet-50 text-violet-700';
      case 'Proposal Requested': return 'bg-purple-50 text-purple-700';
      case 'Converted': return 'bg-emerald-50 text-emerald-700';
      case 'Lost': return 'bg-red-50 text-red-700';
      case 'Disqualified': return 'bg-red-50 text-red-600';
      default: return 'bg-zinc-100 text-zinc-800';
    }
  }

  getPriorityBadge(priority: string): string {
    switch(priority) {
      case 'High': return 'bg-red-50 text-red-700 border border-red-200';
      case 'Medium': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'Low': return 'bg-zinc-50 text-zinc-600 border border-zinc-100';
      default: return 'bg-zinc-50 text-zinc-600';
    }
  }

  getTempBadge(temp: string): string {
    switch(temp) {
      case 'Hot': return 'bg-red-50 text-red-700 border border-red-200';
      case 'Warm': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'Cold': return 'bg-sky-50 text-sky-700 border border-sky-200';
      default: return 'bg-zinc-50 text-zinc-600';
    }
  }

  getScoreColor(score: number): string {
    if (score >= 80) return 'bg-zinc-900';
    if (score >= 50) return 'bg-zinc-700';
    return 'bg-zinc-700';
  }

  getActivityIconClass(type: string): string {
    switch(type) {
      case 'Call': return 'bg-zinc-700 border-zinc-300';
      case 'Email': return 'bg-zinc-700 border-zinc-300';
      case 'Meeting': return 'bg-zinc-700 border-zinc-300';
      case 'Task': return 'bg-zinc-700 border-zinc-300';
      default: return 'bg-zinc-500 border-zinc-200';
    }
  }
}
