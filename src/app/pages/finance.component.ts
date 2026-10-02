import { Component, inject, signal, computed, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrmStateService, Invoice } from '../services/crm-state.service';
import { InvoicesService } from '../services/domains/invoices.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { DataStatusBannerComponent } from '../shared/data-status-banner.component';
import { PaginatorComponent } from '../shared/paginator.component';
import { AttachmentsComponent } from '../shared/attachments.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ApiService } from '../services/api.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { StatCardComponent } from '../shared/ui/stat-card.component';
import { ConfirmService } from '../shared/ui/confirm.service';

// ── Local type alias for invoice line items ────────────────────────────────
interface InvoiceLine {
  item: string;
  description?: string;
  qty: number;
  unitPrice: number;
  type: 'software' | 'hardware' | 'service';
}

@Component({
  selector: 'app-finance',
  imports: [MatIconModule, MatTooltipModule, CommonModule, FormsModule, CreatedByBadgeComponent, DataStatusBannerComponent, PaginatorComponent, AttachmentsComponent, TranslatePipe, PageHeaderComponent, EmptyStateComponent, StatCardComponent],
  template: `
    <div class="page">
      <app-page-header title="Finance" subtitle="Invoices, payables and late-payment recovery">
        @if (canCreate() && activeTab() !== 'Recovery') {
          <button actions class="btn-primary" (click)="openCreateInvoiceModal()">
            <mat-icon>add</mat-icon>
            New Invoice
          </button>
        }
      </app-page-header>

      @if (activeTab() !== 'Recovery') {
        <div class="stat-grid">
          <app-stat-card label="Outstanding" [value]="money0(outstandingTotal())" icon="account_balance_wallet" tone="slate"
                         [hint]="unpaidCount() + ' unpaid invoice' + (unpaidCount() === 1 ? '' : 's')" />
          <app-stat-card label="Overdue" [value]="money0(overdueTotal())" icon="running_with_errors" tone="rose"
                         [hint]="overdueCount() + ' overdue invoice' + (overdueCount() === 1 ? '' : 's')" />
          <app-stat-card label="Paid" [value]="money0(paidTotal())" icon="task_alt" tone="emerald"
                         [hint]="paidCount() + ' paid invoice' + (paidCount() === 1 ? '' : 's')" />
        </div>
      }

      <div class="tabs" role="tablist">
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'Customer'" [attr.aria-selected]="activeTab() === 'Customer'"
                (click)="setFinanceTab('Customer'); invoicesPage.set(1)">
          <mat-icon>receipt</mat-icon>
          {{ 'finance.customer' | translate }}
          <span class="count-pill">{{ customerInvoices().length }}</span>
        </button>
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'Vendor'" [attr.aria-selected]="activeTab() === 'Vendor'"
                (click)="setFinanceTab('Vendor'); invoicesPage.set(1)">
          <mat-icon>receipt_long</mat-icon>
          {{ 'finance.vendor' | translate }}
          <span class="count-pill">{{ vendorInvoices().length }}</span>
        </button>
        <button role="tab" class="tab" [class.is-active]="activeTab() === 'Recovery'" [attr.aria-selected]="activeTab() === 'Recovery'"
                (click)="setFinanceTab('Recovery')">
          <mat-icon>healing</mat-icon>
          {{ 'finance.recovery' | translate }}
          @if (overdueInvoices().length > 0) {
            <span class="count-pill">{{ overdueInvoices().length }}</span>
          }
        </button>
      </div>

        <!-- Invoices View -->
        @if (activeTab() !== 'Recovery') {
          <div class="card overflow-x-auto">
          @if (invoicesService.isLoading$()) {
            <app-data-status-banner [loading]="true" [variant]="'rows'" [columns]="7" [rows]="8" />
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">Invoice Ref</th>
                  <th scope="col">Partner</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Created By</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (invoice of paginatedInvoices(); track invoice.id) {
                  <tr>
                    <td class="whitespace-nowrap text-ink">
                      #{{ invoice.id.slice(0, 8) }}
                    </td>
                    <td class="whitespace-nowrap">
                      <div class="text-sm font-medium text-ink">{{getPartnerName(invoice.partnerId)}}</div>
                      <div class="text-xs text-ink-3">{{ getPartnerCity(invoice.partnerId) }}</div>
                    </td>
                    <td class="whitespace-nowrap">
                      <div class="text-sm text-ink font-semibold">{{formatCurrency(invoice.amount)}}</div>
                    </td>
                    <td class="whitespace-nowrap">
                      <div class="text-sm text-ink-3">{{invoice.dueDate}}</div>
                    </td>
                    <td class="whitespace-nowrap">
                      <app-created-by-badge [createdBy]="invoice.createdBy" [createdAt]="invoice.createdAt" />
                    </td>
                    <td class="whitespace-nowrap">
                      <span [class]="getStatusColor(invoice.status)" class="badge">
                        {{invoice.status}}
                      </span>
                    </td>
                    <td class="col-actions">
                      <div class="inline-flex items-center gap-1">
                      <button (click)="downloadPdf(invoice)" title="Download PDF" aria-label="Download PDF" class="btn-icon btn-sm">
                        <mat-icon class="icon-sm">picture_as_pdf</mat-icon>
                      </button>
                      <button (click)="openInvoiceAttachments(invoice)" title="Attachments" aria-label="Attachments" class="btn-icon btn-sm">
                        <mat-icon class="icon-sm">attach_file</mat-icon>
                      </button>
                      @if (invoice.status !== 'Paid' && canWrite()) {
                        <button (click)="markInvoicePaid(invoice)" class="btn-secondary btn-sm">Mark Paid</button>
                      }
                      @if (state.currentUserPermissions().canDeleteRecords) {
                        <button (click)="deleteInvoice(invoice)" title="Delete invoice" aria-label="Delete invoice" class="btn-icon btn-sm btn-danger-hover">
                          <mat-icon class="icon-sm">delete</mat-icon>
                        </button>
                      }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                <td colspan="7" class="row-empty">
                  <app-empty-state icon="receipt_long" [title]="'No invoices yet'" [text]="canCreate() ? 'Create an invoice to start tracking payments.' : 'Invoices will appear here once created.'" />
                </td>
              </tr>
                }
              </tbody>
            </table>

            <!-- Invoice Attachments Modal -->
            @if (attachmentsInvoice(); as invoiceForAttachments) {
              <div class="modal-backdrop">
                <div class="modal modal-md">
                  <div class="flex justify-between items-center">
                    <h3 class="modal-title">Invoice #{{ invoiceForAttachments.id.slice(0, 8) }}</h3>
                    <button (click)="attachmentsInvoice.set(null)" class="btn-icon btn-sm">
                      <mat-icon class="icon-sm">close</mat-icon>
                    </button>
                  </div>
                  <app-attachments ownerEntityType="INVOICE" [ownerEntityId]="invoiceForAttachments.id" [canWrite]="canWrite()" />
                </div>
              </div>
            }
            @if (filteredInvoices().length > 0) {
              <app-paginator
                [currentPage]="invoicesPage()"
                [totalPages]="invoicesTotalPages()"
                [pageSize]="invoicesPageSize()"
                (pageChange)="invoicesPage.set($event)"
                (pageSizeChange)="invoicesPageSize.set($event)" />
            }
          }
          </div>
        }
        @if (invoicesService.error$()) {
          <app-data-status-banner [error]="invoicesService.error$()" />
        }

        <!-- Recovery View (Late Payers Reminders) -->
        @if (activeTab() === 'Recovery') {
          <div class="space-y-6">
            <div class="alert alert-warning">
              <mat-icon>warning</mat-icon>
              <div>
                <div class="font-semibold">Late Payment Recovery / استخلاص الديون</div>
                <div class="text-xs mt-0.5">Select overdue customers, choose a channel, and send a reminder.</div>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- Left 2 columns: Checkbox selection of late payers -->
              <div class="lg:col-span-2 space-y-3">
                <span class="eyebrow block">Overdue Invoices</span>
                @for (invoice of overdueInvoices(); track invoice.id) {
                  <div class="card p-4 flex items-center justify-between transition-all"
                    [class.is-selected]="selectedInvoiceIds().includes(invoice.id)">
                    <div class="flex items-center gap-3">
                      <input type="checkbox"
            [checked]="selectedInvoiceIds().includes(invoice.id)"
            (change)="toggleInvoiceSelect(invoice.id)">
                      <div>
                        <h4 class="font-semibold text-ink">{{getPartnerName(invoice.partnerId)}}</h4>
                        <p class="text-xs text-ink-3 mt-0.5">City: {{getPartnerCity(invoice.partnerId)}} &bull; Phone: {{getPartnerPhone(invoice.partnerId)}}</p>
                        <p class="text-xs text-ink-2 flex items-center gap-2 mt-1.5">
                          <span class="font-semibold text-ink">{{formatCurrency(invoice.amount)}}</span>
                          <span>&bull;</span>
                          <span class="text-ink font-semibold">Due Date: {{invoice.dueDate}}</span>
                        </p>
                      </div>
                    </div>
                    <span class="badge badge-danger">Overdue</span>
                  </div>
                } @empty {
                  <div class="card">
                    <app-empty-state icon="verified" title="No overdue invoices" text="Excellent collection rates — nothing to chase right now." />
                  </div>
                }
              </div>

              <!-- Right 1 column: Outbound campaign config -->
              <div class="card p-5 space-y-4 self-start">
                <h3 class="card-title pb-3 border-b flex items-center gap-1.5">
                  <mat-icon class="text-ink">send_time_extension</mat-icon> Outbound Reminder
                </h3>

                <div class="space-y-3">
                  <div>
                    <label for="select_channel" class="field-label mb-1.5">Select Channel</label>
                    <div class="grid grid-cols-3 gap-2">
                      <button type="button" (click)="reminderChannel.set('WhatsApp')"
                        [class.is-selected]="reminderChannel() === 'WhatsApp'" class="option-card">
                        <mat-icon class="icon-md">chat</mat-icon>
                        WhatsApp
                      </button>
                      <button type="button" (click)="reminderChannel.set('SMS')"
                        [class.is-selected]="reminderChannel() === 'SMS'" class="option-card">
                        <mat-icon class="icon-md">sms</mat-icon>
                        SMS
                      </button>
                      <button type="button" (click)="reminderChannel.set('Email')"
                        [class.is-selected]="reminderChannel() === 'Email'" class="option-card">
                        <mat-icon class="icon-md">email</mat-icon>
                        Email
                      </button>
                    </div>
                  </div>

                  <div>
                    <label for="template_language" class="field-label mb-1.5">Template Language</label>
                    <select id="template_language" [(ngModel)]="reminderLanguage" (change)="updateReminderTemplate()" class="input-field w-full">
                      <option value="ar">Moroccan Darija / العربية</option>
                      <option value="fr">French / Français</option>
                    </select>
                  </div>

                  <div>
                    <label for="message_preview" class="field-label mb-1.5">Message Preview</label>
                    <textarea id="message_preview" [(ngModel)]="reminderMessage" rows="5" class="input-field w-full"></textarea>
                  </div>

                  @if (successMessage()) {
                    <div class="alert alert-success" role="status">
                      <mat-icon>check_circle</mat-icon>
                      <span>{{successMessage()}}</span>
                    </div>
                  }

                  @if (errorMessage()) {
                    <div class="alert alert-danger" role="alert">
                      <mat-icon>error</mat-icon>
                      <span>{{errorMessage()}}</span>
                    </div>
                  }

                  <button (click)="sendReminders()" [disabled]="selectedInvoiceIds().length === 0" class="btn-primary btn-block">
                    <mat-icon>send</mat-icon>
                    Send Reminders ({{selectedInvoiceIds().length}} selected)
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         CREATE INVOICE MODAL
         ═══════════════════════════════════════════════════════════════════════ -->
    @if (invoiceModalOpen()) {
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events,@angular-eslint/template/interactive-supports-focus -->
      <div class="modal-backdrop" (click)="onBackdropClick($event)">
        <div class="modal modal-xl modal-flush">

          <!-- ── Sticky Modal Header ──────────────────────────────────────── -->
          <div class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-line-soft shrink-0">
            <div class="flex items-center gap-3">
              <div class="icon-chip icon-chip-lg">
                <mat-icon class="icon-md">
                  {{ invoiceType() === 'Deal' ? 'handshake' : 'edit_note' }}
                </mat-icon>
              </div>
              <div>
                <h3 class="card-title leading-tight flex items-center gap-1.5 cursor-help w-fit" matTooltip="Only verified customers are eligible for invoicing" matTooltipPosition="above">
                  Create New Invoice
                  <mat-icon class="text-ink-4 icon-xs">info</mat-icon>
                </h3>
              </div>
            </div>
            <button (click)="invoiceModalOpen.set(false)" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>

          <!-- ── Scrollable Body ─────────────────────────────────────────── -->
          <div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">

            <!-- ① Invoice Modality Toggle -->
            <div>
              <label for="invoice_pathway" class="field-label mb-1.5">Invoice Pathway</label>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" id="invoice-type-manual"
                  (click)="setInvoiceType('Manual')"
                  [class.is-selected]="invoiceType() === 'Manual'"
                  class="option-card option-card--row">
                  <mat-icon class="shrink-0 icon-lg">edit_note</mat-icon>
                  <span class="text-left">
                    <span class="block">Manual Invoice</span>
                    <span class="text-xs font-normal text-ink-3">Free-form, no deal link</span>
                  </span>
                </button>
                <button type="button" id="invoice-type-deal"
                  (click)="setInvoiceType('Deal')"
                  [class.is-selected]="invoiceType() === 'Deal'"
                  class="option-card option-card--row">
                  <mat-icon class="shrink-0 icon-lg">handshake</mat-icon>
                  <span class="text-left">
                    <span class="block">Deal Invoice</span>
                    <span class="text-xs font-normal text-ink-3">Inherits lines from deal</span>
                  </span>
                </button>
              </div>
            </div>

            <!-- ② Deal Selection Block (Deal pathway only) -->
            @if (invoiceType() === 'Deal') {
              <div class="bg-subtle border border-line rounded-xl p-4 space-y-3">
                <div class="flex items-center gap-2">
                  <mat-icon class="text-ink-2 icon-md">link</mat-icon>
                  <span class="eyebrow">Deal Association</span>
                  <span class="badge badge-neutral ml-auto">Lines auto-inherited</span>
                </div>
                <div>
                  <label for="deal-select" class="field-label mb-1.5">
                    Deal Number <span class="text-ink-2">*</span>
                  </label>
                  <select id="deal-select"
                    [(ngModel)]="newInvoiceData.dealId"
                    (ngModelChange)="onDealSelected($event)"
                    required
                    class="input-field w-full">
                    <option value="">— Select a Deal —</option>
                    @for (deal of state.deals(); track deal.id) {
                      <option [value]="deal.id">{{ deal.dealNumber || deal.id }} · {{ deal.title }}</option>
                    }
                  </select>
                  @if (!newInvoiceData.dealId) {
                    <p class="field-error mt-1 flex items-center gap-1">
                      <mat-icon class="icon-xs">error_outline</mat-icon>
                      A Deal selection is required to proceed.
                    </p>
                  }
                </div>
              </div>
            }

            <!-- ③ Two-column Admin Info -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <!-- Document Direction hidden or removed from user view as per requirements -->

              <!-- ── Customer Selector (Manual + Outbound) ──────────────────────
                   Shown prominently when type is Customer or any Manual pathway.
                   When Deal is selected, this row is locked and auto-driven.
              -->
              <div class="sm:col-span-2">
                <label for="partner-select" class="field-label mb-1.5">
                  Select Customer
                  @if (invoiceType() === 'Deal') {
                    <span class="badge badge-neutral ml-1">🔒 Locked by Deal</span>
                  }
                  @if (invoiceType() === 'Manual' && newInvoiceData.type === 'Customer') {
                    <span class="badge badge-neutral ml-1">Fields auto-fill on selection</span>
                  }
                </label>
                <select id="partner-select"
                  [(ngModel)]="newInvoiceData.partnerId"
                  (ngModelChange)="onPartnerSelected($event)"
                  [disabled]="invoiceType() === 'Deal'"
                  [class]="invoiceType() === 'Deal' ? 'bg-subtle text-ink-3 cursor-not-allowed opacity-70' : 'bg-surface focus:ring-2 focus:ring-line-strong'"
                  class="input-field w-full">
                  <option value="">— Select an existing Customer —</option>
                  @for (cust of invoiceEligibleCustomers(); track cust.id) {
                    <option [value]="cust.id">{{ cust.name }}</option>
                  }
                </select>
                @if (invoiceEligibleCustomers().length === 0) {
                  <p class="text-ink text-xs mt-1 flex items-center gap-1">
                    <mat-icon class="icon-xs">warning</mat-icon>
                    No active Customers found. Convert a Prospect first.
                  </p>
                }
                @if (invoiceType() === 'Deal') {
                  <p class="text-ink-3 text-xs mt-1 flex items-center gap-1">
                    <mat-icon class="icon-xs">lock</mat-icon>
                    Partner is auto-assigned from the selected Deal.
                  </p>
                }
                @if (invoiceType() === 'Manual' && newInvoiceData.partnerId && autoFilledFields().size > 0) {
                  <div class="mt-2 bg-muted border border-line-strong rounded-lg px-3 py-2 flex items-center gap-2">
                    <mat-icon class="text-ink-2 shrink-0 icon-sm">auto_awesome</mat-icon>
                    <span class="text-xs text-ink font-medium">Customer details auto-filled from account record. You can still edit any field below.</span>
                  </div>
                }
              </div>

              <!-- VAT Number -->
              <div>
                <label for="label_4" class="field-label mb-1.5">
                  VAT Number
                  @if (autoFilledFields().has('vatNumber')) {
                    <span class="badge badge-neutral ml-1">Auto-filled</span>
                  }
                </label>
                <input [(ngModel)]="newInvoiceData.vatNumber" type="text"
                  placeholder="e.g. MA-ICE-123456789"
                  [class]="autoFilledFields().has('vatNumber') ? 'bg-muted border-line-strong text-ink' : 'bg-surface'"
                  class="input-field w-full">
              </div>

              <!-- Customer Account -->
              <div>
                <label for="label_5" class="field-label mb-1.5">
                  Customer Account
                  @if (invoiceType() === 'Deal' || autoFilledFields().has('customerAccount')) {
                    <span class="badge badge-neutral ml-1">Auto-filled</span>
                  }
                </label>
                <input [(ngModel)]="newInvoiceData.customerAccount"
                  [readonly]="invoiceType() === 'Deal'"
                  type="text"
                  placeholder="e.g. ERP-ATLAS-01"
                  [class]="invoiceType() === 'Deal' ? 'bg-subtle text-ink-3 cursor-not-allowed' : autoFilledFields().has('customerAccount') ? 'bg-muted border-line-strong text-ink' : 'bg-surface'"
                  class="input-field w-full">
              </div>

              <!-- Customer Name -->
              <div class="sm:col-span-2">
                <label for="label_6" class="field-label mb-1.5">
                  Customer Name
                  @if (invoiceType() === 'Deal' || autoFilledFields().has('customerName')) {
                    <span class="badge badge-neutral ml-1">Auto-filled</span>
                  }
                </label>
                <input [(ngModel)]="newInvoiceData.customerName"
                  [readonly]="invoiceType() === 'Deal'"
                  type="text"
                  placeholder="Official corporate name"
                  [class]="invoiceType() === 'Deal' ? 'bg-subtle text-ink-3 cursor-not-allowed' : autoFilledFields().has('customerName') ? 'bg-muted border-line-strong text-ink' : 'bg-surface'"
                  class="input-field w-full">
              </div>

              <!-- Billing Address -->
              <div class="sm:col-span-2">
                <label for="label_7" class="field-label mb-1.5">
                  Billing Address
                  @if (invoiceType() === 'Deal' || autoFilledFields().has('billingAddress')) {
                    <span class="badge badge-neutral ml-1">Auto-filled</span>
                  }
                </label>
                <input [(ngModel)]="newInvoiceData.billingAddress"
                  [readonly]="invoiceType() === 'Deal'"
                  type="text"
                  placeholder="Registered billing / fiscal address"
                  [class]="invoiceType() === 'Deal' ? 'bg-subtle text-ink-3 cursor-not-allowed' : autoFilledFields().has('billingAddress') ? 'bg-muted border-line-strong text-ink' : 'bg-surface'"
                  class="input-field w-full">
              </div>

              <!-- Delivery Address -->
              <div class="sm:col-span-2">
                <label for="label_8" class="field-label mb-1.5">
                  Delivery Address
                  @if (invoiceType() === 'Deal' || autoFilledFields().has('deliveryAddress')) {
                    <span class="badge badge-neutral ml-1">Auto-filled</span>
                  }
                </label>
                <input [(ngModel)]="newInvoiceData.deliveryAddress"
                  [readonly]="invoiceType() === 'Deal'"
                  type="text"
                  placeholder="Full delivery location"
                  [class]="invoiceType() === 'Deal' ? 'bg-subtle text-ink-3 cursor-not-allowed' : autoFilledFields().has('deliveryAddress') ? 'bg-muted border-line-strong text-ink' : 'bg-surface'"
                  class="input-field w-full">
              </div>

              <!-- Due Date -->
              <div>
                <label for="due_date" class="field-label mb-1.5">Due Date</label>
                <input id="due_date" [(ngModel)]="newInvoiceData.dueDate" type="date"
                  class="input-field w-full">
              </div>

              <!-- Computed Total (read-only) -->
              <div>
                <label for="label_10" class="field-label mb-1.5">
                  Total Amount (MAD)
                  @if (invoiceLines().length > 0) {
                    <span class="badge badge-neutral ml-1">Computed from lines</span>
                  }
                </label>
                <input [value]="computedTotal()" readonly type="text"
                  class="input-field w-full cursor-not-allowed">
              </div>
            </div>

            <!-- ④ Line Items Section ─────────────────────────────────────── -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <mat-icon class="text-ink-4 icon-md">format_list_bulleted</mat-icon>
                  <span class="eyebrow">Line Items</span>
                  @if (invoiceType() === 'Deal' && invoiceLines().length > 0) {
                    <span class="badge badge-neutral">
                      {{ invoiceLines().length }} inherited from deal
                    </span>
                  }
                </div>
                <span class="text-xs text-ink-3">Subtotal: {{ formatCurrency(computedTotal()) }}</span>
              </div>

              <!-- Lines Table -->
              @if (invoiceLines().length > 0) {
                <div class="rounded-xl border border-line overflow-x-auto">
                  <!-- Table header -->
                  <div class="grid bg-surface border border-line border-b border-line px-3 py-2 min-w-[520px]"
                       style="grid-template-columns: 1fr 1.4fr 60px 90px 90px 32px">
                    <span class="eyebrow">Item</span>
                    <span class="eyebrow">Description</span>
                    <span class="eyebrow">Qty</span>
                    <span class="eyebrow">Unit Price</span>
                    <span class="eyebrow">Total</span>
                    <span></span>
                  </div>

                  <!-- Line rows -->
                  @for (line of invoiceLines(); track $index; let i = $index) {
                    <div class="grid items-center gap-1.5 px-3 py-2 border-b border-line-soft last:border-0 hover:bg-subtle transition-colors min-w-[520px]"
                         style="grid-template-columns: 1fr 1.4fr 60px 90px 90px 32px">
                      <!-- Item -->
                      <input [(ngModel)]="invoiceLines()[i].item"
                        (ngModelChange)="patchLine(i, 'item', $event)"
                        placeholder="Product / service"
                        class="input-field w-full">
                      <!-- Description -->
                      <input [(ngModel)]="invoiceLines()[i].description"
                        (ngModelChange)="patchLine(i, 'description', $event)"
                        placeholder="Optional detail"
                        class="input-field w-full">
                      <!-- Qty -->
                      <input [(ngModel)]="invoiceLines()[i].qty"
                        (ngModelChange)="patchLine(i, 'qty', +$event)"
                        type="number" min="1"
                        class="input-field w-full text-center">
                      <!-- Unit Price -->
                      <input [(ngModel)]="invoiceLines()[i].unitPrice"
                        (ngModelChange)="patchLine(i, 'unitPrice', +$event)"
                        type="number" min="0"
                        class="input-field w-full text-right">
                      <!-- Row Total (read-only) -->
                      <span class="text-xs font-semibold text-ink-2 text-right pr-1">
                        {{ formatCurrency(line.qty * line.unitPrice) }}
                      </span>
                      <!-- Delete -->
                      <button type="button" (click)="removeLine(i)"
                        class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted-strong text-ink-4 hover:text-ink transition-colors">
                        <mat-icon class="icon-sm">delete_outline</mat-icon>
                      </button>
                    </div>
                  }

                  <!-- Running total footer -->
                  <div class="grid px-3 py-2 bg-surface border border-line border-t border-line min-w-[520px]"
                       style="grid-template-columns: 1fr 1.4fr 60px 90px 90px 32px">
                    <span class="col-span-4 text-xs font-semibold text-ink-3 text-right pr-2">Invoice Total:</span>
                    <span class="text-xs font-semibold text-ink text-right pr-1">{{ formatCurrency(computedTotal()) }}</span>
                    <span></span>
                  </div>
                </div>
              } @else {
                <div class="rounded-xl border-2 border-dashed border-line p-6 text-center">
                  <mat-icon class="text-ink-4 mx-auto block icon-xl">receipt_long</mat-icon>
                  <p class="text-xs text-ink-3 mt-2">No line items yet.</p>
                  @if (invoiceType() === 'Deal') {
                    <p class="text-xs text-ink-2 mt-1">Select a Deal above to auto-inherit its product lines.</p>
                  }
                </div>
              }

              <!-- Add Custom Line button -->
              <button type="button"
                (click)="addBlankLine()"
                class="w-full border-2 border-dashed border-line-strong hover:border-line-strong text-ink-2 hover:text-ink rounded-xl py-2.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 hover:bg-muted">
                <mat-icon class="icon-sm">add</mat-icon>
                + Add Custom Invoice Line
              </button>
            </div>

            <!-- Validation Banner -->
            @if (formValidationError()) {
              <div class="bg-muted border border-line-strong rounded-lg p-3 text-xs text-ink flex items-start gap-1.5">
                <mat-icon class="text-ink-2 mt-0.5 shrink-0 icon-sm">error_outline</mat-icon>
                <span>{{ formValidationError() }}</span>
              </div>
            }
          </div>

          <!-- ── Sticky Footer Actions ───────────────────────────────────── -->
          <div class="px-6 py-4 border-t border-line-soft bg-surface border border-line rounded-b-2xl flex items-center justify-between gap-3 shrink-0">
            <!-- Left: Cancel -->
            <button (click)="invoiceModalOpen.set(false)"
              class="px-4 py-2 btn-secondary text-ink-2 text-sm font-semibold rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>

            <!-- Right: Save Draft + Save & Send -->
            <div class="flex items-center gap-2">
              <!-- Save as Draft -->
              <button type="button" (click)="saveInvoice('Draft')"
                class="flex items-center gap-1.5 px-4 py-2 border text-sm font-semibold rounded-lg transition-colors"
                [class]="invoiceType() === 'Deal'
                  ? 'border-line-strong text-ink hover:bg-muted'
                  : 'border-line-strong text-ink hover:bg-muted'">
                <mat-icon class="icon-sm">save</mat-icon>
                Save Draft
              </button>

              <!-- Save & Send -->
              <button type="button" (click)="saveInvoice('Pending')" class="btn-primary">
                <mat-icon>send</mat-icon>
                Save &amp; Send
              </button>
            </div>
          </div>

        </div><!-- /modal card -->
      </div><!-- /backdrop -->
    }
  `
})
export class FinanceComponent {
  private confirmDialog = inject(ConfirmService);
  state = inject(CrmStateService);
  invoicesService = inject(InvoicesService);
  translation = inject(TranslationService);
  private api = inject(ApiService);
  activeTab = signal<'Customer' | 'Vendor' | 'Recovery'>('Customer');

  setFinanceTab(tab: 'Customer' | 'Vendor' | 'Recovery'): void {
    this.activeTab.set(tab);
    const labelMap: Record<string, string> = {
      'Customer': 'finance.customerInvoices',
      'Vendor': 'finance.vendorInvoices',
      'Recovery': 'finance.recovery'
    };
    this.state.breadcrumbLabel.set(this.translation.t(labelMap[tab]));
  }

  canCreate(): boolean { return this.state.hasAuthority('INVOICES_CREATE'); }
  canWrite(): boolean { return this.state.hasAuthority('INVOICES_WRITE'); }
  canDelete(): boolean { return this.state.hasAuthority('INVOICES_DELETE'); }

  markInvoicePaid(invoice: Invoice) {
    if (!this.canWrite()) return;
    this.invoicesService.updateInvoice(invoice.id, { ...invoice, status: 'Paid' });
  }

  attachmentsInvoice = signal<Invoice | null>(null);

  openInvoiceAttachments(invoice: Invoice) {
    this.attachmentsInvoice.set(invoice);
  }

  async deleteInvoice(invoice: Invoice) {
    if (!this.canDelete()) return;
    if (await this.confirmDialog.ask({ title: 'Delete invoice?', message: `Invoice #${invoice.id.slice(0, 8)} will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete invoice', danger: true })) {
      this.invoicesService.deleteInvoice(invoice.id);
    }
  }

  downloadPdf(invoice: Invoice) {
    this.api.downloadInvoicePdf(invoice.id).subscribe({
      next: (blob) => {
        const filename = `facture-${invoice.invoiceNumber || invoice.id.substring(0, 8)}.pdf`;
        this.api.downloadBlob(blob, filename);
      },
      error: () => {
        this.errorMessage.set('Failed to download invoice PDF.');
      }
    });
  }

  invoiceModalOpen  = signal(false);
  selectedInvoiceIds = signal<string[]>([]);
  reminderChannel   = signal<'WhatsApp' | 'SMS' | 'Email'>('WhatsApp');
  reminderLanguage  = 'ar';
  reminderMessage   = '';
  successMessage    = signal('');
  errorMessage      = signal('');
  formValidationError = signal('');

  // ── Invoice Type Modality ─────────────────────────────────────────────────
  /** Tracks which invoice creation pathway the user selected. */
  invoiceType = signal<'Manual' | 'Deal'>('Manual');

  // ── Line Items Signal ─────────────────────────────────────────────────────
  /**
   * Active invoice line items — combines deal-inherited lines and manually
   * appended custom entries. Drives both the UI table and the computed total.
   */
  invoiceLines = signal<InvoiceLine[]>([]);

  /** Reactive sum of all line items: qty × unitPrice. */
  computedTotal = computed(() =>
    this.invoiceLines().reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
  );

  // ── Invoice type filters ─────────────────────────────────────────────────
  /** Customer invoices (type === 'Customer') */
  customerInvoices = computed(() =>
    (this.invoicesService.allInvoices() || []).filter((inv: Invoice) => inv.type === 'Customer')
  );

  /** Vendor invoices (type === 'Vendor') */
  vendorInvoices = computed(() =>
    (this.invoicesService.allInvoices() || []).filter((inv: Invoice) => inv.type === 'Vendor')
  );

  /** The invoices behind the active tab — the stat cards summarise exactly what the table lists. */
  private activeInvoices = computed(() => (this.activeTab() === 'Vendor' ? this.vendorInvoices() : this.customerInvoices()));
  private sum = (list: Invoice[]) => list.reduce((total, inv) => total + (inv.amount || 0), 0);
  private unpaid = computed(() => this.activeInvoices().filter(i => i.status !== 'Paid'));
  private overdue = computed(() => this.activeInvoices().filter(i => i.status === 'Overdue'));
  private paid = computed(() => this.activeInvoices().filter(i => i.status === 'Paid'));
  outstandingTotal = computed(() => this.sum(this.unpaid()));
  overdueTotal = computed(() => this.sum(this.overdue()));
  paidTotal = computed(() => this.sum(this.paid()));
  unpaidCount = computed(() => this.unpaid().length);
  overdueCount = computed(() => this.overdue().length);
  paidCount = computed(() => this.paid().length);

  /** Overdue invoices (status === 'Overdue') */
  overdueInvoices = computed(() =>
    (this.invoicesService.allInvoices() || []).filter((inv: Invoice) => inv.status === 'Overdue')
  );

  // ── Eligible Customers (Prospects blocked) ────────────────────────────────
  /** Only Partners with type === 'Customer' may be invoiced. */
  invoiceEligibleCustomers = computed(() =>
    this.state.partners().filter(p => p.type === 'Customer')
  );

  // ── Form State ────────────────────────────────────────────────────────────
  newInvoiceData: {
    type: 'Customer' | 'Vendor';
    partnerId: string;
    dealId: string;
    dueDate: string;
    customerAccount: string;
    customerName: string;
    billingAddress: string;
    deliveryAddress: string;
    vatNumber: string;
  } = this.blankForm();

  /** Tracks which fields were auto-filled from the CustomerCard. */
  autoFilledFields = signal<Set<string>>(new Set());

  constructor() {
    this.invoicesService.load();
    this.state.loadPartners();
    const tab = this.state.navigateTab();
    if (tab) {
      this.activeTab.set(tab as 'Customer' | 'Vendor' | 'Recovery');
      this.state.navigateTab.set(null);
    }
    const label = this.activeTab() === 'Customer' ? 'Customer Invoices' : this.activeTab() === 'Vendor' ? 'Vendor Invoices' : 'Recovery';
    this.state.breadcrumbLabel.set(label);
    this.updateReminderTemplate();
    // When switching back to Manual, clear deal-bound locked fields and lines
    effect(() => {
      if (this.invoiceType() === 'Manual') {
        this.newInvoiceData.dealId = '';
        this.invoiceLines.set([]);
      }
    });
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  private blankForm() {
    return {
      type: 'Customer' as 'Customer' | 'Vendor',
      partnerId: '',
      dealId: '',
      dueDate: '',
      customerAccount: '',
      customerName: '',
      billingAddress: '',
      deliveryAddress: '',
      vatNumber: '',
    };
  }

  /** Switch pathway; clears deal context and line items when going Manual. */
  setInvoiceType(type: 'Manual' | 'Deal') {
    this.invoiceType.set(type);
    this.formValidationError.set('');
    if (type === 'Manual') {
      this.newInvoiceData.dealId = '';
      this.invoiceLines.set([]);
    }
  }

  /**
   * Called when the user picks a Deal.
   * ① Locks the Partner to the deal's partnerId.
   * ② Auto-fills admin fields (customerAccount, deliveryAddress, customerName).
   * ③ Inherits all deal / proposal lines into invoiceLines signal.
   */
  onDealSelected(dealId: string) {
    if (!dealId) { this.invoiceLines.set([]); return; }

    const deal = this.state.deals().find(d => d.id === dealId);
    if (!deal) return;

    // ── Lock partner ──────────────────────────────────────────────────────
    this.newInvoiceData.partnerId = deal.partnerId;

    // ── Auto-fill admin fields ────────────────────────────────────────────
    this.newInvoiceData.customerAccount = deal.customerAccount ?? '';
    this.newInvoiceData.deliveryAddress = deal.deliveryAddress ?? '';

    const partner = this.state.partners().find(p => p.id === deal.partnerId);
    this.newInvoiceData.customerName = partner?.name ?? '';

    // ── Inherit line items ────────────────────────────────────────────────
    // Prefer deal.orderLines → fall back to linked proposal lines
    const sourceLines = deal.orderLines && deal.orderLines.length > 0
      ? deal.orderLines
      : (this.state.proposals().find(pr => pr.id === deal.proposalId)?.lines ?? []);

    const inherited: InvoiceLine[] = sourceLines.map(l => ({
      item:       l.product,
      description: l.description || '',
      qty:         l.qty,
      unitPrice:   l.unitPrice,
      type:        'service' as const,   // default; user can override per row
    }));

    this.invoiceLines.set(inherited);
    this.formValidationError.set('');
  }

  /**
   * Called when the user manually picks a Customer (Manual pathway).
   * Auto-fills Customer Name, VAT, Billing Address, and Delivery Address
   * from the linked CustomerCard when available.
   */
  onPartnerSelected(partnerId: string) {
    if (!partnerId) {
      // Clear auto-filled fields when selection is cleared
      this.autoFilledFields.set(new Set());
      this.newInvoiceData.customerName = '';
      this.newInvoiceData.vatNumber = '';
      this.newInvoiceData.billingAddress = '';
      this.newInvoiceData.deliveryAddress = '';
      return;
    }

    const partner = this.state.partners().find(p => p.id === partnerId);
    if (!partner) return;

    const filled = new Set<string>();

    // ── Customer Name ──────────────────────────────────────────────────────
    this.newInvoiceData.customerName = partner.name;
    filled.add('customerName');

    // ── Enrich from CustomerCard ───────────────────────────────────────────
    const card = this.state.getCustomerCard(partnerId);
    if (card) {
      // VAT: use ICE field (Identifiant Commun de l'Entreprise — Morocco VAT)
      if (card.ice) {
        this.newInvoiceData.vatNumber = card.ice;
        filled.add('vatNumber');
      } else if (card.tp) {
        this.newInvoiceData.vatNumber = card.tp;
        filled.add('vatNumber');
      }

      // Billing Address: prefer 'Billing' or 'Siège Social / Fiscal' address type
      const billingAddr = card.addresses.find(a =>
        a.addressType === 'Billing' || a.addressType === 'Siège Social / Fiscal'
      ) ?? card.addresses.find(a => a.isPrimary) ?? card.addresses[0];
      if (billingAddr) {
        this.newInvoiceData.billingAddress =
          [billingAddr.streetAddress, billingAddr.industrialZone, billingAddr.postalCode, billingAddr.city]
            .filter(Boolean).join(', ');
        filled.add('billingAddress');
      }

      // Delivery Address: prefer 'Delivery' type, fall back to billing
      const deliveryAddr = card.addresses.find(a => a.addressType === 'Delivery')
        ?? billingAddr;
      if (deliveryAddr) {
        this.newInvoiceData.deliveryAddress =
          [deliveryAddr.streetAddress, deliveryAddr.industrialZone, deliveryAddr.postalCode, deliveryAddr.city]
            .filter(Boolean).join(', ');
        filled.add('deliveryAddress');
      }

      // Customer Account from ERP account code
      if (card.erpAccount) {
        this.newInvoiceData.customerAccount = card.erpAccount;
        filled.add('customerAccount');
      } else if (card.accountId) {
        this.newInvoiceData.customerAccount = card.accountId;
        filled.add('customerAccount');
      }
    }

    this.autoFilledFields.set(filled);
    this.formValidationError.set('');
  }

  /** Append a blank custom line to the invoice. */
  addBlankLine() {
    this.invoiceLines.update(lines => [
      ...lines,
      { item: '', description: '', qty: 1, unitPrice: 0, type: 'service' as const }
    ]);
  }

  /** Remove the line at index i. */
  removeLine(i: number) {
    this.invoiceLines.update(lines => lines.filter((_, idx) => idx !== i));
  }

  /**
   * Patch a single field on a line (Angular @for loops give us a snapshot,
   * so we must use update + spread to trigger change detection).
   */
  patchLine(i: number, field: keyof InvoiceLine, value: string | number) {
    this.invoiceLines.update(lines => {
      const copy = [...lines];
      copy[i] = { ...copy[i], [field]: value } as InvoiceLine;
      return copy;
    });
  }

  // ── Validation & Save ─────────────────────────────────────────────────────

  /**
   * Validates the form and persists the invoice.
   * @param status 'Draft' → save-only; 'Pending' → save & send
   */
  saveInvoice(status: 'Draft' | 'Pending' = 'Pending') {
    if (!this.canCreate()) return;
    // Prospect guard (belt-and-suspenders, dropdown is already filtered)
    if (this.newInvoiceData.partnerId) {
      const partner = this.state.partners().find(p => p.id === this.newInvoiceData.partnerId);
      if (partner && partner.type !== 'Customer') {
        this.formValidationError.set('Invoices can only be created for verified Customers. Prospects are not eligible.');
        return;
      }
    }

    // Deal invoice guard
    if (this.invoiceType() === 'Deal' && !this.newInvoiceData.dealId) {
      this.formValidationError.set('A Deal must be selected for a Deal Invoice.');
      return;
    }

    // Partner required
    if (!this.newInvoiceData.partnerId) {
      this.formValidationError.set('Please select a Customer Account.');
      return;
    }

    // At least one meaningful line item OR non-zero manual total
    const total = this.computedTotal();
    if (total <= 0) {
      this.formValidationError.set('Add at least one line item with a quantity and unit price, or adjust existing lines.');
      return;
    }

    // Due date required
    if (!this.newInvoiceData.dueDate) {
      this.formValidationError.set('Please specify a due date.');
      return;
    }

    this.invoicesService.addInvoice({
      type:            this.newInvoiceData.type,
      partnerId:       this.newInvoiceData.partnerId,
      // The line sum is tax-exclusive; the backend adds VAT and returns the real total as `amount`.
      subtotal:        total,
      amount:          total,
      status:          status as 'Draft' | 'Pending',
      dueDate:         this.newInvoiceData.dueDate,
      dealId:          this.newInvoiceData.dealId || undefined,
      customerAccount: this.newInvoiceData.customerAccount || undefined,
      customerName:    this.newInvoiceData.customerName    || undefined,
      deliveryAddress: this.newInvoiceData.deliveryAddress || undefined,
      vatNumber:       this.newInvoiceData.vatNumber       || undefined,
      lines:           this.invoiceLines().length > 0 ? [...this.invoiceLines()] : undefined,
      createdBy:       this.state.currentUserId(),
    });

    this.invoiceModalOpen.set(false);
    this.formValidationError.set('');
  }

  // ── Invoice list helpers ──────────────────────────────────────────────────

  filteredInvoices = () =>
    this.activeTab() === 'Customer'
      ? this.customerInvoices()
      : this.vendorInvoices();

  invoicesPage = signal(1);
  invoicesPageSize = signal(10);
  invoicesTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredInvoices().length / this.invoicesPageSize())));
  paginatedInvoices = computed(() => {
    const start = (this.invoicesPage() - 1) * this.invoicesPageSize();
    return this.filteredInvoices().slice(start, start + this.invoicesPageSize());
  });

  getPartnerName(id: string) {
    return this.state.partners().find(p => p.id === id)?.name ?? 'Unknown';
  }
  getPartnerCity(id: string) {
    return this.state.partners().find(p => p.id === id)?.city ?? 'Casablanca';
  }
  getPartnerPhone(id: string) {
    return this.state.partners().find(p => p.id === id)?.phone ?? 'N/A';
  }

  /** Whole-number money for KPI cards, where decimals are noise. */
  money0(value: number) {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(value);
  }

  formatCurrency(value: number) {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(value);
  }

  getStatusColor(status: string) {
    switch (status) {
      case 'Paid':    return 'badge-success';
      case 'Overdue': return 'badge-danger';
      case 'Pending': return 'badge-warning';
      case 'Draft':   return 'bg-muted   text-ink-2   border-line';
      default:        return 'bg-muted   text-ink   border-line';
    }
  }

  toggleInvoiceSelect(id: string) {
    this.selectedInvoiceIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  openCreateInvoiceModal() {
    if (!this.canCreate()) return;
    this.newInvoiceData = this.blankForm();
    // Default the type based on the active sidebar tab
    this.newInvoiceData.type = this.activeTab() === 'Vendor' ? 'Vendor' : 'Customer';
    this.invoiceType.set('Manual');
    this.invoiceLines.set([]);
    this.formValidationError.set('');
    this.autoFilledFields.set(new Set());
    this.invoiceModalOpen.set(true);
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.invoiceModalOpen.set(false);
    }
  }

  // ── Recovery helpers ──────────────────────────────────────────────────────

  updateReminderTemplate() {
    if (this.reminderLanguage === 'ar') {
      this.reminderMessage = `السلام عليكم،\nنذكركم بلطف بضرورة تسوية الفاتورة الخاصة بكم المتبقية والبالغة قيمتها {{amount}} درهم مغربي، والتي كانت مستحقة بتاريخ {{due_date}}.\nشكرًا لتعاونكم مع شركة أكمل الرقمية.\nطاقم المالية.`;
    } else {
      this.reminderMessage = `Bonjour,\nNous vous rappelons amicalement de régler votre facture impayée d'un montant de {{amount}} MAD, échue le {{due_date}}.\nMerci pour votre confiance.\nL'équipe Finance.`;
    }
  }

  sendReminders() {
    const ids = this.selectedInvoiceIds();
    if (ids.length === 0) return;
    const channel = this.reminderChannel().toLowerCase();
    this.api.sendInvoiceReminders(ids, channel, this.reminderMessage).subscribe({
      next: (res) => {
        this.successMessage.set(`Succès! Rappel envoyé via ${this.reminderChannel()} (${res.sent} facture(s)).`);
        setTimeout(() => this.successMessage.set(''), 4000);
        this.selectedInvoiceIds.set([]);
      },
      error: (err) => {
        this.errorMessage.set(err?.detail || 'Erreur lors de l’envoi des rappels.');
        setTimeout(() => this.errorMessage.set(''), 4000);
      }
    });
  }
}
