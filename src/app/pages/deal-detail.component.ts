import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Deal, Meeting } from '../services/crm-state.service';
import { ApiService } from '../services/api.service';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { AttachmentsComponent } from '../shared/attachments.component';
import { UserPickerComponent } from '../shared/user-picker.component';

@Component({
  selector: 'app-deal-detail',
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink, CreatedByBadgeComponent, AttachmentsComponent, UserPickerComponent],
  template: `
    <div class="space-y-6 font-sans max-w-5xl mx-auto">
      <a routerLink="/sales" class="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors">
        <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">arrow_back</mat-icon>
        Back to Sales
      </a>

      @if (deal(); as deal) {
        <!-- Header -->
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs">
          <div class="flex justify-between items-start">
            <div>
              <h2 class="text-xl font-bold text-zinc-900">{{deal.title}}</h2>
              <p class="text-sm text-zinc-500 mt-1">Client: {{getPartnerName(deal.partnerId)}} · {{deal.dealNumber || 'No deal number'}}</p>
              <div class="mt-2">
                <app-created-by-badge [createdBy]="deal.createdBy" [createdAt]="deal.createdAt" />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-3 py-1 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-950 border border-zinc-200">
                {{deal.stage}}
              </span>
              @if (state.currentUserPermissions().canDeleteRecords) {
                <button (click)="deleteDeal(deal)" title="Delete deal" class="p-1.5 rounded-lg bg-zinc-50 hover:bg-red-50 hover:text-red-600 border border-zinc-200 hover:border-red-200 text-zinc-500 transition-colors">
                  <mat-icon class="text-[16px] w-4 h-4">delete</mat-icon>
                </button>
              }
            </div>
          </div>
        </div>

        <!-- General Info & Amounts -->
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Amount Details</span>
              <div class="mt-1">
                <span class="text-xl font-bold text-zinc-900 font-sans">{{formatCurrency(deal.amount)}}</span>
                @if (deal.discount) {
                  <span class="text-xs text-zinc-900 font-semibold ml-2">({{deal.discount}}% Discount applied)</span>
                }
              </div>
            </div>
            <div>
              <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Comments / Notes</span>
              <p class="text-xs text-zinc-600 mt-1">{{deal.comments || 'No comments.'}}</p>
            </div>
            <div>
              <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Attached Proposal</span>
              <div class="text-xs text-zinc-600 mt-1">#{{deal.proposalId || 'N/A'}} - {{ getProposalTitle(deal.proposalId) }}</div>
            </div>
          </div>
        </div>

        <!-- Detail Grids -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50 p-4 rounded-2xl border border-zinc-100 text-xs">
          <!-- Identification & Dates -->
          <div class="space-y-2">
            <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-200/60 pb-1">1. Identification & Dates</span>
            <div class="grid grid-cols-2 gap-y-1.5 text-zinc-600">
              <span class="font-medium">Order Number:</span> <span class="font-sans text-zinc-900 font-semibold">{{ deal.orderNumber || 'N/A' }}</span>
              <span class="font-medium">Deal Number:</span> <span class="font-sans text-zinc-900 font-semibold">{{ deal.dealNumber || 'N/A' }}</span>
              <span class="font-medium">Order Date:</span> <span class="text-zinc-900 font-sans">{{ deal.orderDate || 'N/A' }}</span>
              <span class="font-medium">Req. Delivery:</span> <span class="text-zinc-900 font-sans">{{ deal.requestedDeliveryDate || 'N/A' }}</span>
              <span class="font-medium">Order Status:</span>
              <span><span class="px-1.5 py-0.5 rounded text-meta font-semibold bg-zinc-100 text-zinc-950 border border-zinc-200">{{ deal.orderStatus || 'N/A' }}</span></span>
            </div>
          </div>

          <!-- Customer & Delivery -->
          <div class="space-y-2">
            <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-200/60 pb-1">2. Customer & Delivery</span>
            <div class="grid grid-cols-3 gap-y-1.5 text-zinc-600">
              <span class="font-medium col-span-1">Account:</span> <span class="col-span-2 text-zinc-900 font-sans">{{ deal.customerAccount || 'N/A' }}</span>
              <span class="font-medium col-span-1">Contact:</span> <span class="col-span-2 text-zinc-900 font-medium">{{ deal.contactPerson || 'N/A' }}</span>
              <span class="font-medium col-span-1">Email:</span> <span class="col-span-2 text-zinc-900 font-sans truncate" [title]="deal.contactEmail">{{ deal.contactEmail || 'N/A' }}</span>
              <span class="font-medium col-span-1">Phone:</span> <span class="col-span-2 text-zinc-900 font-sans">{{ deal.contactPhone || 'N/A' }}</span>
            </div>
            <div class="mt-1.5 pt-1.5 border-t border-zinc-200/60 text-meta text-zinc-600 space-y-1">
              <div><strong class="text-zinc-700">Billing:</strong> {{ deal.billingAddress || 'N/A' }}</div>
              <div><strong class="text-zinc-700">Delivery:</strong> {{ deal.deliveryAddress || 'N/A' }}</div>
            </div>
          </div>

          <!-- Sales & Commercial -->
          <div class="space-y-2">
            <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-200/60 pb-1">3. Sales & Commercial</span>
            <div class="grid grid-cols-2 gap-y-1.5 text-zinc-600">
              <span class="font-medium">Sales Person:</span> <span class="text-zinc-900 font-medium">{{ deal.salesPerson || 'N/A' }}</span>
              <span class="font-medium">Region:</span> <span class="text-zinc-900">{{ deal.salesRegion || 'N/A' }}</span>
              <span class="font-medium">Currency:</span> <span class="text-zinc-900 font-bold font-sans">{{ deal.currency || 'MAD' }}</span>
              <span class="font-medium">Payment Terms:</span> <span class="text-zinc-900">{{ deal.paymentTerms || 'N/A' }}</span>
              <span class="font-medium">Total Amount:</span> <span class="text-zinc-900 font-sans font-bold">{{ formatCurrency(deal.orderTotalAmount || deal.amount) }}</span>
            </div>
          </div>

          <!-- Vendor & Logistics -->
          <div class="space-y-2">
            <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-200/60 pb-1">4. Vendor & Logistics</span>
            <div class="grid grid-cols-2 gap-y-1.5 text-zinc-600">
              <span class="font-medium">Vendor Account:</span> <span class="font-sans text-zinc-900 font-semibold">{{ deal.vendorAccount || 'N/A' }}</span>
              <span class="font-medium">PO Reference:</span> <span class="font-sans text-zinc-900 font-semibold">{{ deal.purchaseOrderRef || 'N/A' }}</span>
              <span class="font-medium">Warehouse:</span> <span class="text-zinc-900">{{ deal.warehouseAddress || 'N/A' }}</span>
              <span class="font-medium">Transport:</span> <span class="text-zinc-900">{{ deal.transportationService || 'N/A' }}</span>
            </div>
          </div>
        </div>

        <!-- Email Exchange Log -->
        @if (deal.emailExchange) {
          <div class="bg-zinc-50 rounded-xl p-4 border border-zinc-100 text-xs font-sans space-y-1.5">
            <div class="text-zinc-400 font-sans font-bold flex items-center gap-1 mb-1">
              <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none">email</mat-icon> Email Exchange & Confirmation Logs
            </div>
            <pre class="whitespace-pre-wrap text-meta text-zinc-700 leading-relaxed font-sans">{{deal.emailExchange}}</pre>
          </div>
        }

        <!-- Activity Hub -->
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs">
          <h5 class="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <mat-icon class="text-[16px] w-4 h-4 text-zinc-900 flex items-center justify-center">forum</mat-icon> Deal Activity Hub
          </h5>

          <!-- Tabs Header -->
          <div class="flex flex-wrap gap-3 sm:gap-4 border-b border-zinc-200 mb-4">
            <button type="button" (click)="setDealTab(deal.id, 'calls')"
              [class]="getDealTab(deal.id) === 'calls' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
              class="px-0.5 py-2.5 -mb-px border-b-2 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap">
              <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">call</mat-icon>
              Calls
              <span class="text-meta">{{ deal.activityLog?.calls?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'emails')"
              [class]="getDealTab(deal.id) === 'emails' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
              class="px-0.5 py-2.5 -mb-px border-b-2 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap">
              <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">email</mat-icon>
              Emails
              <span class="text-meta">{{ deal.activityLog?.emails?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'meetings')"
              [class]="getDealTab(deal.id) === 'meetings' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
              class="px-0.5 py-2.5 -mb-px border-b-2 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap">
              <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">groups</mat-icon>
              Meetings
              <span class="text-meta">{{ deal.activityLog?.meetings?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'recordings')"
              [class]="getDealTab(deal.id) === 'recordings' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
              class="px-0.5 py-2.5 -mb-px border-b-2 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap">
              <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">videocam</mat-icon>
              Recordings
              <span class="text-meta">{{ deal.activityLog?.recordings?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'notes')"
              [class]="getDealTab(deal.id) === 'notes' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
              class="px-0.5 py-2.5 -mb-px border-b-2 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap">
              <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">note_alt</mat-icon>
              Notes
              <span class="text-meta">{{ deal.activityLog?.notes?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'followups')"
              [class]="getDealTab(deal.id) === 'followups' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
              class="px-0.5 py-2.5 -mb-px border-b-2 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap">
              <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">notification_important</mat-icon>
              Follow-ups
              <span class="text-meta">{{ deal.activityLog?.followUps?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'calendar')"
              [class]="getDealTab(deal.id) === 'calendar' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
              class="px-0.5 py-2.5 -mb-px border-b-2 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap">
              <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">calendar_month</mat-icon>
              Calendar
            </button>
          </div>

          <!-- Active Tab Panel -->
          <div class="bg-zinc-50/50 border border-zinc-200/60 rounded-xl p-4 min-h-[180px]">

            <!-- CALLS TAB -->
            @if (getDealTab(deal.id) === 'calls') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="text-meta font-semibold text-zinc-500 uppercase tracking-wider">Phone Calls History</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'calls')" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="text-[16px] w-4 h-4 flex items-center justify-center">add</mat-icon> Log Call
                  </button>
                </div>
                <div class="space-y-3">
                  @for (call of deal.activityLog?.calls; track call.id) {
                    <div class="bg-white border border-zinc-150 rounded-lg p-3 shadow-xs space-y-1.5">
                      <div class="flex justify-between items-start">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-zinc-800">{{ call.callerName }}</span>
                          <span class="text-zinc-400 font-sans text-meta">{{ call.date }} ({{ call.duration }} min)</span>
                        </div>
                        <span [class]="call.outcome === 'Interested' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : call.outcome === 'Follow-up' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'"
                              class="px-2 py-0.5 rounded text-meta font-semibold border">{{ call.outcome }}</span>
                      </div>
                      <p class="text-meta text-zinc-600 font-sans leading-relaxed">{{ call.summary }}</p>
                    </div>
                  } @empty {
                    <div class="text-center py-6 text-zinc-400 text-xs">No calls logged yet.</div>
                  }
                </div>
              </div>
            }

            <!-- EMAILS TAB -->
            @if (getDealTab(deal.id) === 'emails') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="text-meta font-semibold text-zinc-500 uppercase tracking-wider">Email Correspondence Thread</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'emails')" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="text-[16px] w-4 h-4 flex items-center justify-center">add</mat-icon> Log Email
                  </button>
                </div>
                <div class="space-y-3">
                  @for (email of deal.activityLog?.emails; track email.id) {
                    <div [class]="email.direction === 'sent' ? 'bg-zinc-100/40 border-zinc-200 ml-6' : 'bg-white border-zinc-150 mr-6'"
                         class="border rounded-lg p-3 shadow-xs space-y-1.5 transition-all">
                      <div class="flex justify-between items-start">
                        <div>
                          <span class="font-bold text-zinc-800 text-xs">{{ email.subject }}</span>
                          <div class="text-meta text-zinc-400 font-sans mt-0.5">From: {{ email.from }} | To: {{ email.to }}</div>
                        </div>
                        <span class="text-meta font-sans text-zinc-400">{{ email.date }}</span>
                      </div>
                      <p class="text-meta text-zinc-600 leading-relaxed font-sans whitespace-pre-wrap">{{ email.body }}</p>
                    </div>
                  }
                  @if (deal.emailExchange && (!deal.activityLog || deal.activityLog.emails.length === 0)) {
                    <div class="bg-white border border-zinc-150 rounded-lg p-3 shadow-xs font-sans text-meta text-zinc-700 leading-relaxed">
                      <div class="text-zinc-400 font-sans font-bold flex items-center gap-1 mb-2">
                        <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none">history</mat-icon> Imported Exchange Logs
                      </div>
                      <pre class="whitespace-pre-wrap text-meta font-sans leading-relaxed">{{ deal.emailExchange }}</pre>
                    </div>
                  }
                  @if (!deal.emailExchange && (!deal.activityLog || deal.activityLog.emails.length === 0)) {
                    <div class="text-center py-6 text-zinc-400 text-xs">No email exchanges logged yet.</div>
                  }
                </div>
              </div>
            }

            <!-- MEETINGS TAB -->
            @if (getDealTab(deal.id) === 'meetings') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="text-meta font-semibold text-zinc-500 uppercase tracking-wider">Meetings & Technical Demos</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'meetings')" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="text-[16px] w-4 h-4 flex items-center justify-center">add</mat-icon> Log Meeting
                  </button>
                </div>
                <div class="space-y-3">
                  @for (meeting of deal.activityLog?.meetings; track meeting.id) {
                    <div class="bg-white border border-zinc-150 rounded-lg p-3 shadow-xs space-y-2">
                      <div class="flex justify-between items-start">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-zinc-800 text-xs">{{ meeting.title }}</span>
                          <span [class]="meeting.type === 'teams' ? 'bg-zinc-100 text-zinc-950 border-zinc-200' : meeting.type === 'demo' ? 'bg-zinc-100 text-zinc-950 border-zinc-200' : 'bg-zinc-50 text-zinc-700 border-zinc-200'"
                                class="px-1.5 py-0.2 rounded text-meta font-semibold border uppercase">{{ meeting.type }}</span>
                        </div>
                        <span class="text-meta text-zinc-400 font-sans">{{ meeting.date }} à {{ meeting.time }}</span>
                      </div>
                      <div class="text-meta text-zinc-500">
                        <strong>Location:</strong> {{ meeting.location }} |
                        <strong>Attendees:</strong>
                        @for (att of meeting.attendees; track $index) {
                          <span class="inline-block bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded-full mx-0.5">{{ att }}</span>
                        }
                      </div>
                      <p class="text-meta text-zinc-600 font-sans leading-relaxed border-t border-zinc-50 pt-1.5">{{ meeting.summary }}</p>
                    </div>
                  } @empty {
                    <div class="text-center py-6 text-zinc-400 text-xs">No meetings logged yet.</div>
                  }
                </div>
              </div>
            }

            <!-- RECORDINGS TAB -->
            @if (getDealTab(deal.id) === 'recordings') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="text-meta font-semibold text-zinc-500 uppercase tracking-wider">Teams Meeting Records</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'recordings')" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="text-[16px] w-4 h-4 flex items-center justify-center">add</mat-icon> Add Link
                  </button>
                </div>
                <div class="space-y-2">
                  @for (rec of deal.activityLog?.recordings; track rec.id) {
                    <div class="bg-white border border-zinc-150 rounded-lg p-3 shadow-xs flex items-center justify-between gap-4">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center shrink-0 border border-zinc-200">
                          <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">videocam</mat-icon>
                        </div>
                        <div>
                          <span class="font-bold text-zinc-800 text-xs block">{{ rec.title }}</span>
                          <span class="text-meta text-zinc-400 font-sans">{{ rec.date }} | Duration: {{ rec.duration }}</span>
                        </div>
                      </div>
                      <div class="flex gap-2">
                        <a [href]="rec.meetingLink" target="_blank" class="px-2.5 py-1 text-meta font-semibold rounded bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200 flex items-center gap-0.5">
                          <mat-icon class="text-[12px] w-3 h-3">link</mat-icon> Teams
                        </a>
                        <a [href]="rec.recordingLink" target="_blank" class="px-2.5 py-1 text-meta font-semibold rounded bg-zinc-100 text-zinc-950 border border-zinc-300 hover:bg-zinc-200 flex items-center gap-0.5">
                          <mat-icon class="text-[12px] w-3 h-3 flex items-center justify-center">play_arrow</mat-icon> Record
                        </a>
                      </div>
                    </div>
                  } @empty {
                    <div class="text-center py-6 text-zinc-400 text-xs">No recording links added yet.</div>
                  }
                </div>
              </div>
            }

            <!-- NOTES TAB -->
            @if (getDealTab(deal.id) === 'notes') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="text-meta font-semibold text-zinc-500 uppercase tracking-wider">Sales Notes & Comments</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'notes')" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="text-[16px] w-4 h-4 flex items-center justify-center">add</mat-icon> Add Note
                  </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  @for (note of deal.activityLog?.notes; track note.id) {
                    <div class="bg-zinc-100/50 border border-zinc-200 rounded-lg p-3 shadow-xs space-y-1.5 relative overflow-hidden font-sans">
                      <div class="absolute top-0 left-0 w-1 h-full bg-zinc-500"></div>
                      <div class="flex justify-between items-center text-meta text-zinc-400 font-sans">
                        <span>By: {{ note.author }}</span>
                        <span>{{ note.date }}</span>
                      </div>
                      <p class="text-meta text-zinc-700 leading-relaxed font-sans">{{ note.content }}</p>
                    </div>
                  } @empty {
                    <div class="col-span-2 text-center py-6 text-zinc-400 text-xs">No notes added yet.</div>
                  }
                </div>
              </div>
            }

            <!-- FOLLOW-UPS TAB -->
            @if (getDealTab(deal.id) === 'followups') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="text-meta font-semibold text-zinc-500 uppercase tracking-wider">Upcoming Alerts & Action Reminders</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'followups')" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="text-[16px] w-4 h-4 flex items-center justify-center">add</mat-icon> Add Follow-up
                  </button>
                </div>
                <div class="space-y-2">
                  @for (f of deal.activityLog?.followUps; track f.id) {
                    <div class="bg-white border border-zinc-150 rounded-lg p-3 shadow-xs flex items-center justify-between gap-4">
                      <div class="flex items-center gap-3">
                        <button type="button" (click)="toggleFollowUpStatus(deal.id, f.id, f.status)" class="text-zinc-400 hover:text-zinc-900">
                          <mat-icon class="text-base w-4.5 h-4.5 flex items-center justify-center">{{ f.status === 'done' ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                        </button>
                        <div>
                          <span [class.line-through]="f.status === 'done'" [class.text-zinc-400]="f.status === 'done'" class="font-bold text-zinc-800 text-xs block font-sans">{{ f.title }}</span>
                          <span class="text-meta text-zinc-400 font-sans">Due date: {{ f.dueDate }} | Owner: {{ f.assignedTo }}</span>
                        </div>
                      </div>
                      <span [class]="f.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'" class="px-2 py-0.5 border text-meta font-bold uppercase rounded font-sans">
                        {{ f.status === 'done' ? 'Completed' : 'Pending' }}
                      </span>
                    </div>
                  } @empty {
                    <div class="text-center py-6 text-zinc-400 text-xs">No follow-ups scheduled yet.</div>
                  }
                </div>
              </div>
            }

            <!-- CALENDAR TAB -->
            @if (getDealTab(deal.id) === 'calendar') {
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div class="flex justify-between items-center mb-2 px-1">
                    <span class="text-meta font-bold text-zinc-700 uppercase">Juin 2026</span>
                    <span class="text-meta text-zinc-400 flex items-center gap-0.5 font-semibold">
                      <span class="w-1.5 h-1.5 bg-zinc-900 rounded-full inline-block"></span> Outlook Sync TBD
                    </span>
                  </div>
                  <div class="bg-white border border-zinc-200 rounded-xl p-2.5 shadow-xs">
                    <div class="grid grid-cols-7 gap-1 text-center font-bold text-meta text-zinc-400 mb-1 border-b border-zinc-50 pb-1">
                      @for (h of calendarHeaders; track h) { <div>{{ h }}</div> }
                    </div>
                    <div class="grid grid-cols-7 gap-1.5">
                      @for (day of calendarDays; track day) {
                        <button type="button" (click)="selectCalendarDay(deal.id, day)"
                                [class]="isSelectedCalendarDay(deal.id, day) ? 'bg-zinc-900 text-white font-bold' : hasEventsOnDay(deal, day) ? 'bg-zinc-100 text-zinc-950 font-bold border-zinc-300' : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100 border-zinc-105 border-zinc-100'"
                                class="w-full aspect-square rounded-lg text-meta font-semibold border flex flex-col items-center justify-center relative transition-all">
                          {{ day }}
                          @if (hasEventsOnDay(deal, day) && !isSelectedCalendarDay(deal.id, day)) {
                            <span class="absolute bottom-1 w-1.5 h-1.5 bg-zinc-900 rounded-full"></span>
                          }
                        </button>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex flex-col justify-between">
                  <div class="space-y-2">
                    <span class="text-meta font-bold text-zinc-700 block mb-2 uppercase">
                      Events: {{ getSelectedCalendarDay(deal.id) ? 'Day ' + getSelectedCalendarDay(deal.id) + ' June' : 'Select a day' }}
                    </span>
                    <div class="space-y-2">
                      @for (m of getEventsOnDay(deal, getSelectedCalendarDay(deal.id) || 15); track m.id) {
                        <div class="bg-white border border-zinc-200 rounded-lg p-2.5 shadow-xs">
                          <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-zinc-900 text-xs">{{ m.title }}</span>
                            <span class="text-meta text-zinc-400 font-sans">{{ m.time }}</span>
                          </div>
                          <div class="text-meta text-zinc-500 uppercase tracking-wider mb-1 font-sans">Type: {{ m.type }} | Location: {{ m.location }}</div>
                          <p class="text-meta text-zinc-600 line-clamp-2 leading-relaxed font-sans">{{ m.summary }}</p>
                        </div>
                      } @empty {
                        <div class="text-center py-8 text-zinc-400 text-meta bg-white border border-zinc-150 rounded-xl font-sans">No meetings scheduled on this day.</div>
                      }
                    </div>
                  </div>
                  <div class="text-meta bg-zinc-100 text-zinc-500 rounded-lg p-2.5 border border-zinc-150 mt-4 leading-relaxed font-sans">
                    Tip: Meetings logged in the Meetings tab automatically populate this calendar view.
                  </div>
                </div>
              </div>
            }

            <div class="mt-6 pt-4 border-t border-zinc-100">
              <app-attachments ownerEntityType="DEAL" [ownerEntityId]="deal.id" [canWrite]="canWriteDeal()" />
            </div>

          </div>
        </div>

        <!-- Footer Actions -->
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs flex justify-between items-center">
          <div class="flex items-center gap-2">
            <span class="text-xs text-zinc-500">Lines: {{ deal.orderLines?.length || 0 }} items</span>
          </div>
          <div class="flex gap-2">
            @if (!hasPOForDeal(deal.id) && canCreatePO()) {
              <button (click)="openCreatePOModal(deal)" class="bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-950 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center">
                <mat-icon class="mr-1 text-[16px] w-4 h-4">add_shopping_cart</mat-icon> Create PO (Operations)
              </button>
            }
            @if (canCreateTask()) {
              <button (click)="openAssignTaskModal(deal.id, deal.title)" class="bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-100 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <mat-icon class="text-[16px] w-4 h-4">assignment</mat-icon> Assign Task
              </button>
            }
            @if (deal.stage === 'New' && canWriteDeal()) {
              <button (click)="state.updateDealStage(deal.id, 'Confirmed')" class="bg-zinc-900 hover:bg-zinc-950 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center">
                <mat-icon class="mr-1 text-[16px] w-4 h-4">check</mat-icon> Confirm Deal
              </button>
            }
          </div>
        </div>
      } @else {
        <div class="bg-white border border-zinc-200/80 rounded-2xl p-16 text-center space-y-3">
          <div class="w-16 h-16 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mx-auto">
            <mat-icon style="font-size:32px;width:32px;height:32px">error_outline</mat-icon>
          </div>
          <h2 class="text-base font-bold text-zinc-900">Deal not found</h2>
          <p class="text-xs text-zinc-500 max-w-xs mx-auto">The requested deal does not exist or may have been deleted.</p>
          <a routerLink="/sales" class="inline-block bg-zinc-100 text-zinc-950 border border-zinc-200/50 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs">Return to Sales</a>
        </div>
      }
    </div>

    <!-- Add Activity Modal -->
    @if (addActivityModalOpen(); as modal) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-zinc-100 animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-zinc-950 capitalize">{{ modal.type }} Log</h3>
            <button type="button" (click)="addActivityModalOpen.set(null)" class="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg transition-colors">
              <mat-icon class="text-[20px] w-5 h-5">close</mat-icon>
            </button>
          </div>

          @if (modal.type === 'calls') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date" class="block text-xs font-semibold text-zinc-500 mb-1">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.calls.date" type="date" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
                <div>
                  <label for="duration_min" class="block text-xs font-semibold text-zinc-500 mb-1">Duration (min)</label>
                  <input id="duration_min" [(ngModel)]="newActivityInput.calls.duration" type="number" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>
              <div>
                <label for="caller_name" class="block text-xs font-semibold text-zinc-500 mb-1">Caller Name</label>
                <input id="caller_name" [(ngModel)]="newActivityInput.calls.callerName" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
              <div>
                <label for="summary" class="block text-xs font-semibold text-zinc-500 mb-1">Summary</label>
                <textarea id="summary" [(ngModel)]="newActivityInput.calls.summary" rows="3" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
              </div>
              <div>
                <label for="outcome" class="block text-xs font-semibold text-zinc-500 mb-1">Outcome</label>
                <select id="outcome" [(ngModel)]="newActivityInput.calls.outcome" class="w-full border border-zinc-200 rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                  <option value="Interested">Interested</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Not Interested">Not Interested</option>
                </select>
              </div>
            </div>
          }

          @if (modal.type === 'emails') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date" class="block text-xs font-semibold text-zinc-500 mb-1">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.emails.date" type="date" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
                <div>
                  <label for="direction" class="block text-xs font-semibold text-zinc-500 mb-1">Direction</label>
                  <select id="direction" [(ngModel)]="newActivityInput.emails.direction" class="w-full border border-zinc-200 rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                    <option value="sent">Sent</option>
                    <option value="received">Received</option>
                  </select>
                </div>
              </div>
              <div>
                <label for="subject" class="block text-xs font-semibold text-zinc-500 mb-1">Subject</label>
                <input id="subject" [(ngModel)]="newActivityInput.emails.subject" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="from" class="block text-xs font-semibold text-zinc-500 mb-1">From</label>
                  <input id="from" [(ngModel)]="newActivityInput.emails.from" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
                <div>
                  <label for="to" class="block text-xs font-semibold text-zinc-500 mb-1">To</label>
                  <input id="to" [(ngModel)]="newActivityInput.emails.to" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>
              <div>
                <label for="body" class="block text-xs font-semibold text-zinc-500 mb-1">Body</label>
                <textarea id="body" [(ngModel)]="newActivityInput.emails.body" rows="3" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
              </div>
            </div>
          }

          @if (modal.type === 'meetings') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date" class="block text-xs font-semibold text-zinc-500 mb-1">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.meetings.date" type="date" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
                <div>
                  <label for="time" class="block text-xs font-semibold text-zinc-500 mb-1">Time</label>
                  <input id="time" [(ngModel)]="newActivityInput.meetings.time" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>
              <div>
                <label for="title" class="block text-xs font-semibold text-zinc-500 mb-1">Title</label>
                <input id="title" [(ngModel)]="newActivityInput.meetings.title" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="type" class="block text-xs font-semibold text-zinc-500 mb-1">Type</label>
                  <select id="type" [(ngModel)]="newActivityInput.meetings.type" class="w-full border border-zinc-200 rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                    <option value="teams">Teams</option>
                    <option value="demo">Demo</option>
                    <option value="physical">Physical</option>
                  </select>
                </div>
                <div>
                  <label for="location" class="block text-xs font-semibold text-zinc-500 mb-1">Location</label>
                  <input id="location" [(ngModel)]="newActivityInput.meetings.location" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>
              <div>
                <label for="attendees_comma_sepa" class="block text-xs font-semibold text-zinc-500 mb-1">Attendees (comma separated)</label>
                <input id="attendees_comma_sepa" [(ngModel)]="newActivityInput.meetings.attendees" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
              <div>
                <label for="summary" class="block text-xs font-semibold text-zinc-500 mb-1">Summary</label>
                <textarea id="summary" [(ngModel)]="newActivityInput.meetings.summary" rows="2" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
              </div>
            </div>
          }

          @if (modal.type === 'recordings') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date" class="block text-xs font-semibold text-zinc-500 mb-1">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.recordings.date" type="date" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
                <div>
                  <label for="duration" class="block text-xs font-semibold text-zinc-500 mb-1">Duration</label>
                  <input id="duration" [(ngModel)]="newActivityInput.recordings.duration" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>
              <div>
                <label for="title" class="block text-xs font-semibold text-zinc-500 mb-1">Title</label>
                <input id="title" [(ngModel)]="newActivityInput.recordings.title" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
              <div>
                <label for="meeting_link" class="block text-xs font-semibold text-zinc-500 mb-1">Meeting Link</label>
                <input id="meeting_link" [(ngModel)]="newActivityInput.recordings.meetingLink" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
              <div>
                <label for="recording_link" class="block text-xs font-semibold text-zinc-500 mb-1">Recording Link</label>
                <input id="recording_link" [(ngModel)]="newActivityInput.recordings.recordingLink" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
            </div>
          }

          @if (modal.type === 'notes') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date" class="block text-xs font-semibold text-zinc-500 mb-1">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.notes.date" type="date" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
                <div>
                  <label for="author" class="block text-xs font-semibold text-zinc-500 mb-1">Author</label>
                  <input id="author" [(ngModel)]="newActivityInput.notes.author" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>
              <div>
                <label for="content" class="block text-xs font-semibold text-zinc-500 mb-1">Content</label>
                <textarea id="content" [(ngModel)]="newActivityInput.notes.content" rows="4" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
              </div>
            </div>
          }

          @if (modal.type === 'followups') {
            <div class="space-y-3">
              <div>
                <label for="due_date" class="block text-xs font-semibold text-zinc-500 mb-1">Due Date</label>
                <input id="due_date" [(ngModel)]="newActivityInput.followups.dueDate" type="date" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
              <div>
                <label for="title" class="block text-xs font-semibold text-zinc-500 mb-1">Title</label>
                <input id="title" [(ngModel)]="newActivityInput.followups.title" type="text" placeholder="e.g. Send quotation" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
              <div>
                <label for="assigned_to" class="block text-xs font-semibold text-zinc-500 mb-1">Assigned To</label>
                <input id="assigned_to" [(ngModel)]="newActivityInput.followups.assignedTo" type="text" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
            </div>
          }

          <div class="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <button (click)="addActivityModalOpen.set(null)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
            <button (click)="saveActivityEntry()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-sm">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- Create PO Modal -->
    @if (poModalOpen()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-xl border border-zinc-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          <h3 class="text-lg font-bold text-zinc-950 shrink-0">Create Purchase Order</h3>
          <p class="text-xs text-zinc-500 shrink-0">Creating Purchase Order linked to: <strong>{{selectedDealForPO()?.title}}</strong></p>

          <div class="space-y-4 overflow-y-auto pr-1 flex-1">
            <div>
              <div class="flex justify-between items-center mb-1">
                <label for="vendor" class="block text-xs font-semibold text-zinc-500 uppercase">Vendor</label>
                <button (click)="showNewVendorForm.set(!showNewVendorForm())" class="text-zinc-900 hover:text-zinc-950 text-meta font-bold uppercase">
                  {{ showNewVendorForm() ? 'Select Existing' : '+ Create New Vendor Inline' }}
                </button>
              </div>
              @if (showNewVendorForm()) {
                <div class="grid grid-cols-2 gap-3">
                  <input [(ngModel)]="newVendorData.name" type="text" placeholder="Vendor name" class="border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                  <input [(ngModel)]="newVendorData.email" type="email" placeholder="Email" class="border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                  <input [(ngModel)]="newVendorData.phone" type="text" placeholder="Phone" class="border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                  <input [(ngModel)]="newVendorData.city" type="text" placeholder="City" class="border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              } @else {
                <select [(ngModel)]="selectedVendorId" class="w-full border border-zinc-200 rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                  @for (v of state.vendors(); track v.id) {
                    <option [value]="v.id">{{ v.name }}</option>
                  }
                </select>
              }
            </div>

            <div>
              <label for="delivery_date" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Delivery Date</label>
              <input id="delivery_date" [(ngModel)]="newPoDeliveryDate" type="date" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
            </div>

            <div class="space-y-2">
              <label for="line_items" class="block text-xs font-semibold text-zinc-500 uppercase">Line Items</label>
              <div class="space-y-2">
                @for (line of poLines(); track $index) {
                  <div class="grid grid-cols-12 gap-2 items-center">
                    <input [(ngModel)]="line.item" placeholder="Item name" class="col-span-4 border border-zinc-200 rounded-lg p-1.5 text-xs focus:outline-blue-600">
                    <input [(ngModel)]="line.qty" type="number" class="col-span-2 border border-zinc-200 rounded-lg p-1.5 text-xs focus:outline-blue-600 text-center" placeholder="Qty">
                    <input [(ngModel)]="line.unitPrice" type="number" class="col-span-3 border border-zinc-200 rounded-lg p-1.5 text-xs focus:outline-blue-600 font-sans text-right" placeholder="Unit price">
                    <select [(ngModel)]="line.type" class="col-span-2 border border-zinc-200 rounded-lg p-1.5 text-xs bg-white focus:outline-blue-600">
                      <option value="software">Software</option>
                      <option value="hardware">Hardware</option>
                      <option value="service">Service</option>
                    </select>
                    <button type="button" (click)="removePoLine($index)" class="col-span-1 text-zinc-700 hover:bg-zinc-100 p-1 rounded">
                      <mat-icon class="text-[16px] w-4 h-4">delete</mat-icon>
                    </button>
                  </div>
                }
              </div>
              <button (click)="addPoLineItem()" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center mt-1">
                <mat-icon class="text-[16px] w-4 h-4">add_circle</mat-icon> Add Line Item
              </button>
            </div>
          </div>

          <div class="flex justify-between items-center border-t border-zinc-100 pt-4 shrink-0">
            <span class="text-sm text-zinc-500">Total: <strong class="text-zinc-900 font-sans">{{ formatCurrency(getPoTotal()) }}</strong></span>
            <div class="flex gap-2">
              <button (click)="poModalOpen.set(false); clearPoLocalState()" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
              <button (click)="saveDraftPO()" class="px-4 py-2 border border-zinc-200 text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg">Save as Draft</button>
              <button (click)="savePurchaseOrder()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-sm">Create & Send PO</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Assign Task Modal -->
    @if (assignTaskModalOpen(); as ctx) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-zinc-100 animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-zinc-950">Assign Task</h3>
            <button (click)="assignTaskModalOpen.set(null)" class="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg transition-colors">
              <mat-icon class="text-[20px] w-5 h-5">close</mat-icon>
            </button>
          </div>
          <p class="text-xs text-zinc-500">For: <strong>{{ ctx.entityTitle }}</strong></p>

          <div class="space-y-3">
            <div>
              <label for="task_title" class="block text-xs font-semibold text-zinc-500 mb-1">Task Title</label>
              <input id="task_title" [(ngModel)]="assignTaskData.title" type="text" placeholder="e.g. Review deal terms" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600">
            </div>
            <div>
              <label for="description" class="block text-xs font-semibold text-zinc-500 mb-1">Description</label>
              <textarea id="description" [(ngModel)]="assignTaskData.description" rows="2" class="w-full border border-zinc-200 rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
            </div>
            <div>
              <label for="assigned_team" class="block text-xs font-semibold text-zinc-500 mb-1">Assigned Team</label>
              <select id="assigned_team" [(ngModel)]="assignTaskData.assignedTeamId" class="w-full border border-zinc-200 rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                <option value="">Unassigned</option>
                @for (team of state.teams(); track team.id) {
                  <option [value]="team.id">{{ team.name }}</option>
                }
              </select>
            </div>
            <div>
              <span class="block text-xs font-semibold text-zinc-500 mb-1">Assigned To</span>
              <app-user-picker [(value)]="assignTaskData.assignedToUserId" placeholder="— Select —" />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <button (click)="assignTaskModalOpen.set(null)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
            <button (click)="saveAssignTask()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-sm">Create Task</button>
          </div>
        </div>
      </div>
    }
  `
})
export class DealDetailComponent {
  state = inject(CrmStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);

  canWriteDeal(): boolean { return this.state.hasAuthority('DEALS_WRITE'); }
  canCreatePO(): boolean { return this.state.hasAuthority('PURCHASE_ORDERS_CREATE'); }
  canCreateTask(): boolean { return this.state.hasAuthority('TASKS_CREATE'); }
  canWriteDealActivity(): boolean { return this.state.hasAuthority('DEAL_ACTIVITIES_WRITE'); }
  canCreateDealActivity(): boolean { return this.state.hasAuthority('DEAL_ACTIVITIES_CREATE'); }

  dealId = signal<string | null>(null);
  private fetchedDeal = signal<Deal | null>(null);

  deal = computed(() => {
    const id = this.dealId();
    if (!id) return null;
    return this.state.deals().find(d => d.id === id) || this.fetchedDeal();
  });

  deleteDeal(deal: Deal) {
    if (!this.state.hasAuthority('DEALS_DELETE')) return;
    if (confirm(`Delete deal "${deal.title}"? This cannot be undone.`)) {
      this.state.deleteDeal(deal.id);
      this.router.navigate(['/sales']);
    }
  }

  // Activity Hub
  activeDealTabs = signal<Record<string, string>>({});
  addActivityModalOpen = signal<{ dealId: string; type: 'calls' | 'emails' | 'meetings' | 'recordings' | 'notes' | 'followups' } | null>(null);
  selectedCalendarDay = signal<Record<string, number>>({});

  calendarDays = Array.from({ length: 30 }, (_, i) => i + 1);
  calendarHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  private todayStr = new Date().toISOString().split('T')[0];

  newActivityInput = {
    calls: { date: this.todayStr, duration: 15, callerName: '', summary: '', outcome: 'Interested' },
    emails: { date: this.todayStr, from: '', to: '', subject: '', body: '', direction: 'sent' as const },
    meetings: { date: this.todayStr, time: '10:00', title: '', type: 'teams' as const, attendees: '', location: 'Teams Meeting', summary: '' },
    recordings: { date: this.todayStr, title: '', meetingLink: '', recordingLink: '', duration: '30 mins' },
    notes: { date: this.todayStr, author: '', content: '' },
    followups: { dueDate: this.todayStr, title: '', assignedTo: '' }
  };

  // Assign Task
  assignTaskModalOpen = signal<{ entityType: 'deal'; entityId: string; entityTitle: string } | null>(null);
  assignTaskData = {
    title: '',
    description: '',
    assignedTeamId: '',
    assignedToUserId: ''
  };

  // PO Modal
  poModalOpen = signal(false);
  selectedDealForPO = signal<Deal | null>(null);
  showNewVendorForm = signal(false);
  selectedVendorId = signal<string>('');
  newVendorData = { name: '', email: '', phone: '', city: 'Casablanca' };
  poLines = signal<{ item: string; qty: number; unitPrice: number; type: 'software' | 'hardware' | 'service' }[]>([{ item: '', qty: 1, unitPrice: 0, type: 'software' }]);
  newPoDeliveryDate = '';

  constructor() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('dealId');
      this.dealId.set(id);
      this.activeDealTabs.set({});
      if (id) {
        this.api.getDeal(id).subscribe({
          next: (d) => this.fetchedDeal.set(d),
          error: () => {}
        });
      }
    });
    this.state.loadDeals();
    this.state.loadPartners();
    this.state.loadProposals();
    this.state.loadTasks();
  }

  getPartnerName(id: string) {
    return this.state.partners().find(p => p.id === id)?.name || 'Unknown';
  }

  getProposalTitle(id?: string) {
    return this.state.proposals().find(p => p.id === id)?.title || 'N/A';
  }

  formatCurrency(value: number) {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(value);
  }

  hasPOForDeal(dealId: string) {
    return this.state.purchaseOrders().some(po => po.dealId === dealId);
  }

  // Activity Hub
  getDealTab(dealId: string): string {
    return this.activeDealTabs()[dealId] || 'calls';
  }

  setDealTab(dealId: string, tab: string): void {
    this.activeDealTabs.update(tabs => ({ ...tabs, [dealId]: tab }));
  }

  toggleFollowUpStatus(dealId: string, followUpId: string, currentStatus: string): void {
    if (!this.canWriteDealActivity()) return;
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';
    this.state.updateFollowUpStatus(dealId, followUpId, nextStatus);
  }

  openAddActivityModal(dealId: string, type: 'calls' | 'emails' | 'meetings' | 'recordings' | 'notes' | 'followups') {
    if (!this.canCreateDealActivity()) return;
    this.addActivityModalOpen.set({ dealId, type });
    const me = this.state.currentUser()?.name || this.state.users().find(u => u.team === 'Sales')?.name || 'Current User';
    const myEmail = this.state.currentUser()?.email || '';
    const currentDeal = this.deal();
    const clientEmail = currentDeal?.contactEmail || '';
    const today = new Date().toISOString().split('T')[0];

    this.newActivityInput = {
      calls: { date: today, duration: 15, callerName: me, summary: '', outcome: 'Interested' },
      emails: { date: today, from: myEmail, to: clientEmail, subject: 'Follow up: ' + (currentDeal?.title || ''), body: '', direction: 'sent' },
      meetings: { date: today, time: '10:00', title: '', type: 'teams', attendees: me, location: 'Teams Meeting', summary: '' },
      recordings: { date: today, title: 'Meeting Recording', meetingLink: '', recordingLink: '', duration: '30 mins' },
      notes: { date: today, author: me, content: '' },
      followups: { dueDate: today, title: '', assignedTo: me }
    };
  }

  saveActivityEntry() {
    if (!this.canCreateDealActivity()) return;
    const modal = this.addActivityModalOpen();
    if (!modal) return;

    const { dealId, type } = modal;
    if (type === 'calls') {
      this.state.addCallLog(dealId, { ...this.newActivityInput.calls });
    } else if (type === 'emails') {
      this.state.addEmailLog(dealId, { ...this.newActivityInput.emails });
    } else if (type === 'meetings') {
      const atts = this.newActivityInput.meetings.attendees.split(',').map(s => s.trim()).filter(Boolean);
      this.state.addMeeting(dealId, { ...this.newActivityInput.meetings, attendees: atts });
    } else if (type === 'recordings') {
      this.state.addRecording(dealId, { ...this.newActivityInput.recordings });
    } else if (type === 'notes') {
      this.state.addNote(dealId, { ...this.newActivityInput.notes });
    } else if (type === 'followups') {
      this.state.addFollowUp(dealId, { ...this.newActivityInput.followups, status: 'pending' });
    }

    this.addActivityModalOpen.set(null);
  }

  selectCalendarDay(dealId: string, day: number): void {
    this.selectedCalendarDay.update(days => ({ ...days, [dealId]: day }));
  }

  getSelectedCalendarDay(dealId: string): number {
    return this.selectedCalendarDay()[dealId] || 15;
  }

  isSelectedCalendarDay(dealId: string, day: number): boolean {
    return this.getSelectedCalendarDay(dealId) === day;
  }

  hasEventsOnDay(deal: Deal, day: number): boolean {
    if (!deal.activityLog?.meetings) return false;
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
    const dateStr = prefix + String(day).padStart(2, '0');
    return deal.activityLog.meetings.some((m: Meeting) => m.date === dateStr);
  }

  getEventsOnDay(deal: Deal, day: number): Meeting[] {
    if (!deal.activityLog?.meetings) return [];
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
    const dateStr = prefix + String(day).padStart(2, '0');
    return deal.activityLog.meetings.filter((m: Meeting) => m.date === dateStr);
  }

  // PO helpers
  addPoLineItem() {
    this.poLines.update(lines => [...lines, { item: '', qty: 1, unitPrice: 0, type: 'software' }]);
  }

  removePoLine(index: number) {
    this.poLines.update(lines => lines.filter((_, i) => i !== index));
  }

  getPoTotal(): number {
    return this.poLines().reduce((acc, line) => acc + (line.qty * line.unitPrice), 0);
  }

  openCreatePOModal(deal: Deal) {
    if (!this.canCreatePO()) return;
    this.selectedDealForPO.set(deal);
    this.selectedVendorId.set(this.state.vendors()[0]?.id || '');
    this.showNewVendorForm.set(false);

    if (deal.orderLines && deal.orderLines.length > 0) {
      this.poLines.set(deal.orderLines.map(l => ({
        item: l.product,
        qty: l.qty,
        unitPrice: Math.round(l.unitPrice * 0.7),
        type: 'software' as const
      })));
    } else {
      this.poLines.set([{ item: '', qty: 1, unitPrice: 0, type: 'software' }]);
    }

    this.newPoDeliveryDate = '';
    this.poModalOpen.set(true);
  }

  savePurchaseOrder() {
    if (!this.canCreatePO()) return;
    const deal = this.selectedDealForPO();
    if (!deal) return;

    this.resolvePOVendorId((vendorId) => {
      if (!vendorId) return;

      const totalAmount = this.getPoTotal();

      this.state.addPurchaseOrder({
        dealId: deal.id,
        vendorId: vendorId,
        amount: totalAmount,
        status: 'Sent',
        deliveryDate: this.newPoDeliveryDate || undefined,
        sentVia: 'Email via CRM',
        lines: this.poLines().map(line => ({
          product: line.item,
          qty: line.qty,
          cost: line.unitPrice,
          type: line.type
        }))
      });

      this.state.updateDealStage(deal.id, 'Confirmed');

      this.clearPoLocalState();
      this.poModalOpen.set(false);
    });
  }

  saveDraftPO() {
    if (!this.canCreatePO()) return;
    const deal = this.selectedDealForPO();
    if (!deal) return;

    this.resolvePOVendorId((vendorId) => {
      if (!vendorId) return;

      const totalAmount = this.getPoTotal();

      this.state.addPurchaseOrder({
        dealId: deal.id,
        vendorId: vendorId,
        amount: totalAmount,
        status: 'Draft',
        deliveryDate: this.newPoDeliveryDate || undefined,
        lines: this.poLines().map(line => ({
          product: line.item,
          qty: line.qty,
          cost: line.unitPrice,
          type: line.type
        }))
      });

      this.clearPoLocalState();
      this.poModalOpen.set(false);
    });
  }

  private resolvePOVendorId(onResolved: (vendorId: string | null) => void): void {
    const vendorId = this.selectedVendorId();
    if (this.showNewVendorForm()) {
      if (this.newVendorData.name.trim()) {
        this.state.createPartnerAwaitingId({
          name: this.newVendorData.name,
          type: 'Vendor',
          email: this.newVendorData.email,
          phone: this.newVendorData.phone,
          city: this.newVendorData.city,
          comments: 'Created inline from PO generation.'
        }, (id) => {
          this.selectedVendorId.set(id);
          this.showNewVendorForm.set(false);
          onResolved(id);
        });
      } else {
        onResolved(null);
      }
      return;
    }
    onResolved(vendorId || null);
  }

  clearPoLocalState() {
    this.poLines.set([{ item: '', qty: 1, unitPrice: 0, type: 'software' }]);
    this.selectedVendorId.set('');
    this.showNewVendorForm.set(false);
    this.newVendorData = { name: '', email: '', phone: '', city: 'Casablanca' };
    this.newPoDeliveryDate = '';
    this.selectedDealForPO.set(null);
  }

  // Assign Task
  openAssignTaskModal(entityId: string, entityTitle: string) {
    if (!this.canCreateTask()) return;
    this.assignTaskData = {
      title: '',
      description: '',
      assignedTeamId: '',
      assignedToUserId: ''
    };
    this.assignTaskModalOpen.set({ entityType: 'deal', entityId, entityTitle });
  }

  saveAssignTask() {
    if (!this.canCreateTask()) return;
    const ctx = this.assignTaskModalOpen();
    if (!ctx || !this.assignTaskData.title.trim() || !this.assignTaskData.assignedToUserId) return;

    this.state.addTask({
      title: this.assignTaskData.title.trim(),
      description: this.assignTaskData.description.trim() || undefined,
      assignedTeamId: this.assignTaskData.assignedTeamId || undefined,
      assignedToUserId: this.assignTaskData.assignedToUserId,
      assignedByUserId: this.state.currentUserId(),
      status: 'Pending',
      relatedEntityType: 'DEAL',
      relatedEntityId: ctx.entityId
    });

    this.assignTaskModalOpen.set(null);
  }
}
