import { Component, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Lead, LeadActivity, LeadAttachment } from '../services/crm-state.service';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { ApiService } from '../services/api.service';
import { WhatsAppInboxStore } from '../services/domains/whatsapp-inbox.service';
import { WaThreadComponent } from '../shared/whatsapp/wa-thread.component';
import { WaComposerComponent } from '../shared/whatsapp/wa-composer.component';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-lead-detail',
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink, CreatedByBadgeComponent, UserAvatarComponent,
    WaThreadComponent, WaComposerComponent, TranslatePipe],
  template: `
    <div class="space-y-6 font-sans max-w-5xl mx-auto">
      <a routerLink="/partners" class="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors">
        <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">arrow_back</mat-icon>
        Back to Partners
      </a>

      @if (lead(); as lead) {
        <!-- Header -->
        <div class="card rounded-2xl p-6">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-4">
              <div class="h-14 w-14 bg-zinc-100 text-zinc-950 font-extrabold rounded-xl flex items-center justify-center text-lg">
                {{ getInitials(lead.name) }}
              </div>
              <div>
                <h2 class="text-2xl font-bold text-zinc-900">{{ lead.name }}</h2>
                <p class="text-sm text-zinc-500 font-semibold mt-0.5">{{ lead.id }} &bull; {{ lead.companyName }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <span [class]="getStatusClass(lead.status)" class="px-2.5 py-1 text-xs font-semibold rounded-full badge">{{ lead.status }}</span>
                  <span [class]="getPriorityBadge(lead.priority)" class="px-2 py-0.5 text-meta font-bold uppercase rounded-md badge">{{ lead.priority }}</span>
                  <span [class]="getTempBadge(lead.temperature)" class="px-2 py-0.5 text-meta font-bold uppercase rounded-md badge">{{ lead.temperature }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
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
              @if (lead.status !== 'Converted') {
                <div class="relative">
                  <button (click)="toggleConvertMenu($event)" class="bg-zinc-900 hover:bg-zinc-950 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <mat-icon class="text-[14px] w-3.5 h-3.5">arrow_forward</mat-icon>
                    Convert
                  </button>
                  @if (showConvertMenu()) {
                    <div class="absolute right-0 top-9 bg-white border border-zinc-200 rounded-xl shadow-lg py-1.5 z-10 w-44 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                      <button (click)="$event.stopPropagation(); convertToProspect(lead)" class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 font-medium cursor-pointer">
                        <mat-icon class="text-zinc-400 text-sm w-4 h-4">swap_horiz</mat-icon>
                        Convert to Prospect
                      </button>
                      <button (click)="$event.stopPropagation(); markLeadAsLost(lead)" class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 font-medium cursor-pointer">
                        <mat-icon class="text-zinc-400 text-sm w-4 h-4">cancel</mat-icon>
                        Mark as Lost
                      </button>
                      <button (click)="$event.stopPropagation(); deleteLead(lead)" class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 font-medium cursor-pointer">
                        <mat-icon class="text-red-400 text-sm w-4 h-4">delete_outline</mat-icon>
                        Delete Lead
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div class="card rounded-2xl p-4">
            <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider">Lead Score</span>
            <div class="flex items-center gap-2 mt-1">
              <div class="flex-1 bg-white/30 rounded-full h-2 overflow-hidden">
                <div [style.width.%]="lead.score" [class]="getScoreColor(lead.score)" class="h-full rounded-full"></div>
              </div>
              <span class="text-lg font-bold" [class]="lead.score >= 80 ? 'text-zinc-900' : lead.score >= 50 ? 'text-zinc-900' : 'text-zinc-900'">{{ lead.score }}</span>
            </div>
          </div>
          <div class="card rounded-2xl p-4">
            <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider">Origin</span>
            <div class="text-lg font-bold text-zinc-900 mt-1">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div>
          </div>
          <div class="card rounded-2xl p-4">
            <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider">Probability</span>
            <div class="text-lg font-bold text-zinc-900 mt-1">{{ lead.probability || '0' }}%</div>
          </div>
          <div class="card rounded-2xl p-4">
            <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider">Expected Close</span>
            <div class="text-lg font-bold text-zinc-900 mt-1">{{ lead.expectedCloseDate || '—' }}</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="card rounded-2xl overflow-hidden">
          <div class="px-6 border-b border-white/20 flex gap-6">
            <button (click)="activeTab.set('info')" [class]="activeTab() === 'info' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'" class="py-3 border-b-2 text-sm font-semibold transition-all">Info</button>
            <button (click)="activeTab.set('activities')" [class]="activeTab() === 'activities' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'" class="py-3 border-b-2 text-sm font-semibold transition-all">Activities & Notes</button>
            <button (click)="activeTab.set('attachments')" [class]="activeTab() === 'attachments' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'" class="py-3 border-b-2 text-sm font-semibold transition-all">Attachments</button>
            <button (click)="activeTab.set('history')" [class]="activeTab() === 'history' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'" class="py-3 border-b-2 text-sm font-semibold transition-all">Status History</button>
            @if (canReadWhatsApp()) {
              <button (click)="openWhatsAppTab(lead.id)" [class]="activeTab() === 'whatsapp' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'" class="py-3 border-b-2 text-sm font-semibold transition-all">{{ 'inbox.leadTab.title' | translate }}</button>
            }
          </div>

          <div class="p-6">
            @if (activeTab() === 'info') {
              <div class="space-y-6">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <!-- Basic Information -->
                  <div class="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
                    <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Basic Information</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Lead Name</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.name }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Company</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.companyName }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Assigned Salesperson</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.assignedSalesperson || 'Unassigned' }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Sales Team</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.salesTeam || '—' }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Email</div><a href="mailto:{{ lead.contacts?.[0]?.email }}" class="font-semibold text-zinc-900 hover:underline mt-0.5 block truncate">{{ lead.contacts?.[0]?.email || '—' }}</a></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Phone</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.contacts?.[0]?.phone || '—' }}</div></div>
                      @if (lead.contacts?.[0]?.website; as web) {
                        <div><div class="text-meta uppercase font-semibold text-zinc-400">Website</div><a href="http://{{web}}" target="_blank" class="font-semibold text-zinc-900 hover:underline mt-0.5 block truncate">{{ web }}</a></div>
                      }
                      @if (lead.contacts?.[0]?.linkedin; as li) {
                        <div><div class="text-meta uppercase font-semibold text-zinc-400">LinkedIn</div><a href="http://{{li}}" target="_blank" class="font-semibold text-zinc-900 hover:underline mt-0.5 block truncate">{{ li }}</a></div>
                      }
                    </div>
                  </div>

                  <!-- Company Information -->
                  <div class="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
                    <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Company Information</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Industry</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.industry || '—' }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Company Size</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.size || '—' }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Annual Revenue</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.annualRevenue || '—' }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Offices Count</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.officesCount || '—' }}</div></div>
                      <div class="col-span-2"><div class="text-meta uppercase font-semibold text-zinc-400">Address</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.company?.address || '—' }}, {{ lead.company?.city || '—' }}, {{ lead.company?.country || '—' }}</div></div>
                    </div>
                  </div>

                  <!-- Origin & Campaign -->
                  <div class="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
                    <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Origin & Marketing Campaign</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Origin</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Campaign</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.campaigns?.[0]?.campaign || '—' }}</div></div>
                      @if (lead.campaigns?.[0]?.referralPartner) { <div><div class="text-meta uppercase font-semibold text-zinc-400">Referral Partner</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.campaigns?.[0]?.referralPartner }}</div></div> }
                      @if (lead.campaigns?.[0]?.tradeShow) { <div><div class="text-meta uppercase font-semibold text-zinc-400">Trade Show</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.campaigns?.[0]?.tradeShow }}</div></div> }
                    </div>
                  </div>

                  <!-- Key Stakeholders -->
                  <div class="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
                    <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Key Stakeholders</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Decision Maker</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.decisionMaker || '—' }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Influencer</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.influencer || '—' }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Finance Contact</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.financeContact || '—' }}</div></div>
                      <div><div class="text-meta uppercase font-semibold text-zinc-400">Technical Contact</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.technicalContact || '—' }}</div></div>
                    </div>
                  </div>
                </div>

                <!-- Audit Trail -->
                <div class="bg-white border border-zinc-200 rounded-xl p-5">
                  <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Audit Trail</h3>
                  <div class="grid grid-cols-2 gap-4 text-xs text-zinc-500 mt-3">
                    <div><div>Created By</div><div class="mt-1"><app-created-by-badge [createdBy]="lead.createdBy" [createdAt]="lead.createdDate" /></div></div>
                    <div><div>Modified</div><div class="font-semibold text-zinc-700 mt-1">{{ lead.modifiedDate }} by <app-user-avatar [userId]="lead.modifiedBy" [size]="20" /> {{ getUserName(lead.modifiedBy) }}</div></div>
                  </div>
                </div>
              </div>
            }

            @if (activeTab() === 'activities') {
              <div class="space-y-6">
                <div class="bg-white border border-zinc-200 rounded-xl p-5 text-sm">
                  <h3 class="text-xs font-bold text-zinc-950 uppercase tracking-wider">Lead Qualification & Sales Potential</h3>
                  <div class="grid grid-cols-2 gap-4 mt-3">
                    <div><div class="text-meta uppercase font-semibold text-zinc-400">Interested Product</div><div class="font-semibold text-zinc-800 mt-0.5">{{ lead.productInterests?.[0]?.product || '—' }}</div></div>
                    <div><div class="text-meta uppercase font-semibold text-zinc-400">Solution</div><div class="font-semibold text-zinc-700 mt-0.5">{{ lead.productInterests?.[0]?.solution || '—' }}</div></div>
                    <div><div class="text-meta uppercase font-semibold text-zinc-400">Origin</div><div class="font-bold text-zinc-950 mt-0.5">{{ lead.origin || lead.campaigns?.[0]?.source || '—' }}</div></div>
                    <div><div class="text-meta uppercase font-semibold text-zinc-400">Deal Probability</div><div class="font-semibold text-zinc-700 mt-0.5">{{ lead.probability || '0' }}%</div></div>
                  </div>
                </div>

                <div class="bg-white border border-zinc-200 rounded-xl p-5">
                  <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Notes & Comments</h3>
                  <div class="mt-2 text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{{ lead.notes || 'No notes added for this lead yet.' }}</div>
                </div>

                <div class="card rounded-xl p-5 space-y-3">
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
                  <div><label for="details" class="block text-meta uppercase font-semibold text-zinc-400 mb-1">Details</label>
                    <textarea id="details" [(ngModel)]="newActivity.detail" rows="2" placeholder="More detailed recap..." class="w-full input-field rounded-lg p-2 text-xs outline-none"></textarea></div>
                  <div class="flex justify-end pt-2">
                    <button (click)="submitActivity(lead.id)" class="bg-zinc-800/80 hover:bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Log Activity</button>
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

            @if (activeTab() === 'attachments') {
              <div class="space-y-6">
                <div class="card rounded-xl p-5 space-y-3">
                  <h3 class="text-xs font-bold text-zinc-700 uppercase">Upload Document</h3>
                  <div class="flex gap-3 items-center">
                    <input #fileInput type="file" (change)="onFileSelected($event, lead.id)" class="flex-1 text-xs">
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

            @if (activeTab() === 'whatsapp') {
              <div class="rounded-xl overflow-hidden flex flex-col h-[560px]" style="border: 1px solid var(--color-border)">
                @if (inbox.selected(); as c) {
                  <div class="flex items-center justify-between px-4 py-2 text-xs" style="border-bottom: 1px solid var(--color-border); color: var(--color-text-secondary)">
                    <span dir="ltr">{{ c.phone }}</span>
                    <a [routerLink]="['/inbox']" [queryParams]="{ c: c.id }" class="font-semibold" style="color: var(--color-accent-text)">{{ 'inbox.leadTab.openInInbox' | translate }}</a>
                  </div>
                  <app-wa-thread
                    class="flex-1 min-h-0"
                    [messages]="inbox.messages()"
                    [loading]="inbox.loadingMessages()"
                    [hasOlder]="!!inbox.olderCursor()"
                    [canApprove]="canSendWhatsApp()"
                    (loadOlder)="inbox.loadOlder()"
                    (approve)="inbox.approve($event.id, $event.text)"
                    (discard)="inbox.discard($event)"
                  />
                  <app-wa-composer [canSend]="canSendWhatsApp()" [sending]="inbox.sending()" (send)="inbox.send($event)" />
                } @else if (waLoading()) {
                  <p class="flex-1 flex items-center justify-center text-sm" style="color: var(--color-text-tertiary)">{{ 'inbox.loading' | translate }}</p>
                } @else if (lead.phone) {
                  <div class="flex-1 flex items-center justify-center text-sm p-6 text-center" style="color: var(--color-text-secondary)">
                    {{ 'inbox.leadTab.empty' | translate }}
                  </div>
                  <app-wa-composer [canSend]="canSendWhatsApp()" [sending]="inbox.sending()" (send)="inbox.startWithPartner(lead.id, $event)" />
                } @else {
                  <p class="flex-1 flex items-center justify-center text-sm p-6 text-center" style="color: var(--color-text-secondary)">{{ 'inbox.leadTab.noPhone' | translate }}</p>
                }
              </div>
            }

            @if (activeTab() === 'history') {
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
      } @else {
        <div class="text-center py-20 text-zinc-400">
          <mat-icon class="text-[48px]! w-12 h-12 mb-3 text-zinc-300">filter_alt</mat-icon>
          <p class="font-semibold text-zinc-500">Lead not found</p>
        </div>
      }
    </div>
  `
})
export class LeadDetailComponent implements OnDestroy {
  state = inject(CrmStateService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  api = inject(ApiService);
  uploading = signal(false);

  activeTab = signal<'info' | 'activities' | 'attachments' | 'history' | 'whatsapp'>('info');
  inbox = inject(WhatsAppInboxStore);
  waLoading = signal(false);
  canReadWhatsApp = computed(() => this.state.hasAuthority('WHATSAPP_READ'));
  canSendWhatsApp = computed(() => this.state.hasAuthority('WHATSAPP_SEND'));
  showConvertMenu = signal(false);

  newActivity = {
    type: 'Call' as LeadActivity['type'],
    date: new Date().toISOString().split('T')[0],
    summary: '',
    detail: ''
  };

  lead = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return this.state.leadsData().find(l => l.id === id) || null;
  });

  onStatusChange(leadId: string, status: Lead['status']) {
    this.state.updateLeadStatus(leadId, status);
  }

  constructor() {
    // Deep-link entry point (no selectLead ran): hydrate server sub-resources once.
    effect(() => {
      const id = this.route.snapshot.paramMap.get('id');
      if (id) this.state.loadLeadDetails(id);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('click', () => {
        this.showConvertMenu.set(false);
      });
    }
  }

  async openWhatsAppTab(leadId: string) {
    this.activeTab.set('whatsapp');
    this.waLoading.set(true);
    await this.inbox.openForPartner(leadId);
    this.waLoading.set(false);
  }

  ngOnDestroy() {
    this.inbox.select(null);
  }

  toggleConvertMenu(event: Event) {
    event.stopPropagation();
    this.showConvertMenu.update(v => !v);
  }

  markLeadAsLost(lead: Lead) {
    this.showConvertMenu.set(false);
    this.state.updateLeadStatus(lead.id, 'Lost');
  }

  deleteLead(lead: Lead) {
    this.showConvertMenu.set(false);
    this.state.deleteLead(lead.id);
    this.router.navigate(['/partners']);
  }

  convertToProspect(lead: Lead) {
    this.showConvertMenu.set(false);
    this.state.convertLeadDataToProspect(lead);
    this.router.navigate(['/partners']);
  }

  submitActivity(leadId: string) {
    if (!this.newActivity.summary.trim()) return;
    this.state.addLeadActivity(leadId, {
      type: this.newActivity.type,
      date: this.newActivity.date,
      summary: this.newActivity.summary,
      detail: this.newActivity.detail,
      assignedTo: 'Achraf (Manager)'
    });
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
      this.api.deleteFile(file.fileId).subscribe({ error: () => { /* ignore error */ } });
    }
  }

  getInitials(name: string): string {
    if (!name) return 'LD';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
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
