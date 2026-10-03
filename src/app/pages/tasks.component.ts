import { Component, inject, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Task, Ticket, TicketStatus, TicketPriority } from '../services/crm-state.service';
import { CategoriesService, TasksService, TicketsService } from '../services/domains';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { RouterModule } from '@angular/router';
import { DataStatusBannerComponent } from '../shared/data-status-banner.component';
import { PaginatorComponent } from '../shared/paginator.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { TranslationService } from '../services/translation.service';
import { RelatedEntityPickerComponent } from '../shared/related-entity-picker.component';
import { UserPickerComponent } from '../shared/user-picker.component';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { RelatedEntityService } from '../services/related-entity.service';
import { EntityLink } from '../shared/related-entity.model';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { ConfirmService } from '../shared/ui/confirm.service';
import { CategoryPillComponent } from '../shared/ui/category-pill.component';
import { CategoryPickerComponent } from '../shared/ui/category-picker.component';

type TaskScope = 'open' | 'overdue' | 'completed' | 'all';
type TaskSort = 'smart' | 'due' | 'priority' | 'newest';
type TaskView = 'tickets' | 'list' | 'kanban';

/** Tasks that share a ticket (or, under key `NONE`, the ones that belong to no ticket). */
interface TaskGroup {
  key: string;
  ticket?: Ticket;
  /** Tasks to show (after the tab and filters). */
  tasks: Task[];
  /** Progress counts cover every task on the ticket, whatever the tab is hiding. */
  total: number;
  done: number;
  percent: number;
  overdue: number;
}

const NO_TICKET = 'NONE';

@Component({
  selector: 'app-tasks',
  imports: [MatIconModule, CommonModule, FormsModule, DragDropModule, CreatedByBadgeComponent, RouterModule, DataStatusBannerComponent, PaginatorComponent, TranslatePipe, RelatedEntityPickerComponent, UserPickerComponent, UserAvatarComponent, PageHeaderComponent, EmptyStateComponent, CategoryPillComponent, CategoryPickerComponent],
  styles: [`
    .kanban-column.cdk-drop-list-dragging .kanban-card:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .kanban-card.cdk-drag-placeholder {
      opacity: 0;
    }
    .kanban-card.cdk-drag-preview {
      background: var(--color-surface) !important;
      border-radius: var(--r-card);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--color-border);
      transform: rotate(3deg);
      transition: none;
    }
    .kanban-card {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1),
                  box-shadow 200ms ease;
    }
    .kanban-column {
      transition: background-color 200ms ease;
    }

    /* Task rows: a checklist line, not a table row. The page's own width decides the layout (container
       query), because the sidebar can leave a wide screen with a narrow content column. */
    .task-list { container-type: inline-size; }
    .task-row {
      display: grid; align-items: center; column-gap: 12px; row-gap: 6px;
      grid-template-columns: 20px 32px minmax(0, 1fr) 84px 156px 120px 124px 148px;
      padding: 10px 16px; border-top: 1px solid var(--color-border-light);
      border-inline-start: 3px solid transparent;
      transition: background var(--transition-fast);
    }
    .task-row:first-child { border-top: 0; }
    .task-row:hover { background: var(--color-surface-hover); }
    .task-row.is-selected { background: var(--color-accent-light); }
    .task-row[data-priority='Urgent'] { border-inline-start-color: var(--color-danger); }
    .task-row[data-priority='Medium'] { border-inline-start-color: var(--color-warning); }
    .task-main, .task-meta > * { min-width: 0; }
    .task-meta { display: contents; }
    .task-actions { display: inline-flex; align-items: center; gap: 2px; justify-content: flex-end; }
    /* Selection boxes stay out of the way until a row is hovered or something is selected. */
    .task-sel { opacity: 0; transition: opacity var(--transition-fast); }
    .task-row:hover .task-sel, .group-head:hover .task-sel, .task-sel:focus-visible, .has-selection .task-sel { opacity: 1; }
    @media (hover: none) { .task-sel { opacity: 1; } }
    .group-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--color-subtle); }
    @container (max-width: 980px) {
      .task-row { grid-template-columns: 20px 32px minmax(0, 1fr) 148px; }
      .task-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; grid-column: 3 / -1; grid-row: 2; }
      .task-actions { grid-column: 4; grid-row: 1; }
    }
  `],
  template: `
    <div class="page">
      <app-page-header title="Tasks" subtitle="Work to get done, grouped by the ticket it belongs to">
        @if (canCreate()) {
          <button actions class="btn-primary" (click)="openCreateTaskModal()">
            <mat-icon>add</mat-icon>
            {{ 'tasks.newTask' | translate }}
          </button>
        }
      </app-page-header>

      @if (activeView() !== 'kanban') {
        <div class="tabs" role="tablist" aria-label="Task scope">
          @for (s of scopeTabs; track s.id) {
            <button role="tab" class="tab" [class.is-active]="scope() === s.id" [attr.aria-selected]="scope() === s.id" (click)="setScope(s.id)">
              <mat-icon>{{ s.icon }}</mat-icon>
              {{ s.label }}
              <span class="count-pill" [class.is-alert]="s.id === 'overdue' && scopeCounts()[s.id] > 0">{{ scopeCounts()[s.id] }}</span>
            </button>
          }
        </div>
      }

      <div class="toolbar">
        <div class="segmented" role="group" aria-label="Task view">
          <button class="segmented__item" [class.is-active]="activeView() === 'tickets'" [attr.aria-pressed]="activeView() === 'tickets'" (click)="setView('tickets')">
            <mat-icon>account_tree</mat-icon>
            By ticket
          </button>
          <button class="segmented__item" [class.is-active]="activeView() === 'list'" [attr.aria-pressed]="activeView() === 'list'" (click)="setView('list')">
            <mat-icon>checklist</mat-icon>
            {{ 'tasks.list' | translate }}
          </button>
          <button class="segmented__item" [class.is-active]="activeView() === 'kanban'" [attr.aria-pressed]="activeView() === 'kanban'" (click)="setView('kanban')">
            <mat-icon>view_column</mat-icon>
            Board
          </button>
        </div>
        <label class="search-field">
          <mat-icon>search</mat-icon>
          <input type="search" class="input-field" placeholder="Search tasks or tickets…" aria-label="Search tasks"
                 [ngModel]="searchTerm()" (ngModelChange)="setSearch($event)" />
        </label>
        <select [ngModel]="activePriorityFilter()" (ngModelChange)="activePriorityFilter.set($event); resetPages()" class="input-field" aria-label="Filter tasks by priority">
          <option [ngValue]="null">All Priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event); resetPages()" class="input-field" aria-label="Filter tasks by category">
          <option value="">All Categories</option>
          <option value="NONE">No category</option>
          @for (c of categories.categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
        <select [ngModel]="assigneeFilter()" (ngModelChange)="setAssigneeFilter($event)" class="input-field" aria-label="Filter tasks by assignee">
          <option value="">All assignees</option>
          <option value="NONE">{{ 'leads.unassigned' | translate }}</option>
          @for (user of state.users(); track user.id) {
            <option [value]="user.id">{{user.displayName}}</option>
          }
        </select>
        <select [ngModel]="linkFilter()" (ngModelChange)="linkFilter.set($event); resetPages()" class="input-field" aria-label="Filter tasks by linked record">
          <option value="">All tasks</option>
          <option value="TICKET">On a ticket</option>
          <option value="DEAL">Deal tasks</option>
          <option value="PARTNER">Partner tasks</option>
          <option value="NONE">Not linked</option>
        </select>
        @if (activeView() === 'list') {
          <select [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event); resetPages()" class="input-field" aria-label="Sort tasks">
            <option value="smart">Sort: Most urgent</option>
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="newest">Sort: Newest</option>
          </select>
        }
        @if (activeView() === 'tickets' && groups().length > 1) {
          <button (click)="allCollapsed() ? expandAll() : collapseAll()" class="btn-ghost btn-sm">
            <mat-icon>{{ allCollapsed() ? 'unfold_more' : 'unfold_less' }}</mat-icon>
            {{ allCollapsed() ? 'Expand all' : 'Collapse all' }}
          </button>
        }
        @if (hasActiveFilters()) {
          <button (click)="clearFilters()" class="btn-ghost btn-sm">
            <mat-icon>close</mat-icon>
            Clear
          </button>
        }
        <span class="toolbar__count toolbar__spacer">
          {{ visibleCount() }} task{{ visibleCount() !== 1 ? 's' : '' }}@if (activeView() === 'tickets' && ticketGroupCount() > 0) { · {{ ticketGroupCount() }} ticket{{ ticketGroupCount() !== 1 ? 's' : '' }}}
        </span>
      </div>

      @if (tasksService.isLoading$()) {
        <app-data-status-banner [loading]="true" [variant]="'rows'" [columns]="6" [rows]="8" />
      } @else {

      <!-- One task, as a checklist line. showLink adds the record chip (list view / standalone group). -->
      <ng-template #taskRow let-task let-showLink="showLink">
        <div class="task-row" [attr.data-priority]="task.priority" [class.is-selected]="selectedIds().has(task.id)">
          <input type="checkbox" class="task-sel cursor-pointer" [checked]="selectedIds().has(task.id)" (change)="toggleSelect(task.id)" [attr.aria-label]="'Select ' + task.title" />
          <button type="button" class="btn-icon btn-sm" (click)="toggleDone(task)" [disabled]="!canWrite()"
                  [title]="task.status === 'Completed' ? 'Reopen task' : 'Mark as done'"
                  [attr.aria-label]="(task.status === 'Completed' ? 'Reopen ' : 'Mark done: ') + task.title">
            <mat-icon class="icon-md" [class]="statusIconInk(task.status)">{{ statusIcon(task.status) }}</mat-icon>
          </button>

          <div class="task-main">
            <div class="flex items-start gap-2">
              <button type="button" (click)="openEditModal(task)" [disabled]="!canWrite()"
                      class="table-name-link text-sm font-medium text-left wrap-break-word min-w-0"
                      [class.line-through]="task.status === 'Completed'" [class.text-ink-3]="task.status === 'Completed'" [class.text-ink]="task.status !== 'Completed'"
                      [title]="createdTooltip(task)">{{ task.title }}</button>
              <app-category-pill class="shrink-0" [categoryId]="task.categoryId" [note]="isOnTicket(task) ? 'Same as its ticket' : ''" />
            </div>
            @if (task.description) {
              <div class="text-meta text-ink-3 mt-0.5 truncate" [title]="task.description">{{ task.description }}</div>
            }
            @if (showLink) {
              @if (getRelatedLabel(task); as label) {
                <div class="mt-1.5">
                  @if (ticketRoute(task); as route) {
                    <a [routerLink]="route" class="badge badge-neutral hover:underline" title="Open ticket">
                      <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                      <span class="truncate max-w-xs">{{ label }}</span>
                    </a>
                  } @else {
                    <span class="badge badge-neutral">
                      <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                      <span class="truncate max-w-xs">{{ label }}</span>
                    </span>
                  }
                </div>
              }
            }
          </div>

          <div class="task-meta">
            @if (task.priority) {
              <span [class]="getPriorityColor(task.priority)" class="badge justify-self-start">{{ task.priority }}</span>
            } @else {
              <span></span>
            }
            @if (task.assignedToUserId) {
              <span class="flex items-center gap-2 text-xs text-ink-2 min-w-0" [title]="getAssigneeName(task.assignedToUserId)">
                <app-user-avatar [userId]="task.assignedToUserId" [size]="20" />
                <span class="truncate">{{ getAssigneeName(task.assignedToUserId) }}</span>
              </span>
            } @else if (task.status !== 'Completed' && canWrite()) {
              <button type="button" (click)="openAssignModal(task)" class="btn-ghost btn-sm justify-self-start">
                <mat-icon class="icon-sm">person_add</mat-icon> Assign
              </button>
            } @else {
              <span class="text-xs text-ink-3">{{ 'leads.unassigned' | translate }}</span>
            }
            @if (dueInfo(task); as due) {
              <span class="inline-flex items-center gap-1 text-xs whitespace-nowrap" [class]="due.cls" [title]="due.title">
                <mat-icon class="icon-xs">{{ due.icon }}</mat-icon>{{ due.label }}
              </span>
            } @else {
              <span class="text-ink-4">—</span>
            }
            <select [ngModel]="task.status" (ngModelChange)="tasksService.updateStatus(task.id, $event)" [disabled]="!canWrite()"
                    [class]="getStatusColor(task.status)" class="pill-select justify-self-start" [attr.aria-label]="'Status of ' + task.title">
              @if (!statusOptions.includes(task.status)) { <option [value]="task.status">{{ task.status }}</option> }
              @for (st of statusOptions; track st) { <option [value]="st">{{ st }}</option> }
            </select>
          </div>

          <div class="task-actions">
            @if (canWrite()) {
              @if (task.status === 'Pending' || task.status === 'Blocked') {
                <button (click)="tasksService.updateStatus(task.id, 'In Progress')" class="btn-icon btn-sm" [title]="task.status === 'Blocked' ? 'Resume' : 'Start working'" aria-label="Start task">
                  <mat-icon class="icon-sm">play_arrow</mat-icon>
                </button>
              }
              @if (task.status !== 'Completed') {
                <button (click)="openAssignModal(task)" class="btn-icon btn-sm" title="Assign" aria-label="Assign task">
                  <mat-icon class="icon-sm">person_add</mat-icon>
                </button>
              }
              @if (!isOnTicket(task)) {
                <button (click)="openAttachModal(task)" class="btn-icon btn-sm" title="Attach to a ticket" aria-label="Attach to a ticket">
                  <mat-icon class="icon-sm">confirmation_number</mat-icon>
                </button>
              }
              <button (click)="openEditModal(task)" class="btn-icon btn-sm" title="Edit task" aria-label="Edit task">
                <mat-icon class="icon-sm">edit</mat-icon>
              </button>
            }
            @if (state.currentUserPermissions().canDeleteRecords) {
              <button (click)="deleteTask(task)" class="btn-icon btn-sm btn-danger-hover" title="Delete task" aria-label="Delete task">
                <mat-icon class="icon-sm">delete</mat-icon>
              </button>
            }
          </div>
        </div>
      </ng-template>

      <!-- By ticket: one card per ticket, its tasks nested underneath -->
      @if (activeView() === 'tickets') {
        <div class="task-list space-y-4" [class.has-selection]="selectedIds().size > 0">
          @for (g of pagedGroups(); track g.key) {
            <section class="card overflow-hidden">
              <div class="group-head" [class.border-b]="!collapsed().has(g.key)" [class.border-line-soft]="!collapsed().has(g.key)">
                <input type="checkbox" class="task-sel cursor-pointer" [checked]="groupAllSelected(g)" (change)="toggleGroupSelect(g)" [attr.aria-label]="'Select all tasks in ' + groupTitle(g)" />
                <button type="button" class="btn-icon btn-sm" (click)="toggleGroup(g.key)" [attr.aria-expanded]="!collapsed().has(g.key)"
                        [attr.aria-label]="(collapsed().has(g.key) ? 'Expand ' : 'Collapse ') + groupTitle(g)">
                  <mat-icon class="icon-sm">{{ collapsed().has(g.key) ? 'chevron_right' : 'expand_more' }}</mat-icon>
                </button>
                <mat-icon class="icon-md text-ink-3 shrink-0">{{ g.key === NO_TICKET ? 'checklist' : 'confirmation_number' }}</mat-icon>
                <div class="min-w-0 flex-1">
                  @if (g.key === NO_TICKET) {
                    <div class="text-sm font-semibold text-ink">Standalone tasks</div>
                    <div class="text-meta text-ink-3 mt-0.5">Not part of a ticket</div>
                  } @else if (g.ticket; as t) {
                    <a [routerLink]="['/tickets', t.id]" class="table-name-link text-sm font-semibold text-ink wrap-break-word" title="Open ticket">{{ t.title }}</a>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-meta text-ink-3">
                      <app-category-pill [categoryId]="t.categoryId" />
                      <span [class]="ticketStatusClass(t.status)" class="badge">{{ ticketStatusLabel(t.status) }}</span>
                      <span class="inline-flex items-center gap-0.5 font-semibold" [class]="ticketPriorityInk(t.priority)">
                        <mat-icon class="icon-xs">flag</mat-icon>{{ ticketPriorityLabel(t.priority) }}
                      </span>
                      @if (partnerNameOf(t); as partner) {
                        <span class="inline-flex items-center gap-1"><mat-icon class="icon-xs">business</mat-icon>{{ partner }}</span>
                      }
                      @if (t.deadline) {
                        <span class="inline-flex items-center gap-1"><mat-icon class="icon-xs">event</mat-icon>Due {{ t.deadline | date:'d MMM' }}</span>
                      }
                    </div>
                  } @else {
                    <div class="text-sm font-semibold text-ink">Ticket unavailable</div>
                    <div class="text-meta text-ink-3 mt-0.5">It may have been deleted or is still loading</div>
                  }
                </div>
                @if (g.overdue > 0) {
                  <span class="badge badge-danger shrink-0">{{ g.overdue }} overdue</span>
                }
                @if (g.key !== NO_TICKET) {
                  <span class="inline-flex items-center gap-2 shrink-0" [title]="g.done + ' of ' + g.total + ' tasks done'">
                    <span class="text-xs font-semibold tabular-nums" [class]="g.done === g.total ? 'text-success-ink' : 'text-ink-2'">{{ g.done }}/{{ g.total }}</span>
                    <span class="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                      <span class="block h-full rounded-full" [class]="g.done === g.total ? 'bg-success' : 'bg-primary'" [style.width.%]="g.percent"></span>
                    </span>
                  </span>
                  <a [routerLink]="['/tickets', g.key]" class="btn-icon btn-sm shrink-0" title="Open ticket" aria-label="Open ticket">
                    <mat-icon class="icon-sm">open_in_new</mat-icon>
                  </a>
                }
              </div>

              @if (!collapsed().has(g.key)) {
                <div>
                  @for (task of g.tasks; track task.id) {
                    <ng-container [ngTemplateOutlet]="taskRow" [ngTemplateOutletContext]="{ $implicit: task, showLink: g.key === NO_TICKET }" />
                  }
                </div>
                @if (g.key !== NO_TICKET && canCreate()) {
                  <div class="px-4 py-2 border-t border-line-soft">
                    @if (addingTo() === g.key) {
                      <div class="flex items-center gap-2">
                        <mat-icon class="icon-sm text-ink-3">add</mat-icon>
                        <input [id]="'quick-add-' + g.key" type="text" class="input-field flex-1" placeholder="New task title — press Enter to add" aria-label="New task title"
                               [(ngModel)]="quickTitle" (keydown.enter)="quickAdd(g.key)" (keydown.escape)="addingTo.set(null)" />
                        <button (click)="quickAdd(g.key)" [disabled]="!quickTitle.trim()" class="btn-primary btn-sm">Add</button>
                        <button (click)="addingTo.set(null)" class="btn-ghost btn-sm">Done</button>
                      </div>
                    } @else {
                      <button (click)="startQuickAdd(g.key)" class="btn-ghost btn-sm">
                        <mat-icon>add</mat-icon> Add task to this ticket
                      </button>
                    }
                  </div>
                }
              }
            </section>
          } @empty {
            <div class="card">
              <app-empty-state icon="task_alt"
                [title]="hasActiveFilters() ? 'No tasks match your filters' : emptyTitle()"
                [text]="hasActiveFilters() ? 'Try a different search or clear the filters.' : 'Tasks you create or are assigned will show up here, grouped by ticket.'" />
            </div>
          }
        </div>
        @if (groups().length > 0) {
          <app-paginator
            label="Tickets per page"
            [currentPage]="currentGroupPage()"
            [totalPages]="groupTotalPages()"
            [pageSize]="groupsPageSize()"
            (pageChange)="groupsPage.set($event)"
            (pageSizeChange)="groupsPageSize.set($event)" />
        }
      }

      <!-- Flat list -->
      @if (activeView() === 'list') {
        <div class="card overflow-hidden">
          <div class="task-list" [class.has-selection]="selectedIds().size > 0">
            @for (task of paginatedTasks(); track task.id) {
              <ng-container [ngTemplateOutlet]="taskRow" [ngTemplateOutletContext]="{ $implicit: task, showLink: true }" />
            } @empty {
              <app-empty-state icon="task_alt"
                [title]="hasActiveFilters() ? 'No tasks match your filters' : emptyTitle()"
                [text]="hasActiveFilters() ? 'Try a different search or clear the filters.' : 'Tasks you create or are assigned will show up here.'" />
            }
          </div>
          @if (scopeFiltered().length > 0) {
            <app-paginator
              [currentPage]="currentPage()"
              [totalPages]="tasksTotalPages()"
              [pageSize]="tasksPageSize()"
              (pageChange)="tasksPage.set($event)"
              (pageSizeChange)="tasksPageSize.set($event)" />
          }
        </div>
      }

      <!-- Kanban View -->
      @if (activeView() === 'kanban') {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[600px]" cdkDropListGroup>
          <div class="card p-4 flex flex-col">
            <div class="flex items-center justify-between mb-4 px-1">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-ink-4"></div>
                <h3 class="eyebrow">{{ 'tasks.pending' | translate }}</h3>
              </div>
              <span class="badge badge-neutral">{{pendingTasks().length}}</span>
            </div>
            <div
              cdkDropList
              [cdkDropListData]="pendingTasks()"
              (cdkDropListDropped)="onDrop($event, 'Pending')"
              class="kanban-column flex-1 space-y-3 min-h-[100px] rounded-xl"
            >
              @for (task of pendingTasks(); track task.id) {
                <div cdkDrag [cdkDragData]="task" class="kanban-card card p-4 cursor-grab active:cursor-grabbing">
                  <div class="flex items-start justify-between mb-2">
                    <span class="text-meta text-ink-3">#{{ task.id.slice(0, 8) }}</span>
                    <div class="flex items-center gap-1">
                      @if (task.priority) {
                        <span [class]="getPriorityColor(task.priority)" class="badge">{{task.priority}}</span>
                      }
                      <span [class]="getStatusColor(task.status)" class="badge">{{task.status}}</span>
                    </div>
                  </div>
                  <h4 class="card-title mb-2 leading-snug">{{task.title}}</h4>
                  @if (task.categoryId) { <app-category-pill class="mb-2" [categoryId]="task.categoryId" /> }
                  @if (getRelatedLabel(task); as label) {
                    @if (ticketRoute(task); as route) {
                      <a [routerLink]="route" (mousedown)="$event.stopPropagation()" class="btn-secondary btn-sm mb-2" title="Open ticket">
                        <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </a>
                    } @else {
                      <div class="badge badge-neutral mb-2">
                        <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </div>
                    }
                  }
                  <div class="flex items-center gap-2 text-meta text-ink-3 pt-2 border-t border-line-soft">
                    @if (task.assignedToUserId) {
                      <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                      <span class="font-medium truncate">{{ getAssigneeName(task.assignedToUserId) }}</span>
                    } @else {
                      <mat-icon class="icon-xs">person</mat-icon>
                      <span class="font-medium truncate">{{ 'leads.unassigned' | translate }}</span>
                    }
                    @if (task.assignedTeamId) {
                      <span class="badge badge-neutral ml-auto">{{getTeamName(task.assignedTeamId)}}</span>
                    }
                  </div>
                  <div class="mt-2 pt-2 border-t border-line-soft flex items-center gap-2 text-meta text-ink-3">
                    <app-created-by-badge [createdBy]="task.createdBy" [createdAt]="task.createdAt" [size]="20" />
                  </div>
                </div>
              } @empty {
                <div class="text-center py-8 text-xs text-ink-3 italic">{{ 'tasks.noTasks' | translate }}</div>
              }
            </div>
          </div>

          <div class="card p-4 flex flex-col">
            <div class="flex items-center justify-between mb-4 px-1">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-ink-2"></div>
                <h3 class="eyebrow">{{ 'tasks.inProgress' | translate }}</h3>
              </div>
              <span class="badge badge-neutral">{{inProgressTasks().length}}</span>
            </div>
            <div
              cdkDropList
              [cdkDropListData]="inProgressTasks()"
              (cdkDropListDropped)="onDrop($event, 'In Progress')"
              class="kanban-column flex-1 space-y-3 min-h-[100px] rounded-xl"
            >
              @for (task of inProgressTasks(); track task.id) {
                <div cdkDrag [cdkDragData]="task" class="kanban-card card p-4 cursor-grab active:cursor-grabbing">
                  <div class="flex items-start justify-between mb-2">
                    <span class="text-meta text-ink-3">#{{ task.id.slice(0, 8) }}</span>
                    <div class="flex items-center gap-1">
                      @if (task.priority) {
                        <span [class]="getPriorityColor(task.priority)" class="badge">{{task.priority}}</span>
                      }
                      <span [class]="getStatusColor(task.status)" class="badge">{{task.status}}</span>
                    </div>
                  </div>
                  <h4 class="card-title mb-2 leading-snug">{{task.title}}</h4>
                  @if (task.categoryId) { <app-category-pill class="mb-2" [categoryId]="task.categoryId" /> }
                  @if (getRelatedLabel(task); as label) {
                    @if (ticketRoute(task); as route) {
                      <a [routerLink]="route" (mousedown)="$event.stopPropagation()" class="btn-secondary btn-sm mb-2" title="Open ticket">
                        <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </a>
                    } @else {
                      <div class="badge badge-neutral mb-2">
                        <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </div>
                    }
                  }
                  <div class="flex items-center gap-2 text-meta text-ink-3 pt-2 border-t border-line-soft">
                    @if (task.assignedToUserId) {
                      <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                      <span class="font-medium truncate">{{ getAssigneeName(task.assignedToUserId) }}</span>
                    } @else {
                      <mat-icon class="icon-xs">person</mat-icon>
                      <span class="font-medium truncate">{{ 'leads.unassigned' | translate }}</span>
                    }
                    @if (task.assignedTeamId) {
                      <span class="badge badge-neutral ml-auto">{{getTeamName(task.assignedTeamId)}}</span>
                    }
                  </div>
                  <div class="mt-2 pt-2 border-t border-line-soft flex items-center gap-2 text-meta text-ink-3">
                    <app-created-by-badge [createdBy]="task.createdBy" [createdAt]="task.createdAt" [size]="20" />
                  </div>
                </div>
              } @empty {
                <div class="text-center py-8 text-xs text-ink-3 italic">{{ 'tasks.noTasks' | translate }}</div>
              }
            </div>
          </div>

          <div class="card p-4 flex flex-col">
            <div class="flex items-center justify-between mb-4 px-1">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-ink-2"></div>
                <h3 class="eyebrow">{{ 'tasks.completed' | translate }}</h3>
              </div>
              <span class="badge badge-neutral">{{completedTasks().length}}</span>
            </div>
            <div
              cdkDropList
              [cdkDropListData]="completedTasks()"
              (cdkDropListDropped)="onDrop($event, 'Completed')"
              class="kanban-column flex-1 space-y-3 min-h-[100px] rounded-xl"
            >
              @for (task of completedTasks(); track task.id) {
                <div cdkDrag [cdkDragData]="task" class="kanban-card card p-4 cursor-grab active:cursor-grabbing">
                  <div class="flex items-start justify-between mb-2">
                    <span class="text-meta text-ink-3">#{{ task.id.slice(0, 8) }}</span>
                    <div class="flex items-center gap-1">
                      @if (task.priority) {
                        <span [class]="getPriorityColor(task.priority)" class="badge">{{task.priority}}</span>
                      }
                      <span [class]="getStatusColor(task.status)" class="badge">{{task.status}}</span>
                    </div>
                  </div>
                  <h4 class="card-title mb-2 leading-snug">{{task.title}}</h4>
                  @if (task.categoryId) { <app-category-pill class="mb-2" [categoryId]="task.categoryId" /> }
                  @if (getRelatedLabel(task); as label) {
                    @if (ticketRoute(task); as route) {
                      <a [routerLink]="route" (mousedown)="$event.stopPropagation()" class="btn-secondary btn-sm mb-2" title="Open ticket">
                        <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </a>
                    } @else {
                      <div class="badge badge-neutral mb-2">
                        <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </div>
                    }
                  }
                  <div class="flex items-center gap-2 text-meta text-ink-3 pt-2 border-t border-line-soft">
                    @if (task.assignedToUserId) {
                      <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                      <span class="font-medium truncate">{{ getAssigneeName(task.assignedToUserId) }}</span>
                    } @else {
                      <mat-icon class="icon-xs">person</mat-icon>
                      <span class="font-medium truncate">{{ 'leads.unassigned' | translate }}</span>
                    }
                    @if (task.assignedTeamId) {
                      <span class="badge badge-neutral ml-auto">{{getTeamName(task.assignedTeamId)}}</span>
                    }
                  </div>
                  <div class="mt-2 pt-2 border-t border-line-soft flex items-center gap-2 text-meta text-ink-3">
                    <app-created-by-badge [createdBy]="task.createdBy" [createdAt]="task.createdAt" [size]="20" />
                  </div>
                </div>
              } @empty {
                <div class="text-center py-8 text-xs text-ink-3 italic">{{ 'tasks.noTasks' | translate }}</div>
              }
            </div>
          </div>
        </div>
      }
      }
      @if (tasksService.error$()) {
        <app-data-status-banner [error]="tasksService.error$()" />
      }
      @if (selectedIds().size > 0 && activeView() !== 'kanban') {
        <div class="bulk-action-bar">
          <span class="font-semibold">{{ selectedIds().size }} selected</span>
          <div class="bulk-action-bar__sep"></div>
          @if (canWrite()) {
            <select (change)="bulkAssign($event)" aria-label="Assign selected tasks">
              <option value="">Assign to…</option>
              @for (u of state.users(); track u.id) { <option [value]="u.id">{{u.displayName}}</option> }
            </select>
            <select (change)="bulkChangeStatus($event)" aria-label="Change status of selected tasks">
              <option value="">Change status…</option>
              @for (s of statusOptions; track s) { <option [value]="s">{{s}}</option> }
            </select>
            <select (change)="bulkAttach($event)" aria-label="Attach selected tasks to a ticket">
              <option value="">Attach to ticket…</option>
              @for (t of ticketChoices().open; track t.id) { <option [value]="t.id">{{ ticketOptionLabel(t) }}</option> }
            </select>
          }
          <button class="bulk-action-bar__btn" (click)="bulkExport()">Export CSV</button>
          <button class="bulk-action-bar__btn is-quiet" (click)="clearSelection()">Clear</button>
        </div>
      }
    </div>

    <!-- Create Task Modal -->
    @if (taskModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <h3 class="modal-title">{{ 'tasks.newTask' | translate }}</h3>

          <div class="space-y-3">
            <div>
              <label for="task_title" class="field-label mb-1.5">Task Title</label>
              <input id="task_title" [(ngModel)]="newTaskData.title" type="text" placeholder="e.g. Generate Customer Invoice" class="input-field w-full">
            </div>

            <div>
              <label for="description" class="field-label mb-1.5">Description</label>
              <textarea id="description" [(ngModel)]="newTaskData.description" rows="2" class="input-field w-full"></textarea>
            </div>

            <div>
              <label for="new_task_ticket" class="field-label mb-1.5">Ticket <span class="text-ink-3 normal-case font-medium">(optional)</span></label>
              <select id="new_task_ticket" [(ngModel)]="newTaskData.ticketId" class="input-field w-full">
                <option value="">Not part of a ticket</option>
                  <optgroup label="Open tickets">
                    @for (t of ticketChoices().open; track t.id) { <option [value]="t.id">{{ ticketOptionLabel(t) }}</option> }
                  </optgroup>
                  @if (ticketChoices().closed.length) {
                    <optgroup label="Resolved / closed">
                      @for (t of ticketChoices().closed; track t.id) { <option [value]="t.id">{{ ticketOptionLabel(t) }}</option> }
                    </optgroup>
                  }
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="assigned_team" class="field-label mb-1.5">Assigned Team</label>
                <select id="assigned_team" [(ngModel)]="newTaskData.assignedTeamId" class="input-field w-full">
                  <option value="">{{ 'leads.unassigned' | translate }}</option>
                  @for (team of state.teams(); track team.id) {
                    <option [value]="team.id">{{team.name}}</option>
                  }
                </select>
              </div>
              <div>
                <label for="priority" class="field-label mb-1.5">Priority</label>
                <select id="priority" [(ngModel)]="newTaskData.priority" class="input-field w-full">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label for="due_date" class="field-label mb-1.5">Due Date</label>
              <input id="due_date" [(ngModel)]="newTaskData.dueDate" type="date" class="input-field w-full">
            </div>

            <div>
              <span class="eyebrow block mb-1">Assigned Person</span>
              <app-user-picker [(value)]="newTaskData.assignedToUserId" />
            </div>

            <div>
              <span class="field-label mb-1.5 block">Category <span class="text-ink-3 normal-case font-medium">(optional)</span></span>
              <app-category-picker [value]="newTaskData.ticketId ? ticketCategoryId(newTaskData.ticketId) : newTaskData.categoryId"
                                   (valueChange)="newTaskData.categoryId = $event" [disabled]="!!newTaskData.ticketId"
                                   [hint]="newTaskData.ticketId ? 'A task on a ticket takes the ticket’s category — change it on the ticket.' : ''" />
            </div>

            @if (!newTaskData.ticketId) {
              <app-related-entity-picker [(link)]="newTaskData.link" label="Or link to another record" />
            }
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-line-soft">
            <button (click)="closeTaskModal()" class="btn-secondary">{{ 'common.cancel' | translate }}</button>
            <button (click)="saveTask()" [disabled]="!newTaskData.title.trim()" class="btn-primary">{{ 'common.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Edit Task Modal -->
    @if (editingTask(); as task) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <div class="flex justify-between items-center">
            <h3 class="modal-title">Edit task</h3>
            <button (click)="closeEditModal()" class="btn-icon btn-sm" aria-label="Close">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label for="edit_task_title" class="field-label mb-1.5">Task Title</label>
              <input id="edit_task_title" [(ngModel)]="editData.title" type="text" class="input-field w-full">
            </div>
            <div>
              <label for="edit_task_description" class="field-label mb-1.5">Description</label>
              <textarea id="edit_task_description" [(ngModel)]="editData.description" rows="3" class="input-field w-full"></textarea>
            </div>
            <div>
              <label for="edit_task_ticket" class="field-label mb-1.5">Ticket <span class="text-ink-3 normal-case font-medium">(optional)</span></label>
              <select id="edit_task_ticket" [(ngModel)]="editData.ticketId" class="input-field w-full">
                <option value="">Not part of a ticket</option>
                  <optgroup label="Open tickets">
                    @for (t of ticketChoices().open; track t.id) { <option [value]="t.id">{{ ticketOptionLabel(t) }}</option> }
                  </optgroup>
                  @if (ticketChoices().closed.length) {
                    <optgroup label="Resolved / closed">
                      @for (t of ticketChoices().closed; track t.id) { <option [value]="t.id">{{ ticketOptionLabel(t) }}</option> }
                    </optgroup>
                  }
              </select>
              @if (!isOnTicket(task) && getRelatedLabel(task); as other) {
                <p class="text-xs text-ink-3 mt-1">Currently linked to {{ other }}. Choosing a ticket replaces that link.</p>
              }
            </div>
            <div>
              <span class="field-label mb-1.5 block">Category <span class="text-ink-3 normal-case font-medium">(optional)</span></span>
              <app-category-picker [value]="editData.ticketId ? ticketCategoryId(editData.ticketId) : editData.categoryId"
                                   (valueChange)="editData.categoryId = $event" [disabled]="!!editData.ticketId"
                                   [hint]="editData.ticketId ? 'A task on a ticket takes the ticket’s category — change it on the ticket.' : ''" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="edit_task_status" class="field-label mb-1.5">Status</label>
                <select id="edit_task_status" [(ngModel)]="editData.status" class="input-field w-full">
                  @if (!statusOptions.includes(editData.status)) { <option [value]="editData.status">{{ editData.status }}</option> }
                  @for (st of statusOptions; track st) { <option [value]="st">{{ st }}</option> }
                </select>
              </div>
              <div>
                <label for="edit_task_priority" class="field-label mb-1.5">Priority</label>
                <select id="edit_task_priority" [(ngModel)]="editData.priority" class="input-field w-full">
                  <option value="">None</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="edit_task_due" class="field-label mb-1.5">Due Date</label>
                <input id="edit_task_due" [(ngModel)]="editData.dueDate" type="date" class="input-field w-full">
              </div>
              <div>
                <label for="edit_task_team" class="field-label mb-1.5">Assigned Team</label>
                <select id="edit_task_team" [(ngModel)]="editData.assignedTeamId" class="input-field w-full">
                  <option value="">{{ 'leads.unassigned' | translate }}</option>
                  @for (team of state.teams(); track team.id) {
                    <option [value]="team.id">{{team.name}}</option>
                  }
                </select>
              </div>
            </div>
            <div>
              <span class="eyebrow block mb-1">Assigned Person</span>
              <app-user-picker [(value)]="editData.assignedToUserId" />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-line-soft">
            <button (click)="closeEditModal()" class="btn-secondary">{{ 'common.cancel' | translate }}</button>
            <button (click)="saveEdit(task)" [disabled]="!editData.title.trim()" class="btn-primary">{{ 'common.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Attach to ticket -->
    @if (attachingTask(); as task) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <h3 class="modal-title">Attach to a ticket</h3>
          <p class="text-sm text-ink-2">"{{ task.title }}" will show up under the ticket you pick.</p>
          <div>
            <label for="attach_ticket" class="field-label mb-1.5">Ticket</label>
            <select id="attach_ticket" [(ngModel)]="attachTicketId" class="input-field w-full">
              <option value="">Select a ticket…</option>
                  <optgroup label="Open tickets">
                    @for (t of ticketChoices().open; track t.id) { <option [value]="t.id">{{ ticketOptionLabel(t) }}</option> }
                  </optgroup>
                  @if (ticketChoices().closed.length) {
                    <optgroup label="Resolved / closed">
                      @for (t of ticketChoices().closed; track t.id) { <option [value]="t.id">{{ ticketOptionLabel(t) }}</option> }
                    </optgroup>
                  }
            </select>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button (click)="attachingTask.set(null)" class="btn-secondary">Cancel</button>
            <button (click)="saveAttach(task)" [disabled]="!attachTicketId" class="btn-primary">Attach</button>
          </div>
        </div>
      </div>
    }

    <!-- Assign Modal -->
    @if (assignModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal modal-sm">
          <h3 class="modal-title">Assign Task: {{selectedTask()?.title}}</h3>
          <div>
            <span class="eyebrow block mb-1">Select Assignee</span>
            <app-user-picker [(value)]="reassignedUser" />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button (click)="assignModalOpen.set(false)" class="btn-secondary">Cancel</button>
            <button (click)="saveAssignment()" class="btn-primary">Assign</button>
          </div>
        </div>
      </div>
    }
  `
})
export class TasksComponent {
  private confirmDialog = inject(ConfirmService);
  state = inject(CrmStateService);
  tasksService = inject(TasksService);
  ticketsService = inject(TicketsService);
  categories = inject(CategoriesService);
  translation = inject(TranslationService);
  private related = inject(RelatedEntityService);

  readonly NO_TICKET = NO_TICKET;

  canCreate(): boolean { return this.state.hasAuthority('TASKS_CREATE'); }
  canWrite(): boolean { return this.state.hasAuthority('TASKS_WRITE'); }
  canDelete(): boolean { return this.state.hasAuthority('TASKS_DELETE'); }

  /** The chosen view is remembered; "By ticket" is the default. */
  private static readonly VIEW_KEY = 'bento_tasks_view';
  activeView = signal<TaskView>(TasksComponent.storedView());
  activePriorityFilter = signal<'Urgent' | 'Medium' | 'Low' | null>(null);

  private static storedView(): TaskView {
    try {
      const v = typeof localStorage !== 'undefined' ? localStorage.getItem(TasksComponent.VIEW_KEY) : null;
      return v === 'list' || v === 'kanban' ? v : 'tickets';
    } catch { return 'tickets'; }
  }

  setView(view: TaskView) {
    this.activeView.set(view);
    try { localStorage.setItem(TasksComponent.VIEW_KEY, view); } catch { /* storage unavailable */ }
  }

  /** Narrow the board to tasks linked to one kind of record ('NONE' = unlinked, '' = all). */
  linkFilter = signal<'' | 'TICKET' | 'DEAL' | 'PARTNER' | 'NONE'>('');

  /** '' = every category, 'NONE' = tasks without one, otherwise a category id. */
  categoryFilter = signal<string>('');

  /** Narrow the board to tasks assigned to one user ('NONE' = unassigned, '' = everyone). Remembered across sessions. */
  private static readonly ASSIGNEE_FILTER_KEY = 'bento_task_assignee_filter';
  assigneeFilter = signal<string>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(TasksComponent.ASSIGNEE_FILTER_KEY) || '' : ''
  );

  setAssigneeFilter(value: string) {
    this.assigneeFilter.set(value);
    this.resetPages();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TasksComponent.ASSIGNEE_FILTER_KEY, value);
    }
  }

  searchTerm = signal('');
  scope = signal<TaskScope>('open');
  sortBy = signal<TaskSort>('smart');
  selectedIds = signal<Set<string>>(new Set());

  readonly scopeTabs: { id: TaskScope; label: string; icon: string }[] = [
    { id: 'open', label: 'Open', icon: 'pending_actions' },
    { id: 'overdue', label: 'Overdue', icon: 'event_busy' },
    { id: 'completed', label: 'Completed', icon: 'task_alt' },
    { id: 'all', label: 'All', icon: 'list_alt' }
  ];
  readonly statusOptions: Task['status'][] = ['Pending', 'In Progress', 'Completed'];

  /** Local calendar day (YYYY-MM-DD) — due dates are plain dates, so compare against the user's today, not UTC's. */
  private today = TasksComponent.localDay(new Date());
  private static localDay(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  private static dayNumber(day: string): number {
    return Math.round(Date.parse(day.slice(0, 10) + 'T00:00:00Z') / 86_400_000);
  }

  resetPages() {
    this.tasksPage.set(1);
    this.groupsPage.set(1);
  }

  setSearch(value: string) {
    this.searchTerm.set(value ?? '');
    this.resetPages();
  }

  setScope(scope: TaskScope) {
    this.scope.set(scope);
    this.resetPages();
  }

  // ---- Tickets ----

  private ticketMap = computed(() => new Map(this.ticketsService.allTickets().map(t => [t.id, t])));

  isOnTicket(task: Task): boolean {
    return task.relatedEntityType === 'TICKET' && !!task.relatedEntityId;
  }

  ticketOf(task: Task): Ticket | undefined {
    return this.isOnTicket(task) ? this.ticketMap().get(task.relatedEntityId!) : undefined;
  }

  /** Tickets to pick from, open ones first. */
  ticketChoices = computed(() => {
    const all = [...this.ticketsService.allTickets()].sort((a, b) => a.title.localeCompare(b.title));
    const isOpen = (t: Ticket) => t.status === 'OPEN' || t.status === 'IN_PROGRESS';
    return { open: all.filter(isOpen), closed: all.filter(t => !isOpen(t)) };
  });

  partnerNameOf(ticket: Ticket): string {
    const id = ticket.relatedPartnerId || ticket.partnerId;
    return id ? this.state.partners().find(p => p.id === id)?.name ?? '' : '';
  }

  /** A task on a ticket takes the ticket's category, so the forms show it rather than offering a choice. */
  ticketCategoryId(ticketId: string): string {
    return this.ticketMap().get(ticketId)?.categoryId ?? '';
  }

  ticketOptionLabel(ticket: Ticket): string {
    const partner = this.partnerNameOf(ticket);
    return partner ? `${ticket.title} · ${partner}` : ticket.title;
  }

  ticketStatusLabel(status: TicketStatus): string {
    return { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed' }[status];
  }

  ticketStatusClass(status: TicketStatus): string {
    return { OPEN: 'badge-danger', IN_PROGRESS: 'badge-warning', RESOLVED: 'badge-success', CLOSED: 'badge-neutral' }[status];
  }

  ticketPriorityLabel(priority: TicketPriority): string {
    return { URGENT: 'Urgent', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }[priority];
  }

  ticketPriorityInk(priority: TicketPriority): string {
    return { URGENT: 'text-danger-ink', HIGH: 'text-warning-ink', MEDIUM: 'text-success-ink', LOW: 'text-accent-ink' }[priority];
  }

  // ---- Filtering, scoping, sorting ----

  /** Search, priority, linked record and assignee — shared by every view. */
  filteredTasks = computed(() => {
    const priority = this.activePriorityFilter();
    const link = this.linkFilter();
    const category = this.categoryFilter();
    const assignee = this.assigneeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.tasksService.allTasks().filter(t =>
      (!q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q) || t.id.toLowerCase().includes(q) ||
        this.getRelatedLabel(t).toLowerCase().includes(q) || this.getAssigneeName(t.assignedToUserId).toLowerCase().includes(q)) &&
      (!priority || t.priority === priority) &&
      (!link || (link === 'NONE' ? !t.relatedEntityType : t.relatedEntityType === link)) &&
      (!category || (category === 'NONE' ? !t.categoryId : t.categoryId === category)) &&
      (!assignee || (assignee === 'NONE' ? !t.assignedToUserId : t.assignedToUserId === assignee))
    );
  });

  hasActiveFilters = computed(() => !!this.searchTerm() || !!this.activePriorityFilter() || !!this.linkFilter() || !!this.categoryFilter() || !!this.assigneeFilter());

  isOverdue(task: Task): boolean {
    return !!task.dueDate && task.status !== 'Completed' && task.dueDate.slice(0, 10) < this.today;
  }

  /** Tab counts follow the active filters, so "Overdue 3" always means 3 matching tasks. */
  scopeCounts = computed<Record<TaskScope, number>>(() => {
    const tasks = this.filteredTasks();
    return {
      open: tasks.filter(t => t.status !== 'Completed').length,
      overdue: tasks.filter(t => this.isOverdue(t)).length,
      completed: tasks.filter(t => t.status === 'Completed').length,
      all: tasks.length
    };
  });

  /** Filtered tasks within the active tab. */
  scopeFiltered = computed(() => {
    const scope = this.scope();
    return this.filteredTasks().filter(t =>
      scope === 'all' || (scope === 'open' && t.status !== 'Completed') ||
      (scope === 'overdue' && this.isOverdue(t)) || (scope === 'completed' && t.status === 'Completed'));
  });

  /** The flat list, ordered per the sort picker. */
  scopedTasks = computed(() => this.sortTasks(this.scopeFiltered(), this.sortBy()));

  visibleCount = computed(() => this.activeView() === 'kanban' ? this.filteredTasks().length : this.scopeFiltered().length);

  private sortTasks(tasks: Task[], sort: TaskSort): Task[] {
    const prio = (t: Task) => t.priority === 'Urgent' ? 0 : t.priority === 'Medium' ? 1 : t.priority === 'Low' ? 2 : 3;
    const due = (t: Task) => t.dueDate ? t.dueDate.slice(0, 10) : '9999-12-31';
    const done = (t: Task) => t.status === 'Completed' ? 1 : 0;
    const newest = (a: Task, b: Task) => (b.createdAt || '').localeCompare(a.createdAt || '');
    return [...tasks].sort((a, b) => {
      switch (sort) {
        case 'due': return done(a) - done(b) || due(a).localeCompare(due(b)) || newest(a, b);
        case 'priority': return done(a) - done(b) || prio(a) - prio(b) || due(a).localeCompare(due(b)) || newest(a, b);
        case 'newest': return newest(a, b);
        default: // most urgent: overdue → priority → soonest due → newest; finished work sinks
          return done(a) - done(b) || Number(this.isOverdue(b)) - Number(this.isOverdue(a)) ||
            prio(a) - prio(b) || due(a).localeCompare(due(b)) || newest(a, b);
      }
    });
  }

  pendingTasks = computed(() => this.filteredTasks().filter(t => t.status === 'Pending'));
  inProgressTasks = computed(() => this.filteredTasks().filter(t => t.status === 'In Progress'));
  completedTasks = computed(() => this.filteredTasks().filter(t => t.status === 'Completed'));

  // ---- Flat list paging ----

  tasksPage = signal(1);
  tasksPageSize = signal(20);
  tasksTotalPages = computed(() => Math.max(1, Math.ceil(this.scopedTasks().length / this.tasksPageSize())));
  /** The requested page, held within range when tasks leave the tab (e.g. completing one on "Open"). */
  currentPage = computed(() => Math.min(this.tasksPage(), this.tasksTotalPages()));
  paginatedTasks = computed(() => {
    const start = (this.currentPage() - 1) * this.tasksPageSize();
    return this.scopedTasks().slice(start, start + this.tasksPageSize());
  });

  // ---- By-ticket groups ----

  /**
   * One group per ticket that has tasks in view, plus a "standalone" group for tasks that belong
   * to no ticket (or to a deal/partner instead). Needs-attention groups come first: most overdue,
   * then the ticket's own priority, then the soonest due task.
   */
  groups = computed<TaskGroup[]>(() => {
    const tickets = this.ticketMap();
    const keyOf = (t: Task) => this.isOnTicket(t) ? t.relatedEntityId! : NO_TICKET;

    const wholeTicket = new Map<string, Task[]>();
    for (const t of this.tasksService.allTasks()) {
      if (!this.isOnTicket(t)) continue;
      const list = wholeTicket.get(t.relatedEntityId!) ?? [];
      list.push(t);
      wholeTicket.set(t.relatedEntityId!, list);
    }

    const buckets = new Map<string, Task[]>();
    for (const t of this.sortTasks(this.scopeFiltered(), 'smart')) {
      const list = buckets.get(keyOf(t)) ?? [];
      list.push(t);
      buckets.set(keyOf(t), list);
    }

    const rank = (g: TaskGroup) => g.ticket ? ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].indexOf(g.ticket.priority) : 4;
    const nextDue = (g: TaskGroup) => g.tasks.filter(t => t.status !== 'Completed' && t.dueDate).map(t => t.dueDate!.slice(0, 10)).sort()[0] ?? '9999-12-31';
    const title = (g: TaskGroup) => (g.ticket?.title ?? '').toLowerCase();

    return [...buckets].map(([key, tasks]): TaskGroup => {
      const whole = key === NO_TICKET ? tasks : (wholeTicket.get(key) ?? tasks);
      const done = whole.filter(t => t.status === 'Completed').length;
      return {
        key, tasks, ticket: tickets.get(key),
        total: whole.length, done, percent: whole.length ? Math.round((done / whole.length) * 100) : 0,
        overdue: tasks.filter(t => this.isOverdue(t)).length
      };
    }).sort((a, b) =>
      Number(a.key === NO_TICKET) - Number(b.key === NO_TICKET) ||
      b.overdue - a.overdue || rank(a) - rank(b) || nextDue(a).localeCompare(nextDue(b)) || title(a).localeCompare(title(b)));
  });

  ticketGroupCount = computed(() => this.groups().filter(g => g.key !== NO_TICKET).length);

  groupsPage = signal(1);
  groupsPageSize = signal(10);
  groupTotalPages = computed(() => Math.max(1, Math.ceil(this.groups().length / this.groupsPageSize())));
  currentGroupPage = computed(() => Math.min(this.groupsPage(), this.groupTotalPages()));
  pagedGroups = computed(() => {
    const start = (this.currentGroupPage() - 1) * this.groupsPageSize();
    return this.groups().slice(start, start + this.groupsPageSize());
  });

  groupTitle(g: TaskGroup): string {
    return g.key === NO_TICKET ? 'standalone tasks' : (g.ticket?.title ?? 'ticket');
  }

  collapsed = signal<Set<string>>(new Set());
  allCollapsed = computed(() => this.groups().length > 0 && this.groups().every(g => this.collapsed().has(g.key)));

  toggleGroup(key: string) {
    const next = new Set(this.collapsed());
    if (!next.delete(key)) next.add(key);
    this.collapsed.set(next);
  }

  expandAll() { this.collapsed.set(new Set()); }
  collapseAll() { this.collapsed.set(new Set(this.groups().map(g => g.key))); }

  // ---- Quick add (inside a ticket card) ----

  addingTo = signal<string | null>(null);
  quickTitle = '';

  startQuickAdd(key: string) {
    this.quickTitle = '';
    this.addingTo.set(key);
    setTimeout(() => document.getElementById('quick-add-' + key)?.focus());
  }

  /** Stays open after adding, so several tasks can be entered in a row. */
  quickAdd(ticketId: string) {
    const title = this.quickTitle.trim();
    if (!title || !this.canCreate()) return;
    this.tasksService.addTaskToTicket(ticketId, { title });
    this.quickTitle = '';
  }

  toggleDone(task: Task) {
    if (!this.canWrite()) return;
    this.tasksService.updateStatus(task.id, task.status === 'Completed' ? 'Pending' : 'Completed');
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'Completed': return 'check_circle';
      case 'In Progress': return 'timelapse';
      case 'Blocked': return 'block';
      default: return 'radio_button_unchecked';
    }
  }

  statusIconInk(status: string): string {
    switch (status) {
      case 'Completed': return 'text-success';
      case 'In Progress': return 'text-accent-ink';
      case 'Blocked': return 'text-warning-ink';
      default: return 'text-ink-4';
    }
  }

  createdTooltip(task: Task): string {
    const by = task.createdBy ? this.getAssigneeName(task.createdBy) : '';
    const on = task.createdAt ? new Date(task.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
    return by || on ? `Created${by ? ' by ' + by : ''}${on ? ' on ' + on : ''}` : task.title;
  }

  emptyTitle(): string {
    switch (this.scope()) {
      case 'overdue': return 'Nothing overdue';
      case 'completed': return 'No completed tasks yet';
      case 'open': return 'No open tasks';
      default: return 'No tasks yet';
    }
  }

  /** Due-date cell: relative wording and urgency colour, with the exact date on hover. */
  dueInfo(task: Task): { label: string; cls: string; icon: string; title: string } | null {
    if (!task.dueDate) return null;
    const day = task.dueDate.slice(0, 10);
    const diff = TasksComponent.dayNumber(day) - TasksComponent.dayNumber(this.today);
    const date = new Date(day + 'T00:00:00');
    const sameYear = date.getFullYear() === new Date().getFullYear();
    const exact = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
    const title = date.toLocaleDateString(undefined, { dateStyle: 'full' });
    if (task.status === 'Completed') return { label: exact, cls: 'text-ink-3', icon: 'event_available', title };
    if (diff < 0) return { label: `${-diff}d overdue`, cls: 'text-danger-ink font-semibold', icon: 'event_busy', title };
    if (diff === 0) return { label: 'Due today', cls: 'text-warning-ink font-semibold', icon: 'today', title };
    if (diff === 1) return { label: 'Tomorrow', cls: 'text-warning-ink', icon: 'event', title };
    if (diff <= 7) return { label: `In ${diff} days`, cls: 'text-ink-2', icon: 'event', title };
    return { label: exact, cls: 'text-ink-2', icon: 'event', title };
  }

  clearFilters() {
    this.searchTerm.set('');
    this.activePriorityFilter.set(null);
    this.linkFilter.set('');
    this.categoryFilter.set('');
    this.setAssigneeFilter('');
  }

  // ---- Selection & bulk actions ----

  toggleSelect(id: string) {
    const next = new Set(this.selectedIds());
    if (!next.delete(id)) next.add(id);
    this.selectedIds.set(next);
  }

  groupAllSelected(g: TaskGroup): boolean {
    const selected = this.selectedIds();
    return g.tasks.length > 0 && g.tasks.every(t => selected.has(t.id));
  }

  toggleGroupSelect(g: TaskGroup) {
    const next = new Set(this.selectedIds());
    const all = this.groupAllSelected(g);
    for (const t of g.tasks) {
      if (all) next.delete(t.id); else next.add(t.id);
    }
    this.selectedIds.set(next);
  }

  clearSelection() {
    this.selectedIds.set(new Set());
  }

  private selectedTasks(): Task[] {
    const ids = this.selectedIds();
    return this.tasksService.allTasks().filter(t => ids.has(t.id));
  }

  bulkAssign(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (!select.value || !this.canWrite()) return;
    for (const t of this.selectedTasks()) this.tasksService.updateStatus(t.id, t.status, select.value);
    select.value = '';
    this.clearSelection();
  }

  bulkChangeStatus(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (!select.value || !this.canWrite()) return;
    for (const t of this.selectedTasks()) this.tasksService.updateStatus(t.id, select.value as Task['status']);
    select.value = '';
    this.clearSelection();
  }

  bulkAttach(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (!select.value || !this.canWrite()) return;
    for (const t of this.selectedTasks()) this.tasksService.relink(t.id, { relatedEntityType: 'TICKET', relatedEntityId: select.value });
    select.value = '';
    this.clearSelection();
  }

  bulkExport() {
    const escapeCsv = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
    const rows = this.selectedTasks().map(t => [
      t.title, this.categories.get(t.categoryId)?.name || '', t.priority || '', t.status, this.getAssigneeName(t.assignedToUserId), t.dueDate?.slice(0, 10) || '', this.getRelatedLabel(t)
    ].map(escapeCsv).join(','));
    const csv = [['Title', 'Category', 'Priority', 'Status', 'Assignee', 'Due', 'Related to'].join(','), ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async deleteTask(task: Task) {
    if (!this.canDelete()) return;
    if (await this.confirmDialog.ask({ title: 'Delete task?', message: `"${task.title}" will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete task', danger: true })) {
      this.tasksService.deleteTask(task.id);
    }
  }

  taskModalOpen = signal(false);
  assignModalOpen = signal(false);
  selectedTask = signal<Task | null>(null);
  reassignedUser = '';

  newTaskData: {
    title: string;
    description: string;
    ticketId: string;
    categoryId: string;
    assignedTeamId: string;
    assignedToUserId: string;
    priority: 'Urgent' | 'Medium' | 'Low';
    dueDate: string;
    link: EntityLink;
  } = {
    title: '',
    description: '',
    ticketId: '',
    categoryId: '',
    assignedTeamId: '',
    assignedToUserId: '',
    priority: 'Medium',
    dueDate: '',
    link: {}
  };

  constructor() {
    this.tasksService.load();
    // Tasks are grouped under, and linked to, their ticket, so the tickets (and the partners they name) are needed.
    this.ticketsService.load();
    this.state.loadPartners();
    this.categories.load();
    const filter = this.state.taskFilter();
    if (filter?.priority && ['Urgent', 'Medium', 'Low'].includes(filter.priority)) {
      this.activePriorityFilter.set(filter.priority as 'Urgent' | 'Medium' | 'Low');
      this.state.taskFilter.set(null);
    }
    const tab = this.state.navigateTab();
    if (tab === 'kanban') {
      this.activeView.set('kanban');
      this.state.navigateTab.set(null);
    }
  }

  getRelatedLabel(task: Task): string {
    const ticket = this.ticketOf(task);
    if (ticket) return ticket.title;
    return this.related.labelOfLink({
      relatedEntityType: task.relatedEntityType,
      relatedEntityId: task.relatedEntityId
    }) || '';
  }

  getRelatedIcon(task: Task): string {
    return this.related.iconOfLink({
      relatedEntityType: task.relatedEntityType,
      relatedEntityId: task.relatedEntityId
    });
  }

  /** Ticket tasks link through to their ticket page; other kinds have no page of their own here. */
  ticketRoute(task: Task): string[] | null {
    return this.isOnTicket(task) ? ['/tickets', task.relatedEntityId!] : null;
  }

  getTeamName(teamId?: string): string {
    if (!teamId) return '—';
    return this.state.teams().find(t => t.id === teamId)?.name || 'Unknown team';
  }

  getAssigneeName(userId?: string): string {
    if (!userId) return '';
    return this.state.users().find(u => u.id === userId)?.displayName || 'Unknown';
  }

  getStatusColor(status: string) {
    switch (status) {
      case 'Completed': return 'badge-success';
      case 'In Progress': return 'badge-info';
      case 'Blocked': return 'badge-warning';
      default: return 'badge-neutral';
    }
  }

  getPriorityColor(priority: string) {
    switch (priority) {
      case 'Urgent': return 'badge-danger';
      case 'Medium': return 'badge-warning';
      case 'Low': return 'badge-success';
      default: return 'badge-neutral';
    }
  }

  onDrop(event: CdkDragDrop<Task[]>, targetStatus: Task['status']) {
    if (event.previousContainer === event.container || !this.canWrite()) return;
    const task = event.item.data as Task;
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    this.tasksService.updateStatus(task.id, targetStatus);
  }

  openCreateTaskModal() {
    if (!this.canCreate()) return;
    this.newTaskData = {
      title: '',
      description: '',
      ticketId: '',
      categoryId: '',
      assignedTeamId: '',
      assignedToUserId: '',
      priority: 'Medium',
      dueDate: '',
      link: {}
    };
    this.taskModalOpen.set(true);
  }

  closeTaskModal() {
    this.taskModalOpen.set(false);
  }

  saveTask() {
    if (!this.canCreate() || !this.newTaskData.title.trim()) return;
    const link: EntityLink = this.newTaskData.ticketId
      ? { relatedEntityType: 'TICKET', relatedEntityId: this.newTaskData.ticketId }
      : this.newTaskData.link;
    this.tasksService.addTask({
      title: this.newTaskData.title.trim(),
      description: this.newTaskData.description,
      // On a ticket the server uses the ticket's category whatever is sent here.
      categoryId: this.newTaskData.ticketId ? undefined : this.newTaskData.categoryId || undefined,
      assignedTeamId: this.newTaskData.assignedTeamId || undefined,
      assignedToUserId: this.newTaskData.assignedToUserId || undefined,
      assignedByUserId: this.state.currentUserId(),
      status: 'Pending',
      priority: this.newTaskData.priority,
      dueDate: this.newTaskData.dueDate || undefined,
      relatedEntityType: link.relatedEntityType ?? undefined,
      relatedEntityId: link.relatedEntityId ?? undefined
    });
    this.taskModalOpen.set(false);
  }

  // ---- Edit ----

  editingTask = signal<Task | null>(null);
  editData = { title: '', description: '', ticketId: '', categoryId: '', status: 'Pending' as Task['status'], priority: '' as Task['priority'] | '', assignedTeamId: '', assignedToUserId: '', dueDate: '' };

  openEditModal(task: Task) {
    if (!this.canWrite()) return;
    this.editData = {
      title: task.title,
      description: task.description || '',
      ticketId: this.isOnTicket(task) ? task.relatedEntityId! : '',
      categoryId: task.categoryId || '',
      status: task.status,
      priority: task.priority || '',
      assignedTeamId: task.assignedTeamId || '',
      assignedToUserId: task.assignedToUserId || '',
      dueDate: task.dueDate?.slice(0, 10) || ''
    };
    this.editingTask.set(task);
  }

  closeEditModal() {
    this.editingTask.set(null);
  }

  saveEdit(task: Task) {
    const d = this.editData;
    const title = d.title.trim();
    if (!title || !this.canWrite()) return;
    const originalTicket = this.isOnTicket(task) ? task.relatedEntityId! : '';
    // The link is only touched when the ticket choice changed, so a deal/partner link survives an unrelated edit.
    const linkChange: Partial<Pick<Task, 'relatedEntityType' | 'relatedEntityId'>> = d.ticketId === originalTicket ? {}
      : d.ticketId ? { relatedEntityType: 'TICKET', relatedEntityId: d.ticketId }
      : { relatedEntityType: undefined, relatedEntityId: undefined };
    this.tasksService.updateDetails(task.id, {
      title,
      description: d.description.trim() || undefined,
      categoryId: d.ticketId ? undefined : d.categoryId || undefined,
      status: d.status,
      priority: d.priority || undefined,
      assignedTeamId: d.assignedTeamId || undefined,
      assignedToUserId: d.assignedToUserId || undefined,
      dueDate: d.dueDate || undefined,
      ...linkChange
    }, () => this.closeEditModal());
  }

  // ---- Attach to a ticket ----

  attachingTask = signal<Task | null>(null);
  attachTicketId = '';

  openAttachModal(task: Task) {
    if (!this.canWrite()) return;
    this.attachTicketId = '';
    this.attachingTask.set(task);
  }

  saveAttach(task: Task) {
    if (!this.attachTicketId || !this.canWrite()) return;
    this.tasksService.relink(task.id, { relatedEntityType: 'TICKET', relatedEntityId: this.attachTicketId });
    this.attachingTask.set(null);
  }

  // ---- Assign ----

  openAssignModal(task: Task) {
    if (!this.canWrite()) return;
    this.selectedTask.set(task);
    this.reassignedUser = task.assignedToUserId || '';
    this.assignModalOpen.set(true);
  }

  saveAssignment() {
    if (!this.canWrite()) return;
    const task = this.selectedTask();
    if (task) {
      this.tasksService.updateStatus(task.id, task.status, this.reassignedUser);
      this.assignModalOpen.set(false);
    }
  }
}
