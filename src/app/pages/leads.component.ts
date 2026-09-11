import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Lead, LeadActivity, LeadAttachment, CrmUser } from '../services/crm-state.service';
import { ApiService } from '../services/api.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';

@Component({
  selector: 'app-leads',
  imports: [CommonModule, FormsModule, MatIconModule, TranslatePipe, UserAvatarComponent],
  template: `
    <div class="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      <!-- Page Header -->
      <div class="flex justify-end">
        <button (click)="openAddLeadModal()" class="bg-zinc-900 hover:bg-zinc-950 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-2 shadow-md hover:shadow-lg focus:outline-none">
          <mat-icon class="w-5 h-5 text-[20px]! leading-none!">add</mat-icon>
          {{ 'leads.addNew' | translate }}
        </button>
      </div>

      <!-- KPI Metrics Dashboard -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <!-- Metric 1: Total Leads -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-4 lg:p-6 flex items-center justify-between shadow-xs">
          <div class="space-y-1">
            <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{{ 'leads.totalLeads' | translate }}</span>
            <div class="text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 truncate">{{ totalLeadsCount() }}</div>
          </div>
          <div class="p-3 bg-zinc-100 text-zinc-900 rounded-xl">
            <mat-icon class="w-6 h-6 text-[24px]! leading-none!">people_outline</mat-icon>
          </div>
        </div>

        <!-- Metric 2: Qualified Leads -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-4 lg:p-6 flex items-center justify-between shadow-xs">
          <div class="space-y-1">
            <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{{ 'leads.qualifiedLeads' | translate }}</span>
            <div class="text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 truncate">{{ qualifiedLeadsCount() }}</div>
          </div>
          <div class="p-3 bg-zinc-100 text-zinc-900 rounded-xl">
            <mat-icon class="w-6 h-6 text-[24px]! leading-none!">verified_user</mat-icon>
          </div>
        </div>

        <!-- Metric 3: Avg Score -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-4 lg:p-6 flex items-center justify-between shadow-xs">
          <div class="space-y-1">
            <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{{ 'leads.avgScore' | translate }}</span>
            <div class="text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 truncate">{{ avgLeadScore() }}%</div>
          </div>
          <div class="p-3 bg-zinc-100 text-zinc-900 rounded-xl">
            <mat-icon class="w-6 h-6 text-[24px]! leading-none!">star_outline</mat-icon>
          </div>
        </div>

        <!-- Metric 4: Conversion Rate -->
        <div class="bg-white rounded-2xl border border-zinc-200 p-4 lg:p-6 flex items-center justify-between shadow-xs">
          <div class="space-y-1">
            <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{{ 'leads.conversionRate' | translate }}</span>
            <div class="text-lg sm:text-xl lg:text-2xl font-bold text-zinc-900 truncate">{{ conversionRate() }}%</div>
          </div>
          <div class="p-3 bg-zinc-100 text-zinc-900 rounded-xl">
            <mat-icon class="w-6 h-6 text-[24px]! leading-none!">trending_up</mat-icon>
          </div>
        </div>
      </div>

      <!-- Filters & Data Table Container -->
      <div class="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        <!-- Table Toolbar / Filters -->
        <div class="p-5 border-b border-zinc-100 flex flex-wrap gap-4 items-center justify-between bg-zinc-50/50">
          <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <!-- Search -->
            <div class="relative flex-1 sm:w-64">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 pointer-events-none">
                <mat-icon class="w-5 h-5 text-[20px]!">search</mat-icon>
              </span>
              <input
                [(ngModel)]="searchQuery"
                type="text"
                [placeholder]="'leads.searchPlaceholder' | translate"
                class="w-full border border-zinc-200 rounded-xl pl-10 pr-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700 transition-all placeholder:text-zinc-400"
              >
            </div>
            <!-- Status Filter -->
            <select [(ngModel)]="statusFilter" class="border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700">
              <option value="">{{ 'leads.allStatuses' | translate }}</option>
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
            <!-- Priority Filter -->
            <select [(ngModel)]="priorityFilter" class="border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-700/20 focus:border-zinc-700">
              <option value="">{{ 'leads.allPriorities' | translate }}</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div class="text-xs text-zinc-400 font-semibold uppercase">
            Showing {{ filteredLeads().length }} of {{ state.leadsData().length }} leads
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100">
            <thead class="bg-zinc-50/50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left">
                  <input type="checkbox" [checked]="allLeadsSelected()" (click)="toggleSelectAllLeads($event)" class="rounded border-zinc-300 cursor-pointer">
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">{{ 'leads.lead' | translate }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">{{ 'leads.company' | translate }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">{{ 'leads.qualification' | translate }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">{{ 'leads.leadScore' | translate }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">{{ 'leads.origin' | translate }}</th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">{{ 'leads.owner' | translate }}</th>
                <th scope="col" class="px-6 py-3 class-left text-xs font-bold text-zinc-400 uppercase tracking-wider">{{ 'leads.status' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200/80 bg-white">
              @for (lead of filteredLeads(); track lead.id) {
                <tr class="hover:bg-zinc-100/20 transition-colors group">
                  <td class="px-6 py-4 whitespace-nowrap" (click)="toggleLeadSelect(lead.id, $event)">
                    <input type="checkbox" [checked]="isLeadSelected(lead.id)" class="rounded border-zinc-300 cursor-pointer">
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                      <div class="h-10 w-10 bg-zinc-200/80 text-zinc-950 font-bold rounded-xl flex items-center justify-center shadow-xs">
                        {{ getInitials(lead.name) }}
                      </div>
                      <div>
                        <button (click)="selectLead(lead)" class="table-name-link text-sm font-semibold text-zinc-900 group-hover:text-zinc-900 transition-colors text-left" [title]="'View ' + lead.name">{{ lead.name }}</button>
                        <div class="text-xs text-zinc-400">{{ lead.id }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-zinc-800">{{ lead.companyName }}</div>
                    <div class="text-xs text-zinc-400">{{ lead.company?.city || ('leads.noCity' | translate) }}, {{ lead.company?.country || ('leads.noCountry' | translate) }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap" (click)="$event.stopPropagation()">
                    <select [ngModel]="lead.qualification" (ngModelChange)="onQualificationChange(lead.id, $event)" (click)="$event.stopPropagation()" [class]="getQualificationClass(lead.qualification)" class="px-2 py-0.5 text-meta font-bold uppercase rounded-md border cursor-pointer focus:outline-none" title="Change qualification">
                      @for (q of leadQualificationOptions; track q) { <option [value]="q">{{ q }}</option> }
                    </select>
                    <div class="flex items-center gap-1.5 mt-1">
                      <span [class]="getPriorityBadge(lead.priority)" class="px-2 py-0.5 text-meta font-bold uppercase rounded-md">
                        {{ lead.priority }}
                      </span>
                      <span [class]="getTempBadge(lead.temperature)" class="px-2 py-0.5 text-meta font-bold uppercase rounded-md">
                        {{ lead.temperature }}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap" (click)="$event.stopPropagation()">
                    @if (scoreEditFor() === lead.id) {
                      <div class="flex items-center gap-2">
                        <input type="range" min="0" max="100" step="1" [ngModel]="scoreDraft()" (ngModelChange)="scoreDraft.set($event)" (change)="commitScore(lead.id)" class="w-28 accent-zinc-900 cursor-pointer" [attr.aria-label]="'Score for ' + lead.name">
                        <span class="text-xs font-bold text-zinc-700 w-7 text-right">{{ scoreDraft() }}</span>
                      </div>
                    } @else {
                      <button (click)="openScoreEditor(lead, $event)" class="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-zinc-100 transition-colors" [title]="'Click to adjust score'">
                        <div class="w-12 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                          <div [style.width.%]="lead.score" [class]="getScoreColor(lead.score)" class="h-full rounded-full"></div>
                        </div>
                        <span class="text-xs font-bold text-zinc-700">{{ lead.score }}</span>
                      </button>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-1.5">
                      <span class="px-2 py-0.5 text-meta font-semibold rounded-md bg-zinc-100 text-zinc-700">
                        {{ lead.origin || lead.campaigns?.[0]?.source || '—' }}
                      </span>
                    </div>
                    <div class="text-xs text-zinc-400 mt-0.5">{{ lead.campaigns?.[0]?.campaign || '—' }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap" (click)="$event.stopPropagation()">
                    <button (click)="openOwnerMenu(lead, $event)" class="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-zinc-100 transition-colors max-w-[160px]" title="Assign owner">
                      @if (lead.assignedToUserId) {
                        <app-user-avatar [userId]="lead.assignedToUserId" [size]="20" />
                      } @else {
                        <mat-icon class="w-4 h-4 text-[16px]! text-zinc-400">person_outline</mat-icon>
                      }
                      <span class="text-sm text-zinc-600 truncate">{{ state.leadOwnerName(lead) || ('leads.unassigned' | translate) }}</span>
                      <mat-icon class="w-3.5 h-3.5 text-[14px]! text-zinc-400 shrink-0">expand_more</mat-icon>
                    </button>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap" (click)="$event.stopPropagation()">
                    <select [ngModel]="lead.status" (ngModelChange)="onStatusChange(lead.id, $event)" (click)="$event.stopPropagation()" [class]="getStatusClass(lead.status)" class="px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer focus:outline-none shadow-xs" title="Change status">
                      @for (s of leadStatusOptions; track s) { <option [value]="s">{{ s }}</option> }
                    </select>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="px-6 py-12 text-center text-zinc-400">
                    <mat-icon class="text-[48px]! w-12 h-12 mb-3 text-zinc-300 block mx-auto">people_alt</mat-icon>
                    <p class="font-semibold text-zinc-500">{{ 'leads.noLeads' | translate }}</p>
                    <p class="text-xs text-zinc-400 mt-1">{{ 'leads.noLeadsHint' | translate }}</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Owner picker popover (fixed: avoids clipping by the table's overflow-x container) -->
      @if (ownerMenuFor(); as menuLeadId) {
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
        <div class="fixed inset-0 z-[60]" (click)="closeOwnerMenu()" (window:scroll)="closeOwnerMenu()" (window:resize)="closeOwnerMenu()">
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
          <div class="fixed bg-white border border-zinc-200 rounded-xl shadow-xl py-1.5 w-64 max-h-72 overflow-y-auto" [style.left.px]="ownerMenuPos().x" [style.top.px]="ownerMenuPos().y" (click)="$event.stopPropagation()">
            <button (click)="chooseOwner(menuLeadId, null)" class="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-zinc-50 text-left text-xs font-semibold text-zinc-500">
              <span class="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center shrink-0"><mat-icon class="text-zinc-400 text-[16px]! w-4 h-4">person_off</mat-icon></span>
              {{ 'leads.unassigned' | translate }}
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

      @if (selectedLeadIds().size > 0) {
        <div class="bulk-action-bar">
          <span class="text-body font-semibold">{{ selectedLeadIds().size }} {{ 'leads.selected' | translate }}</span>
          <div class="w-px h-4 bg-white/20"></div>
          <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkAssignLeadOwner($event)">
            <option value="">{{ 'leads.assignOwner' | translate }}</option>
            @for (u of state.assignableMembers(); track u.id) { <option [value]="u.id">{{u.displayName}}</option> }
          </select>
          <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkChangeLeadStage($event)">
            <option value="">{{ 'leads.changeStage' | translate }}</option>
            @for (s of leadStatusOptions; track s) { <option [value]="s">{{s}}</option> }
          </select>
          <button class="text-body font-semibold px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors" (click)="bulkExportLeads()">{{ 'leads.exportCSV' | translate }}</button>
          <button class="text-meta ml-2 opacity-70 hover:opacity-100 transition-opacity" (click)="clearLeadSelection()">{{ 'leads.clear' | translate }}</button>
        </div>
      }
    </div>

    <!-- Slide-over details pane for lead -->
    @if (selectedLead(); as lead) {
      <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
        <div class="absolute inset-0 overflow-hidden">
          <!-- Backdrop -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
          <div (click)="closeDetails()" class="absolute inset-0 bg-transparent"></div>

          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div class="pointer-events-auto w-screen max-w-2xl transform bg-white shadow-2xl border-l border-zinc-200 flex flex-col h-full animate-in slide-in-from-right duration-300">
              
              <!-- Header -->
              <div class="px-6 py-5 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="h-12 w-12 bg-zinc-900 text-white font-extrabold rounded-xl flex items-center justify-center shadow-md">
                    {{ getInitials(lead.name) }}
                  </div>
                  <div>
                    <h2 class="text-xl font-bold text-zinc-900" id="slide-over-title">{{ lead.name }}</h2>
                    <p class="text-xs text-zinc-400 font-semibold">{{ lead.id }} &bull; {{ lead.companyName }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <!-- Change Status Quick Dropdown -->
                  <div class="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-lg px-2 py-1">
                    <span class="text-meta uppercase font-bold text-zinc-400">{{ 'leads.status' | translate }}:</span>
                    <select [ngModel]="lead.status" (ngModelChange)="onStatusChange(lead.id, $event)" class="text-xs font-semibold text-zinc-700 bg-transparent border-none focus:outline-none cursor-pointer">
                      <option value="New">{{ 'leads.new' | translate }}</option>
                      <option value="Contacted">{{ 'leads.contacted' | translate }}</option>
                      <option value="Attempted Contact">{{ 'leads.attemptedContact' | translate }}</option>
                      <option value="Meeting Scheduled">{{ 'leads.meetingScheduled' | translate }}</option>
                      <option value="Qualified">{{ 'leads.qualified' | translate }}</option>
                      <option value="Proposal Requested">{{ 'leads.proposalRequested' | translate }}</option>
                      <option value="Converted">{{ 'leads.converted' | translate }}</option>
                      <option value="Lost">{{ 'leads.lost' | translate }}</option>
                      <option value="Disqualified">{{ 'leads.disqualified' | translate }}</option>
                    </select>
                  </div>

                  <button (click)="closeDetails()" class="text-zinc-400 hover:text-zinc-600 transition-colors p-1.5 hover:bg-zinc-100 rounded-lg">
                    <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
                  </button>
                </div>
              </div>

              <!-- Tabs Nav -->
              <div class="px-6 border-b border-zinc-100 flex gap-6 bg-zinc-50/50">
                <button (click)="activeDetailTab.set('info')" [class.border-zinc-900]="activeDetailTab() === 'info'" [class.text-zinc-900]="activeDetailTab() === 'info'" class="py-3 border-b-2 border-transparent text-sm font-semibold text-zinc-500 hover:text-zinc-800 transition-all">{{ 'leads.info' | translate }}</button>
                <button (click)="activeDetailTab.set('activities')" [class.border-zinc-900]="activeDetailTab() === 'activities'" [class.text-zinc-900]="activeDetailTab() === 'activities'" class="py-3 border-b-2 border-transparent text-sm font-semibold text-zinc-500 hover:text-zinc-800 transition-all">{{ 'leads.activitiesNotes' | translate }}</button>
                <button (click)="activeDetailTab.set('attachments')" [class.border-zinc-900]="activeDetailTab() === 'attachments'" [class.text-zinc-900]="activeDetailTab() === 'attachments'" class="py-3 border-b-2 border-transparent text-sm font-semibold text-zinc-500 hover:text-zinc-800 transition-all">{{ 'leads.attachments' | translate }}</button>
                <button (click)="activeDetailTab.set('history')" [class.border-zinc-900]="activeDetailTab() === 'history'" [class.text-zinc-900]="activeDetailTab() === 'history'" class="py-3 border-b-2 border-transparent text-sm font-semibold text-zinc-500 hover:text-zinc-800 transition-all">{{ 'leads.statusHistory' | translate }}</button>
              </div>

              <!-- Scrollable content -->
              <div class="flex-1 overflow-y-auto p-6 space-y-6">
                <!-- TAB: Info -->
                @if (activeDetailTab() === 'info') {
                  <div class="space-y-6 animate-in fade-in duration-100">
                    <!-- Basic Information -->
                    <div class="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 space-y-3">
                      <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Basic Information</h3>
                      <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Lead Name</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.name }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Company</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.companyName }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Assigned Salesperson</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.assignedSalesperson || 'Unassigned' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Sales Team</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.salesTeam || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Email</div>
                          <a href="mailto:{{ lead.contacts?.[0]?.email }}" class="font-medium text-zinc-900 hover:underline mt-0.5 block">{{ lead.contacts?.[0]?.email || '—' }}</a>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Phone</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.contacts?.[0]?.phone || '—' }}</div>
                        </div>
                        @if (lead.contacts?.[0]?.website; as web) {
                          <div>
                            <div class="text-meta uppercase font-semibold text-zinc-400">Website</div>
                            <a href="http://{{web}}" target="_blank" class="font-medium text-zinc-900 hover:underline mt-0.5 block">{{ web }}</a>
                          </div>
                        }
                        @if (lead.contacts?.[0]?.linkedin; as li) {
                          <div>
                            <div class="text-meta uppercase font-semibold text-zinc-400">LinkedIn</div>
                            <a href="http://{{li}}" target="_blank" class="font-medium text-zinc-900 hover:underline mt-0.5 block">{{ li }}</a>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Company Information -->
                    <div class="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 space-y-3">
                      <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Company Information</h3>
                      <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Industry</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.company?.industry || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Company Size</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.company?.size || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Annual Revenue</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.company?.annualRevenue || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Offices Count</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.company?.officesCount || '—' }}</div>
                        </div>
                        <div class="col-span-2">
                          <div class="text-meta uppercase font-semibold text-zinc-400">Address</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.company?.address || '—' }}, {{ lead.company?.city || '—' }}, {{ lead.company?.country || '—' }}</div>
                        </div>
                      </div>
                    </div>

                    <!-- Lead Origin & Campaign -->
                    <div class="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 space-y-3">
                      <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Origin & Marketing Campaign</h3>
                      <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Origin</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Campaign</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.campaigns?.[0]?.campaign || '—' }}</div>
                        </div>
                        @if (lead.campaigns?.[0]?.referralPartner) {
                          <div>
                            <div class="text-meta uppercase font-semibold text-zinc-400">Referral Partner</div>
                            <div class="font-medium text-zinc-800 mt-0.5">{{ lead.campaigns?.[0]?.referralPartner }}</div>
                          </div>
                        }
                        @if (lead.campaigns?.[0]?.tradeShow) {
                          <div>
                            <div class="text-meta uppercase font-semibold text-zinc-400">Trade Show</div>
                            <div class="font-medium text-zinc-800 mt-0.5">{{ lead.campaigns?.[0]?.tradeShow }}</div>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Decision Makers -->
                    <div class="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 space-y-3">
                      <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Key Stakeholders (B2B)</h3>
                      <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Decision Maker</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.decisionMaker || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Influencer</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.influencer || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Finance Contact</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.financeContact || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Technical Contact</div>
                          <div class="font-medium text-zinc-800 mt-0.5">{{ lead.technicalContact || '—' }}</div>
                        </div>
                      </div>
                    </div>

                    <!-- Audit Trail -->
                    <div class="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 space-y-3">
                      <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Audit Trail</h3>
                      <div class="grid grid-cols-2 gap-4 text-meta text-zinc-500">
                        <div>
                          <div>Created Date</div>
                          <div class="font-semibold text-zinc-700 mt-0.5">{{ lead.createdDate }} by {{ lead.createdBy }}</div>
                        </div>
                        <div>
                          <div>Modified Date</div>
                          <div class="font-semibold text-zinc-700 mt-0.5">{{ lead.modifiedDate }} by {{ lead.modifiedBy }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                }

                <!-- TAB: Activities & Notes -->
                @if (activeDetailTab() === 'activities') {
                  <div class="space-y-6 animate-in fade-in duration-100">
                    <!-- Product Interest & Budget details -->
                    <div class="bg-zinc-100/40 rounded-xl p-4 border border-zinc-200 space-y-3 text-sm">
                      <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Lead Qualification & Sales Potential</h3>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Interested Product</div>
                          <div class="font-semibold text-zinc-850 mt-0.5">{{ lead.productInterests?.[0]?.product || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Solution</div>
                          <div class="font-medium text-zinc-700 mt-0.5">{{ lead.productInterests?.[0]?.solution || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Origin</div>
                          <div class="font-bold text-zinc-950 mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div>
                        </div>
                        <div>
                          <div class="text-meta uppercase font-semibold text-zinc-400">Deal Probability</div>
                          <div class="font-medium text-zinc-750 mt-0.5">{{ lead.probability || '0' }}%</div>
                        </div>
                      </div>
                    </div>

                    <!-- Free text Notes -->
                    <div class="space-y-2">
                      <label for="notes_comments" class="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Notes & Comments</label>
                      <div class="bg-zinc-100/50 border border-zinc-300/60 rounded-xl p-4 text-sm text-zinc-700 leading-relaxed font-sans shadow-xs whitespace-pre-line">
                        {{ lead.notes || 'No notes added for this lead yet.' }}
                      </div>
                    </div>

                    <!-- Log New Activity Form -->
                    <div class="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                      <h3 class="text-xs font-bold text-zinc-700 uppercase">Log New Activity</h3>
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label for="type" class="block text-meta uppercase font-semibold text-zinc-400 mb-1">Type</label>
                          <select id="type" [(ngModel)]="newActivity.type" class="w-full border border-zinc-200 rounded-lg p-2 text-xs bg-white focus:outline-blue-600">
                            <option value="Call">Call</option>
                            <option value="Email">Email</option>
                            <option value="Meeting">Meeting</option>
                            <option value="Note">Note</option>
                            <option value="Task">Task</option>
                          </select>
                        </div>
                        <div>
                          <label for="date" class="block text-meta uppercase font-semibold text-zinc-400 mb-1">Date</label>
                          <input id="date" [(ngModel)]="newActivity.date" type="date" class="w-full border border-zinc-200 rounded-lg p-1.5 text-xs focus:outline-blue-600">
                        </div>
                      </div>
                      <div>
                        <label for="summary" class="block text-meta uppercase font-semibold text-zinc-400 mb-1">Summary</label>
                        <input id="summary" [(ngModel)]="newActivity.summary" type="text" placeholder="e.g. Discussed pricing options" class="w-full border border-zinc-200 rounded-lg p-2 text-xs focus:outline-blue-600">
                      </div>
                      <div>
                        <label for="details_optional" class="block text-meta uppercase font-semibold text-zinc-400 mb-1">Details (Optional)</label>
                        <textarea id="details_optional" [(ngModel)]="newActivity.detail" rows="2" placeholder="More detailed recap..." class="w-full border border-zinc-200 rounded-lg p-2 text-xs focus:outline-blue-600"></textarea>
                      </div>
                      <div class="flex justify-end pt-2">
                        <button (click)="submitActivity(lead.id)" class="bg-zinc-800 hover:bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs">
                          Log Activity
                        </button>
                      </div>
                    </div>

                    <!-- Activity History Timeline -->
                    <div class="space-y-4">
                      <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Interactions Timeline</h3>
                      <div class="space-y-4">
                        @for (act of lead.activities; track act.id) {
                          <div class="flex gap-4 items-start border-l-2 border-zinc-100 pl-4 relative">
                            <div class="absolute -left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-white flex items-center justify-center"
                                 [class]="getActivityIconClass(act.type)">
                            </div>
                            <div class="flex-1 space-y-1">
                              <div class="flex justify-between items-center">
                                <span class="text-xs font-semibold text-zinc-800">{{ act.summary }}</span>
                                <span class="text-meta text-zinc-400 font-medium">{{ act.date }}</span>
                              </div>
                              @if (act.detail) {
                                <p class="text-xs text-zinc-500 leading-relaxed">{{ act.detail }}</p>
                              }
                              <div class="text-meta font-semibold text-zinc-400 flex items-center gap-1">
                                <span class="px-1.5 py-0.5 rounded bg-zinc-100">{{ act.type }}</span>
                                @if (act.assignedTo) {
                                  <span>Assigned: {{ act.assignedTo }}</span>
                                }
                              </div>
                            </div>
                          </div>
                        } @empty {
                          <p class="text-xs text-zinc-400 text-center py-4">No logged interactions yet.</p>
                        }
                      </div>
                    </div>
                  </div>
                }

                <!-- TAB: Attachments -->
                @if (activeDetailTab() === 'attachments') {
                  <div class="space-y-6 animate-in fade-in duration-100">
                    <div class="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
                      <h3 class="text-xs font-bold text-zinc-700 uppercase">Upload Document</h3>
                      <div class="flex gap-3 items-center">
                        <input type="file" (change)="onFileSelected($event, lead.id)" class="flex-1 text-xs">
                        @if (uploading()) { <span class="text-meta text-zinc-400">Uploading&hellip;</span> }
                      </div>
                    </div>

                    <div class="space-y-3">
                      <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Uploaded Files</h3>
                      <div class="divide-y divide-slate-100 bg-zinc-50/50 rounded-xl border border-zinc-100 overflow-hidden">
                        @for (file of lead.attachments; track file.id) {
                          <div class="px-4 py-3 flex justify-between items-center text-xs">
                            <div class="flex items-center gap-2.5">
                              <mat-icon class="text-zinc-400 text-[20px]! w-5 h-5">insert_drive_file</mat-icon>
                              <div>
                                <div class="font-medium text-zinc-800">
                                  @if (file.fileId) {
                                    <a [href]="getDownloadUrl(file.fileId)" target="_blank" class="hover:underline">{{ file.fileName }}</a>
                                  } @else { {{ file.fileName }} }
                                </div>
                                <div class="text-meta text-zinc-400">Uploaded: {{ file.uploadedAt }} &bull; {{ file.fileSize || 'N/A' }}</div>
                              </div>
                            </div>
                            <button (click)="deleteAttachment(lead.id, file)" class="text-zinc-400 hover:text-zinc-900 transition-colors">
                              <mat-icon class="text-[16px]! w-4 h-4">delete_outline</mat-icon>
                            </button>
                          </div>
                        } @empty {
                          <p class="text-xs text-zinc-400 text-center py-6">No attachments uploaded yet.</p>
                        }
                      </div>
                    </div>
                  </div>
                }

                <!-- TAB: Status History -->
                @if (activeDetailTab() === 'history') {
                  <div class="space-y-4 animate-in fade-in duration-100">
                    <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Status Transition Log</h3>
                    <div class="space-y-4">
                      @for (hist of lead.statusHistory; track $index) {
                        <div class="flex gap-4 items-start pl-4 border-l-2 border-zinc-100 relative">
                          <div class="absolute -left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-zinc-900"></div>
                          <div class="flex-1 text-xs">
                            <div class="flex justify-between font-semibold text-zinc-800">
                              <span>Status updated to: {{ hist.status }}</span>
                              <span class="text-meta text-zinc-400 font-medium">{{ hist.timestamp }}</span>
                            </div>
                            <div class="text-meta text-zinc-400 font-medium mt-0.5">Changed by: {{ hist.user }}</div>
                          </div>
                        </div>
                      } @empty {
                        <p class="text-xs text-zinc-400 text-center py-4">No status changes logged.</p>
                      }
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
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">

          <div class="flex justify-between items-center pb-3 border-b border-zinc-100">
            <h3 class="text-lg font-bold text-zinc-950">{{ 'leads.addNew' | translate }}</h3>
            <button (click)="addLeadModalOpen.set(false)" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
            </button>
          </div>

          <div class="space-y-4 text-xs font-sans">
            <!-- Basic Section -->
            <div class="space-y-2.5">
              <h4 class="font-bold text-zinc-950 uppercase tracking-wider text-meta">1. Basic Information</h4>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="lead_name" class="block font-semibold text-zinc-500 mb-1">Lead Name*</label>
                  <input id="lead_name" [(ngModel)]="newLead.name" type="text" placeholder="e.g. John Doe" class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600">
                </div>
                <div>
                  <label for="company_name" class="block font-semibold text-zinc-500 mb-1">Company Name*</label>
                  <input id="company_name" [(ngModel)]="newLead.companyName" type="text" placeholder="e.g. Acmo Group" class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600">
                </div>
                <div>
                  <label for="email" class="block font-semibold text-zinc-500 mb-1">Email</label>
                  <input id="email" [(ngModel)]="newLead.email" type="email" placeholder="e.g. email@acmo.com" class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600">
                </div>
                <div>
                  <label for="phone" class="block font-semibold text-zinc-500 mb-1">Phone</label>
                  <input id="phone" [(ngModel)]="newLead.phone" type="text" placeholder="e.g. +212-6..." class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600">
                </div>
              </div>
            </div>

            <!-- Company Section -->
            <div class="space-y-2.5">
              <h4 class="font-bold text-zinc-950 uppercase tracking-wider text-meta">2. Company Information</h4>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="industry" class="block font-semibold text-zinc-500 mb-1">Industry</label>
                  <input id="industry" [(ngModel)]="newLead.industry" type="text" placeholder="e.g. Healthcare" class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600">
                </div>
                <div>
                  <label for="company_size" class="block font-semibold text-zinc-500 mb-1">Company Size</label>
                  <input id="company_size" [(ngModel)]="newLead.companySize" type="text" placeholder="e.g. 200 employees" class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600">
                </div>
                <div>
                  <label for="city" class="block font-semibold text-zinc-500 mb-1">City</label>
                  <input id="city" [(ngModel)]="newLead.city" type="text" placeholder="Casablanca" class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600">
                </div>
                <div>
                  <label for="country" class="block font-semibold text-zinc-500 mb-1">Country</label>
                  <input id="country" [(ngModel)]="newLead.country" type="text" placeholder="Morocco" class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600">
                </div>
              </div>
            </div>

            <!-- Qualification & Source -->
            <div class="space-y-2.5">
              <h4 class="font-bold text-zinc-950 uppercase tracking-wider text-meta">3. Qualification & Source</h4>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label for="status" class="block font-semibold text-zinc-500 mb-1">Status</label>
                  <select id="status" [(ngModel)]="newLead.status" class="w-full border border-zinc-200 rounded-lg p-2 bg-white focus:outline-blue-600">
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
                <div>
                  <label for="priority" class="block font-semibold text-zinc-500 mb-1">Priority</label>
                  <select id="priority" [(ngModel)]="newLead.priority" class="w-full border border-zinc-200 rounded-lg p-2 bg-white focus:outline-blue-600">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label for="temperature" class="block font-semibold text-zinc-500 mb-1">Temperature</label>
                  <select id="temperature" [(ngModel)]="newLead.temperature" class="w-full border border-zinc-200 rounded-lg p-2 bg-white focus:outline-blue-600">
                    <option value="Cold">Cold</option>
                    <option value="Warm">Warm</option>
                    <option value="Hot">Hot</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="origin" class="block font-semibold text-zinc-500 mb-1">Origin</label>
                  <select id="origin" [(ngModel)]="newLead.origin" class="w-full border border-zinc-200 rounded-lg p-2 bg-white focus:outline-blue-600">
                    <option value="Landing Page">Landing Page</option>
                    <option value="Marketing Campaign">Marketing Campaign</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label for="product_interest" class="block font-semibold text-zinc-500 mb-1">Product Interest</label>
                  <input id="product_interest" [(ngModel)]="newLead.interestedProduct" type="text" placeholder="e.g. Cloud Hosting" class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600">
                </div>
                <div>
                  <label for="assigned_salesperson" class="block font-semibold text-zinc-500 mb-1">Assigned Salesperson</label>
                  <select id="assigned_salesperson" [(ngModel)]="newLead.assignedSalesperson" class="w-full border border-zinc-200 rounded-lg p-2 bg-white focus:outline-blue-600">
                    <option value="">-- Unassigned --</option>
                    @for (user of state.users(); track user.name) {
                      <option [value]="user.name">{{ user.name }} ({{ user.role }})</option>
                    }
                  </select>
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label for="notes" class="block font-semibold text-zinc-500 mb-1">Notes</label>
              <textarea id="notes" [(ngModel)]="newLead.notes" rows="3" placeholder="Evaluate legacy systems, downtime concerns, etc." class="w-full border border-zinc-200 rounded-lg p-2 focus:outline-blue-600"></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-zinc-100 text-xs">
            <button (click)="addLeadModalOpen.set(false)" class="px-4 py-2 border border-zinc-200 text-zinc-600 font-semibold rounded-lg hover:bg-zinc-50">
              Cancel
            </button>
            <button (click)="saveLead()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white font-semibold rounded-lg shadow-sm">
              Save Lead Record
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class LeadsComponent {
  state = inject(CrmStateService);
  api = inject(ApiService);
  translation = inject(TranslationService);
  uploading = signal(false);

  // Filters state
  searchQuery = '';
  statusFilter = '';
  priorityFilter = '';

  // Modals & Panels state
  selectedLead = signal<Lead | null>(null);
  activeDetailTab = signal<'info' | 'activities' | 'attachments' | 'history'>('info');
  addLeadModalOpen = signal(false);

  // Bulk selection state
  selectedLeadIds = signal<Set<string>>(new Set());
  leadStatusOptions = ['New','Contacted','Attempted Contact','Meeting Scheduled','Qualified','Proposal Requested','Converted','Lost','Disqualified'];
  leadQualificationOptions: Lead['qualification'][] = ['Qualified','Unqualified','Pending'];

  // Inline table editors state
  scoreEditFor = signal<string | null>(null);
  scoreDraft = signal<number>(0);
  ownerMenuFor = signal<string | null>(null);
  ownerMenuPos = signal({ x: 0, y: 0 });

  // Forms state
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

  // KPI Computations
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

  // Filtered Leads list
  filteredLeads = computed(() => {
    let list = this.state.leadsData();

    if (this.statusFilter) {
      list = list.filter(l => l.status === this.statusFilter);
    }
    if (this.priorityFilter) {
      list = list.filter(l => l.priority === this.priorityFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(l => 
        l.name.toLowerCase().includes(q) || 
        l.companyName.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      );
    }
    return list;
  });

  allLeadsSelected = computed(() => {
    const leads = this.filteredLeads();
    return leads.length > 0 && leads.every(l => this.selectedLeadIds().has(l.id));
  });

  // Bulk selection actions
  toggleLeadSelect(id: string, event: Event) {
    event.stopPropagation();
    const current = new Set(this.selectedLeadIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedLeadIds.set(current);
  }

  isLeadSelected(id: string): boolean {
    return this.selectedLeadIds().has(id);
  }

  toggleSelectAllLeads(event: Event) {
    event.stopPropagation();
    const leads = this.filteredLeads();
    if (this.allLeadsSelected()) {
      this.selectedLeadIds.set(new Set());
    } else {
      this.selectedLeadIds.set(new Set(leads.map(l => l.id)));
    }
  }

  clearLeadSelection() {
    this.selectedLeadIds.set(new Set());
  }

  bulkAssignLeadOwner(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    select.value = '';
    if (!value) return;
    for (const id of this.selectedLeadIds()) {
      this.state.assignLead(id, value);
    }
  }

  bulkChangeLeadStage(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) return;
    for (const id of this.selectedLeadIds()) {
      this.state.updateLeadStatus(id, value as Lead['status']);
    }
  }

  bulkExportLeads() {
    const ids = this.selectedLeadIds();
    const leads = this.state.leadsData().filter(l => ids.has(l.id));
    const header = ['Name', 'Company', 'Status', 'Score', 'Owner'];
    const rows = leads.map(l => [
      l.name,
      l.companyName,
      l.status,
      String(l.score),
      l.assignedSalesperson || 'Unassigned'
    ]);
    const csvEscape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leads-export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Lifecycle/Selection actions
  selectLead(lead: Lead) {
    this.selectedLead.set(lead);
    this.state.loadLeadDetails(lead.id);
    this.activeDetailTab.set('info');
    // reset activity form
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
    // Refresh details reference in signals
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) {
      this.selectedLead.set(updated);
    }
  }

  // Activity submit
  submitActivity(leadId: string) {
    if (!this.newActivity.summary.trim()) return;
    this.state.addLeadActivity(leadId, {
      type: this.newActivity.type,
      date: this.newActivity.date,
      summary: this.newActivity.summary,
      detail: this.newActivity.detail,
      assignedTo: 'Achraf (Manager)'
    });

    // Refresh details reference
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) {
      this.selectedLead.set(updated);
    }

    // Reset activity form
    this.newActivity = {
      type: 'Call',
      date: new Date().toISOString().split('T')[0],
      summary: '',
      detail: ''
    };
  }

  // Attachment upload
  onFileSelected(event: Event, leadId: string) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
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
    this.state.removeLeadAttachment(leadId, file.id);
    if (file.fileId) {
      this.api.deleteFile(file.fileId).subscribe({ error: () => { /* handle error */ } });
    }
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) {
      this.selectedLead.set(updated);
    }
  }

  // Add Lead Modal handlers
  openAddLeadModal() {
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
    if (!this.newLead.name.trim() || !this.newLead.companyName.trim()) {
      alert('Lead Name and Company Name are required.');
      return;
    }

    const randomScore = Math.floor(Math.random() * 40) + 50; // 50 to 90
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
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days out
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

  // Inline table editors (qualification / score / status / owner)
  onQualificationChange(leadId: string, value: Lead['qualification']) {
    this.state.updateLead(leadId, { qualification: value });
    const updated = this.state.leadsData().find(l => l.id === leadId);
    if (updated) this.selectedLead.set(updated);
  }

  openScoreEditor(lead: Lead, event: Event) {
    event.stopPropagation();
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
