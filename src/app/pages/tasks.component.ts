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
        @if (activePriorityFilter()) {
          <span class="chip" [attr.title]="'tasks.filteredBy' | translate">
            Priority
            <span [class]="getPriorityColor(activePriorityFilter()!)" class="badge">{{ activePriorityFilter() }}</span>
            <button (click)="clearFilter()" title="Clear filter" aria-label="Clear priority filter" class="btn-icon btn-sm">
              <mat-icon class="icon-sm">close</mat-icon>
            </button>
          </span>
        }
        <span class="toolbar__count toolbar__spacer">{{ filteredTasks().length }} task{{ filteredTasks().length !== 1 ? 's' : '' }}</span>
      </div>

      @if (tasksService.isLoading$()) {
        <app-data-status-banner [loading]="true" [variant]="'tiles'" [tiles]="6" />
      } @else {

      <!-- List View -->
      @if (activeView() === 'list') {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (task of paginatedTasks(); track task.id) {
            <div class="card p-5 flex flex-col justify-between transition-all">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="flex items-center gap-1.5">
                    <span [class]="getStatusColor(task.status)" class="badge">
                      {{task.status}}
                    </span>
                    @if (task.priority) {
                      <span [class]="getPriorityColor(task.priority)" class="badge">{{task.priority}}</span>
                    }
                  </div>
                  <span class="text-xs text-ink-3">#{{ task.id.slice(0, 8) }}</span>
                </div>
                <h4 class="card-title mb-1">{{task.title}}</h4>
                <p class="text-xs text-ink-3 mb-3">{{task.description}}</p>

                @if (getRelatedLabel(task); as label) {
                  @if (ticketRoute(task); as route) {
                    <a [routerLink]="route" class="btn-secondary btn-sm mb-4" title="Open ticket">
                      <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                      {{label}}
                    </a>
                  } @else {
                    <div class="text-xs text-ink bg-muted border border-line rounded-lg p-1.5 px-2 mb-4 inline-flex items-center gap-1 font-medium">
                      <mat-icon class="icon-xs">{{ getRelatedIcon(task) }}</mat-icon>
                      {{label}}
                    </div>
                  }
                }
              </div>

              <div class="border-t border-line-soft pt-3 flex flex-col gap-2 mt-4">
                <div class="flex justify-between items-center text-xs">
                  <span class="text-ink-3 font-medium">Created By:</span>
                  <app-created-by-badge [createdBy]="task.createdBy" [createdAt]="task.createdAt" />
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="text-ink-3 font-medium">Assigned Team:</span>
                  <span class="badge badge-neutral">{{getTeamName(task.assignedTeamId)}}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="text-ink-3 font-medium">Assigned Person:</span>
                  <span class="flex items-center gap-1.5 font-semibold text-ink-2">
                    @if (task.assignedToUserId) {
                      <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                      {{ getAssigneeName(task.assignedToUserId) }}
                    } @else {
                      {{ 'leads.unassigned' | translate }}
                    }
                  </span>
                </div>

                <div class="flex gap-2 pt-2 border-t border-line-soft">
                  @if (task.status === 'Pending' && canWrite()) {
                    <button (click)="tasksService.updateStatus(task.id, 'In Progress')" class="btn-secondary btn-sm w-full">
                      Start Task
                    </button>
                  } @else if (task.status === 'In Progress' && canWrite()) {
                    <button (click)="tasksService.updateStatus(task.id, 'Completed')" class="btn-primary btn-sm w-full">
                      Complete Task
                    </button>
                  } @else if (task.status === 'Completed') {
                    <span class="text-ink text-xs font-semibold py-1.5 text-center w-full flex items-center justify-center">
                      <mat-icon class="mr-0.5 icon-sm">check_circle</mat-icon> Completed
                    </span>
                  }
                  @if (state.currentUserPermissions().canDeleteRecords) {
                    <button (click)="deleteTask(task)" title="Delete task" class="btn-icon btn-sm btn-danger-hover shrink-0">
  <mat-icon class="icon-sm">delete</mat-icon>
</button>
                  }

                  @if (task.status !== 'Completed' && canWrite()) {
                    <button (click)="openAssignModal(task)" class="btn-secondary btn-sm">
                      <mat-icon class="icon-sm">person</mat-icon> Assign
                    </button>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="col-span-full card">
              <app-empty-state icon="task_alt" [title]="'tasks.noTasks' | translate" text="Tasks you create or are assigned will show up here." />
            </div>
          }
        </div>
        @if (filteredTasks().length > 0) {
          <app-paginator
            [currentPage]="tasksPage()"
            [totalPages]="tasksTotalPages()"
            [pageSize]="tasksPageSize()"
            (pageChange)="tasksPage.set($event)"
            (pageSizeChange)="tasksPageSize.set($event)" />
        }
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

  /** All tasks, filtered by priority, linked record and/or assignee if a filter is active */
  filteredTasks = computed(() => {
    const priority = this.activePriorityFilter();
    const link = this.linkFilter();
    const assignee = this.assigneeFilter();
    return this.tasksService.allTasks().filter(t =>
      (!priority || t.priority === priority) &&
      (!link || (link === 'NONE' ? !t.relatedEntityType : t.relatedEntityType === link)) &&
      (!assignee || (assignee === 'NONE' ? !t.assignedToUserId : t.assignedToUserId === assignee))
    );
  });

  pendingTasks = computed(() => this.filteredTasks().filter(t => t.status === 'Pending'));
  inProgressTasks = computed(() => this.filteredTasks().filter(t => t.status === 'In Progress'));
  completedTasks = computed(() => this.filteredTasks().filter(t => t.status === 'Completed'));

  tasksPage = signal(1);
  tasksPageSize = signal(9);
  tasksTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredTasks().length / this.tasksPageSize())));
  paginatedTasks = computed(() => {
    const start = (this.tasksPage() - 1) * this.tasksPageSize();
    return this.filteredTasks().slice(start, start + this.tasksPageSize());
  });

  clearFilter() {
    this.activePriorityFilter.set(null);
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
      default: return 'bg-muted text-ink border border-line';
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

  saveAssignment() {
    if (!this.canWrite()) return;
    const task = this.selectedTask();
    if (task) {
      this.tasksService.updateStatus(task.id, task.status, this.reassignedUser);
      this.assignModalOpen.set(false);
    }
  }
}
