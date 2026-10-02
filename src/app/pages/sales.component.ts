import { Component, inject, signal, computed, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Partner, Proposal, Deal, PurchaseOrder, Task } from '../services/crm-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { DataStatusBannerComponent } from '../shared/data-status-banner.component';
import { PaginatorComponent } from '../shared/paginator.component';
import { AttachmentsComponent } from '../shared/attachments.component';
import { SalesPipelineBoardComponent } from './sales-pipeline-board.component';
import { DealsService } from '../services/domains/deals.service';
import { ProposalsService } from '../services/domains/proposals.service';
import { PurchaseOrdersService } from '../services/domains/purchase-orders.service';
import { PartnersService } from '../services/domains/partners.service';
import { TasksService } from '../services/domains/tasks.service';
import { CrmStateService } from '../services/crm-state.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { UserPickerComponent } from '../shared/user-picker.component';
import { ApiService } from '../services/api.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { StatCardComponent } from '../shared/ui/stat-card.component';
import { ConfirmService } from '../shared/ui/confirm.service';
import { ToastService } from '../services/toast.service';

export type SalesStage = 'New Lead' | 'Qualified' | 'Meeting Scheduled' | 'Proposal Sent' | 'Negotiation' | 'Won / Lost';

@Component({
  selector: 'app-sales',
  imports: [MatIconModule, CommonModule, FormsModule, RouterLink, CreatedByBadgeComponent, DataStatusBannerComponent, PaginatorComponent, AttachmentsComponent, SalesPipelineBoardComponent, TranslatePipe, UserPickerComponent, PageHeaderComponent, EmptyStateComponent, StatCardComponent],
  template: `
    <!--
      eslint-disable @angular-eslint/template/label-has-associated-control --
      ~90 block-level <label>s in this template sit visually above their field but are not
      programmatically associated (no for/id, not nested). Associating each one needs per-field
      visual QA on this 3600-line template, so it is tracked as follow-up a11y work.
      TODO(a11y): wire these labels to their controls and remove this directive.
    -->
    <div class="page">
      <app-page-header title="Sales Pipeline" subtitle="Deals, proposals and purchase orders from first quote to delivery">
        @if (activeTab() === 'deals' && canCreateDeal()) {
          <button actions class="btn-primary" (click)="openCreateDealModal()">
            <mat-icon>add</mat-icon>
            New Deal
          </button>
        } @else if (activeTab() === 'proposals' && canCreateProposal()) {
          <button actions class="btn-primary" (click)="openCreateProposalModal()">
            <mat-icon>add</mat-icon>
            New Proposal
          </button>
        }
      </app-page-header>

      @if (activeTab() !== 'deals') {
        <app-data-status-banner [loading]="activeTabLoading()" [error]="activeTabError()" />
      }

      @if (activeTab() === 'deals') {
        <div class="stat-grid">
          <app-stat-card label="Open Deals" [value]="openDealCount()" icon="handshake" tone="violet" [hint]="money0(openDealValue()) + ' in play'" />
          <app-stat-card label="Won" [value]="money0(wonValue())" icon="emoji_events" tone="violet" [hint]="wonCount() + ' deal' + (wonCount() === 1 ? '' : 's') + ' closed'" />
          <app-stat-card label="Lost" [value]="money0(lostValue())" icon="trending_down" tone="rose" [hint]="lostCount() + ' deal' + (lostCount() === 1 ? '' : 's') + ' lost'" />
          <app-stat-card label="Average Deal" [value]="money0(averageDeal())" icon="payments" tone="violet" hint="across all deals" />
        </div>
      }

      <div class="tabs" role="tablist">
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'deals'" [attr.aria-selected]="activeTab() === 'deals'"
                (click)="setActiveTab('deals', 'sales.deals')">
          <mat-icon>monetization_on</mat-icon>
          {{ 'sales.deals' | translate }}
          <span class="count-pill">{{ dealsService.allDeals().length }}</span>
        </button>
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'proposals'" [attr.aria-selected]="activeTab() === 'proposals'"
                (click)="setActiveTab('proposals', 'sales.proposals')">
          <mat-icon>description</mat-icon>
          {{ 'sales.proposals' | translate }}
          <span class="count-pill">{{ proposalsService.allProposals().length }}</span>
        </button>
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'pos'" [attr.aria-selected]="activeTab() === 'pos'"
                (click)="setActiveTab('pos', 'sales.purchaseOrders')">
          <mat-icon>shopping_cart</mat-icon>
          Purchase Orders
          <span class="count-pill">{{ purchaseOrdersService.allPurchaseOrders().length }}</span>
        </button>
      </div>

      <!-- Deals View -->
      @if (activeTab() === 'deals') {
        <div class="toolbar">
          <div class="segmented" role="group" aria-label="Deals view">
            <button class="segmented__item" [class.is-active]="dealsView() === 'table'" [attr.aria-pressed]="dealsView() === 'table'" (click)="dealsView.set('table')">
              <mat-icon>list_alt</mat-icon>
              Table
            </button>
            <button class="segmented__item" [class.is-active]="dealsView() === 'board'" [attr.aria-pressed]="dealsView() === 'board'" (click)="dealsView.set('board')">
              <mat-icon>view_column</mat-icon>
              Board
            </button>
          </div>
          <span class="toolbar__count toolbar__spacer">{{ dealsService.allDeals().length }} deal{{ dealsService.allDeals().length !== 1 ? 's' : '' }}</span>
        </div>
      }

      @if (activeTab() === 'deals' && dealsView() === 'board') {
        <app-sales-pipeline-board />
      }

      @if (activeTab() === 'deals' && dealsView() === 'table') {
        <div class="table-card">
          @if (activeTabLoading()) {
            <app-data-status-banner [loading]="true" [variant]="'rows'" [columns]="9" [rows]="8" />
          } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">
                  <input type="checkbox" [checked]="allDealsSelected()" (click)="toggleSelectAllDeals($event)" (change)="$event.stopPropagation()" class="cursor-pointer" />
                </th>
                <th scope="col">Deal Title</th>
                <th scope="col">Client</th>
                <th scope="col">Amount</th>
                <th scope="col">Stage</th>
                <th scope="col">Est. Delivery</th>
                <th scope="col">Order Status</th>
                <th scope="col">Created By</th>
                <th scope="col" class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (deal of paginatedDeals(); track deal.id) {
                <tr>
                  <td class="whitespace-nowrap" (click)="$event.stopPropagation()">
                    <input type="checkbox" [checked]="isDealSelected(deal.id)" (click)="toggleDealSelect(deal.id, $event)" class="cursor-pointer" />
                  </td>
                  <td class="whitespace-nowrap">
                    <button (click)="openDealDrawer(deal)" class="table-name-link text-sm font-semibold text-ink text-left" [title]="'View ' + deal.title">{{deal.title}}</button>
                    @if (deal.dealNumber) {
                      <div class="text-meta text-ink-3 font-medium">{{deal.dealNumber}}</div>
                    }
                  </td>
                  <td class="whitespace-nowrap">
                    <div class="text-sm text-ink-2 font-medium">{{getPartnerName(deal.partnerId)}}</div>
                  </td>
                  <td class="whitespace-nowrap">
                    <div class="text-sm text-ink font-semibold">{{formatCurrency(deal.amount)}}</div>
                    @if (deal.discount) {
                      <div class="text-meta text-ink font-semibold">-{{deal.discount}}%</div>
                    }
                  </td>
                  <td class="whitespace-nowrap">
                    <span class="badge" [class]="getDealStageBadge(deal.stage)">
                      {{deal.stage}}
                    </span>
                  </td>
                  <td class="whitespace-nowrap text-ink-2">
                    {{deal.estimatedDeliveryDate || 'N/A'}}
                  </td>
                  <td class="whitespace-nowrap">
                    <span class="badge badge-neutral">
                      {{deal.orderStatus || 'N/A'}}
                    </span>
                  </td>
                  <td class="whitespace-nowrap">
                    <app-created-by-badge [createdBy]="deal.createdBy" [createdAt]="deal.createdAt" />
                  </td>
                  <td class="whitespace-nowrap text-right">
                    <button (click)="$event.stopPropagation(); openDealDrawer(deal)" class="btn-icon btn-sm" title="View details">
                      <mat-icon class="icon-sm">visibility</mat-icon>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9" class="row-empty">
                    <app-empty-state icon="monetization_on" title="No deals yet" text="Deals appear here once a proposal is confirmed. Start with a new proposal or create a deal directly." />
                  </td>
                </tr>
              }
            </tbody>
          </table>
          }
          @if (dealsService.allDeals().length > 0) {
            <app-paginator
              [currentPage]="dealsPage()"
              [totalPages]="dealsTotalPages()"
              [pageSize]="dealsPageSize()"
              (pageChange)="dealsPage.set($event)"
              (pageSizeChange)="dealsPageSize.set($event)" />
          }
          @if (activeTabError()) {
            <app-data-status-banner [error]="activeTabError()" [variant]="'none'" />
          }
        </div>
        @if (selectedDealIds().size > 0) {
          <div class="bulk-action-bar">
            <span class="font-semibold">{{ selectedDealIds().size }} selected</span>
            <div class="bulk-action-bar__sep"></div>
            <select (change)="bulkAssignDealOwner($event)">
              <option value="">Assign owner…</option>
              @for (u of state.users(); track u.id) { <option [value]="u.id">{{u.displayName}}</option> }
            </select>
            <select (change)="bulkChangeDealStage($event)">
              <option value="">Change stage…</option>
              @for (s of dealStageOptions; track s) { <option [value]="s">{{s}}</option> }
            </select>
            <button class="bulk-action-bar__btn" (click)="bulkExportDeals()">Export CSV</button>
            <button class="bulk-action-bar__btn is-quiet" (click)="clearDealSelection()">Clear</button>
          </div>
        }
      }

      <!-- Proposals View -->
      @if (activeTab() === 'proposals') {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          @for (prop of paginatedProposals(); track prop.id) {
            <div class="card p-5 flex flex-col justify-between transition-all">
              <div class="space-y-3">
                <div class="flex justify-between items-start">
                  <span class="badge"
                    [class]="prop.status === 'Confirmed' ? 'badge-success' : (prop.status === 'Sent' ? 'badge-info' : 'bg-muted text-ink')">
                    {{prop.status}}
                  </span>
                  <span class="text-sm text-ink-3">#{{ prop.id.slice(0, 8) }}</span>
                </div>
                <h3 class="modal-title">{{prop.title}}</h3>
                <p class="text-xs text-ink-3">Prospect: {{getPartnerName(prop.partnerId)}}</p>
                <div class="flex items-center gap-3 text-xs text-ink-3">
                  <app-created-by-badge [createdBy]="prop.createdBy" [createdAt]="prop.createdAt" [size]="22" />
                </div>

                <!-- Lines -->
                <div class="bg-subtle rounded-xl p-3 border border-line-soft space-y-2">
                  <span class="eyebrow block">Lines & Pricing</span>
                  @for (line of prop.lines; track $index) {
                    <div class="flex justify-between text-xs text-ink-2">
                      <span>{{line.qty}}x {{line.product}}</span>
                      <span class="">{{formatCurrency(line.total)}}</span>
                    </div>
                  }
                  <div class="flex justify-between border-t border-line pt-1.5 text-xs font-semibold text-ink">
                    <span>Total Proposal Amount</span>
                    <span>{{formatCurrency(prop.amount)}}</span>
                  </div>
                </div>

                <!-- Sales Intelligence / Funnel Metadata -->
                <div class="border-t border-line-soft pt-3">
                  <span class="eyebrow block mb-2">Sales Intelligence</span>
                  <div class="card grid grid-cols-2 gap-3 p-3 text-xs">
                    <div>
                      <span class="text-ink-3 block text-meta font-medium">Opportunity Value</span>
                      <span class="font-semibold text-ink">{{ formatCurrency(prop.opportunityValue || 0) }}</span>
                    </div>
                    <div>
                      <span class="text-ink-3 block text-meta font-medium">Probability</span>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <div class="w-full bg-muted-strong rounded-full h-1.5 max-w-[60px]">
                          <div class="bg-primary h-1.5 rounded-full" [style.width.%]="prop.closingProbability || 0"></div>
                        </div>
                        <span class="font-semibold text-ink">{{ prop.closingProbability || 0 }}%</span>
                      </div>
                    </div>
                    <div>
                      <span class="text-ink-3 block text-meta font-medium">Expected Close</span>
                      <span class="font-semibold text-ink-2">{{ prop.expectedClosingDate || 'TBD' }}</span>
                    </div>
                    <div>
                      <span class="text-ink-3 block text-meta font-medium">Sales Stage</span>
                      <span class="badge mt-0.5" [class]="getStageBadgeClass(prop.stage)">
                        {{ prop.stage || 'New Lead' }}
                      </span>
                    </div>
                    <div class="col-span-2">
                      <span class="text-ink-3 block text-meta font-medium">Competitors</span>
                      @if (prop.competitors && prop.competitors.length > 0) {
                        <div class="flex flex-wrap gap-1 mt-1">
                          @for (comp of prop.competitors; track comp) {
                            <span class="badge badge-neutral">{{comp}}</span>
                          }
                        </div>
                      } @else {
                        <span class="text-ink-3 font-medium italic">No competitors logged.</span>
                      }
                    </div>
                  </div>
                </div>
                
                <!-- Confirmation Info (if confirmed) -->
                @if (prop.status === 'Confirmed' && prop.confirmationMethod) {
                  <div class="border-t border-line-soft pt-3 mt-3">
                    <span class="eyebrow block mb-1.5">Confirmation Proof</span>
                    <div class="bg-muted border border-line rounded-xl p-3 text-xs text-ink space-y-2">
                      <div class="flex items-center gap-1.5 font-semibold text-ink text-meta">
                        @if (prop.confirmationMethod === 'Email') {
                          <mat-icon class="icon-sm">email</mat-icon>
                          <span>Email confirmation</span>
                        } @else if (prop.confirmationMethod === 'WhatsApp') {
                          <mat-icon class="icon-sm">chat</mat-icon>
                          <span>WhatsApp screenshot</span>
                        } @else {
                          <mat-icon class="icon-sm">phone</mat-icon>
                          <span>Call Summary</span>
                        }
                        @if (prop.confirmedAt) {
                          <span class="text-meta text-ink font-normal ml-auto">{{ prop.confirmedAt }}</span>
                        }
                      </div>

                      @if (prop.confirmationAttachmentName) {
                        <div class="flex items-center gap-1.5 bg-surface border border-line-strong p-2 rounded-lg text-ink text-meta truncate">
                          <mat-icon class="text-ink icon-xs">attach_file</mat-icon>
                          <span class="truncate flex-1">{{ prop.confirmationAttachmentName }}</span>
                          @if (prop.confirmationAttachmentData) {
                            <a [href]="prop.confirmationAttachmentData" [download]="prop.confirmationAttachmentName"
                               class="text-accent-ink hover:underline font-semibold ml-1 shrink-0">Download</a>
                          }
                        </div>
                      }

                      @if (prop.confirmationNote) {
                        <p class="text-meta text-ink-2 leading-relaxed bg-surface border border-success-line p-2 rounded-lg italic">
                          "{{ prop.confirmationNote }}"
                        </p>
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="mt-5 pt-3 border-t border-line-soft flex justify-between gap-2">
                <button (click)="openProposalDrawer(prop)" class="btn-icon btn-sm shrink-0" title="View Details">
  <mat-icon class="icon-sm">visibility</mat-icon>
</button>
                <button (click)="downloadProposalPdf(prop)" class="btn-icon btn-sm shrink-0" title="Download Proposal PDF">
  <mat-icon class="icon-sm">picture_as_pdf</mat-icon>
</button>
                <button (click)="openEditProposalModal(prop)" class="btn-icon btn-sm shrink-0" title="Edit Proposal">
  <mat-icon class="icon-sm">edit</mat-icon>
</button>
                @if (canDeleteProposal()) {
                  <button (click)="openProposalDeleteModal(prop)" class="btn-icon btn-sm btn-danger-hover shrink-0" title="Delete Proposal">
  <mat-icon class="icon-sm">delete</mat-icon>
</button>
                }

                @if (prop.status === 'Draft') {
                  <button (click)="openAssignTaskModal('proposal', prop.id, prop.title)" class="btn-icon btn-sm shrink-0" title="Assign Task">
  <mat-icon class="icon-sm">assignment</mat-icon>
</button>
                  <button (click)="openSendProposalModal(prop)" class="btn-primary btn-sm">
                    Send to Prospect
                  </button>
                } @else if (prop.status === 'Sent') {
                  <button (click)="openConfirmProposalModal(prop)" class="btn-primary btn-sm">
                    <mat-icon class="icon-sm">task_alt</mat-icon> Confirm (Signs BC)
                  </button>
                } @else {
                  <button (click)="openConvertProposalModal(prop)" class="btn-primary btn-sm flex-1">
                    <mat-icon class="icon-sm">swap_horiz</mat-icon>
                    Convert to Deal &amp; Customer
                  </button>
                }
              </div>
            </div>
          } @empty {
            <div class="col-span-full card">
              <app-empty-state icon="description" title="No proposals yet" text="Draft a proposal, send it to a prospect and convert it to a deal once confirmed." />
            </div>
          }
        </div>
        @if (proposalsService.allProposals().length > 0) {
          <app-paginator
            [currentPage]="proposalsPage()"
            [totalPages]="proposalsTotalPages()"
            [pageSize]="proposalsPageSize()"
            (pageChange)="proposalsPage.set($event)"
            (pageSizeChange)="proposalsPageSize.set($event)" />
        }
      }

      <!-- Purchase Orders View -->
      @if (activeTab() === 'pos') {
        <div class="table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">PO Ref</th>
                <th scope="col">Vendor</th>
                <th scope="col">Deal</th>
                <th scope="col">Amount</th>
                <th scope="col">Delivery Date</th>
                <th scope="col">Status</th>
                <th scope="col">Created By</th>
                <th scope="col" class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (po of paginatedPOs(); track po.id) {
                <tr>
                  <td class="whitespace-nowrap">
                    <button (click)="openPODrawer(po)" class="table-name-link text-sm font-semibold text-ink text-left" [title]="'View PO #' + po.id">#{{ po.id.slice(0, 8) }}</button>
                    @if (po.sentVia) {
                      <span class="text-meta text-ink-3 font-medium">Sent: {{po.sentVia}}</span>
                    }
                  </td>
                  <td class="whitespace-nowrap">
                    <div class="text-sm text-ink font-medium">{{getPartnerName(po.vendorId)}}</div>
                  </td>
                  <td class="whitespace-nowrap">
                    <div class="text-sm text-ink-3">{{getDealTitle(po.dealId)}}</div>
                  </td>
                  <td class="whitespace-nowrap">
                    <div class="text-sm text-ink font-semibold">{{formatCurrency(po.amount)}}</div>
                  </td>
                  <td class="whitespace-nowrap">
                    <div class="text-sm text-ink-2">{{po.deliveryDate || 'Pending Conf.'}}</div>
                  </td>
                  <td class="whitespace-nowrap">
                    <span class="badge"
                      [class]="po.status === 'Delivered' ? 'badge-success' : (po.status === 'Sent' ? 'badge-info' : 'bg-muted text-ink')">
                      {{po.status}}
                    </span>
                  </td>
                  <td class="whitespace-nowrap">
                    <app-created-by-badge [createdBy]="po.createdBy" [createdAt]="po.createdAt" />
                  </td>
                  <td class="whitespace-nowrap text-right space-x-1.5">
                    <button (click)="$event.stopPropagation(); openPODrawer(po)" class="btn-icon btn-sm" title="View Details">
  <mat-icon class="icon-sm">visibility</mat-icon>
</button>
                    <button (click)="$event.stopPropagation(); downloadPOPdf(po)" class="btn-icon btn-sm" title="Download PO PDF">
  <mat-icon class="icon-sm">picture_as_pdf</mat-icon>
</button>
                    <button (click)="$event.stopPropagation(); openAssignTaskModal('po', po.id, 'PO #' + po.id)" class="btn-secondary btn-sm ml-auto" title="Assign Task">
                      <mat-icon class="icon-xs">assignment</mat-icon> Assign
                    </button>
                    @if (po.status === 'Sent' && canWritePO()) {
                      <button (click)="$event.stopPropagation(); openSetDeliveryDatePOModal(po)" class="btn-secondary btn-sm">Set Del. Date</button>
                      <button (click)="$event.stopPropagation(); purchaseOrdersService.updateStatus(po.id, 'Delivered')" class="btn-primary btn-sm">Receive Goods</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="row-empty">
                    <app-empty-state icon="shopping_cart" title="No purchase orders yet" text="Purchase orders are generated from confirmed deals." />
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (purchaseOrdersService.allPurchaseOrders().length > 0) {
            <app-paginator
              [currentPage]="posPage()"
              [totalPages]="posTotalPages()"
              [pageSize]="posPageSize()"
              (pageChange)="posPage.set($event)"
              (pageSizeChange)="posPageSize.set($event)" />
          }
        </div>
      }
    </div>

    <!-- Modals -->
    <!-- Send Proposal Modal -->
    @if (sendingProposalId()) {
      <div class="modal-backdrop">
        <div class="modal modal-md">
          <div class="flex items-center justify-between">
            <h3 class="modal-title">Send Proposal</h3>
            <button (click)="sendingProposalId.set(null)" title="Close" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>

          <!-- Target Organization -->
          <div class="bg-muted border border-line rounded-xl p-3">
            <span class="eyebrow block mb-0.5">Target Organization</span>
            <span class="text-sm font-semibold text-ink">{{ currentProposalPartnerName() }}</span>
          </div>

          <!-- Channel Selection (multi-select toggle) -->
          <div class="space-y-2">
            <label class="field-label">Sending Channel(s) — select one or both</label>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" (click)="toggleChannel('email')"
                [class]="isChannelSelected('email')
                  ? 'flex flex-col items-center justify-center p-4 border-2 border-ink bg-muted text-ink rounded-xl gap-2 font-semibold transition-all shadow-sm'
                  : 'flex flex-col items-center justify-center p-4 border border-line rounded-xl hover:border-line-strong hover:bg-subtle hover:text-ink transition-all gap-2 text-ink-2'">
                <mat-icon class="icon-xl">email</mat-icon>
                <span class="text-sm font-semibold">Email</span>
                @if (isChannelSelected('email')) {
                  <span class="badge badge-accent">Selected</span>
                }
              </button>
              <button type="button" (click)="toggleChannel('whatsapp')"
                [class]="isChannelSelected('whatsapp')
                  ? 'flex flex-col items-center justify-center p-4 border-2 border-ink bg-muted text-ink rounded-xl gap-2 font-semibold transition-all shadow-sm'
                  : 'flex flex-col items-center justify-center p-4 border border-line rounded-xl hover:border-line-strong hover:bg-subtle hover:text-ink transition-all gap-2 text-ink-2'">
                <mat-icon class="icon-xl">chat</mat-icon>
                <span class="text-sm font-semibold">WhatsApp</span>
                @if (isChannelSelected('whatsapp')) {
                  <span class="badge badge-accent">Selected</span>
                }
              </button>
            </div>
          </div>

          <!-- Add other contacts from same org -->
          @if (proposalOrgContacts().length > 0) {
            <div>
              <label class="field-label mb-1.5">Add other contacts from this organization:</label>
              <select (change)="addContactToRecipients($event)" class="input-field w-full">
                <option value="">— Select a contact —</option>
                @for (contact of proposalOrgContacts(); track contact.id) {
                  <option [value]="contact.id">{{ contact.fullName }} · {{ contact.jobTitle }}</option>
                }
              </select>
            </div>
          }

          <!-- Recipients list -->
          <div class="space-y-2">
            <label class="field-label">Recipients</label>
            @for (recipient of recipients(); track $index) {
              <div class="bg-subtle border border-line rounded-xl p-3 space-y-2">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-semibold text-ink-2 truncate max-w-[200px]">{{ recipient.name || 'New Contact' }}</span>
                  @if ($index > 0) {
                    <button type="button" (click)="removeRecipient($index)" title="Remove recipient" class="btn-icon btn-sm">
                      <mat-icon class="icon-sm">close</mat-icon>
                    </button>
                  }
                </div>
                @if (isChannelSelected('email')) {
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-ink-3 shrink-0 icon-xs">email</mat-icon>
                    <input [value]="recipient.email || ''" (input)="updateRecipientEmail($index, $event)"
                      type="email" placeholder="Email address"
                      class="input-field flex-1">
                  </div>
                }
                @if (isChannelSelected('whatsapp')) {
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-ink-2 shrink-0 icon-xs">chat</mat-icon>
                    <input [value]="recipient.phone || ''" (input)="updateRecipientPhone($index, $event)"
                      type="tel" placeholder="Phone / WhatsApp number"
                      class="input-field flex-1">
                  </div>
                }
              </div>
            } @empty {
              <div class="text-center py-4 text-ink-3 text-xs bg-subtle rounded-xl border border-dashed border-line">
                No recipients yet. The primary contact will be added automatically.
              </div>
            }
            <button type="button" (click)="addManualRecipient()" class="text-ink hover:text-ink text-xs font-semibold flex items-center gap-1 transition-colors">
              <mat-icon class="icon-sm">add_circle</mat-icon> Add Recipient
            </button>
          </div>

          <!-- Footer actions -->
          <div class="flex justify-between gap-2 pt-2 border-t border-line-soft">
            <button (click)="sendingProposalId.set(null)" class="btn-secondary">Cancel</button>
            <button (click)="submitSendProposal()"
              [disabled]="selectedChannels().size === 0 || recipients().length === 0"
              class="btn-primary">
              <mat-icon class="icon-sm">send</mat-icon>
              Send Proposal
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Create Proposal Modal -->
    @if (proposalModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-lg">
          <h3 class="modal-title shrink-0">{{ editingProposalId() ? 'Edit Proposal' : 'Create Proposal' }}</h3>
          
          <div class="space-y-4 overflow-y-auto pr-1 flex-1">
            <div class="space-y-3">
              <div>
                <label class="field-label mb-1.5">Select Prospect / Client</label>
                <select [(ngModel)]="newProposal.partnerId" class="input-field w-full">
                  @for (partner of salesEligiblePartners(); track partner.id) {
                    <option [value]="partner.id">{{ partner.name }} ({{ partner.type }})</option>
                  }
                </select>
              </div>

              <div>
                <label class="field-label mb-1.5">Proposal Title</label>
                <input [(ngModel)]="newProposal.title" type="text" placeholder="e.g. Standard Enterprise Cloud Infrastructure" class="input-field w-full">
              </div>

              <div>
                <label class="field-label mb-1.5">Select Template</label>
                <select [(ngModel)]="selectedTemplateId" (change)="applyTemplate()" class="input-field w-full">
                  <option value="">-- Manual/No Template --</option>
                  @for (temp of proposalTemplates(); track temp.id) {
                    <option [value]="temp.id">{{temp.name}}</option>
                  }
                </select>
              </div>

              <!-- Sales Funnel & Intelligence Section -->
              <div class="border-t border-line-soft pt-3 space-y-3">
                <span class="eyebrow block">Sales Intelligence</span>
                
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="field-label mb-1.5">Opportunity Value</label>
                    <div class="relative rounded-lg shadow-xs">
                      <input [(ngModel)]="newProposal.opportunityValue" type="number" placeholder="0" class="input-field w-full pr-12">
                      <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span class="text-ink-3 text-xs font-semibold">MAD</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label class="field-label mb-1.5">Probability of Closing</label>
                    <div class="relative rounded-lg shadow-xs">
                      <input [(ngModel)]="newProposal.closingProbability" type="number" min="0" max="100" placeholder="50" class="input-field w-full pr-8">
                      <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span class="text-ink-3 text-xs font-semibold">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="field-label mb-1.5">Expected Closing Date</label>
                    <input [(ngModel)]="newProposal.expectedClosingDate" type="date" class="input-field w-full">
                  </div>
                  
                  <div>
                    <label class="field-label mb-1.5">Sales Stage</label>
                    <select [(ngModel)]="newProposal.stage" class="input-field w-full">
                      <option value="New Lead">New Lead</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Meeting Scheduled">Meeting Scheduled</option>
                      <option value="Proposal Sent">Proposal Sent</option>
                      <option value="Negotiation">Negotiation</option>
                      <option value="Won / Lost">Won / Lost</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="field-label mb-1.5">Competitors (comma separated)</label>
                  <input [(ngModel)]="newProposal.competitors" type="text" placeholder="e.g. AWS, Azure, Local Telecom" class="input-field w-full">
                </div>
              </div>

              <!-- Line Items -->
              <div class="space-y-2 border-t border-line-soft pt-2">
                <span class="eyebrow block">Line Items</span>
                @for (line of newProposal.lines; track $index) {
                  <div class="grid grid-cols-12 gap-2 items-center">
                    <input class="input-field col-span-4" [(ngModel)]="line.product" placeholder="Product">
                    <input class="input-field col-span-4" [(ngModel)]="line.description" placeholder="Description">
                    <input class="input-field col-span-1 text-center" type="number" [(ngModel)]="line.qty" (change)="recalcLine(line)">
                    <input class="input-field col-span-2 text-right" type="number" [(ngModel)]="line.unitPrice" (change)="recalcLine(line)">
                    <button type="button" (click)="removeLine($index)" title="Remove line" class="btn-icon btn-sm"><mat-icon class="icon-sm">delete</mat-icon></button>
                  </div>
                }
                <button (click)="addLineItem()" class="text-ink hover:text-ink text-xs font-semibold flex items-center mt-1">
                  <mat-icon class="mr-0.5 icon-sm">add_circle</mat-icon> Add Line Item
                </button>
              </div>
            </div>
          </div>

          <div class="flex justify-between items-center border-t border-line-soft pt-4 shrink-0">
            <div class="text-sm">
              <span class="text-ink-3">Total Amount:</span>
              <strong class="ml-1 text-ink">{{formatCurrency(getNewProposalTotal())}}</strong>
            </div>
            <div class="flex gap-2">
              <button (click)="proposalModalOpen.set(false)" class="btn-secondary">Cancel</button>
              <button (click)="saveProposal(true)" class="btn-secondary">
                <mat-icon class="icon-sm">assignment</mat-icon> {{ editingProposalId() ? 'Save &amp; Assign Task' : 'Create &amp; Assign Task' }}
              </button>
              <button (click)="saveProposal()" class="btn-primary">{{ editingProposalId() ? 'Save Changes' : 'Create Proposal' }}</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Create Deal Modal -->
    @if (dealModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-3xl">
          <div class="flex justify-between items-center border-b border-line-soft pb-3 shrink-0">
            <h3 class="modal-title">Create Deal</h3>
            <span class="badge badge-neutral">Extended Fields Active</span>
          </div>
          
          <!-- HEADER SECTION: All form fields in scrollable 2-column grid -->
          <div class="overflow-y-auto pr-2 shrink-0 max-h-[50vh]">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Left Column: Core Deal info, Customer details, Commercials -->
              <div class="space-y-6">
                <!-- SECTION 1: Identification & Dates -->
                <div class="space-y-3">
                  <h4 class="eyebrow flex items-center gap-1.5">
                    <mat-icon class="icon-sm">tag</mat-icon> Identification & Dates
                  </h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Select Client (Must be Customer)</label>
                      <select [(ngModel)]="newDeal.partnerId" (change)="onPartnerChange()" class="input-field w-full">
                        @for (c of customers(); track c.id) {
                          <option [value]="c.id">{{c.name}}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Linked Proposal</label>
                      <select [(ngModel)]="newDeal.proposalId" (change)="onProposalChange()" class="input-field w-full">
                        <option value="">None</option>
                        @for (p of proposalsService.allProposals(); track p.id) {
                          <option [value]="p.id">#{{ p.id.slice(0, 8) }} - {{p.title}}</option>
                        }
                      </select>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Deal Title</label>
                      <input [(ngModel)]="newDeal.title" type="text" placeholder="e.g. Atlas Cloud Migration Project" class="input-field w-full">
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Order Status</label>
                      <select [(ngModel)]="newDeal.orderStatus" class="input-field w-full">
                        <option value="Draft">Draft</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Processing">Processing</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-4 gap-3">
                    <div class="col-span-2">
                      <label class="field-label mb-1.5">Order Number</label>
                      <input [(ngModel)]="newDeal.orderNumber" type="text" class="input-field w-full">
                    </div>
                    <div class="col-span-2">
                      <label class="field-label mb-1.5">Deal Number</label>
                      <input [(ngModel)]="newDeal.dealNumber" type="text" class="input-field w-full">
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Order Date</label>
                      <input [(ngModel)]="newDeal.orderDate" type="date" class="input-field w-full">
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Requested Delivery Date</label>
                      <input [(ngModel)]="newDeal.requestedDeliveryDate" type="date" class="input-field w-full">
                    </div>
                  </div>
                </div>

                <!-- SECTION 2: Customer & Delivery -->
                <div class="space-y-3">
                  <h4 class="eyebrow flex items-center gap-1.5">
                    <mat-icon class="icon-sm">business</mat-icon> Customer & Delivery
                  </h4>
                  <div class="grid grid-cols-3 gap-3">
                    <div class="col-span-1">
                      <label class="field-label mb-1.5">Customer Account</label>
                      <input [(ngModel)]="newDeal.customerAccount" type="text" class="input-field w-full">
                    </div>
                    <div class="col-span-2">
                      <label class="field-label mb-1.5">Contact Person</label>
                      <input [(ngModel)]="newDeal.contactPerson" type="text" class="input-field w-full">
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Contact Email</label>
                      <input [(ngModel)]="newDeal.contactEmail" type="email" class="input-field w-full">
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Contact Phone Number</label>
                      <input [(ngModel)]="newDeal.contactPhone" type="text" class="input-field w-full">
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Billing Address</label>
                      <textarea [(ngModel)]="newDeal.billingAddress" rows="2" class="input-field w-full"></textarea>
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Delivery Address</label>
                      <textarea [(ngModel)]="newDeal.deliveryAddress" rows="2" class="input-field w-full"></textarea>
                    </div>
                  </div>
                </div>

                <!-- SECTION 3: Sales & Ownership -->
                <div class="space-y-3">
                  <h4 class="eyebrow flex items-center gap-1.5">
                    <mat-icon class="icon-sm">person</mat-icon> Sales & Ownership
                  </h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Sales Person</label>
                      <select [(ngModel)]="newDeal.salesPersonUserId" class="input-field w-full">
                        <option value="">-- Unassigned --</option>
                        @for (u of users(); track u.id) {
                          <option [value]="u.id">{{u.displayName}}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Sales Organization / Region</label>
                      <input [(ngModel)]="newDeal.salesRegion" type="text" class="input-field w-full">
                    </div>
                  </div>
                </div>

                <!-- SECTION 4: Commercial Basics -->
                <div class="space-y-3">
                  <h4 class="eyebrow flex items-center gap-1.5">
                    <mat-icon class="icon-sm">monetization_on</mat-icon> Commercial Basics
                  </h4>
                  <div class="grid grid-cols-4 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Currency</label>
                      <select [(ngModel)]="newDeal.currency" class="input-field w-full">
                        <option value="MAD">MAD</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Amount (Raw)</label>
                      <input [(ngModel)]="newDeal.amount" type="number" class="input-field w-full">
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Discount (%)</label>
                      <input [(ngModel)]="newDeal.discount" type="number" class="input-field w-full">
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Payment Terms</label>
                      <input [(ngModel)]="newDeal.paymentTerms" type="text" placeholder="e.g. 30 Days Net" class="input-field w-full">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Vendor/Partner & Logs/Comments -->
              <div class="space-y-6">
                <!-- SECTION 5: Vendor / Partner (Logistics) -->
                <div class="space-y-3">
                  <h4 class="eyebrow flex items-center gap-1.5">
                    <mat-icon class="icon-sm">local_shipping</mat-icon> Vendor / Partner (Logistics)
                  </h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Vendor Account</label>
                      <input [(ngModel)]="newDeal.vendorAccount" type="text" class="input-field w-full">
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Purchase Order Reference</label>
                      <input [(ngModel)]="newDeal.purchaseOrderRef" type="text" class="input-field w-full">
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Warehouse Address</label>
                      <input [(ngModel)]="newDeal.warehouseAddress" type="text" class="input-field w-full">
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Transportation Service</label>
                      <input [(ngModel)]="newDeal.transportationService" type="text" class="input-field w-full">
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="field-label mb-1.5">Expected Delivery Date (Vendor)</label>
                      <input [(ngModel)]="newDeal.expectedDeliveryDateVendor" type="date" class="input-field w-full">
                    </div>
                    <div>
                      <label class="field-label mb-1.5">Delivery Date (Customer)</label>
                      <input [(ngModel)]="newDeal.deliveryDate" type="date" class="input-field w-full">
                    </div>
                  </div>
                </div>

                <!-- SECTION 6: Logs & Comments -->
                <div class="space-y-3">
                  <h4 class="eyebrow flex items-center gap-1.5">
                    <mat-icon class="icon-sm">notes</mat-icon> Logs & Comments
                  </h4>
                  <div>
                    <label class="field-label mb-1.5">Email Exchange logs & Confirmations</label>
                    <textarea [(ngModel)]="newDeal.emailExchange" rows="3" placeholder="Paste copy of signed email confirmations..." class="input-field w-full"></textarea>
                  </div>
                  <div>
                    <label class="field-label mb-1.5">Customer Comments</label>
                    <textarea [(ngModel)]="newDeal.comments" rows="2" placeholder="Comments..." class="input-field w-full"></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Horizontal Divider -->
          <hr class="border-line shrink-0">

          <!-- LINE ITEMS SECTION: Full-width data table -->
          <div class="space-y-3 min-h-0 flex flex-col overflow-hidden">
            <h4 class="eyebrow flex items-center gap-1.5 shrink-0">
              <mat-icon class="icon-sm">list</mat-icon> Line Items
            </h4>
            <div class="overflow-x-auto border border-line rounded-xl flex-1">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="w-12">#</th>
                    <th>Item Description</th>
                    <th class="text-right w-28">Quantity</th>
                    <th class="text-right w-36">Unit Price</th>
                    <th class="w-52">Vendor</th>
                    <th class="text-center w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of newDeal.lines; track $index) {
                    <tr>
                      <td class="text-ink-3 text-center">{{$index + 1}}</td>
                      <td>
                        <input class="input-field w-full" [(ngModel)]="line.description" placeholder="Item description">
                      </td>
                      <td>
                        <input class="input-field w-full text-right" type="number" [(ngModel)]="line.qty" (change)="recalcDealLine(line)">
                      </td>
                      <td>
                        <input class="input-field w-full text-right" type="number" [(ngModel)]="line.unitPrice" (change)="recalcDealLine(line)">
                      </td>
                      <td>
                        <select class="input-field w-full" [(ngModel)]="line.vendor">
                          <option value="">-- Select Vendor --</option>
                          @for (v of vendors(); track v.id) {
                            <option [value]="v.name">{{v.name}}</option>
                          }
                        </select>
                      </td>
                      <td class="text-center">
                      <button type="button" (click)="removeDealLine($index)" title="Remove line" class="btn-icon btn-sm">
                        <mat-icon class="icon-sm">delete</mat-icon>
                      </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <button (click)="addDealLineItem()" class="text-ink hover:text-ink text-xs font-semibold flex items-center shrink-0">
              <mat-icon class="mr-0.5 icon-sm">add_circle</mat-icon> Add Line Item
            </button>
          </div>

          <!-- Footer -->
          <div class="flex justify-between items-center border-t border-line-soft pt-4 shrink-0">
            <div class="text-sm">
              <span class="text-ink-3">Calculated Total:</span>
              <strong class="ml-1 text-ink">
                {{ formatCurrency(newDeal.amount - (newDeal.amount * (newDeal.discount / 100))) }}
              </strong>
            </div>
            <div class="flex gap-2">
              <button (click)="dealModalOpen.set(false)" class="btn-secondary">Cancel</button>
              <button (click)="saveDeal(true)" class="btn-secondary">
                <mat-icon class="icon-sm">assignment</mat-icon> Save &amp; Assign Task
              </button>
              <button (click)="saveDeal()" class="btn-primary">Save Deal</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Create PO Modal (Operations) -->
    @if (poModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-xl">
          <h3 class="modal-title shrink-0">Create Purchase Order</h3>
          <p class="text-xs text-ink-3 shrink-0">Creating Purchase Order linked to: <strong>{{selectedDealForPO()?.title}}</strong></p>
          
          <div class="space-y-4 overflow-y-auto pr-1 flex-1">
            <div>
              <div class="flex justify-between items-center mb-1">
                <label class="field-label">Vendor</label>
                <button (click)="showNewVendorForm.set(!showNewVendorForm())" class="text-ink hover:text-ink text-meta font-semibold uppercase">
                  {{ showNewVendorForm() ? 'Select Existing' : '+ Create New Vendor Inline' }}
                </button>
              </div>
              
              @if (showNewVendorForm()) {
                <div class="bg-subtle border border-line rounded-xl p-3 space-y-2.5 duration-200">
                  <input [(ngModel)]="newVendorData.name" placeholder="Vendor Company Name" class="input-field w-full">
                  <input [(ngModel)]="newVendorData.email" placeholder="Vendor Email" class="input-field w-full">
                  <input [(ngModel)]="newVendorData.phone" placeholder="Vendor Phone" class="input-field w-full">
                  <select [(ngModel)]="newVendorData.city" class="input-field w-full">
                    <option value="Casablanca">Casablanca</option>
                    <option value="Rabat">Rabat</option>
                    <option value="Marrakech">Marrakech</option>
                  </select>
                </div>
              } @else {
                <select [ngModel]="selectedVendorId()" (ngModelChange)="selectedVendorId.set($event)" class="input-field w-full">
                  @for (vendor of vendors(); track vendor.id) {
                    <option [value]="vendor.id">{{vendor.name}}</option>
                  }
                </select>
              }
            </div>

            <!-- Order Lines Section -->
            <div class="space-y-2 border-t border-line-soft pt-3">
              <span class="eyebrow block">Order Line Items</span>
              
              <div class="space-y-3">
                @for (line of poLines(); track $index; let i = $index) {
                  <div class="card hover:bg-subtle p-3.5 space-y-2.5 relative transition-all">
                    <!-- Line Header -->
                    <div class="flex justify-between items-center">
                      <span class="eyebrow">Line #{{ i + 1 }}</span>
                      @if (poLines().length > 1) {
                        <button type="button" (click)="removePoLine(i)" class="text-ink-2 hover:text-ink hover:bg-muted p-1.5 rounded-lg transition-colors flex items-center justify-center" title="Remove Line">
                          <mat-icon class="icon-sm">delete</mat-icon>
                        </button>
                      }
                    </div>

                    <!-- Row Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <!-- Item Name -->
                      <div class="md:col-span-4">
                        <label class="field-label mb-1.5">Item Name</label>
                        <input [(ngModel)]="line.item" type="text" placeholder="e.g. Dell PowerEdge Server" class="input-field w-full">
                      </div>

                      <!-- Description -->
                      <div class="md:col-span-8">
                        <label class="field-label mb-1.5">Description (Optional)</label>
                        <input [(ngModel)]="line.description" type="text" placeholder="e.g. Core i7, 32GB RAM" class="input-field w-full">
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <!-- Quantity -->
                      <div class="md:col-span-3">
                        <label class="field-label mb-1.5">Quantity</label>
                        <input [(ngModel)]="line.qty" type="number" min="1" class="input-field w-full text-center font-semibold">
                      </div>

                      <!-- Unit Price -->
                      <div class="md:col-span-5">
                        <label class="field-label mb-1.5">Unit Price (MAD)</label>
                        <input [(ngModel)]="line.unitPrice" type="number" class="input-field w-full text-right">
                      </div>

                      <!-- Item Type -->
                      <div class="md:col-span-4">
                        <label class="field-label mb-1.5">Item Type</label>
                        <select [(ngModel)]="line.type" class="input-field w-full">
                          <option value="software">Software</option>
                          <option value="hardware">Hardware</option>
                          <option value="service">Service</option>
                        </select>
                      </div>
                    </div>
                  </div>
                }
              </div>

              <button type="button" (click)="addPoLineItem()" class="btn-secondary btn-sm w-full mt-2">
                <mat-icon class="icon-sm">add_circle</mat-icon>
                + Add Item Line
              </button>
            </div>

            <div>
              <label class="field-label mb-1.5">Expected Vendor Delivery Date</label>
              <input [(ngModel)]="newPoDeliveryDate" type="date" class="input-field w-full">
            </div>
          </div>

          <div class="flex justify-between items-center border-t border-line-soft pt-4 shrink-0">
            <div class="text-sm font-semibold text-ink-2">
              PO Total: <span class="text-ink font-semibold ml-1">{{ formatCurrency(getPoTotal()) }}</span>
            </div>
            <div class="flex gap-2">
              <button (click)="poModalOpen.set(false)" class="btn-secondary">Cancel</button>
              <button (click)="saveDraftPO()" class="btn-secondary">Create Draft</button>
              <button (click)="savePurchaseOrder()" class="btn-primary">Send PO via Email</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Set Delivery Date PO Modal -->
    @if (setDeliveryDateModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <h3 class="modal-title">Log Vendor Expected Delivery Date</h3>
          <div>
            <label class="field-label mb-1.5">Expected Delivery Date</label>
            <input [(ngModel)]="loggedDeliveryDate" type="date" class="input-field w-full">
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button (click)="setDeliveryDateModalOpen.set(false)" class="btn-secondary">Cancel</button>
            <button (click)="saveDeliveryDate()" class="btn-primary">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- Quick Add Activity Modal -->
    @if (addActivityModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <h3 class="modal-title capitalize">Log New {{ addActivityModalOpen()?.type === 'followups' ? 'Follow-up' : addActivityModalOpen()?.type }}</h3>
          
          <!-- Calls Fields -->
          @if (addActivityModalOpen()?.type === 'calls') {
            <div class="space-y-3">
              <div>
                <label class="field-label mb-1.5">Date</label>
                <input [(ngModel)]="newActivityInput.calls.date" type="date" class="input-field w-full">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="field-label mb-1.5">Duration (mins)</label>
                  <input [(ngModel)]="newActivityInput.calls.duration" type="number" class="input-field w-full">
                </div>
                <div>
                  <label class="field-label mb-1.5">Caller Name</label>
                  <input [(ngModel)]="newActivityInput.calls.callerName" type="text" class="input-field w-full">
                </div>
              </div>
              <div>
                <label class="field-label mb-1.5">Outcome</label>
                <select [(ngModel)]="newActivityInput.calls.outcome" class="input-field w-full">
                  <option value="Interested">Interested</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label class="field-label mb-1.5">Summary / Log</label>
                <textarea [(ngModel)]="newActivityInput.calls.summary" rows="3" placeholder="Describe the discussion..." class="input-field w-full"></textarea>
              </div>
            </div>
          }

          <!-- Emails Fields -->
          @if (addActivityModalOpen()?.type === 'emails') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="field-label mb-1.5">Date</label>
                  <input [(ngModel)]="newActivityInput.emails.date" type="date" class="input-field w-full">
                </div>
                <div>
                  <label class="field-label mb-1.5">Direction</label>
                  <select [(ngModel)]="newActivityInput.emails.direction" class="input-field w-full">
                    <option value="sent">Sent to Client</option>
                    <option value="received">Received from Client</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="field-label mb-1.5">From</label>
                  <input [(ngModel)]="newActivityInput.emails.from" type="email" class="input-field w-full">
                </div>
                <div>
                  <label class="field-label mb-1.5">To</label>
                  <input [(ngModel)]="newActivityInput.emails.to" type="email" class="input-field w-full">
                </div>
              </div>
              <div>
                <label class="field-label mb-1.5">Subject</label>
                <input [(ngModel)]="newActivityInput.emails.subject" type="text" placeholder="Subject..." class="input-field w-full font-semibold">
              </div>
              <div>
                <label class="field-label mb-1.5">Email Body</label>
                <textarea [(ngModel)]="newActivityInput.emails.body" rows="4" placeholder="Body copy..." class="input-field w-full"></textarea>
              </div>
            </div>
          }

          <!-- Meetings Fields -->
          @if (addActivityModalOpen()?.type === 'meetings') {
            <div class="space-y-3 overflow-y-auto max-h-[50vh]">
              <div>
                <label class="field-label mb-1.5">Meeting Title</label>
                <input [(ngModel)]="newActivityInput.meetings.title" type="text" placeholder="e.g. Technical Kickoff" class="input-field w-full font-semibold">
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="col-span-2">
                  <label class="field-label mb-1.5">Date</label>
                  <input [(ngModel)]="newActivityInput.meetings.date" type="date" class="input-field w-full">
                </div>
                <div>
                  <label class="field-label mb-1.5">Time</label>
                  <input [(ngModel)]="newActivityInput.meetings.time" type="text" placeholder="10:00" class="input-field w-full">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="field-label mb-1.5">Type</label>
                  <select [(ngModel)]="newActivityInput.meetings.type" class="input-field w-full">
                    <option value="teams">Teams Meeting</option>
                    <option value="demo">Product Demo</option>
                    <option value="in-person">In-person Meeting</option>
                  </select>
                </div>
                <div>
                  <label class="field-label mb-1.5">Location</label>
                  <input [(ngModel)]="newActivityInput.meetings.location" type="text" class="input-field w-full">
                </div>
              </div>
              <div>
                <label class="field-label mb-1.5">Attendees (Comma Separated)</label>
                <input [(ngModel)]="newActivityInput.meetings.attendees" type="text" placeholder="Youssef, Karim Atlas" class="input-field w-full">
              </div>
              <div>
                <label class="field-label mb-1.5">Minutes / Summary</label>
                <textarea [(ngModel)]="newActivityInput.meetings.summary" rows="3" placeholder="Key outcomes..." class="input-field w-full"></textarea>
              </div>
            </div>
          }

          <!-- Recordings Fields -->
          @if (addActivityModalOpen()?.type === 'recordings') {
            <div class="space-y-3">
              <div>
                <label class="field-label mb-1.5">Date</label>
                <input [(ngModel)]="newActivityInput.recordings.date" type="date" class="input-field w-full">
              </div>
              <div>
                <label class="field-label mb-1.5">Title</label>
                <input [(ngModel)]="newActivityInput.recordings.title" type="text" placeholder="e.g. Scoping Call Recording" class="input-field w-full font-semibold">
              </div>
              <div>
                <label class="field-label mb-1.5">Duration (e.g. '45 mins')</label>
                <input [(ngModel)]="newActivityInput.recordings.duration" type="text" placeholder="45 mins" class="input-field w-full">
              </div>
              <div>
                <label class="field-label mb-1.5">Teams Meeting Link</label>
                <input [(ngModel)]="newActivityInput.recordings.meetingLink" type="text" class="input-field w-full">
              </div>
              <div>
                <label class="field-label mb-1.5">Recording Share Link</label>
                <input [(ngModel)]="newActivityInput.recordings.recordingLink" type="text" class="input-field w-full">
              </div>
            </div>
          }

          <!-- Notes Fields -->
          @if (addActivityModalOpen()?.type === 'notes') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="field-label mb-1.5">Date</label>
                  <input [(ngModel)]="newActivityInput.notes.date" type="date" class="input-field w-full">
                </div>
                <div>
                  <label class="field-label mb-1.5">Author</label>
                  <input [(ngModel)]="newActivityInput.notes.author" type="text" class="input-field w-full">
                </div>
              </div>
              <div>
                <label class="field-label mb-1.5">Note Content</label>
                <textarea [(ngModel)]="newActivityInput.notes.content" rows="4" placeholder="Write internal notes..." class="input-field w-full"></textarea>
              </div>
            </div>
          }

          <!-- Follow-ups Fields -->
          @if (addActivityModalOpen()?.type === 'followups') {
            <div class="space-y-3">
              <div>
                <label class="field-label mb-1.5">Due Date</label>
                <input [(ngModel)]="newActivityInput.followups.dueDate" type="date" class="input-field w-full">
              </div>
              <div>
                <label class="field-label mb-1.5">Reminder Title</label>
                <input [(ngModel)]="newActivityInput.followups.title" type="text" placeholder="e.g. Call client for feedback" class="input-field w-full font-semibold">
              </div>
              <div>
                <label class="field-label mb-1.5">Assigned Owner</label>
                <select [(ngModel)]="newActivityInput.followups.assignedTo" class="input-field w-full">
                  @for (user of users(); track user.name) {
                    <option [value]="user.name">{{ user.name }} ({{ user.team }})</option>
                  }
                </select>
              </div>
            </div>
          }

          <div class="flex justify-end gap-2 pt-4 border-t border-line-soft shrink-0">
            <button type="button" (click)="addActivityModalOpen.set(null)" class="btn-secondary">Cancel</button>
            <button type="button" (click)="saveActivityEntry()" class="btn-primary">Save Entry</button>
          </div>
        </div>
      </div>
    }

    <!-- Confirm Proposal Modal -->
    @if (showConfirmProposalModal()) {
      <div class="modal-backdrop">
        <div class="modal modal-md">
          <div class="flex justify-between items-center pb-2 border-b border-line-soft">
            <h3 class="modal-title">Confirm Proposal #{{ (proposalToConfirm()?.id ?? '').slice(0, 8) }}</h3>
            <button (click)="showConfirmProposalModal.set(false)" title="Close" class="btn-icon btn-sm">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="space-y-4">
            <!-- Method Selector -->
            <div>
              <label class="field-label mb-1.5">Confirmation Channel</label>
              <div class="grid grid-cols-3 gap-2">
                <button type="button" (click)="confirmMethod.set('Email')"
                  [class]="confirmMethod() === 'Email' 
                    ? 'flex flex-col items-center justify-center py-2 px-3 border-2 border-ink bg-accent-soft/40 text-ink rounded-xl gap-1 font-semibold transition-all text-xs' 
                    : 'flex flex-col items-center justify-center py-2 px-3 border border-line rounded-xl hover:border-line-strong hover:bg-subtle hover:text-accent-ink transition-all gap-1 text-ink-3 text-xs'">
                  <mat-icon class="icon-md">email</mat-icon>
                  <span>Email</span>
                </button>
                <button type="button" (click)="confirmMethod.set('WhatsApp')"
                  [class]="confirmMethod() === 'WhatsApp' 
                    ? 'flex flex-col items-center justify-center py-2 px-3 border-2 border-ink bg-success-soft/40 text-ink rounded-xl gap-1 font-semibold transition-all text-xs' 
                    : 'flex flex-col items-center justify-center py-2 px-3 border border-line rounded-xl hover:border-line-strong hover:bg-subtle hover:text-success-ink transition-all gap-1 text-ink-3 text-xs'">
                  <mat-icon class="icon-md">chat</mat-icon>
                  <span>WhatsApp</span>
                </button>
                <button type="button" (click)="confirmMethod.set('Call')"
                  [class]="confirmMethod() === 'Call' 
                    ? 'flex flex-col items-center justify-center py-2 px-3 border-2 border-ink bg-warning-soft/40 text-ink rounded-xl gap-1 font-semibold transition-all text-xs' 
                    : 'flex flex-col items-center justify-center py-2 px-3 border border-line rounded-xl hover:border-line-strong hover:bg-subtle hover:text-warning-ink transition-all gap-1 text-ink-3 text-xs'">
                  <mat-icon class="icon-md">phone</mat-icon>
                  <span>Call Log</span>
                </button>
              </div>
            </div>

            <!-- Upload fields or Notes -->
            @if (confirmMethod() === 'Email' || confirmMethod() === 'WhatsApp') {
              <div class="space-y-3">
                <label class="field-label">
                  Attach {{ confirmMethod() }} Confirmation Screenshot / PDF
                </label>
                
                <div class="card p-4 flex flex-col items-center justify-center hover:bg-subtle transition-all relative">
                  <input type="file" (change)="onConfirmFileSelected($event)" accept="image/*,application/pdf"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                  <mat-icon class="text-ink-4 mb-1 icon-xl">cloud_upload</mat-icon>
                  <span class="text-xs text-ink-3 font-semibold">Click or drag image screenshot / document here</span>
                  <span class="text-meta text-ink-3 mt-0.5">Supports PNG, JPG, PDF</span>
                </div>

                @if (confirmAttachmentName()) {
                  <div class="flex items-center gap-2 bg-muted border border-line rounded-xl p-2.5 text-xs text-ink">
                    <mat-icon class="text-ink icon-sm">task_alt</mat-icon>
                    <span class="font-semibold truncate flex-1">{{ confirmAttachmentName() }}</span>
                    <button type="button" (click)="confirmAttachmentName.set(''); confirmAttachmentData.set('');" 
                      class="text-ink hover:text-ink p-0.5 rounded-full transition-colors">
                      <mat-icon class="icon-sm">close</mat-icon>
                    </button>
                  </div>
                }

                <div class="space-y-2">
                  <label class="field-label">Note</label>
                  <textarea [(ngModel)]="confirmNote" name="confirmNote" rows="3"
                    placeholder="Add a note about this confirmation..."
                    class="input-field w-full"></textarea>
                </div>
              </div>
            } @else {
              <div class="space-y-2">
                <label class="field-label">
                  Call Summary &amp; Notes
                </label>
                <textarea [(ngModel)]="confirmNote" name="confirmNote" rows="4" 
                  placeholder="Summary of conversation, agreed pricing details, customer approval details..."
                  class="input-field w-full"></textarea>
              </div>
            }

            <div class="flex justify-end gap-2 pt-4 border-t border-line-soft">
              <button type="button" (click)="showConfirmProposalModal.set(false)" class="btn-secondary">Cancel</button>
              <button type="button" (click)="submitConfirmProposal()"
                [disabled]="(confirmMethod() !== 'Call' && !confirmAttachmentName()) || (confirmMethod() === 'Call' && !confirmNote().trim())"
                class="btn-primary">
                <mat-icon class="w-[18.5px] h-[18.5px] icon-md">task_alt</mat-icon>
                Confirm Proposal
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Convert Proposal to Deal & Customer Modal -->
    @if (showConvertProposalModal()) {
      <div class="modal-backdrop">
        <div class="modal modal-md">
          <div class="flex justify-between items-center pb-2 border-b border-line-soft">
            <h3 class="modal-title">Convert Prospect to Customer</h3>
            <button (click)="showConvertProposalModal.set(false)" class="btn-icon btn-sm">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          
          <form (ngSubmit)="submitConvertProposal()" class="space-y-4">
            <div>
              <label class="field-label mb-1.5">Company / Contact Name</label>
              <input [(ngModel)]="newPartner.name" name="name" type="text" placeholder="e.g. Casablanca Technologies" required class="input-field w-full">
            </div>

            <div>
              <label class="field-label mb-1.5">Email</label>
              <input [(ngModel)]="newPartner.email" name="email" type="email" placeholder="e.g. contact@domain.ma" class="input-field w-full">
            </div>

            <div>
              <label class="field-label mb-1.5">Phone</label>
              <input [(ngModel)]="newPartner.phone" name="phone" type="text" placeholder="e.g. +212-522-XXXXXX" class="input-field w-full">
            </div>

            <div>
              <label class="field-label mb-1.5">City</label>
              <select [(ngModel)]="newPartner.city" name="city" class="input-field w-full">
                <option value="Casablanca">Casablanca</option>
                <option value="Rabat">Rabat</option>
                <option value="Marrakech">Marrakech</option>
                <option value="Tangier">Tangier</option>
                <option value="Fès">Fès</option>
              </select>
            </div>

            <div>
              <label class="field-label mb-1.5">ICE (15 digits) *</label>
              <input [(ngModel)]="newPartner.ICE" name="ICE" type="text" maxlength="15" placeholder="e.g. 123456789012345" required class="input-field w-full">
            </div>
            <div>
              <label class="field-label mb-1.5">Identifiant Fiscal (IF) *</label>
              <input [(ngModel)]="newPartner.IF" name="IF" type="text" placeholder="e.g. 123456" required class="input-field w-full">
            </div>
            <div>
              <label class="field-label mb-1.5">Registre de Commerce (RC) *</label>
              <input [(ngModel)]="newPartner.RC" name="RC" type="text" placeholder="e.g. 123456" required class="input-field w-full">
            </div>

            <div>
              <label class="field-label mb-1.5">Comments / Notes</label>
              <textarea [(ngModel)]="newPartner.comments" name="comments" rows="3" placeholder="Additional details..." class="input-field w-full"></textarea>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-line-soft">
              <button type="button" (click)="showConvertProposalModal.set(false)" class="btn-secondary">Cancel</button>
              <button type="submit" class="btn-primary">Convert to Customer &amp; Deal</button>
            </div>
          </form>
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

          <div class="bg-muted border border-line rounded-xl p-3">
            <span class="eyebrow block mb-0.5">Related to</span>
            <span class="text-sm font-semibold text-ink">{{ ctx.entityTitle }}</span>
          </div>

          <div class="space-y-4">
            <div>
              <label class="field-label mb-1.5">Task Title</label>
              <input [(ngModel)]="assignTaskData.title" type="text" placeholder="e.g. Follow up with client" class="input-field w-full">
            </div>

            <div>
              <label class="field-label mb-1.5">Description (optional)</label>
              <textarea [(ngModel)]="assignTaskData.description" rows="3" placeholder="Describe the task..." class="input-field w-full"></textarea>
            </div>

            <div>
              <label class="field-label mb-1.5">Assigned Team</label>
              <select [(ngModel)]="assignTaskData.assignedTeamId" class="input-field w-full">
                <option value="">Unassigned</option>
                @for (team of state.teams(); track team.id) {
                  <option [value]="team.id">{{ team.name }}</option>
                }
              </select>
            </div>

            <div>
              <span class="eyebrow block mb-1">Assigned Person</span>
              <app-user-picker [(value)]="assignTaskData.assignedToUserId" placeholder="-- Select --" />
            </div>
          </div>

          <div class="flex justify-between gap-2 pt-2 border-t border-line-soft">
            <button (click)="assignTaskModalOpen.set(null)" class="btn-secondary">Cancel</button>
            <button (click)="saveAssignTask()"
              [disabled]="!assignTaskData.title.trim() || !assignTaskData.assignedToUserId"
              class="btn-primary">
              <mat-icon class="icon-sm">assignment</mat-icon>
              Create &amp; Assign Task
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Slide-Over Drawer for Proposal Details -->
    @if (selectedProposal(); as prop) {
      <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="proposal-drawer-title" role="dialog" aria-modal="true">
        <div (click)="closeProposalDrawer()" role="presentation" class="absolute inset-0 overflow-hidden bg-transparent"></div>
        <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-2xl bg-surface shadow-2xl flex flex-col h-full duration-300">
            <div class="px-6 py-5 bg-subtle border-b border-line flex justify-between items-center shrink-0">
              <div>
                <h2 class="section-title" id="proposal-drawer-title">{{prop.title}}</h2>
                <p class="text-xs text-ink-3 mt-0.5">Prospect: {{getPartnerName(prop.partnerId)}} · #{{ prop.id.slice(0, 8) }}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="badge"
                  [class]="prop.status === 'Confirmed' ? 'badge-success' : (prop.status === 'Sent' ? 'badge-info' : 'bg-muted text-ink')">
                  {{prop.status}}
                </span>
                <button (click)="closeProposalDrawer()" class="btn-icon btn-sm">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <div class="bg-subtle rounded-xl p-4 border border-line-soft space-y-3">
                <span class="eyebrow block">Lines & Pricing</span>
                @for (line of prop.lines; track $index) {
                  <div class="flex justify-between text-xs text-ink-2">
                    <span>{{line.qty}}x {{line.product}}</span>
                    <span class="">{{formatCurrency(line.total)}}</span>
                  </div>
                }
                <div class="flex justify-between border-t border-line pt-1.5 text-xs font-semibold text-ink">
                  <span>Total Amount</span>
                  <span>{{formatCurrency(prop.amount)}}</span>
                </div>
              </div>

              <div class="border-t border-line-soft pt-3">
                <span class="eyebrow block mb-2">Sales Intelligence</span>
                <div class="card grid grid-cols-2 gap-3 p-3 text-xs">
                  <div>
                    <span class="text-ink-3 block text-meta font-medium">Opportunity Value</span>
                    <span class="font-semibold text-ink">{{ formatCurrency(prop.opportunityValue || 0) }}</span>
                  </div>
                  <div>
                    <span class="text-ink-3 block text-meta font-medium">Probability</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <div class="w-full bg-muted-strong rounded-full h-1.5 max-w-[60px]">
                        <div class="bg-primary h-1.5 rounded-full" [style.width.%]="prop.closingProbability || 0"></div>
                      </div>
                      <span class="font-semibold text-ink">{{ prop.closingProbability || 0 }}%</span>
                    </div>
                  </div>
                  <div>
                    <span class="text-ink-3 block text-meta font-medium">Expected Close</span>
                    <span class="font-semibold text-ink-2">{{ prop.expectedClosingDate || 'TBD' }}</span>
                  </div>
                  <div>
                    <span class="text-ink-3 block text-meta font-medium">Stage</span>
                    <span class="badge mt-0.5" [class]="getStageBadgeClass(prop.stage)">
                      {{ prop.stage || 'New Lead' }}
                    </span>
                  </div>
                  @if (prop.competitors && prop.competitors.length > 0) {
                    <div class="col-span-2">
                      <span class="text-ink-3 block text-meta font-medium">Competitors</span>
                      <div class="flex flex-wrap gap-1 mt-1">
                        @for (comp of prop.competitors; track comp) {
                          <span class="badge badge-neutral">{{comp}}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              @if (prop.status === 'Confirmed' && prop.confirmationMethod) {
                <div class="border-t border-line-soft pt-3">
                  <span class="eyebrow block mb-1.5">Confirmation Proof</span>
                  <div class="bg-muted border border-line rounded-xl p-3 text-xs text-ink space-y-2">
                    <div class="flex items-center gap-1.5 font-semibold text-ink text-meta">
                      @if (prop.confirmationMethod === 'Email') {
                        <mat-icon class="icon-sm">email</mat-icon>
                        <span>Email confirmation</span>
                      } @else if (prop.confirmationMethod === 'WhatsApp') {
                        <mat-icon class="icon-sm">chat</mat-icon>
                        <span>WhatsApp screenshot</span>
                      } @else {
                        <mat-icon class="icon-sm">phone</mat-icon>
                        <span>Call Summary</span>
                      }
                      @if (prop.confirmedAt) {
                        <span class="text-meta text-ink font-normal ml-auto">{{ prop.confirmedAt }}</span>
                      }
                    </div>
                    @if (prop.confirmationAttachmentName) {
                      <div class="flex items-center gap-1.5 bg-surface border border-line-strong p-2 rounded-lg text-ink text-meta truncate">
                        <mat-icon class="text-ink icon-xs">attach_file</mat-icon>
                        <span class="truncate flex-1">{{ prop.confirmationAttachmentName }}</span>
                        @if (prop.confirmationAttachmentData) {
                          <a [href]="prop.confirmationAttachmentData" [download]="prop.confirmationAttachmentName"
                             class="text-accent-ink hover:underline font-semibold ml-1 shrink-0">Download</a>
                        }
                      </div>
                    }
                    @if (prop.confirmationNote) {
                      <p class="text-meta text-ink-2 leading-relaxed bg-surface border border-success-line p-2 rounded-lg italic">
                        "{{ prop.confirmationNote }}"
                      </p>
                    }
                  </div>
                </div>
              }

              <div class="border-t border-line-soft pt-3">
                <app-attachments ownerEntityType="PROPOSAL" [ownerEntityId]="prop.id" [canWrite]="canWriteProposal()" />
              </div>

              <div class="border-t border-line-soft pt-3 text-xs text-ink-3 space-y-1">
                <app-created-by-badge [createdBy]="prop.createdBy" [createdAt]="prop.createdAt" />
              </div>
            </div>

            <div class="px-6 py-4 bg-subtle border-t border-line flex justify-between items-center shrink-0">
              <span class="text-xs text-ink-3">{{ prop.lines.length }} line item(s)</span>
              <div class="flex gap-2">
                <button (click)="openEditProposalModal(prop); closeProposalDrawer()" class="btn-secondary btn-sm">
                  <mat-icon class="icon-sm">edit</mat-icon> Edit
                </button>
                @if (canDeleteProposal()) {
                  <button (click)="openProposalDeleteModal(prop)" class="btn-secondary btn-sm">
                    <mat-icon class="icon-sm">delete</mat-icon> Delete
                  </button>
                }
                @if (prop.status === 'Draft') {
                  <button (click)="openSendProposalModal(prop); closeProposalDrawer()" class="btn-primary btn-sm">
                    Send to Prospect
                  </button>
                } @else if (prop.status === 'Sent') {
                  <button (click)="openConfirmProposalModal(prop); closeProposalDrawer()" class="btn-primary btn-sm">
                    <mat-icon class="icon-sm">task_alt</mat-icon> Confirm
                  </button>
                } @else {
                  <button (click)="openConvertProposalModal(prop); closeProposalDrawer()" class="btn-primary btn-sm">
                    <mat-icon class="icon-sm">swap_horiz</mat-icon> Convert to Deal
                  </button>
                }
                <button (click)="closeProposalDrawer()" class="btn-secondary btn-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Slide-Over Drawer for PO Details -->
    @if (selectedPO(); as po) {
      <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="po-drawer-title" role="dialog" aria-modal="true">
        <div (click)="closePODrawer()" role="presentation" class="absolute inset-0 overflow-hidden bg-transparent"></div>
        <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-2xl bg-surface shadow-2xl flex flex-col h-full duration-300">
            <div class="px-6 py-5 bg-subtle border-b border-line flex justify-between items-center shrink-0">
              <div>
                <h2 class="section-title" id="po-drawer-title">PO #{{ po.id.slice(0, 8) }}</h2>
                <p class="text-xs text-ink-3 mt-0.5">Vendor: {{getPartnerName(po.vendorId)}} · Deal: {{getDealTitle(po.dealId)}}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="badge"
                  [class]="po.status === 'Delivered' ? 'badge-success' : (po.status === 'Sent' ? 'badge-info' : 'bg-muted text-ink')">
                  {{po.status}}
                </span>
                <button (click)="closePODrawer()" class="btn-icon btn-sm">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-subtle p-4 rounded-xl border border-line-soft text-xs">
                <div>
                  <span class="eyebrow block mb-1">PO Reference</span>
                  <span class="text-ink font-semibold text-sm">#{{ po.id.slice(0, 8) }}</span>
                </div>
                <div>
                  <span class="eyebrow block mb-1">Delivery Date</span>
                  <span class="text-ink">{{po.deliveryDate || 'Pending Conf.'}}</span>
                </div>
                <div>
                  <span class="eyebrow block mb-1">Sent Via</span>
                  <span class="text-ink">{{po.sentVia || 'N/A'}}</span>
                </div>
                <div>
                  <span class="eyebrow block mb-1">Total Amount</span>
                  <span class="text-ink font-semibold">{{formatCurrency(po.amount)}}</span>
                </div>
              </div>

              <div>
                <span class="eyebrow block mb-2">Order Lines</span>
                <div class="border border-line rounded-xl overflow-x-auto">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Unit Cost</th>
                        <th class="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of po.lines; track $index) {
                        <tr>
                          <td class="text-ink">{{line.product}}{{line.description ? ' - ' + line.description : ''}}</td>
                          <td class="text-ink-2 text-right">{{line.qty}}</td>
                          <td class="text-ink-2 text-right">{{formatCurrency(line.cost)}}</td>
                          <td class="text-ink text-right">{{formatCurrency(line.qty * line.cost)}}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="border-t border-line-soft pt-3 text-xs text-ink-3 space-y-1">
                <app-created-by-badge [createdBy]="po.createdBy" [createdAt]="po.createdAt" />
              </div>
            </div>

            <div class="px-6 py-4 bg-subtle border-t border-line flex justify-between items-center shrink-0">
              <span class="text-xs text-ink-3">{{ po.lines.length }} item(s)</span>
              <div class="flex gap-2">
                @if (canCreateTask()) {
                  <button (click)="openAssignTaskModal('po', po.id, 'PO #' + po.id); closePODrawer()" class="btn-secondary btn-sm">
                    <mat-icon class="icon-sm">assignment</mat-icon> Assign Task
                  </button>
                }
                @if (po.status === 'Sent' && canWritePO()) {
                  <button (click)="openSetDeliveryDatePOModal(po); closePODrawer()" class="btn-secondary btn-sm">Set Del. Date</button>
                  <button (click)="purchaseOrdersService.updateStatus(po.id, 'Delivered'); closePODrawer()" class="btn-primary btn-sm">Receive Goods</button>
                }
                @if (currentUserPermissions().canDeleteRecords) {
                  <button (click)="deletePurchaseOrder(po)" title="Delete purchase order" class="btn-icon btn-sm btn-danger-hover">
  <mat-icon class="icon-sm">delete</mat-icon>
</button>
                }
                <button (click)="closePODrawer()" class="btn-secondary btn-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Slide-Over Drawer for Deal Details -->
    @if (selectedDeal(); as deal) {
      <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="deal-drawer-title" role="dialog" aria-modal="true">
        <!-- Backdrop -->
        <div (click)="closeDealDrawer()" role="presentation" class="absolute inset-0 overflow-hidden bg-transparent"></div>
        
        <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-3xl bg-surface shadow-2xl flex flex-col h-full duration-300">
            <!-- Header -->
            <div class="px-6 py-5 bg-subtle border-b border-line flex justify-between items-center shrink-0">
              <div>
                <h2 class="section-title" id="deal-drawer-title">{{deal.title}}</h2>
                <p class="text-xs text-ink-3 mt-0.5">Client: {{getPartnerName(deal.partnerId)}}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="badge badge-neutral">
                  {{deal.stage}}
                </span>
                <a [routerLink]="['/sales/deals', deal.id]" (click)="closeDealDrawer()" class="text-ink hover:text-ink text-xs font-semibold flex items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <mat-icon class="icon-sm">open_in_new</mat-icon> Open page
                </a>
                <button (click)="closeDealDrawer()" class="btn-icon btn-sm">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <!-- General Info & Amounts -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pb-4 border-b border-line-soft">
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
                  <div class="text-xs text-ink-2 mt-1">
                    #{{deal.proposalId || 'N/A'}} - {{ getProposalTitle(deal.proposalId) }}
                  </div>
                </div>
              </div>

              <!-- Identification & Dates -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-subtle p-4 rounded-xl border border-line-soft text-xs">
                <div class="space-y-2">
                  <span class="eyebrow block border-b border-line pb-1.5">1. Identification & Dates</span>
                  <div class="grid grid-cols-2 gap-y-1.5 text-ink-2">
                    <span class="font-medium">Order Number:</span> <span class="text-ink font-semibold">{{ deal.orderNumber || 'N/A' }}</span>
                    <span class="font-medium">Deal Number:</span> <span class="text-ink font-semibold">{{ deal.dealNumber || 'N/A' }}</span>
                    <span class="font-medium">Order Date:</span> <span class="text-ink">{{ deal.orderDate || 'N/A' }}</span>
                    <span class="font-medium">Req. Delivery:</span> <span class="text-ink">{{ deal.requestedDeliveryDate || 'N/A' }}</span>
                    <span class="font-medium">Order Status:</span> 
                    <span>
                      <span class="badge badge-neutral">
                        {{ deal.orderStatus || 'N/A' }}
                      </span>
                    </span>
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
                <div class="bg-subtle rounded-xl p-4 border border-line-soft text-xs space-y-1.5">
                  <div class="text-ink-3 font-semibold flex items-center gap-1 mb-1">
                    <mat-icon class="icon-xs">email</mat-icon> Email Exchange & Confirmation Logs
                  </div>
                  <pre class="whitespace-pre-wrap text-meta text-ink-2 leading-relaxed">{{deal.emailExchange}}</pre>
                </div>
              }

              <!-- Activity Hub -->
              <div class="border-t border-line pt-4">
                <h5 class="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <mat-icon class="text-ink icon-sm">forum</mat-icon> Deal Activity Hub
                </h5>
                
                <!-- Tabs Header -->
                <div class="flex flex-wrap gap-1 border-b border-line mb-4 bg-surface border border-line p-1 rounded-lg">
                  <button type="button" (click)="setDealTab(deal.id, 'calls')"
                    [class]="getDealTab(deal.id) === 'calls' ? 'bg-surface text-ink shadow-xs border-line' : 'text-ink-2 border-transparent hover:text-ink hover:bg-muted'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="icon-xs">call</mat-icon>
                    Calls
                    <span class="bg-muted text-ink px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.calls?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'emails')"
                    [class]="getDealTab(deal.id) === 'emails' ? 'bg-surface text-ink shadow-xs border-line' : 'text-ink-2 border-transparent hover:text-ink hover:bg-muted'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="icon-xs">email</mat-icon>
                    Emails
                    <span class="bg-muted text-ink px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.emails?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'meetings')"
                    [class]="getDealTab(deal.id) === 'meetings' ? 'bg-surface text-ink shadow-xs border-line' : 'text-ink-2 border-transparent hover:text-ink hover:bg-muted'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="icon-xs">groups</mat-icon>
                    Meetings
                    <span class="bg-muted text-ink px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.meetings?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'recordings')"
                    [class]="getDealTab(deal.id) === 'recordings' ? 'bg-surface text-ink shadow-xs border-line' : 'text-ink-2 border-transparent hover:text-ink hover:bg-muted'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="icon-xs">videocam</mat-icon>
                    Recordings
                    <span class="bg-muted text-ink px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.recordings?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'notes')"
                    [class]="getDealTab(deal.id) === 'notes' ? 'bg-surface text-ink shadow-xs border-line' : 'text-ink-2 border-transparent hover:text-ink hover:bg-muted'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="icon-xs">note_alt</mat-icon>
                    Notes
                    <span class="bg-muted text-ink px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.notes?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'followups')"
                    [class]="getDealTab(deal.id) === 'followups' ? 'bg-surface text-ink shadow-xs border-line' : 'text-ink-2 border-transparent hover:text-ink hover:bg-muted'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="icon-xs">notification_important</mat-icon>
                    Follow-ups
                    <span class="bg-muted text-ink px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.followUps?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'calendar')"
                    [class]="getDealTab(deal.id) === 'calendar' ? 'bg-surface text-ink shadow-xs border-line' : 'text-ink-2 border-transparent hover:text-ink hover:bg-muted'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="icon-xs">calendar_month</mat-icon>
                    Calendar
                  </button>
                </div>

                <!-- Active Tab Panel -->
                <div class="card p-4 min-h-[180px]">
                  
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
                              <span [class]="call.outcome === 'Interested' ? 'badge-success' :
                                             call.outcome === 'Follow-up' ? 'badge-warning' :
                                             'bg-muted text-ink-2 border-line'"
                                    class="badge">
                                {{ call.outcome }}
                              </span>
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
                                <div class="text-meta text-ink-3 mt-0.5">
                                  From: {{ email.from }} | To: {{ email.to }}
                                </div>
                              </div>
                              <span class="text-meta text-ink-3">{{ email.date }}</span>
                            </div>
                            <p class="text-meta text-ink-2 leading-relaxed whitespace-pre-wrap">{{ email.body }}</p>
                          </div>
                        }
                        
                        <!-- Legacy emails text snippet fallback -->
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
                                <span [class]="meeting.type === 'teams' ? 'bg-muted text-ink border-line' : 
                                               meeting.type === 'demo' ? 'bg-muted text-ink border-line' : 
                                               'bg-subtle text-ink-2 border-line'"
                                      class="px-1.5 py-0.2 rounded-sm text-meta font-semibold border uppercase">
                                  {{ meeting.type }}
                                </span>
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

                        <!-- Calendar Grid -->
                        <div class="card p-2.5">
                          <div class="grid grid-cols-7 gap-1 text-center font-semibold text-meta text-ink-3 mb-1 border-b border-line-soft pb-1">
                            @for (h of calendarHeaders; track h) {
                              <div>{{ h }}</div>
                            }
                          </div>
                          <div class="grid grid-cols-7 gap-1.5">
                            @for (day of calendarDays; track day) {
                              <button type="button" (click)="selectCalendarDay(deal.id, day)"
                                      [class]="isSelectedCalendarDay(deal.id, day) ? 'bg-primary text-on-primary font-semibold' : 
                                               hasEventsOnDay(deal, day) ? 'bg-muted text-ink font-semibold border-line-strong' : 
                                               'bg-subtle text-ink-2 hover:bg-muted border-line-soft border-line-soft'"
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

                      <!-- Selected Day Details -->
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
                                <div class="text-meta text-ink-3 uppercase tracking-wider mb-1">
                                  Type: {{ m.type }} | Location: {{ m.location }}
                                </div>
                                <p class="text-meta text-ink-2 line-clamp-2 leading-relaxed">{{ m.summary }}</p>
                              </div>
                            } @empty {
                              <div class="text-center py-8 text-ink-3 text-meta bg-surface border border-line-soft rounded-xl">
                                No meetings scheduled on this day.
                              </div>
                            }
                          </div>
                        </div>

                        <div class="badge badge-neutral p-2.5 mt-4 leading-relaxed">
                          💡 <strong>Tip:</strong> Meetings logged in the <strong>Meetings</strong> tab automatically populate this calendar view.
                        </div>
                      </div>
                    </div>
                  }

                </div>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="px-6 py-4 bg-subtle border-t border-line flex justify-between items-center shrink-0">
              <div class="flex items-center gap-2">
                <span class="text-xs text-ink-3">Lines: {{ deal.orderLines?.length || 0 }} items</span>
              </div>
              <div class="flex gap-2">
                <!-- Create PO trigger if none exists for this deal -->
                @if (!hasPOForDeal(deal.id) && canCreatePO()) {
                  <button (click)="openCreatePOModal(deal)" class="btn-secondary btn-sm">
                    <mat-icon class="mr-1 icon-sm">add_shopping_cart</mat-icon> Create PO (Operations)
                  </button>
                }
                @if (canCreateTask()) {
                  <button (click)="openAssignTaskModal('deal', deal.id, deal.title)" class="btn-secondary btn-sm">
                    <mat-icon class="icon-sm">assignment</mat-icon> Assign Task
                  </button>
                }
                @if (deal.stage === 'New' && canWriteDeal()) {
                  <button (click)="dealsService.updateDealStage(deal.id, 'Confirmed')" class="btn-primary btn-sm">
                    <mat-icon class="mr-1 icon-sm">check</mat-icon> Confirm Deal
                  </button>
                }
                <button (click)="closeDealDrawer()" class="btn-secondary btn-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Delete Proposal Confirmation Modal -->
    @if (proposalDeleteModalOpen() && proposalToDelete()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <div class="flex justify-between items-center">
            <h3 class="modal-title">Delete Proposal</h3>
            <button (click)="cancelProposalDelete()" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-ink-2 leading-relaxed">
            Are you sure you want to delete this proposal?
          </p>
          <div class="bg-subtle border border-line rounded-xl px-4 py-3">
            <div class="text-sm font-semibold text-ink">{{ proposalToDelete()?.title }}</div>
            @if (proposalToDelete()?.id) {
              <div class="text-meta text-ink-3 font-mono mt-0.5">#{{ (proposalToDelete()?.id ?? '').slice(0, 8) }}</div>
            }
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
            <button (click)="cancelProposalDelete()" class="btn-secondary">
              Cancel
            </button>
            <button (click)="confirmProposalDelete()" class="btn-danger">
              <mat-icon class="icon-sm">delete</mat-icon>
              Delete
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SalesComponent {
  private notify = inject(ToastService);
  private confirmDialog = inject(ConfirmService);
  dealsService = inject(DealsService);
  proposalsService = inject(ProposalsService);
  purchaseOrdersService = inject(PurchaseOrdersService);
  private partnersService = inject(PartnersService);
  private tasksService = inject(TasksService);
  state = inject(CrmStateService);
  private router = inject(Router);
  translation = inject(TranslationService);
  private api = inject(ApiService);

  downloadProposalPdf(prop: Proposal): void {
    this.api.downloadProposalPdf(prop.id).subscribe({
      next: (blob) => this.api.downloadBlob(blob, `proposition-${prop.id.substring(0, 8)}.pdf`),
      error: () => console.error('Failed to download proposal PDF')
    });
  }

  downloadPOPdf(po: PurchaseOrder): void {
    this.api.downloadPurchaseOrderPdf(po.id).subscribe({
      next: (blob) => this.api.downloadBlob(blob, `bon-commande-${po.orderNumber || po.id.substring(0, 8)}.pdf`),
      error: () => console.error('Failed to download purchase order PDF')
    });
  }

  setActiveTab(tab: 'deals' | 'proposals' | 'pos', labelKey: string): void {
    this.activeTab.set(tab);
    this.breadcrumbLabel.set(this.translation.t(labelKey));
  }

  canCreateDeal(): boolean { return this.state.hasAuthority('DEALS_CREATE'); }
  canWriteDeal(): boolean { return this.state.hasAuthority('DEALS_WRITE'); }
  canCreateProposal(): boolean { return this.state.hasAuthority('PROPOSALS_CREATE'); }
  canWriteProposal(): boolean { return this.state.hasAuthority('PROPOSALS_WRITE'); }
  canDeleteProposal(): boolean { return this.state.hasAuthority('PROPOSALS_DELETE'); }

  // Delete confirmation
  proposalDeleteModalOpen = signal(false);
  proposalToDelete = signal<Proposal | null>(null);

  openProposalDeleteModal(proposal: Proposal) {
    if (!this.canDeleteProposal()) return;
    this.proposalToDelete.set(proposal);
    this.proposalDeleteModalOpen.set(true);
  }

  cancelProposalDelete() {
    this.proposalDeleteModalOpen.set(false);
    this.proposalToDelete.set(null);
  }

  confirmProposalDelete() {
    if (!this.canDeleteProposal()) return;
    const proposal = this.proposalToDelete();
    if (proposal) {
      this.proposalsService.deleteProposal(proposal.id);
    }
    this.proposalDeleteModalOpen.set(false);
    this.proposalToDelete.set(null);
    this.closeProposalDrawer();
  }
  canCreatePO(): boolean { return this.state.hasAuthority('PURCHASE_ORDERS_CREATE'); }
  canWritePO(): boolean { return this.state.hasAuthority('PURCHASE_ORDERS_WRITE'); }
  canCreateTask(): boolean { return this.state.hasAuthority('TASKS_CREATE'); }
  canWriteDealActivity(): boolean { return this.state.hasAuthority('DEAL_ACTIVITIES_WRITE'); }
  canCreateDealActivity(): boolean { return this.state.hasAuthority('DEAL_ACTIVITIES_CREATE'); }

  // UI-only state signals
  breadcrumbLabel = signal('Deals');
  navigateTab = signal<string | null>(null);
  activeTab = signal<'deals' | 'proposals' | 'pos'>('deals');
  dealsView = signal<'table' | 'board'>('table');

  // ── Deal summary (the stat cards describe exactly what the table lists) ──
  private isClosedStage = (stage: string) => stage === 'Closed Won' || stage === 'Closed Lost';
  private openDealsList = computed(() => this.dealsService.allDeals().filter(d => !this.isClosedStage(d.stage)));
  private wonDeals = computed(() => this.dealsService.allDeals().filter(d => d.stage === 'Closed Won'));
  private lostDeals = computed(() => this.dealsService.allDeals().filter(d => d.stage === 'Closed Lost'));
  private sumAmount = (list: { amount: number }[]) => list.reduce((total, d) => total + (d.amount || 0), 0);
  openDealCount = computed(() => this.openDealsList().length);
  openDealValue = computed(() => this.sumAmount(this.openDealsList()));
  wonCount = computed(() => this.wonDeals().length);
  wonValue = computed(() => this.sumAmount(this.wonDeals()));
  lostCount = computed(() => this.lostDeals().length);
  lostValue = computed(() => this.sumAmount(this.lostDeals()));
  averageDeal = computed(() => {
    const all = this.dealsService.allDeals();
    return all.length ? this.sumAmount(all) / all.length : 0;
  });

  // Expose state properties for template and non-domain operations
  users = computed(() => this.state.users());
  currentUserPermissions = computed(() => this.state.currentUserPermissions());
  currentUserId = computed(() => this.state.currentUserId());
  proposalTemplates = computed(() => this.state.proposalTemplates());
  customers = computed(() => this.state.customers());
  vendors = computed(() => this.partnersService.vendors());

  dealsPage = signal(1);
  dealsPageSize = signal(20);
  dealsTotalPages = computed(() => Math.max(1, Math.ceil(this.dealsService.allDeals().length / this.dealsPageSize())));
  paginatedDeals = computed(() => {
    const start = (this.dealsPage() - 1) * this.dealsPageSize();
    return this.dealsService.allDeals().slice(start, start + this.dealsPageSize());
  });

  // Bulk actions state
  selectedDealIds = signal<Set<string>>(new Set());
  dealStageOptions = ['New', 'Proposal sent', 'Confirmed', 'Awaiting Invoicing', 'Invoiced', 'Closed Won', 'Closed Lost'];

  toggleDealSelect(id: string, event: Event) {
    event.stopPropagation();
    this.selectedDealIds.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  isDealSelected(id: string) { return this.selectedDealIds().has(id); }
  allDealsSelected = computed(() => {
    const all = this.paginatedDeals();
    return all.length > 0 && all.every(d => this.selectedDealIds().has(d.id));
  });
  toggleSelectAllDeals(event: Event) {
    event.stopPropagation();
    const all = this.paginatedDeals();
    const allSelected = all.every(d => this.selectedDealIds().has(d.id));
    this.selectedDealIds.set(allSelected ? new Set() : new Set(all.map(d => d.id)));
  }
  clearDealSelection() { this.selectedDealIds.set(new Set()); }
  bulkAssignDealOwner(event: Event) {
    const owner = (event.target as HTMLSelectElement).value;
    if (!owner) return;
    this.selectedDealIds().forEach(id => this.dealsService.patchDeal(id, { salesPersonUserId: owner }));
    (event.target as HTMLSelectElement).value = '';
  }
  bulkChangeDealStage(event: Event) {
    const stage = (event.target as HTMLSelectElement).value as Deal['stage'];
    if (!stage) return;
    this.selectedDealIds().forEach(id => this.dealsService.patchDeal(id, { stage }));
    (event.target as HTMLSelectElement).value = '';
  }
  bulkExportDeals() {
    const ids = this.selectedDealIds();
    const rows = this.dealsService.allDeals().filter(d => ids.has(d.id));
    const header = ['Deal', 'Client', 'Amount', 'Stage', 'Created By'];
    const csvRows = rows.map(d => [d.title, d.partnerId, d.amount, d.stage, d.createdBy || ''].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deals-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  proposalsPage = signal(1);
  proposalsPageSize = signal(10);
  proposalsTotalPages = computed(() => Math.max(1, Math.ceil(this.proposalsService.allProposals().length / this.proposalsPageSize())));
  paginatedProposals = computed(() => {
    const start = (this.proposalsPage() - 1) * this.proposalsPageSize();
    return this.proposalsService.allProposals().slice(start, start + this.proposalsPageSize());
  });

  posPage = signal(1);
  posPageSize = signal(20);
  posTotalPages = computed(() => Math.max(1, Math.ceil(this.purchaseOrdersService.allPurchaseOrders().length / this.posPageSize())));
  paginatedPOs = computed(() => {
    const start = (this.posPage() - 1) * this.posPageSize();
    return this.purchaseOrdersService.allPurchaseOrders().slice(start, start + this.posPageSize());
  });

  activeTabLoading = computed(() => {
    const tab = this.activeTab();
    return tab === 'deals' ? this.dealsService.isLoading$() : tab === 'proposals' ? this.proposalsService.isLoading$() : this.purchaseOrdersService.isLoading$();
  });
  activeTabError = computed(() => {
    const tab = this.activeTab();
    return tab === 'deals' ? this.dealsService.error$() : tab === 'proposals' ? this.proposalsService.error$() : this.purchaseOrdersService.error$();
  });

  constructor() {
    const tab = this.navigateTab();
    if (tab) {
      this.activeTab.set(tab as 'deals' | 'proposals' | 'pos');
      this.navigateTab.set(null);
    }
    const label = this.activeTab() === 'deals' ? 'Deals' : this.activeTab() === 'proposals' ? 'Proposals' : 'Purchase Orders';
    this.breadcrumbLabel.set(label);

    this.dealsService.load();
    this.proposalsService.load();
    this.purchaseOrdersService.load();
    this.partnersService.load();
    this.state.loadProposalTemplates();

    effect(() => {
      const action = this.state.pendingQuickAction();
      if (!action) return;
      if (action.id === 'new-deal') {
        this.openCreateDealModal();
        this.state.pendingQuickAction.set(null);
      } else if (action.id === 'log-call') {
        const mostRecent = [...this.dealsService.allDeals()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
        if (mostRecent) this.openAddActivityModal(mostRecent.id, 'calls');
        this.state.pendingQuickAction.set(null);
      }
    });
  }

  // Convert Proposal to Deal & Customer Modal State
  showConvertProposalModal = signal(false);
  proposalToConvert = signal<Proposal | null>(null);
  newPartner = {
    id: '' as string | undefined,
    name: '',
    type: 'Customer' as const,
    email: '',
    phone: '',
    city: 'Casablanca',
    comments: '',
    ICE: '',
    IF: '',
    RC: '',
    score: undefined as number | undefined,
    source: 'Website form' as const,
    assignedTo: ''
  };

  salesEligiblePartners = computed(() => 
    this.partnersService.allPartners().filter(p => p.type === 'Prospect' || p.type === 'Customer')
  );

  // Modals state
  sendingProposalId = signal<string | null>(null);
  selectedChannels = signal<Set<'email' | 'whatsapp'>>(new Set());
  recipients = signal<{ name: string; email?: string; phone?: string }[]>([]);

  // Confirm Proposal Modal State
  showConfirmProposalModal = signal(false);
  proposalToConfirm = signal<Proposal | null>(null);
  confirmMethod = signal<'Email' | 'WhatsApp' | 'Call'>('Email');
  confirmAttachmentName = signal<string>('');
  confirmAttachmentData = signal<string>('');
  confirmNote = signal<string>('');

  currentProposalPartner = computed(() => {
    const prop = this.proposalsService.allProposals().find(p => p.id === this.sendingProposalId());
    return this.partnersService.allPartners().find(p => p.id === prop?.partnerId) ?? null;
  });

  currentProposalPartnerName = computed(() => {
    return this.currentProposalPartner()?.name ?? 'Unknown Prospect';
  });

  /** Contacts from the same organization as the proposal's partner (via CustomerCard.personnel) */
  proposalOrgContacts = computed(() => {
    const partner = this.currentProposalPartner();
    if (!partner) return [];
    const card = this.partnersService.customerCards().find(c => c.partnerId === partner.id);
    return card ? card.personnel : [];
  });

  /** All other partners of the same type (Prospect) for cross-org additions */
  availableProspects = computed(() => this.partnersService.allPartners().filter(p => p.type === 'Prospect'));
  editingProposalId = signal<string | null>(null);
  proposalModalOpen = signal(false);
  dealModalOpen = signal(false);
  poModalOpen = signal(false);
  setDeliveryDateModalOpen = signal(false);
  leadModalOpen = signal(false);

  // Activity Hub Signals
  activeDealTabs = signal<Record<string, string>>({});
  addActivityModalOpen = signal<{ dealId: string; type: 'calls' | 'emails' | 'meetings' | 'recordings' | 'notes' | 'followups' } | null>(null);
  selectedCalendarDay = signal<Record<string, number>>({});

  calendarDays = Array.from({ length: 30 }, (_, i) => i + 1);
  calendarHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  newActivityInput = {
    calls: { date: '2026-06-27', duration: 15, callerName: 'Youssef El Alami', summary: '', outcome: 'Interested' },
    emails: { date: '2026-06-27', from: 'youssef@acme.ma', to: 'contact@atlasdigital.ma', subject: '', body: '', direction: 'sent' as const },
    meetings: { date: '2026-06-27', time: '10:00', title: '', type: 'teams' as const, attendees: '', location: 'Teams Meeting', summary: '' },
    recordings: { date: '2026-06-27', title: '', meetingLink: 'https://teams.microsoft.com/l/meetup-join/123456', recordingLink: 'https://share.acme.ma/rec/recording-06-27', duration: '30 mins' },
    notes: { date: '2026-06-27', author: 'Youssef El Alami', content: '' },
    followups: { dueDate: '2026-06-27', title: '', assignedTo: 'Omar (Finance)' }
  };

  // Assign Task Modal
  assignTaskModalOpen = signal<{
    entityType: 'deal' | 'proposal' | 'po';
    entityId: string;
    entityTitle: string;
  } | null>(null);
  assignTaskData = {
    title: '',
    description: '',
    assignedTeamId: '',
    assignedToUserId: ''
  };

  // Modal data properties
  newLeadData = {
    name: '',
    email: '',
    phone: '',
    city: 'Casablanca',
    score: 50,
    source: 'Website form',
    assignedTo: ''
  };

  selectedDealForPO = signal<Deal | null>(null);
  showNewVendorForm = signal(false);
  selectedVendorId = signal<string>('');
  newVendorData = { name: '', email: '', phone: '', city: 'Casablanca' };
  poLines = signal<{ item: string; description?: string; qty: number; unitPrice: number; type: 'software' | 'hardware' | 'service' }[]>([{ item: '', qty: 1, unitPrice: 0, type: 'software' }]);
  newPoDeliveryDate = '';

  selectedPOForDelivery = signal<PurchaseOrder | null>(null);
  loggedDeliveryDate = '';

  newProposal = {
    title: '',
    partnerId: '',
    lines: [] as { product: string; description: string; qty: number; unitPrice: number; total: number; vendor: string }[],
    opportunityValue: 0,
    closingProbability: 50,
    expectedClosingDate: '',
    competitors: '',
    stage: 'New Lead' as SalesStage
  };
  selectedTemplateId = '';

  newDeal = {
    title: '',
    partnerId: '',
    amount: 0,
    discount: 0,
    proposalId: '',
    emailExchange: '',
    comments: '',
    lines: [] as { product: string; description: string; qty: number; unitPrice: number; total: number; vendor: string }[],

    // Identification & Dates
    orderNumber: '',
    dealNumber: '',
    orderDate: '',
    requestedDeliveryDate: '',
    orderStatus: 'Draft',

    // Customer & Delivery
    customerAccount: '',
    billingAddress: '',
    deliveryAddress: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',

    // Sales & Ownership
    salesPersonUserId: '',
    salesRegion: '',

    // Commercial Basics
    currency: 'MAD',
    paymentTerms: '',
    orderTotalAmount: 0,

    // Vendor / Partner
    vendorAccount: '',
    purchaseOrderRef: '',
    warehouseAddress: '',
    transportationService: '',
    expectedDeliveryDateVendor: '',
    deliveryDate: ''
  };

  selectedDealForDrawer = signal<Deal | null>(null);
  selectedDeal = computed(() => {
    const id = this.selectedDealForDrawer()?.id;
    if (!id) return null;
    return this.dealsService.allDeals().find(d => d.id === id) || null;
  });

  openDealDrawer(deal: Deal) {
    this.selectedDealForDrawer.set(deal);
  }

  closeDealDrawer() {
    this.selectedDealForDrawer.set(null);
  }

  selectedProposalForDrawer = signal<Proposal | null>(null);
  selectedProposal = computed(() => {
    const id = this.selectedProposalForDrawer()?.id;
    if (!id) return null;
    return this.proposalsService.allProposals().find(p => p.id === id) || null;
  });

  openProposalDrawer(prop: Proposal) {
    this.selectedProposalForDrawer.set(prop);
  }

  closeProposalDrawer() {
    this.selectedProposalForDrawer.set(null);
  }

  selectedPOForDrawer = signal<PurchaseOrder | null>(null);
  selectedPO = computed(() => {
    const id = this.selectedPOForDrawer()?.id;
    if (!id) return null;
    return this.purchaseOrdersService.allPurchaseOrders().find(p => p.id === id) || null;
  });

  openPODrawer(po: PurchaseOrder) {
    this.selectedPOForDrawer.set(po);
  }

  closePODrawer() {
    this.selectedPOForDrawer.set(null);
  }

  async deletePurchaseOrder(po: PurchaseOrder) {
    if (await this.confirmDialog.ask({ title: 'Delete purchase order?', message: `PO #${po.id.slice(0, 8)} will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete PO', danger: true })) {
      this.purchaseOrdersService.deletePurchaseOrder(po.id);
      this.closePODrawer();
    }
  }

  expandedDeals = signal<Record<string, boolean>>({});

  toggleDealDetails(dealId: string) {
    this.expandedDeals.update(val => ({ ...val, [dealId]: !val[dealId] }));
  }

  onPartnerChange() {
    const partner = this.partnersService.allPartners().find(p => p.id === this.newDeal.partnerId);
    if (partner) {
      this.newDeal.customerAccount = 'ACC-' + partner.name.substring(0, 5).toUpperCase().replace(/[^A-Z]/g, '') + '-' + partner.id.toUpperCase();

      const baseCity = partner.city || 'Casablanca';
      this.newDeal.billingAddress = `N° 45 Boulevard de la Résistance, ${baseCity}, Morocco`;
      this.newDeal.deliveryAddress = `Zone Industrielle, ${baseCity}, Morocco`;
      this.newDeal.contactPerson = partner.name.includes(' ') ? partner.name.split(' ')[0] + ' Sefrioui' : 'Karim ' + partner.name;
      this.newDeal.contactEmail = partner.email || 'contact@company.ma';
      this.newDeal.contactPhone = partner.phone || '+212-661-000000';
    }
  }

  onProposalChange() {
    const prop = this.proposalsService.allProposals().find(p => p.id === this.newDeal.proposalId);
    if (prop) {
      this.newDeal.amount = prop.amount;
      this.newDeal.orderTotalAmount = prop.amount;
      this.newDeal.lines = prop.lines.map(l => ({ ...l, vendor: l.vendor || '' }));
      if (prop.partnerId) {
        this.newDeal.partnerId = prop.partnerId;
        this.onPartnerChange();
      }
    } else {
      this.newDeal.lines = [];
    }
  }

  getPartnerName(id: string) {
    return this.partnersService.allPartners().find(p => p.id === id)?.name || 'Unknown';
  }

  getProposalTitle(id?: string) {
    return this.proposalsService.allProposals().find(p => p.id === id)?.title || 'N/A';
  }

  getDealTitle(id?: string) {
    return this.dealsService.allDeals().find(d => d.id === id)?.title || 'N/A';
  }

  /** Whole-number money for KPI cards, where decimals are noise. */
  money0(value: number) {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(value);
  }

  /** Deal stage → badge colour: attention stages warm, outcomes semantic. */
  getDealStageBadge(stage: string): string {
    switch (stage) {
      case 'Closed Won': return 'badge-success';
      case 'Closed Lost': return 'badge-danger';
      case 'Overdue': return 'badge-danger';
      case 'Paid': return 'badge-success';
      case 'Invoiced': return 'badge-info';
      case 'Awaiting Invoicing': case 'Awaiting Delivery': return 'badge-warning';
      case 'PO Sent': return 'badge-violet';
      default: return 'badge-neutral';
    }
  }

  formatCurrency(value: number) {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(value);
  }

  getStatusColor(status: string) {
    switch (status) {
      case 'Completed': return 'badge-success';
      case 'In Progress': return 'badge-info';
      default: return 'bg-muted text-ink border border-line';
    }
  }

  getStageBadgeClass(stage?: string) {
    switch (stage) {
      case 'New Lead':
        return 'bg-muted text-ink-2 border-line';
      case 'Qualified':
        return 'badge-info';
      case 'Meeting Scheduled':
        return 'badge-violet';
      case 'Proposal Sent':
        return 'badge-violet';
      case 'Negotiation':
        return 'badge-warning';
      case 'Won / Lost':
        return 'badge-success';
      default:
        return 'bg-subtle text-ink-2 border-line-soft';
    }
  }

  hasPOForDeal(dealId: string) {
    return this.purchaseOrdersService.allPurchaseOrders().some(po => po.dealId === dealId);
  }

  // Proposal Creation
  openSendProposalModal(prop: Proposal) {
    if (!this.canWriteProposal()) return;
    this.sendingProposalId.set(prop.id);
    this.selectedChannels.set(new Set());
    // Pre-populate primary recipient from the proposal's partner
    const partner = this.partnersService.allPartners().find(p => p.id === prop.partnerId);
    if (partner) {
      this.recipients.set([{ name: partner.name, email: partner.email, phone: partner.phone }]);
    } else {
      this.recipients.set([]);
    }
  }

  toggleChannel(channel: 'email' | 'whatsapp') {
    this.selectedChannels.update(set => {
      const next = new Set(set);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  }

  isChannelSelected(channel: 'email' | 'whatsapp'): boolean {
    return this.selectedChannels().has(channel);
  }

  addContactToRecipients(event: Event) {
    const target = event.target as HTMLSelectElement;
    const personnelId = target.value;
    if (!personnelId) return;

    // First check org contacts (CustomerCard.personnel)
    const orgContacts = this.proposalOrgContacts();
    const personnel = orgContacts.find(p => p.id === personnelId);
    if (personnel) {
      // Avoid duplicates
      const alreadyAdded = this.recipients().some(r => r.name === personnel.fullName);
      if (!alreadyAdded) {
        this.recipients.update(arr => [...arr, {
          name: personnel.fullName,
          email: personnel.directEmail,
          phone: personnel.directMobile
        }]);
      }
    }
    target.value = '';
  }

  updateRecipientEmail(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.recipients.update(arr => {
      const copy = [...arr];
      copy[index] = { ...copy[index], email: input.value };
      return copy;
    });
  }

  updateRecipientPhone(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.recipients.update(arr => {
      const copy = [...arr];
      copy[index] = { ...copy[index], phone: input.value };
      return copy;
    });
  }

  removeRecipient(index: number) {
    this.recipients.update(arr => arr.filter((_, i) => i !== index));
  }

  addManualRecipient() {
    this.recipients.update(arr => [...arr, { name: '', email: '', phone: '' }]);
  }

  submitSendProposal() {
    const propId = this.sendingProposalId();
    if (propId) {
      this.proposalsService.updateStatus(propId, 'Sent');
    }
    this.sendingProposalId.set(null);
  }

  openConfirmProposalModal(prop: Proposal) {
    if (!this.canWriteProposal()) return;
    this.proposalToConfirm.set(prop);
    this.confirmMethod.set('Email');
    this.confirmAttachmentName.set('');
    this.confirmAttachmentData.set('');
    this.confirmNote.set('');
    this.showConfirmProposalModal.set(true);
  }

  onConfirmFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.confirmAttachmentName.set(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        this.confirmAttachmentData.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  submitConfirmProposal() {
    const prop = this.proposalToConfirm();
    if (prop) {
      this.proposalsService.updateProposal(prop.id, {
        status: 'Confirmed',
        confirmationMethod: this.confirmMethod(),
        confirmationAttachmentName: this.confirmAttachmentName(),
        confirmationAttachmentData: this.confirmAttachmentData(),
        confirmationNote: this.confirmNote(),
        confirmedAt: new Date().toISOString().split('T')[0]
      });

      const deal = this.dealsService.allDeals().find(d => d.proposalId === prop.id);
      if (deal) {
        const today = new Date().toISOString().split('T')[0];
        const me = this.users().find(u => u.id === this.state.currentUserId());
        const authorName = me?.displayName || 'System';
        const partner = this.partnersService.allPartners().find(p => p.id === prop.partnerId);
        const method = this.confirmMethod();

        if (method === 'Email') {
          this.dealsService.addEmailLog(deal.id, {
            date: today,
            from: me?.email || 'system@crm.ma',
            to: partner?.email || '',
            subject: `Proposal #${prop.id} Confirmed`,
            body: this.confirmNote() || `Proposal confirmed via Email. Attachment: ${this.confirmAttachmentName()}`,
            direction: 'sent'
          });
        } else if (method === 'WhatsApp') {
          this.dealsService.addNote(deal.id, {
            date: today,
            author: authorName,
            content: this.confirmNote() || `Proposal #${prop.id} confirmed via WhatsApp. Attachment: ${this.confirmAttachmentName()}`
          });
        } else if (method === 'Call') {
          this.dealsService.addCallLog(deal.id, {
            date: today,
            duration: 0,
            callerName: authorName,
            summary: this.confirmNote() || 'Proposal confirmed via call.',
            outcome: 'Confirmed'
          });
        }
      }
    }
    this.showConfirmProposalModal.set(false);
    this.proposalToConfirm.set(null);
  }

  openCreateProposalModal() {
    if (!this.canCreateProposal()) return;
    this.editingProposalId.set(null);
    this.newProposal = {
      title: '',
      partnerId: this.salesEligiblePartners()[0]?.id || '',
      lines: [
        { product: '', description: '', qty: 1, unitPrice: 0, total: 0, vendor: '' }
      ],
      opportunityValue: 0,
      closingProbability: 50,
      expectedClosingDate: new Date().toISOString().split('T')[0],
      competitors: '',
      stage: 'New Lead' as SalesStage
    };
    this.selectedTemplateId = '';
    this.proposalModalOpen.set(true);
  }

  openEditProposalModal(prop: Proposal) {
    if (!this.canWriteProposal()) return;
    this.editingProposalId.set(prop.id);
    this.newProposal = {
      title: prop.title,
      partnerId: prop.partnerId,
      lines: prop.lines.map(l => ({ ...l, vendor: l.vendor || '' })),
      opportunityValue: prop.opportunityValue || 0,
      closingProbability: prop.closingProbability ?? 50,
      expectedClosingDate: prop.expectedClosingDate || '',
      competitors: prop.competitors ? prop.competitors.join(', ') : '',
      stage: prop.stage || 'New Lead'
    };
    this.selectedTemplateId = prop.templateId || '';
    this.proposalModalOpen.set(true);
  }

  applyTemplate() {
    if (this.selectedTemplateId) {
      const template = this.state.proposalTemplates().find(t => t.id === this.selectedTemplateId);
      if (template) {
        this.newProposal.title = template.name;
        this.newProposal.lines = template.lines.map(l => ({ ...l, vendor: l.vendor || '' }));
      }
    }
  }

  addLineItem() {
    this.newProposal.lines.push({ product: '', description: '', qty: 1, unitPrice: 0, total: 0, vendor: '' });
  }

  removeLine(index: number) {
    this.newProposal.lines.splice(index, 1);
  }

  recalcLine(line: { qty: number; unitPrice: number; total?: number }) {
    line.total = line.qty * line.unitPrice;
  }

  getNewProposalTotal() {
    return this.newProposal.lines.reduce((acc, line) => acc + (line.qty * line.unitPrice), 0);
  }

  saveProposal(andAssignTask = false) {
    const propId = this.editingProposalId();
    if (propId ? !this.canWriteProposal() : !this.canCreateProposal()) return;
    const total = this.getNewProposalTotal();
    const competitorsArray = this.newProposal.competitors
      ? this.newProposal.competitors.split(',').map(c => c.trim()).filter(Boolean)
      : [];

    const payload = {
      title: this.newProposal.title || 'Draft Proposal',
      partnerId: this.newProposal.partnerId,
      amount: total,
      templateId: this.selectedTemplateId || undefined,
      lines: this.newProposal.lines,
      opportunityValue: this.newProposal.opportunityValue,
      closingProbability: this.newProposal.closingProbability,
      expectedClosingDate: this.newProposal.expectedClosingDate,
      competitors: competitorsArray,
      stage: this.newProposal.stage
    };

    if (propId) {
      this.proposalsService.updateProposal(propId, payload);
      this.proposalModalOpen.set(false);
      this.editingProposalId.set(null);
      if (andAssignTask) {
        this.openAssignTaskModal('proposal', propId, payload.title);
      }
    } else {
      const newProp = this.proposalsService.addProposal({
        ...payload,
        status: 'Draft'
      });
      this.proposalModalOpen.set(false);
      this.editingProposalId.set(null);
      if (andAssignTask && newProp) {
        this.openAssignTaskModal('proposal', newProp.id, newProp.title);
      }
    }
  }

  // Deal Creation
  openCreateDealModal() {
    if (!this.canCreateDeal()) return;
    // Same source as the modal's <select>: the two partner stores are not guaranteed to be
    // loaded together, and a default the dropdown cannot show leaves partnerId empty.
    const defaultCust = this.customers()[0]?.id || '';
    const today = new Date().toISOString().split('T')[0];
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 30);
    const formattedDeliveryDate = deliveryDate.toISOString().split('T')[0];
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);

    this.newDeal = {
      title: '',
      partnerId: defaultCust,
      amount: 0,
      discount: 0,
      proposalId: '',
      emailExchange: '',
      comments: '',
    lines: [] as { product: string; description: string; qty: number; unitPrice: number; total: number; vendor: string }[],

      orderNumber: 'ORD-2026-' + randomSuffix,
      dealNumber: 'DL-2026-' + randomSuffix,
      orderDate: today,
      requestedDeliveryDate: formattedDeliveryDate,
      orderStatus: 'Draft',

      customerAccount: '',
      billingAddress: '',
      deliveryAddress: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',

      salesPersonUserId: this.state.currentUserId(),
      salesRegion: 'Casablanca-Settat / Maroc',

      currency: 'MAD',
      paymentTerms: '30 Days Net',
      orderTotalAmount: 0,

      vendorAccount: 'VND-CASA-04',
      purchaseOrderRef: 'PO-2026-' + randomSuffix,
      warehouseAddress: 'Zone Industrielle Sapino, Nouaceur, Maroc',
      transportationService: 'Maroc Express Logistics',
      expectedDeliveryDateVendor: formattedDeliveryDate,
      deliveryDate: formattedDeliveryDate
    };

    if (defaultCust) {
      this.onPartnerChange();
    }
    this.dealModalOpen.set(true);
  }

  addDealLineItem() {
    this.newDeal.lines.push({ product: '', description: '', qty: 1, unitPrice: 0, total: 0, vendor: '' });
    this.recalcDealTotal();
  }

  removeDealLine(index: number) {
    this.newDeal.lines.splice(index, 1);
    this.recalcDealTotal();
  }

  recalcDealLine(line: { qty: number; unitPrice: number; total?: number }) {
    line.total = line.qty * line.unitPrice;
    this.recalcDealTotal();
  }

  recalcDealTotal() {
    const total = this.newDeal.lines.reduce((acc, line) => acc + (line.qty * line.unitPrice), 0);
    this.newDeal.amount = total;
    this.newDeal.orderTotalAmount = total;
  }

  // Assign Task Methods
  openAssignTaskModal(entityType: 'deal' | 'proposal' | 'po', entityId: string, entityTitle: string) {
    if (!this.canCreateTask()) return;
    this.assignTaskData = {
      title: '',
      description: '',
      assignedTeamId: '',
      assignedToUserId: ''
    };
    this.assignTaskModalOpen.set({ entityType, entityId, entityTitle });
  }

  saveAssignTask() {
    if (!this.canCreateTask()) return;
    const ctx = this.assignTaskModalOpen();
    if (!ctx || !this.assignTaskData.title.trim() || !this.assignTaskData.assignedToUserId) return;

    const relatedEntityTypeMap: Record<string, Task['relatedEntityType']> = {
      deal: 'DEAL', proposal: 'PROPOSAL', po: 'PURCHASE_ORDER'
    };
    this.tasksService.addTask({
      title: this.assignTaskData.title.trim(),
      description: this.assignTaskData.description.trim() || undefined,
      assignedTeamId: this.assignTaskData.assignedTeamId || undefined,
      assignedToUserId: this.assignTaskData.assignedToUserId,
      assignedByUserId: this.state.currentUserId(),
      status: 'Pending',
      relatedEntityType: relatedEntityTypeMap[ctx.entityType],
      relatedEntityId: ctx.entityId
    });

    this.assignTaskModalOpen.set(null);
  }

  saveDeal(andAssignTask = false) {
    if (!this.canCreateDeal()) return;
    const finalAmount = this.newDeal.amount - (this.newDeal.amount * (this.newDeal.discount / 100));
    const newDeal = this.dealsService.addDeal({
      title: this.newDeal.title || 'New Deal',
      partnerId: this.newDeal.partnerId,
      amount: finalAmount,
      stage: 'New',
      comments: this.newDeal.comments,
      proposalId: this.newDeal.proposalId || undefined,
      discount: this.newDeal.discount || undefined,
      emailExchange: this.newDeal.emailExchange || undefined,
      orderLines: this.newDeal.lines,

      // Identification & Dates
      orderNumber: this.newDeal.orderNumber,
      dealNumber: this.newDeal.dealNumber,
      orderDate: this.newDeal.orderDate,
      requestedDeliveryDate: this.newDeal.requestedDeliveryDate,
      orderStatus: this.newDeal.orderStatus,

      // Customer & Delivery
      customerAccount: this.newDeal.customerAccount,
      billingAddress: this.newDeal.billingAddress,
      deliveryAddress: this.newDeal.deliveryAddress,
      contactPerson: this.newDeal.contactPerson,
      contactEmail: this.newDeal.contactEmail,
      contactPhone: this.newDeal.contactPhone,

      // Sales & Ownership
      salesPersonUserId: this.newDeal.salesPersonUserId || undefined,
      salesRegion: this.newDeal.salesRegion,

      // Commercial Basics
      currency: this.newDeal.currency,
      paymentTerms: this.newDeal.paymentTerms,
      orderTotalAmount: finalAmount,

      // Vendor / Partner
      vendorAccount: this.newDeal.vendorAccount,
      purchaseOrderRef: this.newDeal.purchaseOrderRef,
      warehouseAddress: this.newDeal.warehouseAddress,
      transportationService: this.newDeal.transportationService,
      expectedDeliveryDateVendor: this.newDeal.expectedDeliveryDateVendor,
      deliveryDate: this.newDeal.deliveryDate
    });
    this.dealModalOpen.set(false);
    if (andAssignTask && newDeal) {
      this.openAssignTaskModal('deal', newDeal.id, newDeal.title);
    }
  }

  // Purchase Order Helpers & Mutators
  addPoLineItem() {
    this.poLines.update(lines => [...lines, { item: '', qty: 1, unitPrice: 0, type: 'software' }]);
  }

  removePoLine(index: number) {
    this.poLines.update(lines => lines.filter((_, i) => i !== index));
  }

  getPoTotal(): number {
    return this.poLines().reduce((acc, line) => acc + (line.qty * line.unitPrice), 0);
  }

  // Resolves the vendor id to use for the PO being created, invoking onResolved once known.
  // If a new vendor is being created inline, waits for the server-assigned id (rather than
  // handing back a client-side temp id that the PO's vendorId foreign key can't reference).
  resolvePOVendorId(onResolved: (vendorId: string | null) => void): void {
    const vendorId = this.selectedVendorId();
    if (this.showNewVendorForm()) {
      if (this.newVendorData.name.trim()) {
        this.partnersService.createPartnerAwaitingId({
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
        this.notify.show('Please specify a vendor name.', { type: 'warning' });
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

  openCreatePOModal(deal: Deal) {
    if (!this.canCreatePO()) return;
    this.selectedDealForPO.set(deal);
    this.selectedVendorId.set(this.partnersService.vendors()[0]?.id || '');
    this.showNewVendorForm.set(false);
    
    // Auto-populate poLines with deal lines if available, estimating 70% cost of goods
    if (deal.orderLines && deal.orderLines.length > 0) {
      this.poLines.set(deal.orderLines.map(l => ({
        item: l.product,
        description: l.description || '',
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

      // Add PO
      this.purchaseOrdersService.addPurchaseOrder({
        dealId: deal.id,
        vendorId: vendorId,
        amount: totalAmount,
        status: 'Sent',
        deliveryDate: this.newPoDeliveryDate || undefined,
        sentVia: 'Email via CRM',
        lines: this.poLines().map(line => ({
          product: line.item,
          description: line.description,
          qty: line.qty,
          cost: line.unitPrice,
          type: line.type
        }))
      });

      // Automatically update deal stage to PO Sent
      this.dealsService.updateDealStage(deal.id, 'Confirmed');

      this.clearPoLocalState();
      this.poModalOpen.set(false);
      this.activeTab.set('pos');
    });
  }

  saveDraftPO() {
    if (!this.canCreatePO()) return;
    const deal = this.selectedDealForPO();
    if (!deal) return;

    this.resolvePOVendorId((vendorId) => {
      if (!vendorId) return;

      const totalAmount = this.getPoTotal();

      // Add PO with status Draft
      this.purchaseOrdersService.addPurchaseOrder({
        dealId: deal.id,
        vendorId: vendorId,
        amount: totalAmount,
        status: 'Draft',
        deliveryDate: this.newPoDeliveryDate || undefined,
        lines: this.poLines().map(line => ({
          product: line.item,
          description: line.description,
          qty: line.qty,
          cost: line.unitPrice,
          type: line.type
        }))
      });

      this.clearPoLocalState();
      this.poModalOpen.set(false);
    });
  }

  // PO Delivery Dates
  openSetDeliveryDatePOModal(po: PurchaseOrder) {
    if (!this.canWritePO()) return;
    this.selectedPOForDelivery.set(po);
    this.loggedDeliveryDate = po.deliveryDate || '';
    this.setDeliveryDateModalOpen.set(true);
  }

  saveDeliveryDate() {
    if (!this.canWritePO()) return;
    const po = this.selectedPOForDelivery();
    if (po) {
      this.purchaseOrdersService.updateStatus(po.id, po.status, this.loggedDeliveryDate);
      
      // Update Deal's estimated delivery date
      const deal = this.dealsService.allDeals().find(d => d.id === po.dealId);
      if (deal) {
        // Estimate customer delivery 3 days after vendor delivery
        const parts = this.loggedDeliveryDate.split('-');
        if (parts.length === 3) {
          const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          date.setDate(date.getDate() + 3);
          const customerEst = date.toISOString().substring(0, 10);
          
          this.state.deals.update(deals =>
            deals.map(d => d.id === deal.id ? { ...d, estimatedDeliveryDate: customerEst } : d)
          );
        }
      }
      
      this.setDeliveryDateModalOpen.set(false);
    }
  }

  // Activity Hub Helpers
  getDealTab(dealId: string): string {
    return this.activeDealTabs()[dealId] || 'calls';
  }

  setDealTab(dealId: string, tab: string): void {
    this.activeDealTabs.update(tabs => ({ ...tabs, [dealId]: tab }));
  }

  toggleFollowUpStatus(dealId: string, followUpId: string, currentStatus: string): void {
    if (!this.canWriteDealActivity()) return;
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';
    this.dealsService.updateFollowUpStatus(dealId, followUpId, nextStatus);
  }

  openAddActivityModal(dealId: string, type: 'calls' | 'emails' | 'meetings' | 'recordings' | 'notes' | 'followups') {
    if (!this.canCreateDealActivity()) return;
    this.addActivityModalOpen.set({ dealId, type });
    const me = this.users().find(u => u.team === 'Sales')?.name || 'Youssef El Alami';
    const deal = this.dealsService.allDeals().find(d => d.id === dealId);
    const clientEmail = deal?.contactEmail || 'contact@client.ma';
    
    this.newActivityInput = {
      calls: { date: '2026-06-27', duration: 15, callerName: me, summary: '', outcome: 'Interested' },
      emails: { date: '2026-06-27', from: 'youssef@acme.ma', to: clientEmail, subject: 'Follow up: ' + (deal?.title || ''), body: '', direction: 'sent' },
      meetings: { date: '2026-06-27', time: '10:00', title: '', type: 'teams', attendees: me, location: 'Teams Meeting', summary: '' },
      recordings: { date: '2026-06-27', title: 'Meeting Recording', meetingLink: 'https://teams.microsoft.com/l/meetup-join/123456', recordingLink: 'https://share.acme.ma/rec/recording-06-27', duration: '30 mins' },
      notes: { date: '2026-06-27', author: me, content: '' },
      followups: { dueDate: '2026-06-27', title: '', assignedTo: me }
    };
  }

  saveActivityEntry() {
    if (!this.canCreateDealActivity()) return;
    const modal = this.addActivityModalOpen();
    if (!modal) return;

    const { dealId, type } = modal;
    if (type === 'calls') {
      this.dealsService.addCallLog(dealId, { ...this.newActivityInput.calls });
    } else if (type === 'emails') {
      this.dealsService.addEmailLog(dealId, { ...this.newActivityInput.emails });
    } else if (type === 'meetings') {
      const atts = this.newActivityInput.meetings.attendees.split(',').map(s => s.trim()).filter(Boolean);
      this.dealsService.addMeeting(dealId, {
        ...this.newActivityInput.meetings,
        attendees: atts
      });
    } else if (type === 'recordings') {
      this.dealsService.addRecording(dealId, { ...this.newActivityInput.recordings });
    } else if (type === 'notes') {
      this.dealsService.addNote(dealId, { ...this.newActivityInput.notes });
    } else if (type === 'followups') {
      this.dealsService.addFollowUp(dealId, {
        ...this.newActivityInput.followups,
        status: 'pending'
      });
    }

    this.addActivityModalOpen.set(null);
  }

  selectCalendarDay(dealId: string, day: number): void {
    this.selectedCalendarDay.update(days => ({ ...days, [dealId]: day }));
  }

  getSelectedCalendarDay(dealId: string): number {
    return this.selectedCalendarDay()[dealId] || 15; // default to 15th
  }

  isSelectedCalendarDay(dealId: string, day: number): boolean {
    return this.getSelectedCalendarDay(dealId) === day;
  }

  hasEventsOnDay(deal: Deal, day: number): boolean {
    if (!deal.activityLog || !deal.activityLog.meetings) return false;
    const dateStr = `2026-06-${String(day).padStart(2, '0')}`;
    return deal.activityLog.meetings.some(m => m.date === dateStr);
  }

  getEventsOnDay(deal: Deal, day: number) {
    if (!deal.activityLog || !deal.activityLog.meetings) return [];
    const dateStr = `2026-06-${String(day).padStart(2, '0')}`;
    return deal.activityLog.meetings.filter(m => m.date === dateStr);
  }

  openConvertProposalModal(prop: Proposal) {
    if (!this.canWriteProposal()) return;
    this.proposalToConvert.set(prop);
    const partner = this.partnersService.allPartners().find(p => p.id === prop.partnerId);
    this.newPartner = {
      id: partner?.id,
      name: partner?.name || '',
      type: 'Customer',
      email: partner?.email || '',
      phone: partner?.phone || '',
      city: partner?.city || 'Casablanca',
      comments: partner?.comments || '',
      ICE: '',
      IF: '',
      RC: '',
      score: undefined,
      source: 'Website form',
      assignedTo: ''
    };
    this.showConvertProposalModal.set(true);
  }

  submitConvertProposal() {
    const prop = this.proposalToConvert();
    if (!prop) return;

    if (this.newPartner.name.trim()) {
      if (!this.newPartner.ICE || this.newPartner.ICE.length !== 15) {
        this.notify.show('ICE must be exactly 15 digits.', { type: 'warning' });
        return;
      }
      if (!this.newPartner.IF || !this.newPartner.IF.trim()) {
        this.notify.show('IF is required.', { type: 'warning' });
        return;
      }
      if (!this.newPartner.RC || !this.newPartner.RC.trim()) {
        this.notify.show('RC is required.', { type: 'warning' });
        return;
      }

      const partnerId = prop.partnerId;

      // 1. Promote the associated Prospect → Customer
      this.partnersService.convertToCustomer(partnerId);

      // 2. Update the partner details in the list
      this.state.partners.update(partners =>
        partners.map(p => p.id === partnerId ? {
          ...p,
          name: this.newPartner.name,
          email: this.newPartner.email,
          phone: this.newPartner.phone,
          city: this.newPartner.city,
          comments: this.newPartner.comments
        } : p)
      );

      // 3. Create the Customer Card
      const accountId = this.partnersService.generateAccountId();
      this.partnersService.saveCustomerCard({
        id: 'cc-' + partnerId,
        partnerId: partnerId,
        accountId,
        recordType: 'Organization',
        name: this.newPartner.name,
        searchName: '',
        erpAccount: '',
        ice: this.newPartner.ICE,
        ifField: this.newPartner.IF,
        rc: this.newPartner.RC,
        rcCity: this.newPartner.city,
        tp: '',
        vatStatus: ['Standard'],
        orgType: 'Headquarter',
        parentAccountId: null,
        addresses: [],
        mainPhone: this.newPartner.phone,
        corporateEmail: this.newPartner.email,
        websiteUrl: '',
        personnel: [],
      });

      // 4. Create the Deal
      const today = new Date().toISOString().split('T')[0];
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 30);
      const formattedDelivery = deliveryDate.toISOString().split('T')[0];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);

      this.dealsService.addDeal({
        title: prop.title + ' — Deal',
        partnerId: partnerId,
        amount: prop.amount,
        stage: 'New',
        comments: 'Converted automatically from confirmed proposal #' + prop.id,
        proposalId: prop.id,
        orderLines: prop.lines.map(l => ({ ...l })),
        orderNumber: 'ORD-' + new Date().getFullYear() + '-' + randomSuffix,
        dealNumber: 'DL-' + new Date().getFullYear() + '-' + randomSuffix,
        orderDate: today,
        requestedDeliveryDate: formattedDelivery,
        orderStatus: 'Confirmed',
        currency: 'MAD',
        paymentTerms: '30 Days Net',
        orderTotalAmount: prop.amount,
        salesPersonUserId: this.state.currentUserId(),
        salesRegion: 'Casablanca-Settat / Maroc'
      });

      // Remove the proposal from the list
      this.state.proposals.update(props => props.filter(p => p.id !== prop.id));

      this.showConvertProposalModal.set(false);
      this.proposalToConvert.set(null);

      // Switch to Deals tab so the user sees the result immediately
      this.activeTab.set('deals');
    }
  }

  openCreateLeadModal() {
    this.newLeadData = {
      name: '',
      email: '',
      phone: '',
      city: 'Casablanca',
      score: 50,
      source: 'Website form',
      assignedTo: ''
    };
    this.leadModalOpen.set(true);
  }

  saveLead() {
    if (this.newLeadData.name.trim()) {
      this.partnersService.addPartner({
        name: this.newLeadData.name,
        type: 'Lead',
        email: this.newLeadData.email,
        phone: this.newLeadData.phone,
        city: this.newLeadData.city,
        score: this.newLeadData.score,
        source: this.newLeadData.source as Partner['source'],
        assignedTo: this.newLeadData.assignedTo || undefined
      });
      this.leadModalOpen.set(false);
    }
  }

  convertLeadToProspect(leadId: string) {
    this.partnersService.convertLeadToProspect(leadId);
  }
}
