import { Component, inject, signal, computed, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Ticket, TicketStatus, TicketPriority } from '../services/crm-state.service';
import { TicketsService } from '../services/domains';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { RouterModule } from '@angular/router';
import { DataStatusBannerComponent } from '../shared/data-status-banner.component';
import { PaginatorComponent } from '../shared/paginator.component';
import { AttachmentsComponent } from '../shared/attachments.component';

@Component({
  selector: 'app-tickets',
  imports: [MatIconModule, CommonModule, FormsModule, CreatedByBadgeComponent, RouterModule, DataStatusBannerComponent, PaginatorComponent, AttachmentsComponent],
  template: `
    <div class="space-y-8">
      @if (canCreate()) {
      <div class="flex justify-end">
        <button (click)="openNewTicketModal()" class="bg-zinc-900 hover:bg-zinc-950 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm shadow-lg shadow-zinc-300">
          <mat-icon class="w-5 h-5 text-[20px]! leading-none! flex items-center justify-center">add</mat-icon>
          New Ticket
        </button>
      </div>
      }

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <mat-icon class="text-[18px] w-4.5 h-4.5 text-zinc-500">filter_alt</mat-icon>
          <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Filters</span>
        </div>
        <select [ngModel]="priorityFilter()" (ngModelChange)="priorityFilter.set($event)" class="input-field rounded-lg p-2 text-sm focus:outline-blue-600 cursor-pointer w-40">
          <option [ngValue]="null">All Priorities</option>
          <option value="URGENT">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" class="input-field rounded-lg p-2 text-sm focus:outline-blue-600 cursor-pointer w-44">
          <option [ngValue]="null">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)" class="input-field rounded-lg p-2 text-sm focus:outline-blue-600 cursor-pointer w-44">
          <option [ngValue]="null">All Types</option>
          @for (t of state.ticketTypes(); track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
        @if (hasActiveFilters()) {
          <button (click)="clearFilters()" class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
            <mat-icon class="text-[14px] w-3.5 h-3.5">close</mat-icon>
            Clear Filters
          </button>
        }
        <span class="text-xs text-zinc-400 font-medium ml-auto">{{ filteredTickets().length }} ticket{{ filteredTickets().length !== 1 ? 's' : '' }}</span>
      </div>

      @if (ticketsService.isLoading$()) {
        <app-data-status-banner [loading]="true" [variant]="'rows'" [columns]="9" [rows]="8" />
      } @else {
      <div class="card rounded-2xl overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-white border border-zinc-200">
            <tr>
              <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">
                <input type="checkbox" [checked]="allTicketsOnPageSelected()" (change)="toggleSelectAllTickets($event)" class="cursor-pointer" />
              </th>
              <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Priority</th>
              <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Subject / Title</th>
              <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Type</th>
              <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Related Partner</th>
              <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Assignee</th>
              <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Status</th>
              <th scope="col" class="px-6 py-3 text-left font-medium text-zinc-500 uppercase tracking-wider text-xs">Created By</th>
              <th scope="col" class="px-6 py-3 text-right font-medium text-zinc-500 uppercase tracking-wider text-xs">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-slate-200">
            @for (ticket of paginatedTickets(); track ticket.id) {
              <tr class="hover:bg-zinc-50 transition-colors">
                <td (click)="toggleTicketSelect(ticket.id, $event); $event.stopPropagation()" class="px-6 py-4 whitespace-nowrap">
                  <input type="checkbox" [checked]="isTicketSelected(ticket.id)" (click)="$event.stopPropagation()" (change)="toggleTicketSelect(ticket.id, $event)" class="cursor-pointer" />
                </td>
                <td (click)="openEditTicketModal(ticket)" class="px-6 py-4 whitespace-nowrap cursor-pointer">
                  <div class="flex items-center">
                    <mat-icon [class]="getPriorityColor(ticket.priority)" class="text-[18px] w-5 h-5">flag</mat-icon>
                    <span [class]="getPriorityColor(ticket.priority)" class="ml-1.5 text-meta font-semibold">{{ getPriorityLabel(ticket.priority) }}</span>
                  </div>
                </td>
                <td (click)="openEditTicketModal(ticket)" class="px-6 py-4 cursor-pointer">
                  <div class="text-sm font-medium text-zinc-900">{{ticket.title}}</div>
                  @if (ticket.description) {
                    <div class="text-meta text-zinc-500 font-medium mt-0.5 truncate max-w-xs" [title]="ticket.description">{{ticket.description}}</div>
                  }
                </td>
                <td (click)="openEditTicketModal(ticket)" class="px-6 py-4 whitespace-nowrap cursor-pointer text-sm text-zinc-600">
                  <span class="px-2 py-0.5 text-body bg-zinc-100 text-zinc-700 rounded-md border border-zinc-200 font-medium">
                    {{ticket.type || 'N/A'}}
                  </span>
                </td>
                <td (click)="openEditTicketModal(ticket)" class="px-6 py-4 whitespace-nowrap cursor-pointer text-sm text-zinc-500">
                  {{getPartnerName(ticket.relatedPartnerId)}}
                </td>
                <td (click)="openEditTicketModal(ticket)" class="px-6 py-4 whitespace-nowrap cursor-pointer text-sm text-zinc-600">
                  <div class="flex items-center gap-2">
                    <div class="h-5 w-5 bg-zinc-100 border border-zinc-200 rounded-full flex items-center justify-center text-meta font-bold text-zinc-900 uppercase">
                      {{getAssigneeInitials(ticket.assignedToUserId)}}
                    </div>
                    {{getAssigneeDisplayName(ticket.assignedToUserId)}}
                  </div>
                </td>
                <td (click)="openEditTicketModal(ticket)" class="px-6 py-4 whitespace-nowrap cursor-pointer">
                  <span [class]="getStatusColor(ticket.status)" class="px-2.5 py-1 text-body font-semibold rounded-full border">
                    {{ getStatusLabel(ticket.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <app-created-by-badge [createdBy]="ticket.createdBy" [createdAt]="ticket.createdAt" />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                  @if (state.currentUserPermissions().canDeleteRecords) {
                    <button (click)="openDeleteModal(ticket)" class="text-zinc-700 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Delete Ticket">
                      <mat-icon class="text-[18px] w-4.5 h-4.5">delete</mat-icon>
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9" class="px-6 py-12 text-center text-zinc-400 text-sm">
                  <mat-icon class="text-[40px]! w-10 h-10 mb-2 text-zinc-300 block mx-auto">support_agent</mat-icon>
                  No tickets found. Create one to get started.
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (filteredTickets().length > 0) {
          <app-paginator
            [currentPage]="ticketsPage()"
            [totalPages]="ticketsTotalPages()"
            [pageSize]="ticketsPageSize()"
            (pageChange)="ticketsPage.set($event)"
            (pageSizeChange)="ticketsPageSize.set($event)" />
        }
      </div>
      }
      @if (ticketsService.error$()) {
        <app-data-status-banner [error]="ticketsService.error$()" />
      }
      @if (selectedTicketIds().size > 0) {
        <div class="bulk-action-bar">
          <span class="text-body font-semibold">{{ selectedTicketIds().size }} selected</span>
          <div class="w-px h-4 bg-white/20"></div>
          <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkAssignTicketOwner($event)">
            <option value="">Assign owner…</option>
            @for (u of state.users(); track u.id) { <option [value]="u.name">{{u.name}}</option> }
          </select>
          <select class="text-body bg-white/10 text-white rounded-md px-2 py-1.5 border-none outline-none cursor-pointer" (change)="bulkChangeTicketStatus($event)">
            <option value="">Change stage…</option>
            @for (s of ticketStatusOptions; track s) { <option [value]="s">{{s}}</option> }
          </select>
          <button class="text-body font-semibold px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors" (click)="bulkExportTickets()">Export CSV</button>
          <button class="text-meta ml-2 opacity-70 hover:opacity-100 transition-opacity" (click)="clearTicketSelection()">Clear</button>
        </div>
      }
    </div>

    <!-- Ticket Modal (Create / Edit) -->
    @if (modalOpen()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold text-zinc-950">
              {{ isEditing() ? 'Edit Support Ticket' : 'New Support Ticket' }}
            </h3>
            <button (click)="modalOpen.set(false)" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label for="subject_title" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Subject / Title *</label>
              <input id="subject_title"
                [(ngModel)]="newTicket.title"
                type="text"
                placeholder="e.g. Login issue on client portal"
                class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"
              >
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="ticket_type" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Ticket Type</label>
                <select id="ticket_type" [(ngModel)]="newTicket.type" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                  @for (t of state.ticketTypes(); track t) {
                    <option [value]="t">{{ t }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="related_partner" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Related Partner</label>
                <select id="related_partner" [(ngModel)]="newTicket.relatedPartnerId" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                  <option value="">-- Select Partner --</option>
                  @for (p of state.partners(); track p.id) {
                    <option [value]="p.id">{{p.name}} ({{p.type}})</option>
                  }
                </select>
              </div>
            </div>

            <div>
              <label for="assigned_to" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Assigned To</label>
              <select id="assigned_to" [(ngModel)]="newTicket.assignedToUserId" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                <option value="">-- Select Assignee --</option>
                @for (user of state.users(); track user.id) {
                  <option [value]="user.id">{{user.displayName}} ({{user.role}})</option>
                }
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="priority" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Priority</label>
                <select id="priority" [(ngModel)]="newTicket.priority" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="URGENT">High</option>
                </select>
              </div>
              <div>
                <label for="status" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Status</label>
                <select id="status" [(ngModel)]="newTicket.status" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>

            <!-- Description Field -->
            <div>
              <label for="description" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Description</label>
              <textarea id="description"
                [(ngModel)]="newTicket.description"
                rows="3"
                placeholder="Describe the issue..."
                class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"
              ></textarea>
            </div>

            @if (isEditing() && editingTicketId()) {
              <app-attachments ownerEntityType="TICKET" [ownerEntityId]="editingTicketId()!" [canWrite]="canWrite()" />
            }
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-white/30">
            <button (click)="modalOpen.set(false)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">
              Cancel
            </button>
            <button (click)="saveTicket()" [disabled]="!newTicket.title.trim()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm shadow-lg shadow-zinc-300">
              {{ isEditing() ? 'Save Changes' : 'Create Ticket' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (deleteModalOpen() && ticketToDelete()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-bold text-zinc-950">Delete Ticket</h3>
            <button (click)="cancelDelete()" class="text-zinc-400 hover:text-zinc-600 transition-colors">
              <mat-icon class="w-5 h-5 text-[20px]! leading-none!">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-zinc-600 leading-relaxed">
            Are you sure you want to delete this ticket?
          </p>
          <div class="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <div class="text-sm font-semibold text-zinc-900">{{ ticketToDelete()?.title }}</div>
            @if (ticketToDelete()?.id) {
              <div class="text-meta text-zinc-400 font-mono mt-0.5">#{{ ticketToDelete()?.id }}</div>
            }
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-white/30">
            <button (click)="cancelDelete()" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">
              Cancel
            </button>
            <button (click)="deleteConfirm()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5">
              <mat-icon class="w-4 h-4 text-[16px]! leading-none!">delete</mat-icon>
              Delete
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class TicketsComponent {
  state = inject(CrmStateService);
  ticketsService = inject(TicketsService);

  canCreate(): boolean { return this.state.hasAuthority('TICKETS_CREATE'); }
  canWrite(): boolean { return this.state.hasAuthority('TICKETS_WRITE'); }
  canDelete(): boolean { return this.state.hasAuthority('TICKETS_DELETE'); }

  modalOpen = signal(false);
  isEditing = signal(false);
  editingTicketId = signal<string | null>(null);
  priorityFilter = signal<TicketPriority | null>(null);
  statusFilter = signal<TicketStatus | null>(null);
  typeFilter = signal<string | null>(null);

  filteredTickets = computed(() => {
    const priority = this.priorityFilter();
    const status = this.statusFilter();
    const type = this.typeFilter();
    return this.ticketsService.allTickets().filter(t =>
      (!priority || t.priority === priority) &&
      (!status || t.status === status) &&
      (!type || t.type === type)
    );
  });

  hasActiveFilters = computed(() => !!this.priorityFilter() || !!this.statusFilter() || !!this.typeFilter());

  ticketStatusOptions = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  selectedTicketIds = signal<Set<string>>(new Set());

  allTicketsOnPageSelected = computed(() => {
    const page = this.paginatedTickets();
    if (page.length === 0) return false;
    const selected = this.selectedTicketIds();
    return page.every(t => selected.has(t.id));
  });

  toggleTicketSelect(id: string, event: Event) {
    event.stopPropagation();
    const current = new Set(this.selectedTicketIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedTicketIds.set(current);
  }

  isTicketSelected(id: string): boolean {
    return this.selectedTicketIds().has(id);
  }

  toggleSelectAllTickets(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const current = new Set(this.selectedTicketIds());
    for (const ticket of this.paginatedTickets()) {
      if (checked) {
        current.add(ticket.id);
      } else {
        current.delete(ticket.id);
      }
    }
    this.selectedTicketIds.set(current);
  }

  clearTicketSelection() {
    this.selectedTicketIds.set(new Set());
  }

  bulkAssignTicketOwner(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) return;
    const ids = this.selectedTicketIds();
    for (const id of ids) {
      this.ticketsService.updateTicket(id, { assignedTo: value });
    }
  }

  bulkChangeTicketStatus(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) return;
    const ids = this.selectedTicketIds();
    for (const id of ids) {
      this.ticketsService.updateTicket(id, { status: value as TicketStatus });
    }
  }

  bulkExportTickets() {
    const ids = this.selectedTicketIds();
    const tickets = this.ticketsService.allTickets().filter(t => ids.has(t.id));
    const header = ['Title', 'Type', 'Priority', 'Status', 'Assignee'];
    const escapeCsv = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
    const rows = tickets.map(t => [
      escapeCsv(t.title),
      escapeCsv(t.type || ''),
      escapeCsv(t.priority),
      escapeCsv(t.status),
      escapeCsv(this.getAssigneeDisplayName(t.assignedToUserId))
    ].join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tickets-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  ticketsPage = signal(1);
  ticketsPageSize = signal(10);
  ticketsTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredTickets().length / this.ticketsPageSize())));
  paginatedTickets = computed(() => {
    const start = (this.ticketsPage() - 1) * this.ticketsPageSize();
    return this.filteredTickets().slice(start, start + this.ticketsPageSize());
  });

  clearFilters() {
    this.priorityFilter.set(null);
    this.statusFilter.set(null);
    this.typeFilter.set(null);
  }

  constructor() {
    this.ticketsService.load();
    const filter = this.state.ticketFilter();
    if (filter?.priority && ['URGENT', 'MEDIUM', 'LOW'].includes(filter.priority)) {
      this.priorityFilter.set(filter.priority as TicketPriority);
      this.state.ticketFilter.set(null);
    }

    effect(() => {
      const action = this.state.pendingQuickAction();
      if (!action) return;
      if (action.id === 'new-ticket') {
        this.openNewTicketModal();
        this.state.pendingQuickAction.set(null);
      } else if (action.id === 'open-ticket' && action.payload) {
        const ticket = this.ticketsService.allTickets().find(t => t.id === action.payload);
        if (ticket) {
          this.openEditTicketModal(ticket);
          this.state.pendingQuickAction.set(null);
        }
        // if not found yet (tickets still loading), leave the signal set so this effect re-runs
        // once ticketsService.allTickets() updates and the ticket becomes findable.
      }
    });
  }

  // Delete confirmation
  deleteModalOpen = signal(false);
  ticketToDelete = signal<Ticket | null>(null);

  openDeleteModal(ticket: Ticket) {
    if (!this.canDelete()) return;
    this.ticketToDelete.set(ticket);
    this.deleteModalOpen.set(true);
  }

  cancelDelete() {
    this.deleteModalOpen.set(false);
    this.ticketToDelete.set(null);
  }

  deleteConfirm() {
    if (!this.canDelete()) return;
    const ticket = this.ticketToDelete();
    if (ticket) {
      this.ticketsService.deleteTicket(ticket.id);
    }
    this.deleteModalOpen.set(false);
    this.ticketToDelete.set(null);
  }

  newTicket = {
    title: '',
    description: '',
    relatedPartnerId: '',
    assignedToUserId: '',
    priority: 'MEDIUM' as TicketPriority,
    status: 'OPEN' as TicketStatus,
    type: 'Software issue'
  };

  openNewTicketModal() {
    if (!this.canCreate()) return;
    this.isEditing.set(false);
    this.editingTicketId.set(null);
    this.newTicket = {
      title: '',
      description: '',
      relatedPartnerId: this.state.partners()[0]?.id || '',
      assignedToUserId: this.state.users()[0]?.id || '',
      priority: 'MEDIUM',
      status: 'OPEN',
      type: this.state.ticketTypes()[0] || 'Software issue'
    };
    this.modalOpen.set(true);
  }

  openEditTicketModal(ticket: Ticket) {
    if (!this.canWrite()) return;
    this.isEditing.set(true);
    this.editingTicketId.set(ticket.id);
    this.newTicket = {
      title: ticket.title,
      description: ticket.description || '',
      relatedPartnerId: ticket.relatedPartnerId || '',
      assignedToUserId: ticket.assignedToUserId || '',
      priority: ticket.priority,
      status: ticket.status,
      type: ticket.type || this.state.ticketTypes()[0] || 'Software issue'
    };
    this.modalOpen.set(true);
  }

  saveTicket() {
    const allowed = this.isEditing() ? this.canWrite() : this.canCreate();
    if (!allowed || !this.newTicket.title.trim()) return;

    if (this.isEditing() && this.editingTicketId()) {
      this.ticketsService.updateTicket(this.editingTicketId()!, {
        title: this.newTicket.title,
        description: this.newTicket.description,
        relatedPartnerId: this.newTicket.relatedPartnerId,
        assignedToUserId: this.newTicket.assignedToUserId,
        priority: this.newTicket.priority,
        status: this.newTicket.status,
        type: this.newTicket.type
      });
    } else {
      this.ticketsService.addTicket({
        title: this.newTicket.title,
        description: this.newTicket.description,
        relatedPartnerId: this.newTicket.relatedPartnerId,
        assignedToUserId: this.newTicket.assignedToUserId,
        status: this.newTicket.status,
        priority: this.newTicket.priority,
        type: this.newTicket.type,
        assignedByUserId: this.state.currentUserId()
      });
    }
    this.modalOpen.set(false);
  }

  getPartnerName(id: string | undefined) {
    return this.state.partners().find(p => p.id === id)?.name || 'Unknown';
  }

  getAssigneeDisplayName(userId: string | undefined): string {
    return this.state.users().find(u => u.id === userId)?.displayName || 'Unassigned';
  }

  getAssigneeInitials(userId: string | undefined): string {
    const user = this.state.users().find(u => u.id === userId);
    return user?.initials || 'U';
  }

  getPriorityLabel(priority: TicketPriority): string {
    switch(priority) {
      case 'URGENT': return 'High';
      case 'MEDIUM': return 'Medium';
      case 'LOW': return 'Low';
    }
  }

  getStatusLabel(status: TicketStatus): string {
    switch(status) {
      case 'OPEN': return 'Open';
      case 'IN_PROGRESS': return 'In Progress';
      case 'RESOLVED': return 'Resolved';
      case 'CLOSED': return 'Closed';
    }
  }

  getPriorityColor(priority: TicketPriority) {
    switch(priority) {
      case 'URGENT': return 'text-red-500';
      case 'MEDIUM': return 'text-green-500';
      case 'LOW': return 'text-blue-400';
    }
  }

  getStatusColor(status: TicketStatus) {
    switch(status) {
      case 'OPEN': return 'text-red-600 border border-red-200';
      case 'IN_PROGRESS': return 'text-amber-600 border border-amber-200';
      case 'RESOLVED': return 'text-emerald-600 border border-emerald-200';
      case 'CLOSED': return 'text-zinc-400 border border-zinc-200';
    }
  }
}
