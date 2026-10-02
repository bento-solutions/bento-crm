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
import { ConfirmService } from '../shared/ui/confirm.service';

@Component({
  selector: 'app-deal-detail',
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink, CreatedByBadgeComponent, AttachmentsComponent, UserPickerComponent],
  template: `
    <div class="page max-w-5xl mx-auto">
      <a routerLink="/sales" class="page-back">
        <mat-icon class="icon-sm">arrow_back</mat-icon>
        Back to Sales
      </a>

      @if (deal(); as deal) {
        <!-- Header -->
        <div class="card p-5">
          <div class="flex justify-between items-start">
            <div>
              <h1 class="t-title">{{deal.title}}</h1>
              <p class="text-sm text-ink-3 mt-1">Client: {{getPartnerName(deal.partnerId)}} · {{deal.dealNumber || 'No deal number'}}</p>
              <div class="mt-2">
                <app-created-by-badge [createdBy]="deal.createdBy" [createdAt]="deal.createdAt" />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="badge badge-neutral">
                {{deal.stage}}
              </span>
              @if (state.currentUserPermissions().canDeleteRecords) {
                <button (click)="deleteDeal(deal)" title="Delete deal" class="btn-icon btn-sm btn-danger-hover">
  <mat-icon class="icon-sm">delete</mat-icon>
</button>
              }
            </div>
          </div>
        </div>

        <!-- General Info & Amounts -->
        <div class="card p-5">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span class="eyebrow">Amount Details</span>
              <div class="mt-1">
                <span class="text-xl font-semibold text-ink">{{formatCurrency(deal.amount)}}</span>
                @if (deal.discount) {
                  <span class="text-xs text-ink font-semibold ml-2">({{deal.discount}}% Discount applied)</span>
                }
              </div>
            </div>
            <div>
              <span class="eyebrow">Comments / Notes</span>
              <p class="text-xs text-ink-2 mt-1">{{deal.comments || 'No comments.'}}</p>
            </div>
            <div>
              <span class="eyebrow">Attached Proposal</span>
              <div class="text-xs text-ink-2 mt-1">#{{deal.proposalId || 'N/A'}} - {{ getProposalTitle(deal.proposalId) }}</div>
            </div>
          </div>
        </div>

        <!-- Detail Grids -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 card p-5 text-sm">
          <!-- Identification & Dates -->
          <div class="space-y-2">
            <span class="eyebrow block border-b border-line pb-1.5">1. Identification & Dates</span>
            <div class="grid grid-cols-2 gap-y-1.5 text-ink-2">
              <span class="font-medium">Order Number:</span> <span class="text-ink font-semibold">{{ deal.orderNumber || 'N/A' }}</span>
              <span class="font-medium">Deal Number:</span> <span class="text-ink font-semibold">{{ deal.dealNumber || 'N/A' }}</span>
              <span class="font-medium">Order Date:</span> <span class="text-ink">{{ deal.orderDate || 'N/A' }}</span>
              <span class="font-medium">Req. Delivery:</span> <span class="text-ink">{{ deal.requestedDeliveryDate || 'N/A' }}</span>
              <span class="font-medium">Order Status:</span>
              <span><span class="badge badge-neutral">{{ deal.orderStatus || 'N/A' }}</span></span>
            </div>
          </div>

          <!-- Customer & Delivery -->
          <div class="space-y-2">
            <span class="eyebrow block border-b border-line pb-1.5">2. Customer & Delivery</span>
            <div class="grid grid-cols-3 gap-y-1.5 text-ink-2">
              <span class="font-medium col-span-1">Account:</span> <span class="col-span-2 text-ink">{{ deal.customerAccount || 'N/A' }}</span>
              <span class="font-medium col-span-1">Contact:</span> <span class="col-span-2 text-ink font-medium">{{ deal.contactPerson || 'N/A' }}</span>
              <span class="font-medium col-span-1">Email:</span> <span class="col-span-2 text-ink truncate" [title]="deal.contactEmail">{{ deal.contactEmail || 'N/A' }}</span>
              <span class="font-medium col-span-1">Phone:</span> <span class="col-span-2 text-ink">{{ deal.contactPhone || 'N/A' }}</span>
            </div>
            <div class="mt-1.5 pt-1.5 border-t border-line text-meta text-ink-2 space-y-1">
              <div><strong class="text-ink-2">Billing:</strong> {{ deal.billingAddress || 'N/A' }}</div>
              <div><strong class="text-ink-2">Delivery:</strong> {{ deal.deliveryAddress || 'N/A' }}</div>
            </div>
          </div>

          <!-- Sales & Commercial -->
          <div class="space-y-2">
            <span class="eyebrow block border-b border-line pb-1.5">3. Sales & Commercial</span>
            <div class="grid grid-cols-2 gap-y-1.5 text-ink-2">
              <span class="font-medium">Sales Person:</span> <span class="text-ink font-medium">{{ deal.salesPerson || 'N/A' }}</span>
              <span class="font-medium">Region:</span> <span class="text-ink">{{ deal.salesRegion || 'N/A' }}</span>
              <span class="font-medium">Currency:</span> <span class="text-ink font-semibold">{{ deal.currency || 'MAD' }}</span>
              <span class="font-medium">Payment Terms:</span> <span class="text-ink">{{ deal.paymentTerms || 'N/A' }}</span>
              <span class="font-medium">Total Amount:</span> <span class="text-ink font-semibold">{{ formatCurrency(deal.orderTotalAmount || deal.amount) }}</span>
            </div>
          </div>

          <!-- Vendor & Logistics -->
          <div class="space-y-2">
            <span class="eyebrow block border-b border-line pb-1.5">4. Vendor & Logistics</span>
            <div class="grid grid-cols-2 gap-y-1.5 text-ink-2">
              <span class="font-medium">Vendor Account:</span> <span class="text-ink font-semibold">{{ deal.vendorAccount || 'N/A' }}</span>
              <span class="font-medium">PO Reference:</span> <span class="text-ink font-semibold">{{ deal.purchaseOrderRef || 'N/A' }}</span>
              <span class="font-medium">Warehouse:</span> <span class="text-ink">{{ deal.warehouseAddress || 'N/A' }}</span>
              <span class="font-medium">Transport:</span> <span class="text-ink">{{ deal.transportationService || 'N/A' }}</span>
            </div>
          </div>
        </div>

        <!-- Email Exchange Log -->
        @if (deal.emailExchange) {
          <div class="card p-4 text-sm space-y-1.5">
            <div class="text-ink-3 font-semibold flex items-center gap-1 mb-1">
              <mat-icon class="icon-xs">email</mat-icon> Email Exchange & Confirmation Logs
            </div>
            <pre class="whitespace-pre-wrap text-meta text-ink-2 leading-relaxed">{{deal.emailExchange}}</pre>
          </div>
        }

        <!-- Activity Hub -->
        <div class="card p-5">
          <h5 class="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <mat-icon class="text-ink icon-sm">forum</mat-icon> Deal Activity Hub
          </h5>

          <!-- Tabs Header -->
          <div class="flex flex-wrap gap-3 sm:gap-4 border-b border-line mb-4">
            <button type="button" (click)="setDealTab(deal.id, 'calls')"
              [class.is-active]="getDealTab(deal.id) === 'calls'"
              class="tab">
              <mat-icon class="icon-xs">call</mat-icon>
              Calls
              <span class="text-meta">{{ deal.activityLog?.calls?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'emails')"
              [class.is-active]="getDealTab(deal.id) === 'emails'"
              class="tab">
              <mat-icon class="icon-xs">email</mat-icon>
              Emails
              <span class="text-meta">{{ deal.activityLog?.emails?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'meetings')"
              [class.is-active]="getDealTab(deal.id) === 'meetings'"
              class="tab">
              <mat-icon class="icon-xs">groups</mat-icon>
              Meetings
              <span class="text-meta">{{ deal.activityLog?.meetings?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'recordings')"
              [class.is-active]="getDealTab(deal.id) === 'recordings'"
              class="tab">
              <mat-icon class="icon-xs">videocam</mat-icon>
              Recordings
              <span class="text-meta">{{ deal.activityLog?.recordings?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'notes')"
              [class.is-active]="getDealTab(deal.id) === 'notes'"
              class="tab">
              <mat-icon class="icon-xs">note_alt</mat-icon>
              Notes
              <span class="text-meta">{{ deal.activityLog?.notes?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'followups')"
              [class.is-active]="getDealTab(deal.id) === 'followups'"
              class="tab">
              <mat-icon class="icon-xs">notification_important</mat-icon>
              Follow-ups
              <span class="text-meta">{{ deal.activityLog?.followUps?.length || 0 }}</span>
            </button>
            <button type="button" (click)="setDealTab(deal.id, 'calendar')"
              [class.is-active]="getDealTab(deal.id) === 'calendar'"
              class="tab">
              <mat-icon class="icon-xs">calendar_month</mat-icon>
              Calendar
            </button>
          </div>

          <!-- Active Tab Panel -->
          <div class="bg-subtle border border-line rounded-xl p-4 min-h-[180px]">

            <!-- CALLS TAB -->
            @if (getDealTab(deal.id) === 'calls') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="eyebrow">Phone Calls History</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'calls')" class="text-ink hover:text-ink text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="icon-sm">add</mat-icon> Log Call
                  </button>
                </div>
                <div class="space-y-3">
                  @for (call of deal.activityLog?.calls; track call.id) {
                    <div class="bg-surface border border-line-soft rounded-lg p-3 shadow-xs space-y-1.5">
                      <div class="flex justify-between items-start">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-ink">{{ call.callerName }}</span>
                          <span class="text-ink-3 text-meta">{{ call.date }} ({{ call.duration }} min)</span>
                        </div>
                        <span [class]="call.outcome === 'Interested' ? 'badge-success' : call.outcome === 'Follow-up' ? 'badge-warning' : 'bg-muted text-ink-2 border-line'"
                              class="badge">{{ call.outcome }}</span>
                      </div>
                      <p class="text-meta text-ink-2 leading-relaxed">{{ call.summary }}</p>
                    </div>
                  } @empty {
                    <div class="text-center py-6 text-ink-3 text-xs">No calls logged yet.</div>
                  }
                </div>
              </div>
            }

            <!-- EMAILS TAB -->
            @if (getDealTab(deal.id) === 'emails') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="eyebrow">Email Correspondence Thread</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'emails')" class="text-ink hover:text-ink text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="icon-sm">add</mat-icon> Log Email
                  </button>
                </div>
                <div class="space-y-3">
                  @for (email of deal.activityLog?.emails; track email.id) {
                    <div [class]="email.direction === 'sent' ? 'bg-muted border-line ml-6' : 'bg-surface border-line-soft mr-6'"
                         class="border rounded-lg p-3 shadow-xs space-y-1.5 transition-all">
                      <div class="flex justify-between items-start">
                        <div>
                          <span class="font-semibold text-ink text-xs">{{ email.subject }}</span>
                          <div class="text-meta text-ink-3 mt-0.5">From: {{ email.from }} | To: {{ email.to }}</div>
                        </div>
                        <span class="text-meta text-ink-3">{{ email.date }}</span>
                      </div>
                      <p class="text-meta text-ink-2 leading-relaxed whitespace-pre-wrap">{{ email.body }}</p>
                    </div>
                  }
                  @if (deal.emailExchange && (!deal.activityLog || deal.activityLog.emails.length === 0)) {
                    <div class="bg-surface border border-line-soft rounded-lg p-3 shadow-xs text-meta text-ink-2 leading-relaxed">
                      <div class="text-ink-3 font-semibold flex items-center gap-1 mb-2">
                        <mat-icon class="icon-xs">history</mat-icon> Imported Exchange Logs
                      </div>
                      <pre class="whitespace-pre-wrap text-meta leading-relaxed">{{ deal.emailExchange }}</pre>
                    </div>
                  }
                  @if (!deal.emailExchange && (!deal.activityLog || deal.activityLog.emails.length === 0)) {
                    <div class="text-center py-6 text-ink-3 text-xs">No email exchanges logged yet.</div>
                  }
                </div>
              </div>
            }

            <!-- MEETINGS TAB -->
            @if (getDealTab(deal.id) === 'meetings') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="eyebrow">Meetings & Technical Demos</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'meetings')" class="text-ink hover:text-ink text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="icon-sm">add</mat-icon> Log Meeting
                  </button>
                </div>
                <div class="space-y-3">
                  @for (meeting of deal.activityLog?.meetings; track meeting.id) {
                    <div class="bg-surface border border-line-soft rounded-lg p-3 shadow-xs space-y-2">
                      <div class="flex justify-between items-start">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-ink text-xs">{{ meeting.title }}</span>
                          <span [class]="meeting.type === 'teams' ? 'bg-muted text-ink border-line' : meeting.type === 'demo' ? 'bg-muted text-ink border-line' : 'bg-subtle text-ink-2 border-line'"
                                class="px-1.5 py-0.2 rounded-sm text-meta font-semibold border uppercase">{{ meeting.type }}</span>
                        </div>
                        <span class="text-meta text-ink-3">{{ meeting.date }} à {{ meeting.time }}</span>
                      </div>
                      <div class="text-meta text-ink-3">
                        <strong>Location:</strong> {{ meeting.location }} |
                        <strong>Attendees:</strong>
                        @for (att of meeting.attendees; track $index) {
                          <span class="inline-block bg-muted text-ink-2 px-1.5 py-0.2 rounded-full mx-0.5">{{ att }}</span>
                        }
                      </div>
                      <p class="text-meta text-ink-2 leading-relaxed border-t border-line-soft pt-1.5">{{ meeting.summary }}</p>
                    </div>
                  } @empty {
                    <div class="text-center py-6 text-ink-3 text-xs">No meetings logged yet.</div>
                  }
                </div>
              </div>
            }

            <!-- RECORDINGS TAB -->
            @if (getDealTab(deal.id) === 'recordings') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="eyebrow">Teams Meeting Records</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'recordings')" class="text-ink hover:text-ink text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="icon-sm">add</mat-icon> Add Link
                  </button>
                </div>
                <div class="space-y-2">
                  @for (rec of deal.activityLog?.recordings; track rec.id) {
                    <div class="bg-surface border border-line-soft rounded-lg p-3 shadow-xs flex items-center justify-between gap-4">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-muted text-ink flex items-center justify-center shrink-0 border border-line">
                          <mat-icon class="icon-md">videocam</mat-icon>
                        </div>
                        <div>
                          <span class="font-semibold text-ink text-xs block">{{ rec.title }}</span>
                          <span class="text-meta text-ink-3">{{ rec.date }} | Duration: {{ rec.duration }}</span>
                        </div>
                      </div>
                      <div class="flex gap-2">
                        <a [href]="rec.meetingLink" target="_blank" class="btn-secondary btn-sm">
                          <mat-icon class="icon-xs">link</mat-icon> Teams
                        </a>
                        <a [href]="rec.recordingLink" target="_blank" class="btn-secondary btn-sm">
                          <mat-icon class="icon-xs">play_arrow</mat-icon> Record
                        </a>
                      </div>
                    </div>
                  } @empty {
                    <div class="text-center py-6 text-ink-3 text-xs">No recording links added yet.</div>
                  }
                </div>
              </div>
            }

            <!-- NOTES TAB -->
            @if (getDealTab(deal.id) === 'notes') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="eyebrow">Sales Notes & Comments</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'notes')" class="text-ink hover:text-ink text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="icon-sm">add</mat-icon> Add Note
                  </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  @for (note of deal.activityLog?.notes; track note.id) {
                    <div class="bg-muted border border-line rounded-lg p-3 shadow-xs space-y-1.5 relative overflow-hidden">
                      <div class="absolute top-0 left-0 w-1 h-full bg-ink-3"></div>
                      <div class="flex justify-between items-center text-meta text-ink-3">
                        <span>By: {{ note.author }}</span>
                        <span>{{ note.date }}</span>
                      </div>
                      <p class="text-meta text-ink-2 leading-relaxed">{{ note.content }}</p>
                    </div>
                  } @empty {
                    <div class="col-span-2 text-center py-6 text-ink-3 text-xs">No notes added yet.</div>
                  }
                </div>
              </div>
            }

            <!-- FOLLOW-UPS TAB -->
            @if (getDealTab(deal.id) === 'followups') {
              <div class="space-y-4">
                <div class="flex justify-between items-center">
                  <span class="eyebrow">Upcoming Alerts & Action Reminders</span>
                  <button type="button" (click)="openAddActivityModal(deal.id, 'followups')" class="text-ink hover:text-ink text-xs font-semibold flex items-center gap-0.5">
                    <mat-icon class="icon-sm">add</mat-icon> Add Follow-up
                  </button>
                </div>
                <div class="space-y-2">
                  @for (f of deal.activityLog?.followUps; track f.id) {
                    <div class="bg-surface border border-line-soft rounded-lg p-3 shadow-xs flex items-center justify-between gap-4">
                      <div class="flex items-center gap-3">
                        <button type="button" (click)="toggleFollowUpStatus(deal.id, f.id, f.status)" class="btn-icon btn-sm">
                          <mat-icon class="icon-sm">{{ f.status === 'done' ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                        </button>
                        <div>
                          <span [class.line-through]="f.status === 'done'" [class.text-ink-3]="f.status === 'done'" class="font-semibold text-ink text-xs block">{{ f.title }}</span>
                          <span class="text-meta text-ink-3">Due date: {{ f.dueDate }} | Owner: {{ f.assignedTo }}</span>
                        </div>
                      </div>
                      <span [class]="f.status === 'done' ? 'badge-success' : 'badge-warning'" class="badge">
                        {{ f.status === 'done' ? 'Completed' : 'Pending' }}
                      </span>
                    </div>
                  } @empty {
                    <div class="text-center py-6 text-ink-3 text-xs">No follow-ups scheduled yet.</div>
                  }
                </div>
              </div>
            }

            <!-- CALENDAR TAB -->
            @if (getDealTab(deal.id) === 'calendar') {
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div class="flex justify-between items-center mb-2 px-1">
                    <span class="eyebrow">Juin 2026</span>
                    <span class="text-meta text-ink-3 flex items-center gap-0.5 font-semibold">
                      <span class="w-1.5 h-1.5 bg-primary rounded-full inline-block"></span> Outlook Sync TBD
                    </span>
                  </div>
                  <div class="card p-2.5">
                    <div class="grid grid-cols-7 gap-1 text-center font-semibold text-meta text-ink-3 mb-1 border-b border-line-soft pb-1">
                      @for (h of calendarHeaders; track h) { <div>{{ h }}</div> }
                    </div>
                    <div class="grid grid-cols-7 gap-1.5">
                      @for (day of calendarDays; track day) {
                        <button type="button" (click)="selectCalendarDay(deal.id, day)"
                                [class]="isSelectedCalendarDay(deal.id, day) ? 'bg-primary text-on-primary font-semibold' : hasEventsOnDay(deal, day) ? 'bg-muted text-ink font-semibold border-line-strong' : 'bg-subtle text-ink-2 hover:bg-muted border-line-soft border-line-soft'"
                                class="w-full aspect-square rounded-lg text-meta font-semibold border flex flex-col items-center justify-center relative transition-all">
                          {{ day }}
                          @if (hasEventsOnDay(deal, day) && !isSelectedCalendarDay(deal.id, day)) {
                            <span class="absolute bottom-1 w-1.5 h-1.5 bg-primary rounded-full"></span>
                          }
                        </button>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex flex-col justify-between">
                  <div class="space-y-2">
                    <span class="eyebrow block mb-2">
                      Events: {{ getSelectedCalendarDay(deal.id) ? 'Day ' + getSelectedCalendarDay(deal.id) + ' June' : 'Select a day' }}
                    </span>
                    <div class="space-y-2">
                      @for (m of getEventsOnDay(deal, getSelectedCalendarDay(deal.id) || 15); track m.id) {
                        <div class="bg-surface border border-line rounded-lg p-2.5 shadow-xs">
                          <div class="flex justify-between items-center mb-1">
                            <span class="font-semibold text-ink text-xs">{{ m.title }}</span>
                            <span class="text-meta text-ink-3">{{ m.time }}</span>
                          </div>
                          <div class="text-meta text-ink-3 uppercase tracking-wider mb-1">Type: {{ m.type }} | Location: {{ m.location }}</div>
                          <p class="text-meta text-ink-2 line-clamp-2 leading-relaxed">{{ m.summary }}</p>
                        </div>
                      } @empty {
                        <div class="text-center py-8 text-ink-3 text-meta bg-surface border border-line-soft rounded-xl">No meetings scheduled on this day.</div>
                      }
                    </div>
                  </div>
                  <div class="text-meta bg-muted text-ink-3 rounded-lg p-2.5 border border-line-soft mt-4 leading-relaxed">
                    Tip: Meetings logged in the Meetings tab automatically populate this calendar view.
                  </div>
                </div>
              </div>
            }

            <div class="mt-6 pt-4 border-t border-line-soft">
              <app-attachments ownerEntityType="DEAL" [ownerEntityId]="deal.id" [canWrite]="canWriteDeal()" />
            </div>

          </div>
        </div>

        <!-- Footer Actions -->
        <div class="card p-4 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <span class="text-xs text-ink-3">Lines: {{ deal.orderLines?.length || 0 }} items</span>
          </div>
          <div class="flex gap-2">
            @if (!hasPOForDeal(deal.id) && canCreatePO()) {
              <button (click)="openCreatePOModal(deal)" class="btn-secondary btn-sm">
                <mat-icon class="mr-1 icon-sm">add_shopping_cart</mat-icon> Create PO (Operations)
              </button>
            }
            @if (canCreateTask()) {
              <button (click)="openAssignTaskModal(deal.id, deal.title)" class="btn-secondary btn-sm">
                <mat-icon class="icon-sm">assignment</mat-icon> Assign Task
              </button>
            }
            @if (deal.stage === 'New' && canWriteDeal()) {
              <button (click)="state.updateDealStage(deal.id, 'Confirmed')" class="btn-primary btn-sm">
                <mat-icon class="mr-1 icon-sm">check</mat-icon> Confirm Deal
              </button>
            }
          </div>
        </div>
      } @else {
        <div class="bg-surface border border-line rounded-2xl p-16 text-center space-y-3">
          <div class="w-16 h-16 bg-muted text-ink-3 rounded-full flex items-center justify-center mx-auto">
            <mat-icon>error_outline</mat-icon>
          </div>
          <h2 class="card-title">Deal not found</h2>
          <p class="text-xs text-ink-3 max-w-xs mx-auto">The requested deal does not exist or may have been deleted.</p>
          <a routerLink="/sales" class="inline-block bg-muted text-ink border border-line px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs">Return to Sales</a>
        </div>
      }
    </div>

    <!-- Add Activity Modal -->
    @if (addActivityModalOpen(); as modal) {
      <div class="modal-backdrop">
        <div class="modal modal-lg">
          <div class="flex items-center justify-between">
            <h3 class="modal-title capitalize">{{ modal.type }} Log</h3>
            <button type="button" (click)="addActivityModalOpen.set(null)" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>

          @if (modal.type === 'calls') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date" class="field-label mb-1.5">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.calls.date" type="date" class="input-field w-full">
                </div>
                <div>
                  <label for="duration_min" class="field-label mb-1.5">Duration (min)</label>
                  <input id="duration_min" [(ngModel)]="newActivityInput.calls.duration" type="number" class="input-field w-full">
                </div>
              </div>
              <div>
                <label for="caller_name" class="field-label mb-1.5">Caller Name</label>
                <input id="caller_name" [(ngModel)]="newActivityInput.calls.callerName" type="text" class="input-field w-full">
              </div>
              <div>
                <label for="summary" class="field-label mb-1.5">Summary</label>
                <textarea id="summary" [(ngModel)]="newActivityInput.calls.summary" rows="3" class="input-field w-full"></textarea>
              </div>
              <div>
                <label for="outcome" class="field-label mb-1.5">Outcome</label>
                <select id="outcome" [(ngModel)]="newActivityInput.calls.outcome" class="input-field w-full">
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
                  <label for="date" class="field-label mb-1.5">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.emails.date" type="date" class="input-field w-full">
                </div>
                <div>
                  <label for="direction" class="field-label mb-1.5">Direction</label>
                  <select id="direction" [(ngModel)]="newActivityInput.emails.direction" class="input-field w-full">
                    <option value="sent">Sent</option>
                    <option value="received">Received</option>
                  </select>
                </div>
              </div>
              <div>
                <label for="subject" class="field-label mb-1.5">Subject</label>
                <input id="subject" [(ngModel)]="newActivityInput.emails.subject" type="text" class="input-field w-full">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="from" class="field-label mb-1.5">From</label>
                  <input id="from" [(ngModel)]="newActivityInput.emails.from" type="text" class="input-field w-full">
                </div>
                <div>
                  <label for="to" class="field-label mb-1.5">To</label>
                  <input id="to" [(ngModel)]="newActivityInput.emails.to" type="text" class="input-field w-full">
                </div>
              </div>
              <div>
                <label for="body" class="field-label mb-1.5">Body</label>
                <textarea id="body" [(ngModel)]="newActivityInput.emails.body" rows="3" class="input-field w-full"></textarea>
              </div>
            </div>
          }

          @if (modal.type === 'meetings') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date" class="field-label mb-1.5">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.meetings.date" type="date" class="input-field w-full">
                </div>
                <div>
                  <label for="time" class="field-label mb-1.5">Time</label>
                  <input id="time" [(ngModel)]="newActivityInput.meetings.time" type="text" class="input-field w-full">
                </div>
              </div>
              <div>
                <label for="title" class="field-label mb-1.5">Title</label>
                <input id="title" [(ngModel)]="newActivityInput.meetings.title" type="text" class="input-field w-full">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="type" class="field-label mb-1.5">Type</label>
                  <select id="type" [(ngModel)]="newActivityInput.meetings.type" class="input-field w-full">
                    <option value="teams">Teams</option>
                    <option value="demo">Demo</option>
                    <option value="physical">Physical</option>
                  </select>
                </div>
                <div>
                  <label for="location" class="field-label mb-1.5">Location</label>
                  <input id="location" [(ngModel)]="newActivityInput.meetings.location" type="text" class="input-field w-full">
                </div>
              </div>
              <div>
                <label for="attendees_comma_sepa" class="field-label mb-1.5">Attendees (comma separated)</label>
                <input id="attendees_comma_sepa" [(ngModel)]="newActivityInput.meetings.attendees" type="text" class="input-field w-full">
              </div>
              <div>
                <label for="summary" class="field-label mb-1.5">Summary</label>
                <textarea id="summary" [(ngModel)]="newActivityInput.meetings.summary" rows="2" class="input-field w-full"></textarea>
              </div>
            </div>
          }

          @if (modal.type === 'recordings') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date" class="field-label mb-1.5">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.recordings.date" type="date" class="input-field w-full">
                </div>
                <div>
                  <label for="duration" class="field-label mb-1.5">Duration</label>
                  <input id="duration" [(ngModel)]="newActivityInput.recordings.duration" type="text" class="input-field w-full">
                </div>
              </div>
              <div>
                <label for="title" class="field-label mb-1.5">Title</label>
                <input id="title" [(ngModel)]="newActivityInput.recordings.title" type="text" class="input-field w-full">
              </div>
              <div>
                <label for="meeting_link" class="field-label mb-1.5">Meeting Link</label>
                <input id="meeting_link" [(ngModel)]="newActivityInput.recordings.meetingLink" type="text" class="input-field w-full">
              </div>
              <div>
                <label for="recording_link" class="field-label mb-1.5">Recording Link</label>
                <input id="recording_link" [(ngModel)]="newActivityInput.recordings.recordingLink" type="text" class="input-field w-full">
              </div>
            </div>
          }

          @if (modal.type === 'notes') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date" class="field-label mb-1.5">Date</label>
                  <input id="date" [(ngModel)]="newActivityInput.notes.date" type="date" class="input-field w-full">
                </div>
                <div>
                  <label for="author" class="field-label mb-1.5">Author</label>
                  <input id="author" [(ngModel)]="newActivityInput.notes.author" type="text" class="input-field w-full">
                </div>
              </div>
              <div>
                <label for="content" class="field-label mb-1.5">Content</label>
                <textarea id="content" [(ngModel)]="newActivityInput.notes.content" rows="4" class="input-field w-full"></textarea>
              </div>
            </div>
          }

          @if (modal.type === 'followups') {
            <div class="space-y-3">
              <div>
                <label for="due_date" class="field-label mb-1.5">Due Date</label>
                <input id="due_date" [(ngModel)]="newActivityInput.followups.dueDate" type="date" class="input-field w-full">
              </div>
              <div>
                <label for="title" class="field-label mb-1.5">Title</label>
                <input id="title" [(ngModel)]="newActivityInput.followups.title" type="text" placeholder="e.g. Send quotation" class="input-field w-full">
              </div>
              <div>
                <label for="assigned_to" class="field-label mb-1.5">Assigned To</label>
                <input id="assigned_to" [(ngModel)]="newActivityInput.followups.assignedTo" type="text" class="input-field w-full">
              </div>
            </div>
          }

          <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
            <button (click)="addActivityModalOpen.set(null)" class="btn-secondary">Cancel</button>
            <button (click)="saveActivityEntry()" class="btn-primary">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- Create PO Modal -->
    @if (poModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-xl">
          <h3 class="modal-title shrink-0">Create Purchase Order</h3>
          <p class="text-xs text-ink-3 shrink-0">Creating Purchase Order linked to: <strong>{{selectedDealForPO()?.title}}</strong></p>

          <div class="space-y-4 overflow-y-auto pr-1 flex-1">
            <div>
              <div class="flex justify-between items-center mb-1">
                <label for="vendor" class="field-label">Vendor</label>
                <button (click)="showNewVendorForm.set(!showNewVendorForm())" class="text-ink hover:text-ink text-meta font-semibold uppercase">
                  {{ showNewVendorForm() ? 'Select Existing' : '+ Create New Vendor Inline' }}
                </button>
              </div>
              @if (showNewVendorForm()) {
                <div class="grid grid-cols-2 gap-3">
                  <input [(ngModel)]="newVendorData.name" type="text" placeholder="Vendor name" class="input-field">
                  <input [(ngModel)]="newVendorData.email" type="email" placeholder="Email" class="input-field">
                  <input [(ngModel)]="newVendorData.phone" type="text" placeholder="Phone" class="input-field">
                  <input [(ngModel)]="newVendorData.city" type="text" placeholder="City" class="input-field">
                </div>
              } @else {
                <select [(ngModel)]="selectedVendorId" class="input-field w-full">
                  @for (v of state.vendors(); track v.id) {
                    <option [value]="v.id">{{ v.name }}</option>
                  }
                </select>
              }
            </div>

            <div>
              <label for="delivery_date" class="field-label mb-1.5">Delivery Date</label>
              <input id="delivery_date" [(ngModel)]="newPoDeliveryDate" type="date" class="input-field w-full">
            </div>

            <div class="space-y-2">
              <label for="line_items" class="field-label">Line Items</label>
              <div class="space-y-2">
                @for (line of poLines(); track $index) {
                  <div class="grid grid-cols-12 gap-2 items-center">
                    <input [(ngModel)]="line.item" placeholder="Item name" class="input-field col-span-4">
                    <input [(ngModel)]="line.qty" type="number" class="input-field col-span-2 text-center" placeholder="Qty">
                    <input [(ngModel)]="line.unitPrice" type="number" class="input-field col-span-3 text-right" placeholder="Unit price">
                    <select [(ngModel)]="line.type" class="input-field col-span-2">
                      <option value="software">Software</option>
                      <option value="hardware">Hardware</option>
                      <option value="service">Service</option>
                    </select>
                    <button type="button" (click)="removePoLine($index)" class="btn-icon btn-sm">
                      <mat-icon class="icon-sm">delete</mat-icon>
                    </button>
                  </div>
                }
              </div>
              <button (click)="addPoLineItem()" class="text-ink hover:text-ink text-xs font-semibold flex items-center mt-1">
                <mat-icon class="icon-sm">add_circle</mat-icon> Add Line Item
              </button>
            </div>
          </div>

          <div class="flex justify-between items-center border-t border-line-soft pt-4 shrink-0">
            <span class="text-sm text-ink-3">Total: <strong class="text-ink">{{ formatCurrency(getPoTotal()) }}</strong></span>
            <div class="flex gap-2">
              <button (click)="poModalOpen.set(false); clearPoLocalState()" class="btn-secondary">Cancel</button>
              <button (click)="saveDraftPO()" class="btn-secondary">Save as Draft</button>
              <button (click)="savePurchaseOrder()" class="btn-primary">Create & Send PO</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Assign Task Modal -->
    @if (assignTaskModalOpen(); as ctx) {
      <div class="modal-backdrop">
        <div class="modal modal-md">
          <div class="flex items-center justify-between">
            <h3 class="modal-title">Assign Task</h3>
            <button (click)="assignTaskModalOpen.set(null)" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>
          <p class="text-xs text-ink-3">For: <strong>{{ ctx.entityTitle }}</strong></p>

          <div class="space-y-3">
            <div>
              <label for="task_title" class="field-label mb-1.5">Task Title</label>
              <input id="task_title" [(ngModel)]="assignTaskData.title" type="text" placeholder="e.g. Review deal terms" class="input-field w-full">
            </div>
            <div>
              <label for="description" class="field-label mb-1.5">Description</label>
              <textarea id="description" [(ngModel)]="assignTaskData.description" rows="2" class="input-field w-full"></textarea>
            </div>
            <div>
              <label for="assigned_team" class="field-label mb-1.5">Assigned Team</label>
              <select id="assigned_team" [(ngModel)]="assignTaskData.assignedTeamId" class="input-field w-full">
                <option value="">Unassigned</option>
                @for (team of state.teams(); track team.id) {
                  <option [value]="team.id">{{ team.name }}</option>
                }
              </select>
            </div>
            <div>
              <span class="block text-xs font-semibold text-ink-3 mb-1">Assigned To</span>
              <app-user-picker [(value)]="assignTaskData.assignedToUserId" placeholder="— Select —" />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
            <button (click)="assignTaskModalOpen.set(null)" class="btn-secondary">Cancel</button>
            <button (click)="saveAssignTask()" class="btn-primary">Create Task</button>
          </div>
        </div>
      </div>
    }
  `
})
export class DealDetailComponent {
  private confirmDialog = inject(ConfirmService);
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

  async deleteDeal(deal: Deal) {
    if (!this.state.hasAuthority('DEALS_DELETE')) return;
    if (await this.confirmDialog.ask({ title: 'Delete deal?', message: `"${deal.title}" will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete deal', danger: true })) {
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
