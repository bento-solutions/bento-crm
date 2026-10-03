import { Component, inject, signal, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Task } from '../services/crm-state.service';
import { TasksService } from '../services/domains';
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

type TaskScope = 'open' | 'overdue' | 'completed' | 'all';
type TaskSort = 'smart' | 'due' | 'priority' | 'newest';

@Component({
  selector: 'app-tasks',
  imports: [MatIconModule, CommonModule, FormsModule, DragDropModule, CreatedByBadgeComponent, RouterModule, DataStatusBannerComponent, PaginatorComponent, TranslatePipe, RelatedEntityPickerComponent, UserPickerComponent, UserAvatarComponent, PageHeaderComponent, EmptyStateComponent],
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
    /* Keep the quick actions reachable when the table scrolls sideways on tablets; phones need the width for the title. */
    @media (min-width: 768px) {
      .tasks-table .col-actions {
        position: sticky;
        inset-inline-end: 0;
        background: var(--color-surface);
        box-shadow: -1px 0 0 var(--color-border-light);
      }
      .tasks-table th.col-actions { background: var(--color-subtle); }
      .tasks-table tr:hover td.col-actions { background: var(--color-surface-hover); }
      .tasks-table tr.is-selected td.col-actions { background: var(--color-accent-light); }
    }
  `],
  template: `
    <div class="page">
      <app-page-header title="Tasks" subtitle="Assignments across tickets, deals and partners">
        @if (canCreate()) {
          <button actions class="btn-primary" (click)="openCreateTaskModal()">
            <mat-icon>add</mat-icon>
            {{ 'tasks.newTask' | translate }}
          </button>
        }
      </app-page-header>

      @if (activeView() === 'list') {
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
          <button class="segmented__item" [class.is-active]="activeView() === 'list'" [attr.aria-pressed]="activeView() === 'list'" (click)="activeView.set('list')">
            <mat-icon>list_alt</mat-icon>
            {{ 'tasks.list' | translate }}
          </button>
          <button class="segmented__item" [class.is-active]="activeView() === 'kanban'" [attr.aria-pressed]="activeView() === 'kanban'" (click)="activeView.set('kanban')">
            <mat-icon>view_column</mat-icon>
            {{ 'tasks.kanban' | translate }}
          </button>
        </div>
        <label class="search-field">
          <mat-icon>search</mat-icon>
          <input type="search" class="input-field" placeholder="Search tasks…" aria-label="Search tasks"
                 [ngModel]="searchTerm()" (ngModelChange)="setSearch($event)" />
        </label>
        <select [ngModel]="activePriorityFilter()" (ngModelChange)="activePriorityFilter.set($event); tasksPage.set(1)" class="input-field" aria-label="Filter tasks by priority">
          <option [ngValue]="null">All Priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select [ngModel]="assigneeFilter()" (ngModelChange)="setAssigneeFilter($event)" class="input-field" aria-label="Filter tasks by assignee">
          <option value="">All assignees</option>
          <option value="NONE">{{ 'leads.unassigned' | translate }}</option>
          @for (user of state.users(); track user.id) {
            <option [value]="user.id">{{user.displayName}}</option>
          }
        </select>
        <select [ngModel]="linkFilter()" (ngModelChange)="linkFilter.set($event); tasksPage.set(1)" class="input-field" aria-label="Filter tasks by linked record">
          <option value="">All tasks</option>
          <option value="TICKET">Ticket tasks</option>
          <option value="DEAL">Deal tasks</option>
          <option value="PARTNER">Partner tasks</option>
          <option value="NONE">Unlinked</option>
        </select>
        @if (activeView() === 'list') {
          <select [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event); tasksPage.set(1)" class="input-field" aria-label="Sort tasks">
            <option value="smart">Sort: Most urgent</option>
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="newest">Sort: Newest</option>
          </select>
        }
        @if (hasActiveFilters()) {
          <button (click)="clearFilters()" class="btn-ghost btn-sm">
            <mat-icon>close</mat-icon>
            Clear
          </button>
        }
        <span class="toolbar__count toolbar__spacer">{{ visibleCount() }} task{{ visibleCount() !== 1 ? 's' : '' }}</span>
      </div>

      @if (tasksService.isLoading$()) {
        <app-data-status-banner [loading]="true" [variant]="'rows'" [columns]="7" [rows]="8" />
      } @else {

      <!-- List View -->
      @if (activeView() === 'list') {
        <div class="table-card">
          <table class="data-table tasks-table">
            <thead>
              <tr>
                <th scope="col" class="col-check">
                  <input type="checkbox" [checked]="allOnPageSelected()" (change)="toggleSelectAll($event)" class="cursor-pointer" aria-label="Select all tasks on this page" />
                </th>
                <th scope="col">Priority</th>
                <th scope="col">Task</th>
                <th scope="col">Assignee</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
                <th scope="col" class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (task of paginatedTasks(); track task.id) {
                <tr [class.is-selected]="selectedIds().has(task.id)">
                  <td class="col-check">
                    <input type="checkbox" [checked]="selectedIds().has(task.id)" (change)="toggleSelect(task.id)" class="cursor-pointer" [attr.aria-label]="'Select ' + task.title" />
                  </td>
                  <td class="whitespace-nowrap">
                    @if (task.priority) {
                      <div class="flex items-center">
                        <mat-icon [class]="getPriorityInk(task.priority)" class="icon-md">flag</mat-icon>
                        <span [class]="getPriorityInk(task.priority)" class="ml-1.5 text-meta font-semibold">{{ task.priority }}</span>
                      </div>
                    } @else {
                      <span class="text-ink-4">—</span>
                    }
                  </td>
                  <td>
                    <button type="button" (click)="openEditModal(task)" class="table-name-link text-sm font-medium text-ink max-w-md wrap-break-word"
                            [class.line-through]="task.status === 'Completed'" [class.text-ink-3]="task.status === 'Completed'" [title]="createdTooltip(task)">{{ task.title }}</button>
                    @if (task.description) {
                      <div class="text-meta text-ink-3 font-medium mt-0.5 truncate max-w-md" [title]="task.description">{{ task.description }}</div>
                    }
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
                  </td>
                  <td class="whitespace-nowrap">
                    @if (task.assignedToUserId) {
                      <div class="flex items-center gap-2 text-ink-2">
                        <app-user-avatar [userId]="task.assignedToUserId" [size]="20" />
                        <div class="flex flex-col">
                          <span>{{ getAssigneeName(task.assignedToUserId) }}</span>
                          @if (task.assignedTeamId) {
                            <span class="text-meta text-ink-3">{{ getTeamName(task.assignedTeamId) }}</span>
                          }
                        </div>
                      </div>
                    } @else if (task.status !== 'Completed' && canWrite()) {
                      <button type="button" (click)="openAssignModal(task)" class="btn-secondary btn-sm">
                        <mat-icon class="icon-sm">person_add</mat-icon> Assign
                      </button>
                    } @else {
                      <span class="text-ink-3">{{ 'leads.unassigned' | translate }}</span>
                    }
                  </td>
                  <td class="whitespace-nowrap">
                    @if (dueInfo(task); as due) {
                      <span class="inline-flex items-center gap-1 text-xs" [class]="due.cls" [title]="due.title">
                        <mat-icon class="icon-xs">{{ due.icon }}</mat-icon>{{ due.label }}
                      </span>
                    } @else {
                      <span class="text-ink-4">—</span>
                    }
                  </td>
                  <td class="whitespace-nowrap">
                    <select [ngModel]="task.status" (ngModelChange)="tasksService.updateStatus(task.id, $event)" [disabled]="!canWrite()"
                            [class]="getStatusColor(task.status)" class="pill-select" [attr.aria-label]="'Status of ' + task.title">
                      @if (!statusOptions.includes(task.status)) { <option [value]="task.status">{{ task.status }}</option> }
                      @for (s of statusOptions; track s) { <option [value]="s">{{ s }}</option> }
                    </select>
                  </td>
                  <td class="col-actions">
                    <div class="inline-flex items-center gap-1">
                      @if (canWrite()) {
                        @switch (task.status) {
                          @case ('Pending') {
                            <button (click)="tasksService.updateStatus(task.id, 'In Progress')" class="btn-secondary btn-sm" title="Start working on this task">
                              <mat-icon class="icon-sm">play_arrow</mat-icon> Start
                            </button>
                          }
                          @case ('In Progress') {
                            <button (click)="tasksService.updateStatus(task.id, 'Completed')" class="btn-primary btn-sm" title="Mark as completed">
                              <mat-icon class="icon-sm">check</mat-icon> Done
                            </button>
                          }
                          @case ('Completed') {
                            <button (click)="tasksService.updateStatus(task.id, 'Pending')" class="btn-secondary btn-sm" title="Reopen this task">
                              <mat-icon class="icon-sm">undo</mat-icon> Reopen
                            </button>
                          }
                          @default {
                            <button (click)="tasksService.updateStatus(task.id, 'In Progress')" class="btn-secondary btn-sm" title="Resume this blocked task">
                              <mat-icon class="icon-sm">play_arrow</mat-icon> Resume
                            </button>
                          }
                        }
                        @if (task.status !== 'Completed') {
                          <button (click)="openAssignModal(task)" class="btn-icon btn-sm" title="Assign" aria-label="Assign task">
                            <mat-icon class="icon-sm">person_add</mat-icon>
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
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="row-empty">
                    <app-empty-state icon="task_alt"
                      [title]="hasActiveFilters() ? 'No tasks match your filters' : emptyTitle()"
                      [text]="hasActiveFilters() ? 'Try a different search or clear the filters.' : 'Tasks you create or are assigned will show up here.'" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (scopedTasks().length > 0) {
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
      @if (selectedIds().size > 0 && activeView() === 'list') {
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

            <app-related-entity-picker [(link)]="newTaskData.link" label="Related To" />
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-line-soft">
            <button (click)="closeTaskModal()" class="btn-secondary">{{ 'common.cancel' | translate }}</button>
            <button (click)="saveTask()" class="btn-primary">{{ 'common.save' | translate }}</button>
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
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="edit_task_status" class="field-label mb-1.5">Status</label>
                <select id="edit_task_status" [(ngModel)]="editData.status" class="input-field w-full">
                  @if (!statusOptions.includes(editData.status)) { <option [value]="editData.status">{{ editData.status }}</option> }
                  @for (s of statusOptions; track s) { <option [value]="s">{{ s }}</option> }
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
  translation = inject(TranslationService);
  private related = inject(RelatedEntityService);

  canCreate(): boolean { return this.state.hasAuthority('TASKS_CREATE'); }
  canWrite(): boolean { return this.state.hasAuthority('TASKS_WRITE'); }
  canDelete(): boolean { return this.state.hasAuthority('TASKS_DELETE'); }

  activeView = signal<'list' | 'kanban'>('list');
  activePriorityFilter = signal<'Urgent' | 'Medium' | 'Low' | null>(null);

  /** Narrow the board to tasks linked to one kind of record ('NONE' = unlinked, '' = all). */
  linkFilter = signal<'' | 'TICKET' | 'DEAL' | 'PARTNER' | 'NONE'>('');

  /** Narrow the board to tasks assigned to one user ('NONE' = unassigned, '' = everyone). Remembered across sessions. */
  private static readonly ASSIGNEE_FILTER_KEY = 'bento_task_assignee_filter';
  assigneeFilter = signal<string>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(TasksComponent.ASSIGNEE_FILTER_KEY) || '' : ''
  );

  setAssigneeFilter(value: string) {
    this.assigneeFilter.set(value);
    this.tasksPage.set(1);
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

  setSearch(value: string) {
    this.searchTerm.set(value ?? '');
    this.tasksPage.set(1);
  }

  setScope(scope: TaskScope) {
    this.scope.set(scope);
    this.tasksPage.set(1);
  }

  /** Search, priority, linked record and assignee — shared by the list and the board. */
  filteredTasks = computed(() => {
    const priority = this.activePriorityFilter();
    const link = this.linkFilter();
    const assignee = this.assigneeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.tasksService.allTasks().filter(t =>
      (!q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q) || t.id.toLowerCase().includes(q) ||
        this.getRelatedLabel(t).toLowerCase().includes(q) || this.getAssigneeName(t.assignedToUserId).toLowerCase().includes(q)) &&
      (!priority || t.priority === priority) &&
      (!link || (link === 'NONE' ? !t.relatedEntityType : t.relatedEntityType === link)) &&
      (!assignee || (assignee === 'NONE' ? !t.assignedToUserId : t.assignedToUserId === assignee))
    );
  });

  hasActiveFilters = computed(() => !!this.searchTerm() || !!this.activePriorityFilter() || !!this.linkFilter() || !!this.assigneeFilter());

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

  /** Filtered tasks for the active tab, ordered per the sort picker. */
  scopedTasks = computed(() => {
    const scope = this.scope();
    const tasks = this.filteredTasks().filter(t =>
      scope === 'all' || (scope === 'open' && t.status !== 'Completed') ||
      (scope === 'overdue' && this.isOverdue(t)) || (scope === 'completed' && t.status === 'Completed'));
    return this.sortTasks(tasks, this.sortBy());
  });

  visibleCount = computed(() => this.activeView() === 'list' ? this.scopedTasks().length : this.filteredTasks().length);

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

  tasksPage = signal(1);
  tasksPageSize = signal(10);
  tasksTotalPages = computed(() => Math.max(1, Math.ceil(this.scopedTasks().length / this.tasksPageSize())));
  /** The requested page, held within range when tasks leave the tab (e.g. completing one on "Open"). */
  currentPage = computed(() => Math.min(this.tasksPage(), this.tasksTotalPages()));
  paginatedTasks = computed(() => {
    const start = (this.currentPage() - 1) * this.tasksPageSize();
    return this.scopedTasks().slice(start, start + this.tasksPageSize());
  });

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
    this.setAssigneeFilter('');
  }

  // ---- Selection & bulk actions ----

  allOnPageSelected = computed(() => {
    const page = this.paginatedTasks();
    const selected = this.selectedIds();
    return page.length > 0 && page.every(t => selected.has(t.id));
  });

  toggleSelect(id: string) {
    const next = new Set(this.selectedIds());
    if (!next.delete(id)) next.add(id);
    this.selectedIds.set(next);
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selectedIds());
    for (const t of this.paginatedTasks()) {
      if (checked) next.add(t.id); else next.delete(t.id);
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

  bulkExport() {
    const escapeCsv = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
    const rows = this.selectedTasks().map(t => [
      t.title, t.priority || '', t.status, this.getAssigneeName(t.assignedToUserId), t.dueDate?.slice(0, 10) || '', this.getRelatedLabel(t)
    ].map(escapeCsv).join(','));
    const csv = [['Title', 'Priority', 'Status', 'Assignee', 'Due', 'Related to'].join(','), ...rows].join('\n');
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
    assignedTeamId: string;
    assignedToUserId: string;
    priority: 'Urgent' | 'Medium' | 'Low';
    dueDate: string;
    link: EntityLink;
  } = {
    title: '',
    description: '',
    assignedTeamId: '',
    assignedToUserId: '',
    priority: 'Medium',
    dueDate: '',
    link: {}
  };

  constructor() {
    this.tasksService.load();
    // Ticket tasks show their ticket's title on the chip, which needs the tickets list.
    this.state.loadTickets();
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
    return task.relatedEntityType === 'TICKET' && task.relatedEntityId
      ? ['/tickets', task.relatedEntityId] : null;
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

  /** Text/icon colour for the list's priority flag (the badge variants are for chips). */
  getPriorityInk(priority: string) {
    switch (priority) {
      case 'Urgent': return 'text-danger-ink';
      case 'Medium': return 'text-warning-ink';
      case 'Low': return 'text-success-ink';
      default: return 'text-ink-3';
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
    if (!this.canCreate()) return;
    this.tasksService.addTask({
      title: this.newTaskData.title,
      description: this.newTaskData.description,
      assignedTeamId: this.newTaskData.assignedTeamId || undefined,
      assignedToUserId: this.newTaskData.assignedToUserId || undefined,
      assignedByUserId: this.state.currentUserId(),
      status: 'Pending',
      priority: this.newTaskData.priority,
      dueDate: this.newTaskData.dueDate || undefined,
      relatedEntityType: this.newTaskData.link.relatedEntityType ?? undefined,
      relatedEntityId: this.newTaskData.link.relatedEntityId ?? undefined
    });
    this.taskModalOpen.set(false);
  }

  openAssignModal(task: Task) {
    if (!this.canWrite()) return;
    this.selectedTask.set(task);
    this.reassignedUser = task.assignedToUserId || '';
    this.assignModalOpen.set(true);
  }

  editingTask = signal<Task | null>(null);
  editData = { title: '', description: '', status: 'Pending' as Task['status'], priority: '' as Task['priority'] | '', assignedTeamId: '', assignedToUserId: '', dueDate: '' };

  openEditModal(task: Task) {
    if (!this.canWrite()) return;
    this.editData = {
      title: task.title,
      description: task.description || '',
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
    this.tasksService.updateDetails(task.id, {
      title,
      description: d.description.trim() || undefined,
      status: d.status,
      priority: d.priority || undefined,
      assignedTeamId: d.assignedTeamId || undefined,
      assignedToUserId: d.assignedToUserId || undefined,
      dueDate: d.dueDate || undefined
    }, () => this.closeEditModal());
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
