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

export type SalesStage = 'New Lead' | 'Qualified' | 'Meeting Scheduled' | 'Proposal Sent' | 'Negotiation' | 'Won / Lost';

@Component({
  selector: 'app-sales',
  imports: [MatIconModule, CommonModule, FormsModule, RouterLink, CreatedByBadgeComponent, DataStatusBannerComponent, PaginatorComponent, AttachmentsComponent, SalesPipelineBoardComponent, TranslatePipe],
  template: `
    <div class="space-y-8">
      @if (activeTab() !== 'deals') {
        <app-data-status-banner [loading]="activeTabLoading()" [error]="activeTabError()" />
      }
      <div class="flex gap-5 sm:gap-6 border-b border-zinc-200">
        <button
          (click)="setActiveTab('deals', 'sales.deals')"
          [class]="activeTab() === 'deals' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">monetization_on</mat-icon>
          {{ 'sales.deals' | translate }}
          <span class="text-xs">{{ dealsService.allDeals().length }}</span>
        </button>
        <button
          (click)="setActiveTab('proposals', 'sales.proposals')"
          [class]="activeTab() === 'proposals' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">description</mat-icon>
          {{ 'sales.proposals' | translate }}
          <span class="text-xs">{{ proposalsService.allProposals().length }}</span>
        </button>
        <button
          (click)="setActiveTab('pos', 'sales.purchaseOrders')"
          [class]="activeTab() === 'pos' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">shopping_cart</mat-icon>
          Purchase Orders
          <span class="text-xs">{{ purchaseOrdersService.allPurchaseOrders().length }}</span>
        </button>
      </div>
      <div class="flex justify-end">
          <div class="flex gap-2">
            @if (activeTab() === 'deals' && canCreateDeal()) {
              <button (click)="openCreateDealModal()" class="bg-zinc-900 hover:bg-zinc-950 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-zinc-300">
                <mat-icon class="w-5 h-5 text-[20px]! leading-none! flex items-center justify-center">add</mat-icon>
                New Deal
              </button>
            } @else if (activeTab() === 'proposals' && canCreateProposal()) {
              <button (click)="openCreateProposalModal()" class="bg-zinc-900 hover:bg-zinc-950 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-zinc-300">
                <mat-icon class="w-5 h-5 text-[20px]! leading-none! flex items-center justify-center">add</mat-icon>
                New Proposal
              </button>
            }
          </div>
        </div>

      <!-- Deals View -->
      @if (activeTab() === 'deals') {
        <div class="flex gap-5 sm:gap-6 border-b border-zinc-200">
          <button
            (click)="dealsView.set('table')"
            [class]="dealsView() === 'table' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
            class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <mat-icon class="text-[18px] w-[18px] h-[18px]">list_alt</mat-icon>
            Table
          </button>
          <button
            (click)="dealsView.set('board')"
            [class]="dealsView() === 'board' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
            class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <mat-icon class="text-[18px] w-[18px] h-[18px]">view_column</mat-icon>
            Board
          </button>
        </div>
      }

      @if (activeTab() === 'deals' && dealsView() === 'board') {
        <app-sales-pipeline-board />
      }

      @if (activeTab() === 'deals' && dealsView() === 'table') {
        <div class="card rounded-2xl overflow-x-auto">
          @if (activeTabLoading()) {
            <app-data-status-banner [loading]="true" [variant]="'rows'" [columns]="9" [rows]="8" />
          } @else {
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-zinc-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left">
                  <input type="checkbox" [checked]="allDealsSelected()" (click)="toggleSelectAllDeals($event)" (change)="$event.stopPropagation()" class="cursor-pointer" />
                </th>
                <th scope="col" class="px-6 py-3 text-left font-semibold text-zinc-500 uppercase tracking-wider text-xs">Deal Title</th>
                <th scope="col" class="px-6 py-3 text-left font-semibold text-zinc-500 uppercase tracking-wider text-xs">Client</th>
                <th scope="col" class="px-6 py-3 text-left font-semibold text-zinc-500 uppercase tracking-wider text-xs">Amount</th>
                <th scope="col" class="px-6 py-3 text-left font-semibold text-zinc-500 uppercase tracking-wider text-xs">Stage</th>
                <th scope="col" class="px-6 py-3 text-left font-semibold text-zinc-500 uppercase tracking-wider text-xs">Est. Delivery</th>
                <th scope="col" class="px-6 py-3 text-left font-semibold text-zinc-500 uppercase tracking-wider text-xs">Order Status</th>
                <th scope="col" class="px-6 py-3 text-left font-semibold text-zinc-500 uppercase tracking-wider text-xs">Created By</th>
                <th scope="col" class="px-6 py-3 text-right font-semibold text-zinc-500 uppercase tracking-wider text-xs">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-100">
              @for (deal of paginatedDeals(); track deal.id) {
                <tr (click)="openDealDrawer(deal)" class="hover:bg-zinc-50/80 cursor-pointer transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap" (click)="$event.stopPropagation()">
                    <input type="checkbox" [checked]="isDealSelected(deal.id)" (click)="toggleDealSelect(deal.id, $event)" class="cursor-pointer" />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-semibold text-zinc-900">{{deal.title}}</div>
                    @if (deal.dealNumber) {
                      <div class="text-meta text-zinc-400 font-sans font-medium">{{deal.dealNumber}}</div>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-zinc-600 font-medium">{{getPartnerName(deal.partnerId)}}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-zinc-900 font-sans font-bold">{{formatCurrency(deal.amount)}}</div>
                    @if (deal.discount) {
                      <div class="text-meta text-zinc-900 font-semibold">-{{deal.discount}}%</div>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-950 border border-zinc-200">
                      {{deal.stage}}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 font-sans">
                    {{deal.estimatedDeliveryDate || 'N/A'}}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-0.5 rounded text-meta font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {{deal.orderStatus || 'N/A'}}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <app-created-by-badge [createdBy]="deal.createdBy" [createdAt]="deal.createdAt" />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold">
                    <button (click)="$event.stopPropagation(); openDealDrawer(deal)" class="text-zinc-900 hover:text-zinc-950 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors" title="View details">
                      <mat-icon class="text-lg w-5 h-5 flex items-center justify-center">visibility</mat-icon>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9" class="px-6 py-8 text-center text-zinc-500 text-sm">No deals found. Create a confirmed proposal to start.</td>
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
            <span class="text-body font-semibold">{{ selectedDealIds().size }} selected</span>
            <div class="w-px h-4 bg-white/20"></div>
            <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkAssignDealOwner($event)">
              <option value="">Assign owner…</option>
              @for (u of state.users(); track u.id) { <option [value]="u.name">{{u.name}}</option> }
            </select>
            <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkChangeDealStage($event)">
              <option value="">Change stage…</option>
              @for (s of dealStageOptions; track s) { <option [value]="s">{{s}}</option> }
            </select>
            <button class="text-body font-semibold px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors" (click)="bulkExportDeals()">Export CSV</button>
            <button class="text-meta ml-2 opacity-70 hover:opacity-100 transition-opacity" (click)="clearDealSelection()">Clear</button>
          </div>
        }
      }

      <!-- Proposals View -->
      @if (activeTab() === 'proposals') {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          @for (prop of paginatedProposals(); track prop.id) {
            <div class="card rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all">
              <div class="space-y-3">
                <div class="flex justify-between items-start">
                  <span class="px-2 py-0.5 text-meta font-bold rounded-full uppercase"
                    [class]="prop.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' : (prop.status === 'Sent' ? 'bg-sky-50 text-sky-700' : 'bg-zinc-100 text-zinc-800')">
                    {{prop.status}}
                  </span>
                  <span class="font-sans text-sm text-zinc-400">#{{prop.id}}</span>
                </div>
                <h3 class="text-lg font-semibold text-zinc-900">{{prop.title}}</h3>
                <p class="text-xs text-zinc-500">Prospect: {{getPartnerName(prop.partnerId)}}</p>
                <div class="flex items-center gap-3 text-xs text-zinc-400">
                  <app-created-by-badge [createdBy]="prop.createdBy" [createdAt]="prop.createdAt" [size]="22" />
                </div>

                <!-- Lines -->
                <div class="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2">
                  <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block">Lines & Pricing</span>
                  @for (line of prop.lines; track $index) {
                    <div class="flex justify-between text-xs text-zinc-700">
                      <span>{{line.qty}}x {{line.product}}</span>
                      <span class="font-sans">{{formatCurrency(line.total)}}</span>
                    </div>
                  }
                  <div class="flex justify-between border-t border-zinc-200 pt-1.5 text-xs font-bold text-zinc-900 font-sans">
                    <span>Total Proposal Amount</span>
                    <span>{{formatCurrency(prop.amount)}}</span>
                  </div>
                </div>

                <!-- Sales Intelligence / Funnel Metadata -->
                <div class="border-t border-zinc-100 pt-3">
                  <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block mb-2">Sales Intelligence</span>
                  <div class="grid grid-cols-2 gap-3 bg-white border border-zinc-200 p-3 rounded-xl border border-zinc-150/60 text-xs">
                    <div>
                      <span class="text-zinc-400 block text-meta font-medium">Opportunity Value</span>
                      <span class="font-bold text-zinc-900 font-sans">{{ formatCurrency(prop.opportunityValue || 0) }}</span>
                    </div>
                    <div>
                      <span class="text-zinc-400 block text-meta font-medium">Probability</span>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <div class="w-full bg-zinc-200 rounded-full h-1.5 max-w-[60px]">
                          <div class="bg-zinc-900 h-1.5 rounded-full" [style.width.%]="prop.closingProbability || 0"></div>
                        </div>
                        <span class="font-bold text-zinc-900 font-sans">{{ prop.closingProbability || 0 }}%</span>
                      </div>
                    </div>
                    <div>
                      <span class="text-zinc-400 block text-meta font-medium">Expected Close</span>
                      <span class="font-semibold text-zinc-700 font-sans">{{ prop.expectedClosingDate || 'TBD' }}</span>
                    </div>
                    <div>
                      <span class="text-zinc-400 block text-meta font-medium">Sales Stage</span>
                      <span class="inline-block px-2 py-0.5 text-meta font-bold rounded border uppercase mt-0.5" [class]="getStageBadgeClass(prop.stage)">
                        {{ prop.stage || 'New Lead' }}
                      </span>
                    </div>
                    <div class="col-span-2">
                      <span class="text-zinc-400 block text-meta font-medium">Competitors</span>
                      @if (prop.competitors && prop.competitors.length > 0) {
                        <div class="flex flex-wrap gap-1 mt-1">
                          @for (comp of prop.competitors; track comp) {
                            <span class="bg-zinc-100 text-zinc-600 border border-zinc-200 px-1.5 py-0.5 rounded text-meta font-medium">{{comp}}</span>
                          }
                        </div>
                      } @else {
                        <span class="text-zinc-500 font-medium italic">No competitors logged.</span>
                      }
                    </div>
                  </div>
                </div>
                
                <!-- Confirmation Info (if confirmed) -->
                @if (prop.status === 'Confirmed' && prop.confirmationMethod) {
                  <div class="border-t border-zinc-100 pt-3 mt-3">
                    <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Confirmation Proof</span>
                    <div class="bg-zinc-100/40 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-950 space-y-2">
                      <div class="flex items-center gap-1.5 font-semibold text-zinc-950 text-meta">
                        @if (prop.confirmationMethod === 'Email') {
                          <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">email</mat-icon>
                          <span>Email confirmation</span>
                        } @else if (prop.confirmationMethod === 'WhatsApp') {
                          <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">chat</mat-icon>
                          <span>WhatsApp screenshot</span>
                        } @else {
                          <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">phone</mat-icon>
                          <span>Call Summary</span>
                        }
                        @if (prop.confirmedAt) {
                          <span class="text-meta text-zinc-900 font-normal ml-auto font-sans">{{ prop.confirmedAt }}</span>
                        }
                      </div>

                      @if (prop.confirmationAttachmentName) {
                        <div class="flex items-center gap-1.5 bg-white border border-zinc-300/60 p-2 rounded-lg text-zinc-950 font-sans text-meta truncate">
                          <mat-icon class="text-[14px] w-3.5 h-3.5 text-zinc-900">attach_file</mat-icon>
                          <span class="truncate flex-1">{{ prop.confirmationAttachmentName }}</span>
                          @if (prop.confirmationAttachmentData) {
                            <a [href]="prop.confirmationAttachmentData" [download]="prop.confirmationAttachmentName"
                               class="text-blue-700 hover:underline font-sans font-semibold ml-1 shrink-0">Download</a>
                          }
                        </div>
                      }

                      @if (prop.confirmationNote) {
                        <p class="text-meta text-zinc-650 leading-relaxed bg-white border border-emerald-150 p-2 rounded-lg italic">
                          "{{ prop.confirmationNote }}"
                        </p>
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="mt-5 pt-3 border-t border-zinc-100 flex justify-between gap-2">
                <button (click)="openProposalDrawer(prop)" class="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 p-2 rounded-lg transition-colors flex items-center justify-center shrink-0" title="View Details">
                  <mat-icon class="text-[18px] w-[18px] h-[18px] flex items-center justify-center">visibility</mat-icon>
                </button>
                <button (click)="openEditProposalModal(prop)" class="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-650 p-2 rounded-lg transition-colors flex items-center justify-center shrink-0" title="Edit Proposal">
                  <mat-icon class="text-[18px] w-[18px] h-[18px] flex items-center justify-center">edit</mat-icon>
                </button>
                @if (canDeleteProposal()) {
                  <button (click)="openProposalDeleteModal(prop)" class="bg-zinc-50 hover:bg-red-50 border border-zinc-200 text-zinc-700 hover:text-red-600 p-2 rounded-lg transition-colors flex items-center justify-center shrink-0" title="Delete Proposal">
                    <mat-icon class="text-[18px] w-[18px] h-[18px] flex items-center justify-center">delete</mat-icon>
                  </button>
                }

                @if (prop.status === 'Draft') {
                  <button (click)="openAssignTaskModal('proposal', prop.id, prop.title)" class="bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-100 p-2 rounded-lg transition-colors flex items-center justify-center shrink-0" title="Assign Task">
                    <mat-icon class="text-[18px] w-[18px] h-[18px] flex items-center justify-center">assignment</mat-icon>
                  </button>
                  <button (click)="openSendProposalModal(prop)" class="flex-1 bg-zinc-900 hover:bg-zinc-950 text-white text-xs font-semibold py-2 rounded-lg transition-colors shadow-lg shadow-zinc-300">
                    Send to Prospect
                  </button>
                } @else if (prop.status === 'Sent') {
                  <button (click)="openConfirmProposalModal(prop)" class="flex-1 bg-zinc-900 hover:bg-zinc-950 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1">
                    <mat-icon class="text-[16px] w-4 h-4">task_alt</mat-icon> Confirm (Signs BC)
                  </button>
                } @else {
                  <button (click)="openConvertProposalModal(prop)"
                    class="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold py-2.5 rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 group">
                    <mat-icon class="text-[16px] w-4 h-4 transition-transform group-hover:scale-110">swap_horiz</mat-icon>
                    Convert to Deal &amp; Customer
                  </button>
                }
              </div>
            </div>
          } @empty {
            <div class="col-span-2 card rounded-2xl p-8 text-center text-zinc-500">No proposals found.</div>
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
        <div class="card rounded-2xl overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-zinc-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">PO Ref</th>
                <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Vendor</th>
                <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Deal</th>
                <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Amount</th>
                <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Delivery Date</th>
                <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Status</th>
                <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Created By</th>
                <th scope="col" class="px-6 py-3 text-right font-medium text-zinc-500 uppercase tracking-wider text-xs">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-200">
              @for (po of paginatedPOs(); track po.id) {
                <tr (click)="openPODrawer(po)" class="hover:bg-zinc-50 cursor-pointer transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-semibold text-zinc-900 font-sans">#{{po.id}}</div>
                    @if (po.sentVia) {
                      <span class="text-meta text-zinc-400 font-medium">Sent: {{po.sentVia}}</span>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-zinc-950 font-medium">{{getPartnerName(po.vendorId)}}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-zinc-500">{{getDealTitle(po.dealId)}}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-zinc-900 font-sans font-bold">{{formatCurrency(po.amount)}}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-zinc-600 font-sans">{{po.deliveryDate || 'Pending Conf.'}}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2.5 py-1 text-meta font-bold uppercase rounded-full"
                      [class]="po.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : (po.status === 'Sent' ? 'bg-sky-50 text-sky-700' : 'bg-zinc-100 text-zinc-800')">
                      {{po.status}}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <app-created-by-badge [createdBy]="po.createdBy" [createdAt]="po.createdAt" />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold space-x-1.5">
                    <button (click)="$event.stopPropagation(); openPODrawer(po)" class="bg-white border border-zinc-200 text-zinc-900 px-2 py-1 rounded-lg hover:bg-zinc-100" title="View Details">
                      <mat-icon class="text-[14px] w-3.5 h-3.5 flex items-center justify-center">visibility</mat-icon>
                    </button>
                    <button (click)="$event.stopPropagation(); openAssignTaskModal('po', po.id, 'PO #' + po.id)" class="bg-white border border-zinc-200 text-zinc-900 px-2 py-1 rounded-lg hover:bg-zinc-100 flex items-center gap-1 ml-auto" title="Assign Task">
                      <mat-icon class="text-[14px] w-3.5 h-3.5">assignment</mat-icon> Assign
                    </button>
                    @if (po.status === 'Sent' && canWritePO()) {
                      <button (click)="$event.stopPropagation(); openSetDeliveryDatePOModal(po)" class="bg-white border border-zinc-200 text-zinc-700 px-2 py-1 rounded-lg hover:bg-zinc-50">Set Del. Date</button>
                      <button (click)="$event.stopPropagation(); purchaseOrdersService.updateStatus(po.id, 'Delivered')" class="bg-zinc-900 text-white px-2 py-1 rounded-lg hover:bg-zinc-950 shadow-lg shadow-zinc-300">Receive Goods</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="px-6 py-8 text-center text-zinc-500 text-sm">No Purchase Orders generated yet.</td>
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
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-zinc-950">Send Proposal</h3>
            <button (click)="sendingProposalId.set(null)" title="Close" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="text-[20px] w-5 h-5">close</mat-icon>
            </button>
          </div>

          <!-- Target Organization -->
          <div class="bg-zinc-100 border border-zinc-200 rounded-xl p-3">
            <span class="text-meta text-zinc-500 font-bold uppercase tracking-wider block mb-0.5">Target Organization</span>
            <span class="text-sm font-bold text-zinc-950">{{ currentProposalPartnerName() }}</span>
          </div>

          <!-- Channel Selection (multi-select toggle) -->
          <div class="space-y-2">
            <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider">Sending Channel(s) — select one or both</label>
            <div class="grid grid-cols-2 gap-3">
              <button type="button" (click)="toggleChannel('email')"
                [class]="isChannelSelected('email')
                  ? 'flex flex-col items-center justify-center p-4 border-2 border-zinc-700 bg-zinc-100 text-zinc-950 rounded-xl gap-2 font-semibold transition-all shadow-sm'
                  : 'flex flex-col items-center justify-center p-4 border border-zinc-200 rounded-xl hover:border-zinc-400 hover:bg-zinc-50/50 hover:text-zinc-900 transition-all gap-2 text-zinc-600'">
                <mat-icon class="text-3xl w-8 h-8 flex items-center justify-center">email</mat-icon>
                <span class="text-sm font-semibold">Email</span>
                @if (isChannelSelected('email')) {
                  <span class="text-meta bg-zinc-900 text-white px-2 py-0.5 rounded-full font-bold">Selected</span>
                }
              </button>
              <button type="button" (click)="toggleChannel('whatsapp')"
                [class]="isChannelSelected('whatsapp')
                  ? 'flex flex-col items-center justify-center p-4 border-2 border-zinc-700 bg-zinc-100 text-zinc-950 rounded-xl gap-2 font-semibold transition-all shadow-sm'
                  : 'flex flex-col items-center justify-center p-4 border border-zinc-200 rounded-xl hover:border-zinc-400 hover:bg-zinc-50/50 hover:text-zinc-900 transition-all gap-2 text-zinc-600'">
                <mat-icon class="text-3xl w-8 h-8 flex items-center justify-center">chat</mat-icon>
                <span class="text-sm font-semibold">WhatsApp</span>
                @if (isChannelSelected('whatsapp')) {
                  <span class="text-meta bg-zinc-900 text-white px-2 py-0.5 rounded-full font-bold">Selected</span>
                }
              </button>
            </div>
          </div>

          <!-- Add other contacts from same org -->
          @if (proposalOrgContacts().length > 0) {
            <div>
              <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Add other contacts from this organization:</label>
              <select (change)="addContactToRecipients($event)" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                <option value="">— Select a contact —</option>
                @for (contact of proposalOrgContacts(); track contact.id) {
                  <option [value]="contact.id">{{ contact.fullName }} · {{ contact.jobTitle }}</option>
                }
              </select>
            </div>
          }

          <!-- Recipients list -->
          <div class="space-y-2">
            <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider">Recipients</label>
            @for (recipient of recipients(); track $index) {
              <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-bold text-zinc-700 truncate max-w-[200px]">{{ recipient.name || 'New Contact' }}</span>
                  @if ($index > 0) {
                    <button type="button" (click)="removeRecipient($index)" title="Remove recipient" class="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 p-1 rounded transition-colors">
                      <mat-icon class="text-base w-4 h-4">close</mat-icon>
                    </button>
                  }
                </div>
                @if (isChannelSelected('email')) {
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 text-zinc-500 shrink-0">email</mat-icon>
                    <input [value]="recipient.email || ''" (input)="updateRecipientEmail($index, $event)"
                      type="email" placeholder="Email address"
                      class="flex-1 input-field rounded-lg p-1.5 text-xs focus:outline-blue-600 bg-white">
                  </div>
                }
                @if (isChannelSelected('whatsapp')) {
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 text-zinc-700 shrink-0">chat</mat-icon>
                    <input [value]="recipient.phone || ''" (input)="updateRecipientPhone($index, $event)"
                      type="tel" placeholder="Phone / WhatsApp number"
                      class="flex-1 input-field rounded-lg p-1.5 text-xs focus:outline-blue-600 bg-white">
                  </div>
                }
              </div>
            } @empty {
              <div class="text-center py-4 text-zinc-400 text-xs bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                No recipients yet. The primary contact will be added automatically.
              </div>
            }
            <button type="button" (click)="addManualRecipient()" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center gap-1 transition-colors">
              <mat-icon class="text-base w-4 h-4">add_circle</mat-icon> Add Recipient
            </button>
          </div>

          <!-- Footer actions -->
          <div class="flex justify-between gap-2 pt-2 border-t border-zinc-100">
            <button (click)="sendingProposalId.set(null)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50 transition-colors">Cancel</button>
            <button (click)="submitSendProposal()"
              [disabled]="selectedChannels().size === 0 || recipients().length === 0"
              class="px-5 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-lg shadow-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              <mat-icon class="text-[16px] w-4 h-4">send</mat-icon>
              Send Proposal
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Create Proposal Modal -->
    @if (proposalModalOpen()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
          <h3 class="text-lg font-bold text-zinc-950 shrink-0">{{ editingProposalId() ? 'Edit Proposal' : 'Create Proposal' }}</h3>
          
          <div class="space-y-4 overflow-y-auto pr-1 flex-1">
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Select Prospect / Client</label>
                <select [(ngModel)]="newProposal.partnerId" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                  @for (partner of salesEligiblePartners(); track partner.id) {
                    <option [value]="partner.id">{{ partner.name }} ({{ partner.type }})</option>
                  }
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Proposal Title</label>
                <input [(ngModel)]="newProposal.title" type="text" placeholder="e.g. Standard Enterprise Cloud Infrastructure" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Select Template</label>
                <select [(ngModel)]="selectedTemplateId" (change)="applyTemplate()" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                  <option value="">-- Manual/No Template --</option>
                  @for (temp of proposalTemplates(); track temp.id) {
                    <option [value]="temp.id">{{temp.name}}</option>
                  }
                </select>
              </div>

              <!-- Sales Funnel & Intelligence Section -->
              <div class="border-t border-zinc-100 pt-3 space-y-3">
                <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Sales Intelligence</span>
                
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-semibold text-zinc-500 mb-1">Opportunity Value</label>
                    <div class="relative rounded-lg shadow-xs">
                      <input [(ngModel)]="newProposal.opportunityValue" type="number" placeholder="0" class="w-full input-field rounded-lg p-2 pr-12 text-sm focus:outline-blue-600 font-sans">
                      <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span class="text-zinc-400 text-xs font-semibold">MAD</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label class="block text-xs font-semibold text-zinc-500 mb-1">Probability of Closing</label>
                    <div class="relative rounded-lg shadow-xs">
                      <input [(ngModel)]="newProposal.closingProbability" type="number" min="0" max="100" placeholder="50" class="w-full input-field rounded-lg p-2 pr-8 text-sm focus:outline-blue-600 font-sans">
                      <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span class="text-zinc-400 text-xs font-semibold">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-semibold text-zinc-500 mb-1">Expected Closing Date</label>
                    <input [(ngModel)]="newProposal.expectedClosingDate" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                  </div>
                  
                  <div>
                    <label class="block text-xs font-semibold text-zinc-500 mb-1">Sales Stage</label>
                    <select [(ngModel)]="newProposal.stage" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
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
                  <label class="block text-xs font-semibold text-zinc-500 mb-1">Competitors (comma separated)</label>
                  <input [(ngModel)]="newProposal.competitors" type="text" placeholder="e.g. AWS, Azure, Local Telecom" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>

              <!-- Line Items -->
              <div class="space-y-2 border-t border-zinc-100 pt-2">
                <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Line Items</span>
                @for (line of newProposal.lines; track $index) {
                  <div class="grid grid-cols-12 gap-2 items-center">
                    <input class="col-span-4 input-field rounded-lg p-1.5 text-xs focus:outline-blue-600" [(ngModel)]="line.product" placeholder="Product">
                    <input class="col-span-4 input-field rounded-lg p-1.5 text-xs focus:outline-blue-600" [(ngModel)]="line.description" placeholder="Description">
                    <input class="col-span-1 input-field rounded-lg p-1.5 text-xs focus:outline-blue-600 text-center" type="number" [(ngModel)]="line.qty" (change)="recalcLine(line)">
                    <input class="col-span-2 input-field rounded-lg p-1.5 text-xs focus:outline-blue-600 font-sans text-right" type="number" [(ngModel)]="line.unitPrice" (change)="recalcLine(line)">
                    <button type="button" (click)="removeLine($index)" title="Remove line" class="col-span-1 text-zinc-700 hover:bg-zinc-100 p-1 rounded"><mat-icon class="text-[16px] w-4 h-4 leading-none">delete</mat-icon></button>
                  </div>
                }
                <button (click)="addLineItem()" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center mt-1">
                  <mat-icon class="text-[16px] w-4 h-4 mr-0.5">add_circle</mat-icon> Add Line Item
                </button>
              </div>
            </div>
          </div>

          <div class="flex justify-between items-center border-t border-zinc-100 pt-4 shrink-0">
            <div class="text-sm">
              <span class="text-zinc-500">Total Amount:</span>
              <strong class="ml-1 text-zinc-900 font-sans">{{formatCurrency(getNewProposalTotal())}}</strong>
            </div>
            <div class="flex gap-2">
              <button (click)="proposalModalOpen.set(false)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
              <button (click)="saveProposal(true)" class="px-4 py-2 border border-zinc-200 text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg flex items-center gap-1.5">
                <mat-icon class="text-[16px] w-4 h-4">assignment</mat-icon> {{ editingProposalId() ? 'Save &amp; Assign Task' : 'Create &amp; Assign Task' }}
              </button>
              <button (click)="saveProposal()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-lg shadow-zinc-300">{{ editingProposalId() ? 'Save Changes' : 'Create Proposal' }}</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Create Deal Modal -->
    @if (dealModalOpen()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-7xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
          <div class="flex justify-between items-center border-b border-white/30 pb-3 shrink-0">
            <h3 class="text-xl font-bold text-zinc-950">Create Deal</h3>
            <span class="text-xs text-zinc-900 bg-zinc-100 px-2 py-1 rounded-full font-medium">Extended Fields Active</span>
          </div>
          
          <!-- HEADER SECTION: All form fields in scrollable 2-column grid -->
          <div class="overflow-y-auto pr-2 shrink-0 max-h-[35vh]">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Left Column: Core Deal info, Customer details, Commercials -->
              <div class="space-y-6">
                <!-- SECTION 1: Identification & Dates -->
                <div class="space-y-3">
                  <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-white/30 pb-1 flex items-center gap-1.5">
                    <mat-icon class="text-[16px] w-4 h-4">tag</mat-icon> Identification & Dates
                  </h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Select Client (Must be Customer)</label>
                      <select [(ngModel)]="newDeal.partnerId" (change)="onPartnerChange()" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                        @for (c of customers(); track c.id) {
                          <option [value]="c.id">{{c.name}}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Linked Proposal</label>
                      <select [(ngModel)]="newDeal.proposalId" (change)="onProposalChange()" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                        <option value="">None</option>
                        @for (p of proposalsService.allProposals(); track p.id) {
                          <option [value]="p.id">#{{p.id}} - {{p.title}}</option>
                        }
                      </select>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Deal Title</label>
                      <input [(ngModel)]="newDeal.title" type="text" placeholder="e.g. Atlas Cloud Migration Project" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Order Status</label>
                      <select [(ngModel)]="newDeal.orderStatus" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                        <option value="Draft">Draft</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Processing">Processing</option>
                        <option value="Delivered">Delivered</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-4 gap-3">
                    <div class="col-span-2">
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Order Number</label>
                      <input [(ngModel)]="newDeal.orderNumber" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                    <div class="col-span-2">
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Deal Number</label>
                      <input [(ngModel)]="newDeal.dealNumber" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Order Date</label>
                      <input [(ngModel)]="newDeal.orderDate" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Requested Delivery Date</label>
                      <input [(ngModel)]="newDeal.requestedDeliveryDate" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                  </div>
                </div>

                <!-- SECTION 2: Customer & Delivery -->
                <div class="space-y-3">
                  <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-white/30 pb-1 flex items-center gap-1.5">
                    <mat-icon class="text-[16px] w-4 h-4">business</mat-icon> Customer & Delivery
                  </h4>
                  <div class="grid grid-cols-3 gap-3">
                    <div class="col-span-1">
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Customer Account</label>
                      <input [(ngModel)]="newDeal.customerAccount" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                    <div class="col-span-2">
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Contact Person</label>
                      <input [(ngModel)]="newDeal.contactPerson" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Contact Email</label>
                      <input [(ngModel)]="newDeal.contactEmail" type="email" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Contact Phone Number</label>
                      <input [(ngModel)]="newDeal.contactPhone" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Billing Address</label>
                      <textarea [(ngModel)]="newDeal.billingAddress" rows="2" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Delivery Address</label>
                      <textarea [(ngModel)]="newDeal.deliveryAddress" rows="2" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
                    </div>
                  </div>
                </div>

                <!-- SECTION 3: Sales & Ownership -->
                <div class="space-y-3">
                  <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-white/30 pb-1 flex items-center gap-1.5">
                    <mat-icon class="text-[16px] w-4 h-4">person</mat-icon> Sales & Ownership
                  </h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Sales Person</label>
                      <select [(ngModel)]="newDeal.salesPerson" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                        @for (u of users(); track u.name) {
                          @if (u.team === 'Sales') {
                            <option [value]="u.name">{{u.name}}</option>
                          }
                        }
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Sales Organization / Region</label>
                      <input [(ngModel)]="newDeal.salesRegion" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                    </div>
                  </div>
                </div>

                <!-- SECTION 4: Commercial Basics -->
                <div class="space-y-3">
                  <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-white/30 pb-1 flex items-center gap-1.5">
                    <mat-icon class="text-[16px] w-4 h-4">monetization_on</mat-icon> Commercial Basics
                  </h4>
                  <div class="grid grid-cols-4 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Currency</label>
                      <select [(ngModel)]="newDeal.currency" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                        <option value="MAD">MAD</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Amount (Raw)</label>
                      <input [(ngModel)]="newDeal.amount" type="number" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Discount (%)</label>
                      <input [(ngModel)]="newDeal.discount" type="number" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Payment Terms</label>
                      <input [(ngModel)]="newDeal.paymentTerms" type="text" placeholder="e.g. 30 Days Net" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Vendor/Partner & Logs/Comments -->
              <div class="space-y-6">
                <!-- SECTION 5: Vendor / Partner (Logistics) -->
                <div class="space-y-3">
                  <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-white/30 pb-1 flex items-center gap-1.5">
                    <mat-icon class="text-[16px] w-4 h-4">local_shipping</mat-icon> Vendor / Partner (Logistics)
                  </h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Vendor Account</label>
                      <input [(ngModel)]="newDeal.vendorAccount" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Purchase Order Reference</label>
                      <input [(ngModel)]="newDeal.purchaseOrderRef" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Warehouse Address</label>
                      <input [(ngModel)]="newDeal.warehouseAddress" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Transportation Service</label>
                      <input [(ngModel)]="newDeal.transportationService" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Expected Delivery Date (Vendor)</label>
                      <input [(ngModel)]="newDeal.expectedDeliveryDateVendor" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-zinc-500 mb-1">Delivery Date (Customer)</label>
                      <input [(ngModel)]="newDeal.deliveryDate" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                    </div>
                  </div>
                </div>

                <!-- SECTION 6: Logs & Comments -->
                <div class="space-y-3">
                  <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-white/30 pb-1 flex items-center gap-1.5">
                    <mat-icon class="text-[16px] w-4 h-4">notes</mat-icon> Logs & Comments
                  </h4>
                  <div>
                    <label class="block text-xs font-semibold text-zinc-500 mb-1">Email Exchange logs & Confirmations</label>
                    <textarea [(ngModel)]="newDeal.emailExchange" rows="3" placeholder="Paste copy of signed email confirmations..." class="w-full input-field rounded-lg p-2 text-meta font-sans focus:outline-blue-600"></textarea>
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-zinc-500 mb-1">Customer Comments</label>
                    <textarea [(ngModel)]="newDeal.comments" rows="2" placeholder="Comments..." class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Horizontal Divider -->
          <hr class="border-zinc-200 shrink-0">

          <!-- LINE ITEMS SECTION: Full-width data table -->
          <div class="space-y-3 min-h-0 flex flex-col overflow-hidden">
            <h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <mat-icon class="text-[16px] w-4 h-4">list</mat-icon> Line Items
            </h4>
            <div class="overflow-x-auto border border-zinc-200 rounded-xl flex-1">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-zinc-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider w-12">#</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Item Description</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider w-28">Quantity</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider w-36">Unit Price</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider w-52">Vendor</th>
                    <th class="px-4 py-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-200">
                  @for (line of newDeal.lines; track $index) {
                    <tr class="hover:bg-zinc-50/50">
                      <td class="px-4 py-2 text-sm text-zinc-400 font-sans text-center">{{$index + 1}}</td>
                      <td class="px-4 py-2">
                        <input class="w-full input-field rounded-lg p-1.5 text-sm focus:outline-blue-600" [(ngModel)]="line.description" placeholder="Item description">
                      </td>
                      <td class="px-4 py-2">
                        <input class="w-full input-field rounded-lg p-1.5 text-sm focus:outline-blue-600 text-right font-sans" type="number" [(ngModel)]="line.qty" (change)="recalcDealLine(line)">
                      </td>
                      <td class="px-4 py-2">
                        <input class="w-full input-field rounded-lg p-1.5 text-sm focus:outline-blue-600 text-right font-sans" type="number" [(ngModel)]="line.unitPrice" (change)="recalcDealLine(line)">
                      </td>
                      <td class="px-4 py-2">
                        <select class="w-full input-field rounded-lg p-1.5 text-sm bg-white focus:outline-blue-600" [(ngModel)]="line.vendor">
                          <option value="">-- Select Vendor --</option>
                          @for (v of vendors(); track v.id) {
                            <option [value]="v.name">{{v.name}}</option>
                          }
                        </select>
                      </td>
                      <td class="px-4 py-2 text-center">
                      <button type="button" (click)="removeDealLine($index)" title="Remove line" class="text-zinc-700 hover:bg-zinc-100 p-1 rounded">
                        <mat-icon class="text-[16px] w-4 h-4 leading-none">delete</mat-icon>
                      </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <button (click)="addDealLineItem()" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center shrink-0">
              <mat-icon class="text-[16px] w-4 h-4 mr-0.5">add_circle</mat-icon> Add Line Item
            </button>
          </div>

          <!-- Footer -->
          <div class="flex justify-between items-center border-t border-zinc-100 pt-4 shrink-0">
            <div class="text-sm">
              <span class="text-zinc-500">Calculated Total:</span>
              <strong class="ml-1 text-zinc-900 font-sans">
                {{ formatCurrency(newDeal.amount - (newDeal.amount * (newDeal.discount / 100))) }}
              </strong>
            </div>
            <div class="flex gap-2">
              <button (click)="dealModalOpen.set(false)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
              <button (click)="saveDeal(true)" class="px-4 py-2 border border-zinc-200 text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg flex items-center gap-1.5">
                <mat-icon class="text-[16px] w-4 h-4">assignment</mat-icon> Save &amp; Assign Task
              </button>
              <button (click)="saveDeal()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-lg shadow-zinc-300">Save Deal</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Create PO Modal (Operations) -->
    @if (poModalOpen()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-3xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          <h3 class="text-lg font-bold text-zinc-950 shrink-0">Create Purchase Order</h3>
          <p class="text-xs text-zinc-500 shrink-0">Creating Purchase Order linked to: <strong>{{selectedDealForPO()?.title}}</strong></p>
          
          <div class="space-y-4 overflow-y-auto pr-1 flex-1">
            <div>
              <div class="flex justify-between items-center mb-1">
                <label class="block text-xs font-semibold text-zinc-500 uppercase">Vendor</label>
                <button (click)="showNewVendorForm.set(!showNewVendorForm())" class="text-zinc-900 hover:text-zinc-950 text-meta font-bold uppercase">
                  {{ showNewVendorForm() ? 'Select Existing' : '+ Create New Vendor Inline' }}
                </button>
              </div>
              
              @if (showNewVendorForm()) {
                <div class="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                  <input [(ngModel)]="newVendorData.name" placeholder="Vendor Company Name" class="w-full input-field rounded-lg p-1.5 text-xs bg-white focus:outline-blue-600">
                  <input [(ngModel)]="newVendorData.email" placeholder="Vendor Email" class="w-full input-field rounded-lg p-1.5 text-xs bg-white focus:outline-blue-600 font-sans">
                  <input [(ngModel)]="newVendorData.phone" placeholder="Vendor Phone" class="w-full input-field rounded-lg p-1.5 text-xs bg-white focus:outline-blue-600 font-sans">
                  <select [(ngModel)]="newVendorData.city" class="w-full input-field rounded-lg p-1.5 text-xs bg-white focus:outline-blue-600">
                    <option value="Casablanca">Casablanca</option>
                    <option value="Rabat">Rabat</option>
                    <option value="Marrakech">Marrakech</option>
                  </select>
                </div>
              } @else {
                <select [ngModel]="selectedVendorId()" (ngModelChange)="selectedVendorId.set($event)" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                  @for (vendor of vendors(); track vendor.id) {
                    <option [value]="vendor.id">{{vendor.name}}</option>
                  }
                </select>
              }
            </div>

            <!-- Order Lines Section -->
            <div class="space-y-2 border-t border-zinc-100 pt-3">
              <span class="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Order Line Items</span>
              
              <div class="space-y-3">
                @for (line of poLines(); track $index; let i = $index) {
                  <div class="bg-white border border-zinc-200 hover:bg-zinc-50 border border-zinc-150 rounded-xl p-3.5 space-y-2.5 relative transition-all">
                    <!-- Line Header -->
                    <div class="flex justify-between items-center">
                      <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider">Line #{{ i + 1 }}</span>
                      @if (poLines().length > 1) {
                        <button type="button" (click)="removePoLine(i)" class="text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 p-1.5 rounded-lg transition-colors flex items-center justify-center" title="Remove Line">
                          <mat-icon class="text-[16px] w-4 h-4 flex items-center justify-center">delete</mat-icon>
                        </button>
                      }
                    </div>

                    <!-- Row Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <!-- Item Name -->
                      <div class="md:col-span-4">
                        <label class="block text-meta font-semibold text-zinc-400 mb-1">Item Name</label>
                        <input [(ngModel)]="line.item" type="text" placeholder="e.g. Dell PowerEdge Server" class="w-full input-field rounded-lg p-1.5 text-xs bg-white focus:outline-blue-600">
                      </div>

                      <!-- Description -->
                      <div class="md:col-span-8">
                        <label class="block text-meta font-semibold text-zinc-400 mb-1">Description (Optional)</label>
                        <input [(ngModel)]="line.description" type="text" placeholder="e.g. Core i7, 32GB RAM" class="w-full input-field rounded-lg p-1.5 text-xs bg-white focus:outline-blue-600">
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <!-- Quantity -->
                      <div class="md:col-span-3">
                        <label class="block text-meta font-semibold text-zinc-400 mb-1">Quantity</label>
                        <input [(ngModel)]="line.qty" type="number" min="1" class="w-full input-field rounded-lg p-1.5 text-xs bg-white text-center font-semibold focus:outline-blue-600 font-sans">
                      </div>

                      <!-- Unit Price -->
                      <div class="md:col-span-5">
                        <label class="block text-meta font-semibold text-zinc-400 mb-1">Unit Price (MAD)</label>
                        <input [(ngModel)]="line.unitPrice" type="number" class="w-full input-field rounded-lg p-1.5 text-xs bg-white font-sans text-right focus:outline-blue-600">
                      </div>

                      <!-- Item Type -->
                      <div class="md:col-span-4">
                        <label class="block text-meta font-semibold text-zinc-400 mb-1">Item Type</label>
                        <select [(ngModel)]="line.type" class="w-full input-field rounded-lg p-1.5 text-xs bg-white focus:outline-blue-600">
                          <option value="software">Software</option>
                          <option value="hardware">Hardware</option>
                          <option value="service">Service</option>
                        </select>
                      </div>
                    </div>
                  </div>
                }
              </div>

              <button type="button" (click)="addPoLineItem()" class="w-full py-2 border border-dashed border-zinc-300 hover:border-zinc-500 bg-zinc-100/20 hover:bg-zinc-100/40 text-zinc-900 hover:text-zinc-950 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 mt-2">
                <mat-icon class="text-[16px] w-4 h-4 flex items-center justify-center">add_circle</mat-icon>
                + Add Item Line
              </button>
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Expected Vendor Delivery Date</label>
              <input [(ngModel)]="newPoDeliveryDate" type="date" class="w-full input-field rounded-lg p-2 text-sm font-sans focus:outline-blue-600">
            </div>
          </div>

          <div class="flex justify-between items-center border-t border-zinc-100 pt-4 shrink-0">
            <div class="text-sm font-semibold text-zinc-700">
              PO Total: <span class="font-sans text-zinc-900 font-bold ml-1">{{ formatCurrency(getPoTotal()) }}</span>
            </div>
            <div class="flex gap-2">
              <button (click)="poModalOpen.set(false)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
              <button (click)="saveDraftPO()" class="px-4 py-2 border border-zinc-200 text-zinc-900 hover:bg-zinc-100 text-sm font-semibold rounded-lg shadow-sm">Create Draft</button>
              <button (click)="savePurchaseOrder()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-lg shadow-zinc-300">Send PO via Email</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Set Delivery Date PO Modal -->
    @if (setDeliveryDateModalOpen()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <h3 class="text-lg font-bold text-zinc-950">Log Vendor Expected Delivery Date</h3>
          <div>
            <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Expected Delivery Date</label>
            <input [(ngModel)]="loggedDeliveryDate" type="date" class="w-full input-field rounded-lg p-2 text-sm font-sans focus:outline-blue-600">
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button (click)="setDeliveryDateModalOpen.set(false)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
            <button (click)="saveDeliveryDate()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-lg shadow-zinc-300">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- Quick Add Activity Modal -->
    @if (addActivityModalOpen()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <h3 class="text-lg font-bold text-zinc-950 capitalize">Log New {{ addActivityModalOpen()?.type === 'followups' ? 'Follow-up' : addActivityModalOpen()?.type }}</h3>
          
          <!-- Calls Fields -->
          @if (addActivityModalOpen()?.type === 'calls') {
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Date</label>
                <input [(ngModel)]="newActivityInput.calls.date" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Duration (mins)</label>
                  <input [(ngModel)]="newActivityInput.calls.duration" type="number" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Caller Name</label>
                  <input [(ngModel)]="newActivityInput.calls.callerName" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Outcome</label>
                <select [(ngModel)]="newActivityInput.calls.outcome" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                  <option value="Interested">Interested</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Summary / Log</label>
                <textarea [(ngModel)]="newActivityInput.calls.summary" rows="3" placeholder="Describe the discussion..." class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
              </div>
            </div>
          }

          <!-- Emails Fields -->
          @if (addActivityModalOpen()?.type === 'emails') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Date</label>
                  <input [(ngModel)]="newActivityInput.emails.date" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Direction</label>
                  <select [(ngModel)]="newActivityInput.emails.direction" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                    <option value="sent">Sent to Client</option>
                    <option value="received">Received from Client</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">From</label>
                  <input [(ngModel)]="newActivityInput.emails.from" type="email" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">To</label>
                  <input [(ngModel)]="newActivityInput.emails.to" type="email" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Subject</label>
                <input [(ngModel)]="newActivityInput.emails.subject" type="text" placeholder="Subject..." class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-semibold font-sans">
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Email Body</label>
                <textarea [(ngModel)]="newActivityInput.emails.body" rows="4" placeholder="Body copy..." class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans text-xs"></textarea>
              </div>
            </div>
          }

          <!-- Meetings Fields -->
          @if (addActivityModalOpen()?.type === 'meetings') {
            <div class="space-y-3 overflow-y-auto max-h-[50vh]">
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Meeting Title</label>
                <input [(ngModel)]="newActivityInput.meetings.title" type="text" placeholder="e.g. Technical Kickoff" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-semibold">
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="col-span-2">
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Date</label>
                  <input [(ngModel)]="newActivityInput.meetings.date" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Time</label>
                  <input [(ngModel)]="newActivityInput.meetings.time" type="text" placeholder="10:00" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Type</label>
                  <select [(ngModel)]="newActivityInput.meetings.type" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                    <option value="teams">Teams Meeting</option>
                    <option value="demo">Product Demo</option>
                    <option value="in-person">In-person Meeting</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Location</label>
                  <input [(ngModel)]="newActivityInput.meetings.location" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Attendees (Comma Separated)</label>
                <input [(ngModel)]="newActivityInput.meetings.attendees" type="text" placeholder="Youssef, Karim Atlas" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-medium">
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Minutes / Summary</label>
                <textarea [(ngModel)]="newActivityInput.meetings.summary" rows="3" placeholder="Key outcomes..." class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
              </div>
            </div>
          }

          <!-- Recordings Fields -->
          @if (addActivityModalOpen()?.type === 'recordings') {
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Date</label>
                <input [(ngModel)]="newActivityInput.recordings.date" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Title</label>
                <input [(ngModel)]="newActivityInput.recordings.title" type="text" placeholder="e.g. Scoping Call Recording" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-semibold font-sans">
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Duration (e.g. '45 mins')</label>
                <input [(ngModel)]="newActivityInput.recordings.duration" type="text" placeholder="45 mins" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Teams Meeting Link</label>
                <input [(ngModel)]="newActivityInput.recordings.meetingLink" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans text-xs">
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Recording Share Link</label>
                <input [(ngModel)]="newActivityInput.recordings.recordingLink" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans text-xs">
              </div>
            </div>
          }

          <!-- Notes Fields -->
          @if (addActivityModalOpen()?.type === 'notes') {
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Date</label>
                  <input [(ngModel)]="newActivityInput.notes.date" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Author</label>
                  <input [(ngModel)]="newActivityInput.notes.author" type="text" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Note Content</label>
                <textarea [(ngModel)]="newActivityInput.notes.content" rows="4" placeholder="Write internal notes..." class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
              </div>
            </div>
          }

          <!-- Follow-ups Fields -->
          @if (addActivityModalOpen()?.type === 'followups') {
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Due Date</label>
                <input [(ngModel)]="newActivityInput.followups.dueDate" type="date" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Reminder Title</label>
                <input [(ngModel)]="newActivityInput.followups.title" type="text" placeholder="e.g. Call client for feedback" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-semibold font-sans">
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Assigned Owner</label>
                <select [(ngModel)]="newActivityInput.followups.assignedTo" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                  @for (user of users(); track user.name) {
                    <option [value]="user.name">{{ user.name }} ({{ user.team }})</option>
                  }
                </select>
              </div>
            </div>
          }

          <div class="flex justify-end gap-2 pt-4 border-t border-zinc-100 shrink-0">
            <button type="button" (click)="addActivityModalOpen.set(null)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50 font-sans">Cancel</button>
            <button type="button" (click)="saveActivityEntry()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-lg shadow-zinc-300 font-sans">Save Entry</button>
          </div>
        </div>
      </div>
    }

    <!-- Confirm Proposal Modal -->
    @if (showConfirmProposalModal()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-md w-full p-6 space-y-6 animate-in zoom-in-95 duration-200">
          <div class="flex justify-between items-center pb-2 border-b border-white/30">
            <h3 class="text-lg font-bold text-zinc-950">Confirm Proposal #{{ proposalToConfirm()?.id }}</h3>
            <button (click)="showConfirmProposalModal.set(false)" title="Close" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="space-y-4 font-sans">
            <!-- Method Selector -->
            <div>
              <label class="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Confirmation Channel</label>
              <div class="grid grid-cols-3 gap-2">
                <button type="button" (click)="confirmMethod.set('Email')"
                  [class]="confirmMethod() === 'Email' 
                    ? 'flex flex-col items-center justify-center py-2 px-3 border-2 border-zinc-700 bg-blue-50/40 text-zinc-950 rounded-xl gap-1 font-semibold transition-all text-xs' 
                    : 'flex flex-col items-center justify-center py-2 px-3 border border-zinc-200 rounded-xl hover:border-zinc-400 hover:bg-zinc-50 hover:text-blue-700 transition-all gap-1 text-zinc-500 text-xs'">
                  <mat-icon class="text-xl w-5 h-5 flex items-center justify-center">email</mat-icon>
                  <span>Email</span>
                </button>
                <button type="button" (click)="confirmMethod.set('WhatsApp')"
                  [class]="confirmMethod() === 'WhatsApp' 
                    ? 'flex flex-col items-center justify-center py-2 px-3 border-2 border-zinc-700 bg-emerald-55/40 text-zinc-950 rounded-xl gap-1 font-semibold transition-all text-xs' 
                    : 'flex flex-col items-center justify-center py-2 px-3 border border-zinc-200 rounded-xl hover:border-zinc-400 hover:bg-zinc-50 hover:text-emerald-650 transition-all gap-1 text-zinc-500 text-xs'">
                  <mat-icon class="text-xl w-5 h-5 flex items-center justify-center">chat</mat-icon>
                  <span>WhatsApp</span>
                </button>
                <button type="button" (click)="confirmMethod.set('Call')"
                  [class]="confirmMethod() === 'Call' 
                    ? 'flex flex-col items-center justify-center py-2 px-3 border-2 border-zinc-700 bg-amber-55/40 text-zinc-950 rounded-xl gap-1 font-semibold transition-all text-xs' 
                    : 'flex flex-col items-center justify-center py-2 px-3 border border-zinc-200 rounded-xl hover:border-zinc-400 hover:bg-zinc-50 hover:text-amber-650 transition-all gap-1 text-zinc-500 text-xs'">
                  <mat-icon class="text-xl w-5 h-5 flex items-center justify-center">phone</mat-icon>
                  <span>Call Log</span>
                </button>
              </div>
            </div>

            <!-- Upload fields or Notes -->
            @if (confirmMethod() === 'Email' || confirmMethod() === 'WhatsApp') {
              <div class="space-y-3">
                <label class="block text-xs font-semibold text-zinc-650 uppercase">
                  Attach {{ confirmMethod() }} Confirmation Screenshot / PDF
                </label>
                
                <div class="border-2 border-dashed border-zinc-200 rounded-xl p-4 flex flex-col items-center justify-center bg-white border border-zinc-200 hover:bg-zinc-50 transition-all relative">
                  <input type="file" (change)="onConfirmFileSelected($event)" accept="image/*,application/pdf"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                  <mat-icon class="text-zinc-400 text-3xl w-8 h-8 mb-1">cloud_upload</mat-icon>
                  <span class="text-xs text-zinc-500 font-semibold">Click or drag image screenshot / document here</span>
                  <span class="text-meta text-zinc-400 mt-0.5">Supports PNG, JPG, PDF</span>
                </div>

                @if (confirmAttachmentName()) {
                  <div class="flex items-center gap-2 bg-zinc-100 border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-950">
                    <mat-icon class="text-zinc-900 text-sm w-4 h-4">task_alt</mat-icon>
                    <span class="font-semibold truncate flex-1">{{ confirmAttachmentName() }}</span>
                    <button type="button" (click)="confirmAttachmentName.set(''); confirmAttachmentData.set('');" 
                      class="text-zinc-950 hover:text-zinc-900 p-0.5 rounded-full transition-colors">
                      <mat-icon class="text-sm w-4 h-4">close</mat-icon>
                    </button>
                  </div>
                }

                <div class="space-y-2">
                  <label class="block text-xs font-semibold text-zinc-650 uppercase">Note</label>
                  <textarea [(ngModel)]="confirmNote" name="confirmNote" rows="3"
                    placeholder="Add a note about this confirmation..."
                    class="w-full border border-zinc-200 rounded-xl p-3 text-xs focus:outline-blue-700 bg-white placeholder-slate-400 shadow-sm"></textarea>
                </div>
              </div>
            } @else {
              <div class="space-y-2">
                <label class="block text-xs font-semibold text-zinc-650 uppercase">
                  Call Summary &amp; Notes
                </label>
                <textarea [(ngModel)]="confirmNote" name="confirmNote" rows="4" 
                  placeholder="Summary of conversation, agreed pricing details, customer approval details..."
                  class="w-full border border-zinc-200 rounded-xl p-3 text-xs focus:outline-blue-700 bg-white placeholder-slate-400 shadow-sm"></textarea>
              </div>
            }

            <div class="flex justify-end gap-2 pt-4 border-t border-zinc-100">
              <button type="button" (click)="showConfirmProposalModal.set(false)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
              <button type="button" (click)="submitConfirmProposal()"
                [disabled]="(confirmMethod() !== 'Call' && !confirmAttachmentName()) || (confirmMethod() === 'Call' && !confirmNote().trim())"
                class="px-5 py-2 bg-zinc-900 hover:bg-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5">
                <mat-icon class="text-[18px] w-[18.5px] h-[18.5px]">task_alt</mat-icon>
                Confirm Proposal
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Convert Proposal to Deal & Customer Modal -->
    @if (showConvertProposalModal()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-md w-full p-6 space-y-6">
          <div class="flex justify-between items-center pb-2 border-b border-white/30">
            <h3 class="text-lg font-semibold text-zinc-950">Convert Prospect to Customer</h3>
            <button (click)="showConvertProposalModal.set(false)" class="text-zinc-400 hover:text-zinc-600">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          
          <form (ngSubmit)="submitConvertProposal()" class="space-y-4 font-sans">
            <div>
              <label class="block text-xs font-semibold text-zinc-600 uppercase mb-1">Company / Contact Name</label>
              <input [(ngModel)]="newPartner.name" name="name" type="text" placeholder="e.g. Casablanca Technologies" required class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-600 uppercase mb-1">Email</label>
              <input [(ngModel)]="newPartner.email" name="email" type="email" placeholder="e.g. contact@domain.ma" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-600 uppercase mb-1">Phone</label>
              <input [(ngModel)]="newPartner.phone" name="phone" type="text" placeholder="e.g. +212-522-XXXXXX" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-600 uppercase mb-1">City</label>
              <select [(ngModel)]="newPartner.city" name="city" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 bg-white">
                <option value="Casablanca">Casablanca</option>
                <option value="Rabat">Rabat</option>
                <option value="Marrakech">Marrakech</option>
                <option value="Tangier">Tangier</option>
                <option value="Fès">Fès</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-600 uppercase mb-1">ICE (15 digits) *</label>
              <input [(ngModel)]="newPartner.ICE" name="ICE" type="text" maxlength="15" placeholder="e.g. 123456789012345" required class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
            </div>
            <div>
              <label class="block text-xs font-semibold text-zinc-600 uppercase mb-1">Identifiant Fiscal (IF) *</label>
              <input [(ngModel)]="newPartner.IF" name="IF" type="text" placeholder="e.g. 123456" required class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
            </div>
            <div>
              <label class="block text-xs font-semibold text-zinc-600 uppercase mb-1">Registre de Commerce (RC) *</label>
              <input [(ngModel)]="newPartner.RC" name="RC" type="text" placeholder="e.g. 123456" required class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600 font-sans">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-600 uppercase mb-1">Comments / Notes</label>
              <textarea [(ngModel)]="newPartner.comments" name="comments" rows="3" placeholder="Additional details..." class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-zinc-100">
              <button type="button" (click)="showConvertProposalModal.set(false)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
              <button type="submit" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-lg shadow-zinc-300">Convert to Customer &amp; Deal</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Assign Task Modal -->
    @if (assignTaskModalOpen(); as ctx) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-zinc-950">Assign Task</h3>
            <button (click)="assignTaskModalOpen.set(null)" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="text-[20px] w-5 h-5">close</mat-icon>
            </button>
          </div>

          <div class="bg-zinc-100 border border-zinc-200 rounded-xl p-3">
            <span class="text-meta text-zinc-500 font-bold uppercase tracking-wider block mb-0.5">Related to</span>
            <span class="text-sm font-bold text-zinc-950">{{ ctx.entityTitle }}</span>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Task Title</label>
              <input [(ngModel)]="assignTaskData.title" type="text" placeholder="e.g. Follow up with client" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Description (optional)</label>
              <textarea [(ngModel)]="assignTaskData.description" rows="3" placeholder="Describe the task..." class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Assigned Team</label>
              <select [(ngModel)]="assignTaskData.assignedTeam" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
                <option value="Finance">Finance</option>
                <option value="Support">Support</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Assigned Person</label>
              <select [(ngModel)]="assignTaskData.assignedTo" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                <option value="">-- Select --</option>
                @for (user of users(); track user.name) {
                  <option [value]="user.name">{{ user.name }} ({{ user.team }})</option>
                }
              </select>
            </div>
          </div>

          <div class="flex justify-between gap-2 pt-2 border-t border-zinc-100">
            <button (click)="assignTaskModalOpen.set(null)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50 transition-colors">Cancel</button>
            <button (click)="saveAssignTask()"
              [disabled]="!assignTaskData.title.trim() || !assignTaskData.assignedTo"
              class="px-5 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-lg shadow-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              <mat-icon class="text-[16px] w-4 h-4">assignment</mat-icon>
              Create &amp; Assign Task
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Slide-Over Drawer for Proposal Details -->
    @if (selectedProposal(); as prop) {
      <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="proposal-drawer-title" role="dialog" aria-modal="true">
        <div (click)="closeProposalDrawer()" class="absolute inset-0 overflow-hidden bg-transparent"></div>
        <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-2xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right-12 duration-300">
            <div class="px-6 py-5 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center shrink-0">
              <div>
                <h2 class="text-lg font-bold text-zinc-900" id="proposal-drawer-title">{{prop.title}}</h2>
                <p class="text-xs text-zinc-500 mt-0.5">Prospect: {{getPartnerName(prop.partnerId)}} · #{{prop.id}}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="px-3 py-1 text-xs font-semibold rounded-full uppercase"
                  [class]="prop.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' : (prop.status === 'Sent' ? 'bg-sky-50 text-sky-700' : 'bg-zinc-100 text-zinc-800')">
                  {{prop.status}}
                </span>
                <button (click)="closeProposalDrawer()" class="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <div class="bg-zinc-50 rounded-xl p-4 border border-zinc-100 space-y-3">
                <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block">Lines & Pricing</span>
                @for (line of prop.lines; track $index) {
                  <div class="flex justify-between text-xs text-zinc-700">
                    <span>{{line.qty}}x {{line.product}}</span>
                    <span class="font-sans">{{formatCurrency(line.total)}}</span>
                  </div>
                }
                <div class="flex justify-between border-t border-zinc-200 pt-1.5 text-xs font-bold text-zinc-900 font-sans">
                  <span>Total Amount</span>
                  <span>{{formatCurrency(prop.amount)}}</span>
                </div>
              </div>

              <div class="border-t border-zinc-100 pt-3">
                <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block mb-2">Sales Intelligence</span>
                <div class="grid grid-cols-2 gap-3 bg-white border border-zinc-200 p-3 rounded-xl border border-zinc-150/60 text-xs">
                  <div>
                    <span class="text-zinc-400 block text-meta font-medium">Opportunity Value</span>
                    <span class="font-bold text-zinc-900 font-sans">{{ formatCurrency(prop.opportunityValue || 0) }}</span>
                  </div>
                  <div>
                    <span class="text-zinc-400 block text-meta font-medium">Probability</span>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <div class="w-full bg-zinc-200 rounded-full h-1.5 max-w-[60px]">
                        <div class="bg-zinc-900 h-1.5 rounded-full" [style.width.%]="prop.closingProbability || 0"></div>
                      </div>
                      <span class="font-bold text-zinc-900 font-sans">{{ prop.closingProbability || 0 }}%</span>
                    </div>
                  </div>
                  <div>
                    <span class="text-zinc-400 block text-meta font-medium">Expected Close</span>
                    <span class="font-semibold text-zinc-700 font-sans">{{ prop.expectedClosingDate || 'TBD' }}</span>
                  </div>
                  <div>
                    <span class="text-zinc-400 block text-meta font-medium">Stage</span>
                    <span class="inline-block px-2 py-0.5 text-meta font-bold rounded border uppercase mt-0.5" [class]="getStageBadgeClass(prop.stage)">
                      {{ prop.stage || 'New Lead' }}
                    </span>
                  </div>
                  @if (prop.competitors && prop.competitors.length > 0) {
                    <div class="col-span-2">
                      <span class="text-zinc-400 block text-meta font-medium">Competitors</span>
                      <div class="flex flex-wrap gap-1 mt-1">
                        @for (comp of prop.competitors; track comp) {
                          <span class="bg-zinc-100 text-zinc-600 border border-zinc-200 px-1.5 py-0.5 rounded text-meta font-medium">{{comp}}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>

              @if (prop.status === 'Confirmed' && prop.confirmationMethod) {
                <div class="border-t border-zinc-100 pt-3">
                  <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Confirmation Proof</span>
                  <div class="bg-zinc-100/40 border border-zinc-200 rounded-xl p-3 text-xs text-zinc-950 space-y-2">
                    <div class="flex items-center gap-1.5 font-semibold text-zinc-950 text-meta">
                      @if (prop.confirmationMethod === 'Email') {
                        <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">email</mat-icon>
                        <span>Email confirmation</span>
                      } @else if (prop.confirmationMethod === 'WhatsApp') {
                        <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">chat</mat-icon>
                        <span>WhatsApp screenshot</span>
                      } @else {
                        <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">phone</mat-icon>
                        <span>Call Summary</span>
                      }
                      @if (prop.confirmedAt) {
                        <span class="text-meta text-zinc-900 font-normal ml-auto font-sans">{{ prop.confirmedAt }}</span>
                      }
                    </div>
                    @if (prop.confirmationAttachmentName) {
                      <div class="flex items-center gap-1.5 bg-white border border-zinc-300/60 p-2 rounded-lg text-zinc-950 font-sans text-meta truncate">
                        <mat-icon class="text-[14px] w-3.5 h-3.5 text-zinc-900">attach_file</mat-icon>
                        <span class="truncate flex-1">{{ prop.confirmationAttachmentName }}</span>
                        @if (prop.confirmationAttachmentData) {
                          <a [href]="prop.confirmationAttachmentData" [download]="prop.confirmationAttachmentName"
                             class="text-blue-700 hover:underline font-sans font-semibold ml-1 shrink-0">Download</a>
                        }
                      </div>
                    }
                    @if (prop.confirmationNote) {
                      <p class="text-meta text-zinc-650 leading-relaxed bg-white border border-emerald-150 p-2 rounded-lg italic">
                        "{{ prop.confirmationNote }}"
                      </p>
                    }
                  </div>
                </div>
              }

              <div class="border-t border-zinc-100 pt-3">
                <app-attachments ownerEntityType="PROPOSAL" [ownerEntityId]="prop.id" [canWrite]="canWriteProposal()" />
              </div>

              <div class="border-t border-zinc-100 pt-3 text-xs text-zinc-500 space-y-1">
                <app-created-by-badge [createdBy]="prop.createdBy" [createdAt]="prop.createdAt" />
              </div>
            </div>

            <div class="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex justify-between items-center shrink-0">
              <span class="text-xs text-zinc-500">{{ prop.lines.length }} line item(s)</span>
              <div class="flex gap-2">
                <button (click)="openEditProposalModal(prop); closeProposalDrawer()" class="bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-100 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                  <mat-icon class="text-[16px] w-4 h-4">edit</mat-icon> Edit
                </button>
                @if (canDeleteProposal()) {
                  <button (click)="openProposalDeleteModal(prop)" class="bg-white border border-zinc-300 text-zinc-700 hover:bg-red-50 hover:text-red-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    <mat-icon class="text-[16px] w-4 h-4">delete</mat-icon> Delete
                  </button>
                }
                @if (prop.status === 'Draft') {
                  <button (click)="openSendProposalModal(prop); closeProposalDrawer()" class="bg-zinc-900 hover:bg-zinc-950 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                    Send to Prospect
                  </button>
                } @else if (prop.status === 'Sent') {
                  <button (click)="openConfirmProposalModal(prop); closeProposalDrawer()" class="bg-zinc-900 hover:bg-zinc-950 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    <mat-icon class="text-[16px] w-4 h-4">task_alt</mat-icon> Confirm
                  </button>
                } @else {
                  <button (click)="openConvertProposalModal(prop); closeProposalDrawer()" class="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                    <mat-icon class="text-[16px] w-4 h-4">swap_horiz</mat-icon> Convert to Deal
                  </button>
                }
                <button (click)="closeProposalDrawer()" class="bg-white border border-zinc-300 text-zinc-700 px-4 py-1.5 rounded-lg text-xs font-semibold">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Slide-Over Drawer for PO Details -->
    @if (selectedPO(); as po) {
      <div class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="po-drawer-title" role="dialog" aria-modal="true">
        <div (click)="closePODrawer()" class="absolute inset-0 overflow-hidden bg-transparent"></div>
        <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-2xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right-12 duration-300">
            <div class="px-6 py-5 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center shrink-0">
              <div>
                <h2 class="text-lg font-bold text-zinc-900" id="po-drawer-title">PO #{{po.id}}</h2>
                <p class="text-xs text-zinc-500 mt-0.5">Vendor: {{getPartnerName(po.vendorId)}} · Deal: {{getDealTitle(po.dealId)}}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="px-3 py-1 text-xs font-bold uppercase rounded-full"
                  [class]="po.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : (po.status === 'Sent' ? 'bg-sky-50 text-sky-700' : 'bg-zinc-100 text-zinc-800')">
                  {{po.status}}
                </span>
                <button (click)="closePODrawer()" class="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-xs">
                <div>
                  <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block mb-1">PO Reference</span>
                  <span class="font-sans text-zinc-900 font-bold text-sm">#{{po.id}}</span>
                </div>
                <div>
                  <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block mb-1">Delivery Date</span>
                  <span class="text-zinc-900 font-sans">{{po.deliveryDate || 'Pending Conf.'}}</span>
                </div>
                <div>
                  <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block mb-1">Sent Via</span>
                  <span class="text-zinc-900">{{po.sentVia || 'N/A'}}</span>
                </div>
                <div>
                  <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block mb-1">Total Amount</span>
                  <span class="font-sans text-zinc-900 font-bold">{{formatCurrency(po.amount)}}</span>
                </div>
              </div>

              <div>
                <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block mb-2">Order Lines</span>
                <div class="border border-zinc-200 rounded-xl overflow-x-auto">
                  <table class="min-w-full divide-y divide-slate-200">
                    <thead class="bg-zinc-50">
                      <tr>
                        <th class="px-3 py-2 text-left text-meta font-semibold text-zinc-500 uppercase">Item</th>
                        <th class="px-3 py-2 text-right text-meta font-semibold text-zinc-500 uppercase">Qty</th>
                        <th class="px-3 py-2 text-right text-meta font-semibold text-zinc-500 uppercase">Unit Cost</th>
                        <th class="px-3 py-2 text-right text-meta font-semibold text-zinc-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-slate-100">
                      @for (line of po.lines; track $index) {
                        <tr class="hover:bg-zinc-50/50">
                          <td class="px-3 py-2 text-xs text-zinc-900 font-medium">{{line.product}}{{line.description ? ' - ' + line.description : ''}}</td>
                          <td class="px-3 py-2 text-xs text-zinc-700 font-sans text-right">{{line.qty}}</td>
                          <td class="px-3 py-2 text-xs text-zinc-700 font-sans text-right">{{formatCurrency(line.cost)}}</td>
                          <td class="px-3 py-2 text-xs text-zinc-900 font-sans font-bold text-right">{{formatCurrency(line.qty * line.cost)}}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="border-t border-zinc-100 pt-3 text-xs text-zinc-500 space-y-1">
                <app-created-by-badge [createdBy]="po.createdBy" [createdAt]="po.createdAt" />
              </div>
            </div>

            <div class="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex justify-between items-center shrink-0">
              <span class="text-xs text-zinc-500">{{ po.lines.length }} item(s)</span>
              <div class="flex gap-2">
                @if (canCreateTask()) {
                  <button (click)="openAssignTaskModal('po', po.id, 'PO #' + po.id); closePODrawer()" class="bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-100 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    <mat-icon class="text-[16px] w-4 h-4">assignment</mat-icon> Assign Task
                  </button>
                }
                @if (po.status === 'Sent' && canWritePO()) {
                  <button (click)="openSetDeliveryDatePOModal(po); closePODrawer()" class="bg-white border border-zinc-200 text-zinc-700 px-3 py-1.5 rounded-lg hover:bg-zinc-50 text-xs font-semibold">Set Del. Date</button>
                  <button (click)="purchaseOrdersService.updateStatus(po.id, 'Delivered'); closePODrawer()" class="bg-zinc-900 hover:bg-zinc-950 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg shadow-zinc-300">Receive Goods</button>
                }
                @if (currentUserPermissions().canDeleteRecords) {
                  <button (click)="deletePurchaseOrder(po)" title="Delete purchase order" class="bg-zinc-50 hover:bg-red-50 hover:text-red-600 border border-zinc-200 hover:border-red-200 text-zinc-500 px-2 py-1.5 rounded-lg transition-colors">
                    <mat-icon class="text-[16px] w-4 h-4">delete</mat-icon>
                  </button>
                }
                <button (click)="closePODrawer()" class="bg-white border border-zinc-300 text-zinc-700 px-4 py-1.5 rounded-lg text-xs font-semibold">Close</button>
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
        <div (click)="closeDealDrawer()" class="absolute inset-0 overflow-hidden bg-transparent"></div>
        
        <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div class="w-screen max-w-3xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right-12 duration-300">
            <!-- Header -->
            <div class="px-6 py-5 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center shrink-0">
              <div>
                <h2 class="text-lg font-bold text-zinc-900" id="deal-drawer-title">{{deal.title}}</h2>
                <p class="text-xs text-zinc-500 mt-0.5">Client: {{getPartnerName(deal.partnerId)}}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="px-3 py-1 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-950 border border-zinc-200">
                  {{deal.stage}}
                </span>
                <a [routerLink]="['/sales/deals', deal.id]" (click)="closeDealDrawer()" class="text-zinc-900 hover:text-zinc-950 text-xs font-semibold flex items-center gap-1 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                  <mat-icon class="text-sm w-4 h-4">open_in_new</mat-icon> Open page
                </a>
                <button (click)="closeDealDrawer()" class="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <!-- General Info & Amounts -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pb-4 border-b border-white/30">
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
                  <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">Comments / Notes</span>
                  <p class="text-xs text-zinc-600 mt-1">{{deal.comments || 'No comments.'}}</p>
                </div>

                <div>
                  <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">Attached Proposal</span>
                  <div class="text-xs text-zinc-600 mt-1">
                    #{{deal.proposalId || 'N/A'}} - {{ getProposalTitle(deal.proposalId) }}
                  </div>
                </div>
              </div>

              <!-- Identification & Dates -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-xs">
                <div class="space-y-2">
                  <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-200/60 pb-1">1. Identification & Dates</span>
                  <div class="grid grid-cols-2 gap-y-1.5 text-zinc-600 font-sans">
                    <span class="font-medium">Order Number:</span> <span class="font-sans text-zinc-900 font-semibold">{{ deal.orderNumber || 'N/A' }}</span>
                    <span class="font-medium">Deal Number:</span> <span class="font-sans text-zinc-900 font-semibold">{{ deal.dealNumber || 'N/A' }}</span>
                    <span class="font-medium">Order Date:</span> <span class="text-zinc-900 font-sans">{{ deal.orderDate || 'N/A' }}</span>
                    <span class="font-medium">Req. Delivery:</span> <span class="text-zinc-900 font-sans">{{ deal.requestedDeliveryDate || 'N/A' }}</span>
                    <span class="font-medium">Order Status:</span> 
                    <span>
                      <span class="px-1.5 py-0.5 rounded text-meta font-semibold bg-zinc-100 text-zinc-950 border border-zinc-200">
                        {{ deal.orderStatus || 'N/A' }}
                      </span>
                    </span>
                  </div>
                </div>

                <!-- Customer & Delivery -->
                <div class="space-y-2">
                  <span class="text-meta font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-200/60 pb-1">2. Customer & Delivery</span>
                  <div class="grid grid-cols-3 gap-y-1.5 text-zinc-600 font-sans">
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
                  <div class="grid grid-cols-2 gap-y-1.5 text-zinc-600 font-sans">
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
                  <div class="grid grid-cols-2 gap-y-1.5 text-zinc-600 font-sans">
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
              <div class="border-t border-zinc-200 pt-4">
                <h5 class="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-sans">
                  <mat-icon class="text-[16px] w-4 h-4 text-zinc-900 flex items-center justify-center">forum</mat-icon> Deal Activity Hub
                </h5>
                
                <!-- Tabs Header -->
                <div class="flex flex-wrap gap-1 border-b border-zinc-200 mb-4 bg-white border border-zinc-200 p-1 rounded-lg">
                  <button type="button" (click)="setDealTab(deal.id, 'calls')"
                    [class]="getDealTab(deal.id) === 'calls' ? 'bg-white text-zinc-900 shadow-xs border-zinc-200' : 'text-zinc-600 border-transparent hover:text-zinc-900 hover:bg-zinc-100'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">call</mat-icon>
                    Calls
                    <span class="bg-zinc-100 text-zinc-900 px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.calls?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'emails')"
                    [class]="getDealTab(deal.id) === 'emails' ? 'bg-white text-zinc-900 shadow-xs border-zinc-200' : 'text-zinc-600 border-transparent hover:text-zinc-900 hover:bg-zinc-100'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">email</mat-icon>
                    Emails
                    <span class="bg-zinc-100 text-zinc-900 px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.emails?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'meetings')"
                    [class]="getDealTab(deal.id) === 'meetings' ? 'bg-white text-zinc-900 shadow-xs border-zinc-200' : 'text-zinc-600 border-transparent hover:text-zinc-900 hover:bg-zinc-100'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">groups</mat-icon>
                    Meetings
                    <span class="bg-zinc-100 text-zinc-900 px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.meetings?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'recordings')"
                    [class]="getDealTab(deal.id) === 'recordings' ? 'bg-white text-zinc-900 shadow-xs border-zinc-200' : 'text-zinc-600 border-transparent hover:text-zinc-900 hover:bg-zinc-100'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">videocam</mat-icon>
                    Recordings
                    <span class="bg-zinc-100 text-zinc-900 px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.recordings?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'notes')"
                    [class]="getDealTab(deal.id) === 'notes' ? 'bg-white text-zinc-900 shadow-xs border-zinc-200' : 'text-zinc-600 border-transparent hover:text-zinc-900 hover:bg-zinc-100'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">note_alt</mat-icon>
                    Notes
                    <span class="bg-zinc-100 text-zinc-900 px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.notes?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'followups')"
                    [class]="getDealTab(deal.id) === 'followups' ? 'bg-white text-zinc-900 shadow-xs border-zinc-200' : 'text-zinc-600 border-transparent hover:text-zinc-900 hover:bg-zinc-100'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">notification_important</mat-icon>
                    Follow-ups
                    <span class="bg-zinc-100 text-zinc-900 px-1 py-0.2 rounded-full text-meta font-semibold">{{ deal.activityLog?.followUps?.length || 0 }}</span>
                  </button>
                  <button type="button" (click)="setDealTab(deal.id, 'calendar')"
                    [class]="getDealTab(deal.id) === 'calendar' ? 'bg-white text-zinc-900 shadow-xs border-zinc-200' : 'text-zinc-600 border-transparent hover:text-zinc-900 hover:bg-zinc-100'"
                    class="px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5">
                    <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none flex items-center justify-center">calendar_month</mat-icon>
                    Calendar
                  </button>
                </div>

                <!-- Active Tab Panel -->
                <div class="bg-white border border-zinc-200 border border-zinc-200/60 rounded-xl p-4 min-h-[180px]">
                  
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
                              <span [class]="call.outcome === 'Interested' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                             call.outcome === 'Follow-up' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                             'bg-zinc-100 text-zinc-600 border-zinc-200'"
                                    class="px-2 py-0.5 rounded text-meta font-semibold border">
                                {{ call.outcome }}
                              </span>
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
                                <div class="text-meta text-zinc-400 font-sans mt-0.5">
                                  From: {{ email.from }} | To: {{ email.to }}
                                </div>
                              </div>
                              <span class="text-meta font-sans text-zinc-400">{{ email.date }}</span>
                            </div>
                            <p class="text-meta text-zinc-600 leading-relaxed font-sans whitespace-pre-wrap">{{ email.body }}</p>
                          </div>
                        }
                        
                        <!-- Legacy emails text snippet fallback -->
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
                                <span [class]="meeting.type === 'teams' ? 'bg-zinc-100 text-zinc-950 border-zinc-200' : 
                                               meeting.type === 'demo' ? 'bg-zinc-100 text-zinc-950 border-zinc-200' : 
                                               'bg-zinc-50 text-zinc-700 border-zinc-200'"
                                      class="px-1.5 py-0.2 rounded text-meta font-semibold border uppercase">
                                  {{ meeting.type }}
                                </span>
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
                        <span class="text-meta font-semibold text-zinc-500 uppercase tracking-wider font-sans">Upcoming Alerts & Action Reminders</span>
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

                        <!-- Calendar Grid -->
                        <div class="bg-white border border-zinc-200 rounded-xl p-2.5 shadow-xs">
                          <div class="grid grid-cols-7 gap-1 text-center font-bold text-meta text-zinc-400 mb-1 border-b border-zinc-50 pb-1">
                            @for (h of calendarHeaders; track h) {
                              <div>{{ h }}</div>
                            }
                          </div>
                          <div class="grid grid-cols-7 gap-1.5">
                            @for (day of calendarDays; track day) {
                              <button type="button" (click)="selectCalendarDay(deal.id, day)"
                                      [class]="isSelectedCalendarDay(deal.id, day) ? 'bg-zinc-900 text-white font-bold' : 
                                               hasEventsOnDay(deal, day) ? 'bg-zinc-100 text-zinc-950 font-bold border-zinc-300' : 
                                               'bg-zinc-50 text-zinc-700 hover:bg-zinc-100 border-zinc-105 border-zinc-100'"
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

                      <!-- Selected Day Details -->
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
                                <div class="text-meta text-zinc-500 uppercase tracking-wider mb-1 font-sans">
                                  Type: {{ m.type }} | Location: {{ m.location }}
                                </div>
                                <p class="text-meta text-zinc-600 line-clamp-2 leading-relaxed font-sans">{{ m.summary }}</p>
                              </div>
                            } @empty {
                              <div class="text-center py-8 text-zinc-400 text-meta bg-white border border-zinc-150 rounded-xl font-sans">
                                No meetings scheduled on this day.
                              </div>
                            }
                          </div>
                        </div>

                        <div class="text-meta badge text-zinc-500 rounded-lg p-2.5 border border-zinc-150 mt-4 leading-relaxed font-sans">
                          💡 <strong>Tip:</strong> Meetings logged in the <strong>Meetings</strong> tab automatically populate this calendar view.
                        </div>
                      </div>
                    </div>
                  }

                </div>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex justify-between items-center shrink-0 font-sans">
              <div class="flex items-center gap-2">
                <span class="text-xs text-zinc-500">Lines: {{ deal.orderLines?.length || 0 }} items</span>
              </div>
              <div class="flex gap-2">
                <!-- Create PO trigger if none exists for this deal -->
                @if (!hasPOForDeal(deal.id) && canCreatePO()) {
                  <button (click)="openCreatePOModal(deal)" class="bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-950 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center">
                    <mat-icon class="mr-1 text-[16px] w-4 h-4">add_shopping_cart</mat-icon> Create PO (Operations)
                  </button>
                }
                @if (canCreateTask()) {
                  <button (click)="openAssignTaskModal('deal', deal.id, deal.title)" class="bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-100 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    <mat-icon class="text-[16px] w-4 h-4">assignment</mat-icon> Assign Task
                  </button>
                }
                @if (deal.stage === 'New' && canWriteDeal()) {
                  <button (click)="dealsService.updateDealStage(deal.id, 'Confirmed')" class="bg-zinc-900 hover:bg-zinc-950 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center">
                    <mat-icon class="mr-1 text-[16px] w-4 h-4">check</mat-icon> Confirm Deal
                  </button>
                }
                <button (click)="closeDealDrawer()" class="bg-white border border-zinc-300 text-zinc-700 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Delete Proposal Confirmation Modal -->
    @if (proposalDeleteModalOpen() && proposalToDelete()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold text-zinc-950">Delete Proposal</h3>
            <button (click)="cancelProposalDelete()" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-zinc-600 leading-relaxed">
            Are you sure you want to delete this proposal?
          </p>
          <div class="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <div class="text-sm font-semibold text-zinc-900">{{ proposalToDelete()?.title }}</div>
            @if (proposalToDelete()?.id) {
              <div class="text-meta text-zinc-400 font-mono mt-0.5">#{{ proposalToDelete()?.id }}</div>
            }
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-white/30">
            <button (click)="cancelProposalDelete()" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">
              Cancel
            </button>
            <button (click)="confirmProposalDelete()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5">
              <mat-icon class="w-4 h-4 text-[16px]! leading-none!">delete</mat-icon>
              Delete
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SalesComponent {
  dealsService = inject(DealsService);
  proposalsService = inject(ProposalsService);
  purchaseOrdersService = inject(PurchaseOrdersService);
  private partnersService = inject(PartnersService);
  private tasksService = inject(TasksService);
  state = inject(CrmStateService);
  private router = inject(Router);
  translation = inject(TranslationService);

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
    this.selectedDealIds().forEach(id => this.dealsService.updateDeal(id, { salesPerson: owner }));
    (event.target as HTMLSelectElement).value = '';
  }
  bulkChangeDealStage(event: Event) {
    const stage = (event.target as HTMLSelectElement).value as Deal['stage'];
    if (!stage) return;
    this.selectedDealIds().forEach(id => this.dealsService.updateDeal(id, { stage }));
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
    assignedTeam: 'Sales' as 'Sales' | 'Operations' | 'Finance' | 'Support',
    assignedTo: ''
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
    salesPerson: '',
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

  deletePurchaseOrder(po: PurchaseOrder) {
    if (confirm(`Delete purchase order "#${po.id}"? This cannot be undone.`)) {
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

  formatCurrency(value: number) {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(value);
  }

  getStatusColor(status: string) {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'In Progress': return 'bg-sky-50 text-sky-700 border border-sky-200';
      default: return 'bg-zinc-100 text-zinc-800 border border-zinc-200';
    }
  }

  getStageBadgeClass(stage?: string) {
    switch (stage) {
      case 'New Lead':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Qualified':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Meeting Scheduled':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Proposal Sent':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'Negotiation':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Won / Lost':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-zinc-50 text-zinc-600 border-zinc-100';
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
    const defaultCust = this.partnersService.customers()[0]?.id || '';
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

      salesPerson: this.users().find(u => u.team === 'Sales')?.name || 'Youssef El Alami',
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
      assignedTeam: 'Sales',
      assignedTo: ''
    };
    this.assignTaskModalOpen.set({ entityType, entityId, entityTitle });
  }

  saveAssignTask() {
    if (!this.canCreateTask()) return;
    const ctx = this.assignTaskModalOpen();
    if (!ctx || !this.assignTaskData.title.trim() || !this.assignTaskData.assignedTo) return;

    const moduleMap: Record<string, string> = { deal: 'Sales', proposal: 'Sales', po: 'Sales' };
    const subModuleMap: Record<string, string> = { deal: 'Deal', proposal: 'Proposal', po: 'PurchaseOrder' };
    this.tasksService.addTask({
      title: this.assignTaskData.title.trim(),
      description: this.assignTaskData.description.trim() || undefined,
      assignedTeam: this.assignTaskData.assignedTeam,
      assignedTo: this.assignTaskData.assignedTo,
      status: 'Pending',
      relatedTo: ctx.entityTitle,
      relatedModule: moduleMap[ctx.entityType] as Task['relatedModule'],
      relatedSubModule: subModuleMap[ctx.entityType],
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
      salesPerson: this.newDeal.salesPerson,
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
        alert('Please specify a vendor name');
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
        alert('ICE must be exactly 15 digits.');
        return;
      }
      if (!this.newPartner.IF || !this.newPartner.IF.trim()) {
        alert('IF is required.');
        return;
      }
      if (!this.newPartner.RC || !this.newPartner.RC.trim()) {
        alert('RC is required.');
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
        salesPerson: this.users().find(u => u.team === 'Sales')?.name || '',
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
