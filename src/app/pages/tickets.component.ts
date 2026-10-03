import { Component, inject, signal, computed, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Ticket, TicketStatus, TicketPriority } from '../services/crm-state.service';
import { CategoriesService, TasksService, TicketsService } from '../services/domains';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { RouterModule } from '@angular/router';
import { DataStatusBannerComponent } from '../shared/data-status-banner.component';
import { PaginatorComponent } from '../shared/paginator.component';
import { AttachmentsComponent } from '../shared/attachments.component';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { TICKET_ASSIGNEE_FILTER_KEY } from '../shared/assignee-filter-keys';
import { CategoryPillComponent } from '../shared/ui/category-pill.component';
import { CategoryPickerComponent } from '../shared/ui/category-picker.component';

@Component({
  selector: 'app-tickets',
  imports: [MatIconModule, CommonModule, FormsModule, CreatedByBadgeComponent, RouterModule, DataStatusBannerComponent, PaginatorComponent, AttachmentsComponent, PageHeaderComponent, EmptyStateComponent, CategoryPillComponent, CategoryPickerComponent],
  template: `
    <div class="page">
      <app-page-header title="Tickets" subtitle="Track and resolve customer requests and support issues">
        @if (canCreate()) {
          <button actions class="btn-primary" (click)="openNewTicketModal()">
            <mat-icon>add</mat-icon>
            New Ticket
          </button>
        }
      </app-page-header>

      <div class="toolbar">
        <label class="search-field">
          <mat-icon>search</mat-icon>
          <input type="search" class="input-field" placeholder="Search tickets…" aria-label="Search tickets"
                 [ngModel]="searchTerm()" (ngModelChange)="setSearch($event)" />
        </label>
        <select [ngModel]="priorityFilter()" (ngModelChange)="priorityFilter.set($event)" class="input-field" aria-label="Filter tickets by priority">
          <option [ngValue]="null">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" class="input-field" aria-label="Filter tickets by status">
          <option [ngValue]="null">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)" class="input-field" aria-label="Filter tickets by type">
          <option [ngValue]="null">All Types</option>
          @for (t of state.ticketTypes(); track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
        <select [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event); ticketsPage.set(1)" class="input-field" aria-label="Filter tickets by category">
          <option value="">All Categories</option>
          <option value="NONE">No category</option>
          @for (c of categories.categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
        <select [ngModel]="assigneeFilter()" (ngModelChange)="setAssigneeFilter($event)" class="input-field" aria-label="Filter tickets by assignee">
          <option value="">All Assignees</option>
          <option value="NONE">Unassigned</option>
          @for (user of state.users(); track user.id) {
            <option [value]="user.id">{{user.displayName}}</option>
          }
        </select>
        @if (hasActiveFilters()) {
          <button (click)="clearFilters()" class="btn-ghost btn-sm">
            <mat-icon>close</mat-icon>
            Clear
          </button>
        }
        <span class="toolbar__count toolbar__spacer">{{ filteredTickets().length }} ticket{{ filteredTickets().length !== 1 ? 's' : '' }}</span>
      </div>

      @if (ticketsService.isLoading$()) {
        <app-data-status-banner [loading]="true" [variant]="'rows'" [columns]="11" [rows]="8" />
      } @else {
      <div class="table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">
                <input type="checkbox" [checked]="allTicketsOnPageSelected()" (change)="toggleSelectAllTickets($event)" class="cursor-pointer" />
              </th>
              <th scope="col">Priority</th>
              <th scope="col">Subject / Title</th>
              <th scope="col">Category</th>
              <th scope="col">Type</th>
              <th scope="col">Related Partner</th>
              <th scope="col">Tasks</th>
              <th scope="col">Assignee</th>
              <th scope="col">Status</th>
              <th scope="col">Created By</th>
              <th scope="col" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (ticket of paginatedTickets(); track ticket.id) {
              <tr>
                <td (click)="toggleTicketSelect(ticket.id, $event); $event.stopPropagation()" class="whitespace-nowrap">
                  <input type="checkbox" [checked]="isTicketSelected(ticket.id)" (click)="$event.stopPropagation()" (change)="toggleTicketSelect(ticket.id, $event)" class="cursor-pointer" />
                </td>
                <td class="whitespace-nowrap">
                  <div class="flex items-center">
                    <mat-icon [class]="getPriorityColor(ticket.priority)" class="icon-md">flag</mat-icon>
                    <span [class]="getPriorityColor(ticket.priority)" class="ml-1.5 text-meta font-semibold">{{ getPriorityLabel(ticket.priority) }}</span>
                  </div>
                </td>
                <td>
                  <a [routerLink]="['/tickets', ticket.id]" class="table-name-link text-sm font-medium text-ink text-left" [title]="'Open ' + ticket.title">{{ticket.title}}</a>
                  @if (ticket.description) {
                    <div class="text-meta text-ink-3 font-medium mt-0.5 truncate max-w-xs" [title]="ticket.description">{{ticket.description}}</div>
                  }
                </td>
                <td class="whitespace-nowrap">
                  <app-category-pill [categoryId]="ticket.categoryId" [showEmpty]="true" />
                </td>
                <td class="whitespace-nowrap text-ink-2">
                  <span class="badge badge-neutral">
                    {{ticket.type || 'N/A'}}
                  </span>
                </td>
                <td class="whitespace-nowrap text-ink-3">
                  {{getPartnerName(ticket.relatedPartnerId || ticket.partnerId)}}
                </td>
                <td class="whitespace-nowrap">
                  @if (taskProgress(ticket); as p) {
                    @if (p.total > 0) {
                      <a [routerLink]="['/tickets', ticket.id]" class="inline-flex items-center gap-2 group" [title]="p.done + ' of ' + p.total + ' tasks done'">
                        <span class="text-xs font-semibold tabular-nums" [class]="p.done === p.total ? 'text-success-ink' : 'text-ink-2'">{{ p.done }}/{{ p.total }}</span>
                        <span class="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <span class="block h-full rounded-full" [class]="p.done === p.total ? 'bg-success' : 'bg-primary'" [style.width.%]="p.percent"></span>
                        </span>
                      </a>
                    } @else {
                      <a [routerLink]="['/tickets', ticket.id]" class="text-xs text-ink-3 hover:text-ink-2 inline-flex items-center gap-1" title="Add tasks">
                        <mat-icon class="icon-xs">add_task</mat-icon>Add
                      </a>
                    }
                  }
                </td>
                <td class="whitespace-nowrap text-ink-2">
                  <div class="flex items-center gap-2">
                    <div class="h-5 w-5 bg-muted border border-line rounded-full flex items-center justify-center text-meta font-semibold text-ink uppercase">
                      {{getAssigneeInitials(ticket.assignedToUserId)}}
                    </div>
                    {{getAssigneeDisplayName(ticket.assignedToUserId)}}
                  </div>
                </td>
                <td class="whitespace-nowrap">
                  <span [class]="getStatusColor(ticket.status)" class="badge">
                    {{ getStatusLabel(ticket.status) }}
                  </span>
                </td>
                <td class="whitespace-nowrap">
                  <app-created-by-badge [createdBy]="ticket.createdBy" [createdAt]="ticket.createdAt" />
                </td>
                <td class="whitespace-nowrap text-right">
                  @if (canWrite()) {
                    <button (click)="openEditTicketModal(ticket)" class="btn-icon btn-sm" title="Edit Ticket">
                      <mat-icon class="icon-sm">edit</mat-icon>
                    </button>
                  }
                  @if (state.currentUserPermissions().canDeleteRecords) {
                    <button (click)="openDeleteModal(ticket)" class="btn-icon btn-sm btn-danger-hover" title="Delete Ticket">
                      <mat-icon class="icon-sm">delete</mat-icon>
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="11" class="row-empty">
                  <app-empty-state icon="support_agent" [title]="hasActiveFilters() ? 'No tickets match your filters' : 'No tickets yet'" [text]="hasActiveFilters() ? 'Try a different search or clear the filters.' : 'Create a ticket to start tracking a customer request.'" />
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
          <span class="font-semibold">{{ selectedTicketIds().size }} selected</span>
          <div class="bulk-action-bar__sep"></div>
          <select (change)="bulkAssignTicketOwner($event)">
            <option value="">Assign owner…</option>
            @for (u of state.users(); track u.id) { <option [value]="u.id">{{u.displayName}}</option> }
          </select>
          <select (change)="bulkChangeTicketStatus($event)">
            <option value="">Change stage…</option>
            @for (s of ticketStatusOptions; track s) { <option [value]="s">{{s}}</option> }
          </select>
          <button class="bulk-action-bar__btn" (click)="bulkExportTickets()">Export CSV</button>
          <button class="bulk-action-bar__btn is-quiet" (click)="clearTicketSelection()">Clear</button>
        </div>
      }
    </div>

    <!-- Ticket Modal (Create / Edit) -->
    @if (modalOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-md">
          <div class="flex justify-between items-center">
            <h3 class="modal-title">
              {{ isEditing() ? 'Edit Support Ticket' : 'New Support Ticket' }}
            </h3>
            <button (click)="modalOpen.set(false)" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label for="subject_title" class="field-label mb-1.5">Subject / Title *</label>
              <input id="subject_title"
                [(ngModel)]="newTicket.title"
                type="text"
                placeholder="e.g. Login issue on client portal"
                class="input-field w-full"
              >
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="ticket_type" class="field-label mb-1.5">Ticket Type</label>
                <select id="ticket_type" [(ngModel)]="newTicket.type" class="input-field w-full">
                  @for (t of state.ticketTypes(); track t) {
                    <option [value]="t">{{ t }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="related_partner" class="field-label mb-1.5">Related Partner</label>
                <select id="related_partner" [(ngModel)]="newTicket.relatedPartnerId" class="input-field w-full">
                  <option value="">-- Select Partner --</option>
                  @for (p of state.partners(); track p.id) {
                    <option [value]="p.id">{{p.name}} ({{p.type}})</option>
                  }
                </select>
              </div>
            </div>

            <div>
              <label for="assigned_to" class="field-label mb-1.5">Assigned To</label>
              <select id="assigned_to" [(ngModel)]="newTicket.assignedToUserId" class="input-field w-full">
                <option value="">-- Select Assignee --</option>
                @for (user of state.users(); track user.id) {
                  <option [value]="user.id">{{user.displayName}} ({{user.role}})</option>
                }
              </select>
            </div>

            <div>
              <span class="field-label mb-1.5 block">Category <span class="text-ink-3 normal-case font-medium">(optional)</span></span>
              <app-category-picker [(value)]="newTicket.categoryId" hint="Its tasks take the same category." />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="priority" class="field-label mb-1.5">Priority</label>
                <select id="priority" [(ngModel)]="newTicket.priority" class="input-field w-full">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label for="status" class="field-label mb-1.5">Status</label>
                <select id="status" [(ngModel)]="newTicket.status" class="input-field w-full">
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>

            <!-- Description Field -->
            <div>
              <label for="description" class="field-label mb-1.5">Description</label>
              <textarea id="description"
                [(ngModel)]="newTicket.description"
                rows="3"
                placeholder="Describe the issue..."
                class="input-field w-full"
              ></textarea>
            </div>

            @if (isEditing() && editingTicketId()) {
              <app-attachments ownerEntityType="TICKET" [ownerEntityId]="editingTicketId()!" [canWrite]="canWrite()" />
            }
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
            <button (click)="modalOpen.set(false)" class="btn-secondary">
              Cancel
            </button>
            <button (click)="saveTicket()" [disabled]="!newTicket.title.trim()" class="btn-primary">
              {{ isEditing() ? 'Save Changes' : 'Create Ticket' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (deleteModalOpen() && ticketToDelete()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <div class="flex justify-between items-center">
            <h3 class="modal-title">Delete Ticket</h3>
            <button (click)="cancelDelete()" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>
          <p class="text-sm text-ink-2 leading-relaxed">
            Are you sure you want to delete this ticket?
          </p>
          <div class="bg-subtle border border-line rounded-xl px-4 py-3">
            <div class="text-sm font-semibold text-ink">{{ ticketToDelete()?.title }}</div>
            @if (ticketToDelete()?.id) {
              <div class="text-meta text-ink-3 font-mono mt-0.5">#{{ (ticketToDelete()?.id ?? '').slice(0, 8) }}</div>
            }
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-line-soft">
            <button (click)="cancelDelete()" class="btn-secondary">
              Cancel
            </button>
            <button (click)="deleteConfirm()" class="btn-danger">
              <mat-icon class="icon-sm">delete</mat-icon>
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
  tasksService = inject(TasksService);
  categories = inject(CategoriesService);

  canCreate(): boolean { return this.state.hasAuthority('TICKETS_CREATE'); }
  canWrite(): boolean { return this.state.hasAuthority('TICKETS_WRITE'); }
  canDelete(): boolean { return this.state.hasAuthority('TICKETS_DELETE'); }

  modalOpen = signal(false);
  isEditing = signal(false);
  editingTicketId = signal<string | null>(null);
  priorityFilter = signal<TicketPriority | null>(null);
  statusFilter = signal<TicketStatus | null>(null);
  typeFilter = signal<string | null>(null);
  /** '' = every category, 'NONE' = tickets without one, otherwise a category id. */
  categoryFilter = signal<string>('');

  /** Narrow the list to tickets assigned to one user ('NONE' = unassigned, '' = everyone). Remembered across sessions. */
  assigneeFilter = signal<string>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(TICKET_ASSIGNEE_FILTER_KEY) || '' : ''
  );

  setAssigneeFilter(value: string) {
    this.assigneeFilter.set(value);
    this.ticketsPage.set(1);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TICKET_ASSIGNEE_FILTER_KEY, value);
    }
  }

  searchTerm = signal('');

  setSearch(value: string) {
    this.searchTerm.set(value ?? '');
    this.ticketsPage.set(1);
  }

  filteredTickets = computed(() => {
    const priority = this.priorityFilter();
    const status = this.statusFilter();
    const type = this.typeFilter();
    const category = this.categoryFilter();
    const assignee = this.assigneeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.ticketsService.allTickets().filter(t =>
      (!q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q) || t.id.toLowerCase().includes(q) ||
        this.getPartnerName(t.relatedPartnerId || t.partnerId).toLowerCase().includes(q)) &&
      (!priority || t.priority === priority) &&
      (!status || t.status === status) &&
      (!type || t.type === type) &&
      (!category || (category === 'NONE' ? !t.categoryId : t.categoryId === category)) &&
      (!assignee || (assignee === 'NONE' ? !t.assignedToUserId : t.assignedToUserId === assignee))
    );
  });

  hasActiveFilters = computed(() => !!this.searchTerm() || !!this.priorityFilter() || !!this.statusFilter() || !!this.typeFilter() || !!this.categoryFilter() || !!this.assigneeFilter());

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
      this.ticketsService.patchTicket(id, { assignedToUserId: value });
    }
  }

  bulkChangeTicketStatus(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) return;
    const ids = this.selectedTicketIds();
    for (const id of ids) {
      this.ticketsService.patchTicket(id, { status: value as TicketStatus });
    }
  }

  bulkExportTickets() {
    const ids = this.selectedTicketIds();
    const tickets = this.ticketsService.allTickets().filter(t => ids.has(t.id));
    const header = ['Title', 'Category', 'Type', 'Priority', 'Status', 'Assignee'];
    const escapeCsv = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
    const rows = tickets.map(t => [
      escapeCsv(t.title),
      escapeCsv(this.categories.get(t.categoryId)?.name || ''),
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
    this.searchTerm.set('');
    this.priorityFilter.set(null);
    this.statusFilter.set(null);
    this.typeFilter.set(null);
    this.categoryFilter.set('');
    this.setAssigneeFilter('');
  }

  /**
   * "2/5 tasks" for a row. Once the Tasks store is loaded it is the live source (a task
   * completed on the board is reflected here at once); before that, the counts the ticket
   * API returned with the row are used.
   */
  taskProgress(ticket: Ticket): { total: number; done: number; percent: number } {
    let total: number; let done: number;
    if (this.tasksService.isLoaded()) {
      const tasks = this.tasksService.relatedTo({ relatedEntityType: 'TICKET', relatedEntityId: ticket.id });
      total = tasks.length;
      done = tasks.filter(t => t.status === 'Completed').length;
    } else {
      total = ticket.taskCount ?? 0;
      done = ticket.taskDoneCount ?? 0;
    }
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  constructor() {
    this.ticketsService.load();
    this.tasksService.load();
    this.state.loadPartners();
    this.categories.load();
    const filter = this.state.ticketFilter();
    if (filter?.priority && ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].includes(filter.priority)) {
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
    categoryId: '',
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
      categoryId: '',
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
      relatedPartnerId: ticket.relatedPartnerId || ticket.partnerId || '',
      assignedToUserId: ticket.assignedToUserId || '',
      categoryId: ticket.categoryId || '',
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
      this.ticketsService.patchTicket(this.editingTicketId()!, {
        title: this.newTicket.title,
        description: this.newTicket.description,
        relatedPartnerId: this.newTicket.relatedPartnerId || undefined,
        partnerId: this.newTicket.relatedPartnerId || undefined,
        relatedEntityType: this.newTicket.relatedPartnerId ? 'PARTNER' : undefined,
        relatedEntityId: this.newTicket.relatedPartnerId || undefined,
        assignedToUserId: this.newTicket.assignedToUserId || undefined,
        categoryId: this.newTicket.categoryId || undefined,
        priority: this.newTicket.priority,
        status: this.newTicket.status,
        type: this.newTicket.type
      });
    } else {
      const partnerId = this.newTicket.relatedPartnerId || undefined;
      this.ticketsService.addTicket({
        title: this.newTicket.title,
        description: this.newTicket.description,
        // The backend reads the partner from `partnerId` / the generic link pair, not from
        // `relatedPartnerId` (a frontend-only alias kept for the table's existing readers).
        partnerId,
        relatedEntityType: partnerId ? 'PARTNER' : undefined,
        relatedEntityId: partnerId,
        assignedToUserId: this.newTicket.assignedToUserId || undefined,
        categoryId: this.newTicket.categoryId || undefined,
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
      case 'URGENT': return 'Urgent';
      case 'HIGH': return 'High';
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
      case 'URGENT': return 'text-danger-ink';
      case 'HIGH': return 'text-warning-ink';
      case 'MEDIUM': return 'text-success-ink';
      case 'LOW': return 'text-accent-ink';
    }
  }

  getStatusColor(status: TicketStatus) {
    switch(status) {
      case 'OPEN': return 'badge-danger';
      case 'IN_PROGRESS': return 'badge-warning';
      case 'RESOLVED': return 'badge-success';
      case 'CLOSED': return 'badge-neutral';
    }
  }
}
