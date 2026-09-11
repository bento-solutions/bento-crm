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

@Component({
  selector: 'app-tasks',
  imports: [MatIconModule, CommonModule, FormsModule, DragDropModule, CreatedByBadgeComponent, RouterModule, DataStatusBannerComponent, PaginatorComponent, TranslatePipe, RelatedEntityPickerComponent, UserPickerComponent, UserAvatarComponent],
  styles: [`
    .kanban-column.cdk-drop-list-dragging .kanban-card:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .kanban-card.cdk-drag-placeholder {
      opacity: 0;
    }
    .kanban-card.cdk-drag-preview {
      background: white !important;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
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
    <div class="space-y-8">
      @if (canCreate()) {
      <div class="flex justify-end">
        <button (click)="openCreateTaskModal()" class="bg-zinc-900 hover:bg-zinc-950 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm shadow-lg shadow-zinc-300">
          <mat-icon class="w-5 h-5 text-[20px]! leading-none! flex items-center justify-center">add</mat-icon>
          {{ 'tasks.newTask' | translate }}
        </button>
      </div>
      }

      <!-- Priority Filter Banner -->
      @if (activePriorityFilter()) {
        <div class="flex items-center gap-2">
          <div class="bg-white border border-zinc-200 rounded-xl px-4 py-2 flex items-center gap-2 text-sm">
            <mat-icon class="text-[18px] w-4.5 h-4.5 text-zinc-700">filter_alt</mat-icon>
            <span class="font-semibold text-zinc-700">{{ 'tasks.filteredBy' | translate }}</span>
            <span [class]="activePriorityFilter() === 'Urgent' ? 'text-red-600' : activePriorityFilter() === 'Medium' ? 'text-amber-600' : 'text-emerald-600'" class="px-2 py-0.5 rounded text-xs font-medium">{{activePriorityFilter()}}</span>
            <button (click)="clearFilter()" title="Clear filter" class="text-zinc-400 hover:text-zinc-600 ml-1 transition-colors">
              <mat-icon class="text-[16px] w-4 h-4">close</mat-icon>
            </button>
          </div>
          <span class="text-xs text-zinc-400 font-medium">{{ filteredTasks().length }} task{{ filteredTasks().length !== 1 ? 's' : '' }}</span>
        </div>
      }

      <!-- View Tabs -->
      <div class="flex gap-5 sm:gap-6 border-b border-zinc-200">
        <button
          (click)="activeView.set('list')"
          [class]="activeView() === 'list' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">list_alt</mat-icon>
          {{ 'tasks.list' | translate }}
        </button>
        <button
          (click)="activeView.set('kanban')"
          [class]="activeView() === 'kanban' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'"
          class="px-1 py-3 -mb-px border-b-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <mat-icon class="text-[18px] w-[18px] h-[18px]">view_column</mat-icon>
          {{ 'tasks.kanban' | translate }}
        </button>
        <div class="ml-auto flex items-center gap-2 py-2">
          <mat-icon class="text-[16px] w-4 h-4 text-zinc-500">link</mat-icon>
          <select [ngModel]="linkFilter()" (ngModelChange)="linkFilter.set($event); tasksPage.set(1)" class="input-field rounded-lg px-2 py-1.5 text-xs focus:outline-blue-600 cursor-pointer" aria-label="Filter tasks by linked record">
            <option value="">All tasks</option>
            <option value="TICKET">Ticket tasks</option>
            <option value="DEAL">Deal tasks</option>
            <option value="PARTNER">Partner tasks</option>
            <option value="NONE">Unlinked</option>
          </select>
        </div>
      </div>

      @if (tasksService.isLoading$()) {
        <app-data-status-banner [loading]="true" [variant]="'tiles'" [tiles]="6" />
      } @else {

      <!-- List View -->
      @if (activeView() === 'list') {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (task of paginatedTasks(); track task.id) {
            <div class="card rounded-xl p-5 flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div class="flex justify-between items-start mb-3">
                  <div class="flex items-center gap-1.5">
                    <span [class]="getStatusColor(task.status)" class="px-2.5 py-1 text-meta font-bold uppercase rounded-full">
                      {{task.status}}
                    </span>
                    @if (task.priority) {
                      <span [class]="getPriorityColor(task.priority)" class="text-meta font-bold px-1.5 py-0.5 rounded-full">{{task.priority}}</span>
                    }
                  </div>
                  <span class="text-xs text-zinc-400 font-sans">#{{task.id}}</span>
                </div>
                <h4 class="text-zinc-900 font-semibold text-base mb-1">{{task.title}}</h4>
                <p class="text-xs text-zinc-500 mb-3">{{task.description}}</p>

                @if (getRelatedLabel(task); as label) {
                  @if (ticketRoute(task); as route) {
                    <a [routerLink]="route" class="text-xs text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg p-1.5 px-2 mb-4 inline-flex items-center gap-1 font-medium transition-colors" title="Open ticket">
                      <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none">{{ getRelatedIcon(task) }}</mat-icon>
                      {{label}}
                    </a>
                  } @else {
                    <div class="text-xs text-zinc-900 bg-zinc-100 border border-zinc-200 rounded-lg p-1.5 px-2 mb-4 inline-flex items-center gap-1 font-medium">
                      <mat-icon class="text-[14px] w-3.5 h-3.5 leading-none">{{ getRelatedIcon(task) }}</mat-icon>
                      {{label}}
                    </div>
                  }
                }
              </div>

              <div class="border-t border-zinc-100 pt-3 flex flex-col gap-2 mt-4">
                <div class="flex justify-between items-center text-xs">
                  <span class="text-zinc-400 font-medium">Created By:</span>
                  <app-created-by-badge [createdBy]="task.createdBy" [createdAt]="task.createdAt" />
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="text-zinc-400 font-medium">Assigned Team:</span>
                  <span class="font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">{{getTeamName(task.assignedTeamId)}}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span class="text-zinc-400 font-medium">Assigned Person:</span>
                  <span class="flex items-center gap-1.5 font-bold text-zinc-700">
                    @if (task.assignedToUserId) {
                      <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                      {{ getAssigneeName(task.assignedToUserId) }}
                    } @else {
                      {{ 'leads.unassigned' | translate }}
                    }
                  </span>
                </div>

                <div class="flex gap-2 pt-2 border-t border-zinc-50">
                  @if (task.status === 'Pending' && canWrite()) {
                    <button (click)="tasksService.updateStatus(task.id, 'In Progress')" class="w-full bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      Start Task
                    </button>
                  } @else if (task.status === 'In Progress' && canWrite()) {
                    <button (click)="tasksService.updateStatus(task.id, 'Completed')" class="w-full bg-zinc-900 hover:bg-zinc-950 text-white py-1.5 rounded-lg text-xs font-semibold transition-colors">
                      Complete Task
                    </button>
                  } @else if (task.status === 'Completed') {
                    <span class="text-zinc-900 text-xs font-bold py-1.5 text-center w-full flex items-center justify-center">
                      <mat-icon class="text-[16px] w-4 h-4 mr-0.5">check_circle</mat-icon> Completed
                    </span>
                  }
                  @if (state.currentUserPermissions().canDeleteRecords) {
                    <button (click)="deleteTask(task)" title="Delete task" class="shrink-0 bg-zinc-50 hover:bg-red-50 hover:text-red-600 border border-zinc-200 hover:border-red-200 text-zinc-500 p-1.5 rounded-lg transition-colors">
                      <mat-icon class="text-[16px] w-4 h-4">delete</mat-icon>
                    </button>
                  }

                  @if (task.status !== 'Completed' && canWrite()) {
                    <button (click)="openAssignModal(task)" class="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-center">
                      <mat-icon class="text-[16px] w-4 h-4">person</mat-icon> Assign
                    </button>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="col-span-full text-center py-12 text-zinc-500 card rounded-2xl">
              {{ 'tasks.noTasks' | translate }}
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
          <div class="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col">
            <div class="flex items-center justify-between mb-4 px-1">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-zinc-400"></div>
                <h3 class="text-sm font-bold text-zinc-700 uppercase tracking-wide">{{ 'tasks.pending' | translate }}</h3>
              </div>
              <span class="text-xs font-semibold text-zinc-400 bg-white px-2 py-0.5 rounded-full border border-white/30">{{pendingTasks().length}}</span>
            </div>
            <div
              cdkDropList
              [cdkDropListData]="pendingTasks()"
              (cdkDropListDropped)="onDrop($event, 'Pending')"
              class="kanban-column flex-1 space-y-3 min-h-[100px] rounded-xl"
            >
              @for (task of pendingTasks(); track task.id) {
                <div cdkDrag [cdkDragData]="task" class="kanban-card card rounded-xl p-4 cursor-grab active:cursor-grabbing hover:shadow-md">
                  <div class="flex items-start justify-between mb-2">
                    <span class="text-meta font-sans text-zinc-400">#{{task.id}}</span>
                    <div class="flex items-center gap-1">
                      @if (task.priority) {
                        <span [class]="getPriorityColor(task.priority)" class="text-meta font-bold px-1.5 py-0.5 rounded-full">{{task.priority}}</span>
                      }
                      <span [class]="getStatusColor(task.status)" class="text-meta font-bold uppercase px-1.5 py-0.5 rounded-full">{{task.status}}</span>
                    </div>
                  </div>
                  <h4 class="text-sm font-semibold text-zinc-900 mb-2 leading-snug">{{task.title}}</h4>
                  @if (getRelatedLabel(task); as label) {
                    @if (ticketRoute(task); as route) {
                      <a [routerLink]="route" (mousedown)="$event.stopPropagation()" class="text-meta text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-2 py-1 mb-2 inline-flex items-center gap-1 font-medium transition-colors" title="Open ticket">
                        <mat-icon class="text-[12px] w-3 h-3 leading-none">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </a>
                    } @else {
                      <div class="text-meta text-zinc-900 bg-zinc-100 border border-zinc-200 rounded-lg px-2 py-1 mb-2 inline-flex items-center gap-1 font-medium">
                        <mat-icon class="text-[12px] w-3 h-3 leading-none">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </div>
                    }
                  }
                  <div class="flex items-center gap-2 text-meta text-zinc-500 pt-2 border-t border-zinc-100">
                    @if (task.assignedToUserId) {
                      <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                      <span class="font-medium truncate">{{ getAssigneeName(task.assignedToUserId) }}</span>
                    } @else {
                      <mat-icon class="text-[14px] w-3.5 h-3.5">person</mat-icon>
                      <span class="font-medium truncate">{{ 'leads.unassigned' | translate }}</span>
                    }
                    @if (task.assignedTeamId) {
                      <span class="ml-auto text-meta font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{{getTeamName(task.assignedTeamId)}}</span>
                    }
                  </div>
                  <div class="mt-2 pt-2 border-t border-zinc-50 flex items-center gap-2 text-meta text-zinc-400">
                    <app-created-by-badge [createdBy]="task.createdBy" [createdAt]="task.createdAt" [size]="20" />
                  </div>
                </div>
              } @empty {
                <div class="text-center py-8 text-xs text-zinc-400 italic">{{ 'tasks.noTasks' | translate }}</div>
              }
            </div>
          </div>

          <div class="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col">
            <div class="flex items-center justify-between mb-4 px-1">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                <h3 class="text-sm font-bold text-zinc-700 uppercase tracking-wide">{{ 'tasks.inProgress' | translate }}</h3>
              </div>
              <span class="text-xs font-semibold text-zinc-400 bg-white px-2 py-0.5 rounded-full border border-white/30">{{inProgressTasks().length}}</span>
            </div>
            <div
              cdkDropList
              [cdkDropListData]="inProgressTasks()"
              (cdkDropListDropped)="onDrop($event, 'In Progress')"
              class="kanban-column flex-1 space-y-3 min-h-[100px] rounded-xl"
            >
              @for (task of inProgressTasks(); track task.id) {
                <div cdkDrag [cdkDragData]="task" class="kanban-card card rounded-xl p-4 cursor-grab active:cursor-grabbing hover:shadow-md">
                  <div class="flex items-start justify-between mb-2">
                    <span class="text-meta font-sans text-zinc-400">#{{task.id}}</span>
                    <div class="flex items-center gap-1">
                      @if (task.priority) {
                        <span [class]="getPriorityColor(task.priority)" class="text-meta font-bold px-1.5 py-0.5 rounded-full">{{task.priority}}</span>
                      }
                      <span [class]="getStatusColor(task.status)" class="text-meta font-bold uppercase px-1.5 py-0.5 rounded-full">{{task.status}}</span>
                    </div>
                  </div>
                  <h4 class="text-sm font-semibold text-zinc-900 mb-2 leading-snug">{{task.title}}</h4>
                  @if (getRelatedLabel(task); as label) {
                    @if (ticketRoute(task); as route) {
                      <a [routerLink]="route" (mousedown)="$event.stopPropagation()" class="text-meta text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-2 py-1 mb-2 inline-flex items-center gap-1 font-medium transition-colors" title="Open ticket">
                        <mat-icon class="text-[12px] w-3 h-3 leading-none">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </a>
                    } @else {
                      <div class="text-meta text-zinc-900 bg-zinc-100 border border-zinc-200 rounded-lg px-2 py-1 mb-2 inline-flex items-center gap-1 font-medium">
                        <mat-icon class="text-[12px] w-3 h-3 leading-none">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </div>
                    }
                  }
                  <div class="flex items-center gap-2 text-meta text-zinc-500 pt-2 border-t border-zinc-100">
                    @if (task.assignedToUserId) {
                      <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                      <span class="font-medium truncate">{{ getAssigneeName(task.assignedToUserId) }}</span>
                    } @else {
                      <mat-icon class="text-[14px] w-3.5 h-3.5">person</mat-icon>
                      <span class="font-medium truncate">{{ 'leads.unassigned' | translate }}</span>
                    }
                    @if (task.assignedTeamId) {
                      <span class="ml-auto text-meta font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{{getTeamName(task.assignedTeamId)}}</span>
                    }
                  </div>
                  <div class="mt-2 pt-2 border-t border-zinc-50 flex items-center gap-2 text-meta text-zinc-400">
                    <app-created-by-badge [createdBy]="task.createdBy" [createdAt]="task.createdAt" [size]="20" />
                  </div>
                </div>
              } @empty {
                <div class="text-center py-8 text-xs text-zinc-400 italic">{{ 'tasks.noTasks' | translate }}</div>
              }
            </div>
          </div>

          <div class="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col">
            <div class="flex items-center justify-between mb-4 px-1">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                <h3 class="text-sm font-bold text-zinc-700 uppercase tracking-wide">{{ 'tasks.completed' | translate }}</h3>
              </div>
              <span class="text-xs font-semibold text-zinc-400 bg-white px-2 py-0.5 rounded-full border border-white/30">{{completedTasks().length}}</span>
            </div>
            <div
              cdkDropList
              [cdkDropListData]="completedTasks()"
              (cdkDropListDropped)="onDrop($event, 'Completed')"
              class="kanban-column flex-1 space-y-3 min-h-[100px] rounded-xl"
            >
              @for (task of completedTasks(); track task.id) {
                <div cdkDrag [cdkDragData]="task" class="kanban-card card rounded-xl p-4 cursor-grab active:cursor-grabbing hover:shadow-md">
                  <div class="flex items-start justify-between mb-2">
                    <span class="text-meta font-sans text-zinc-400">#{{task.id}}</span>
                    <div class="flex items-center gap-1">
                      @if (task.priority) {
                        <span [class]="getPriorityColor(task.priority)" class="text-meta font-bold px-1.5 py-0.5 rounded-full">{{task.priority}}</span>
                      }
                      <span [class]="getStatusColor(task.status)" class="text-meta font-bold uppercase px-1.5 py-0.5 rounded-full">{{task.status}}</span>
                    </div>
                  </div>
                  <h4 class="text-sm font-semibold text-zinc-900 mb-2 leading-snug">{{task.title}}</h4>
                  @if (getRelatedLabel(task); as label) {
                    @if (ticketRoute(task); as route) {
                      <a [routerLink]="route" (mousedown)="$event.stopPropagation()" class="text-meta text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-2 py-1 mb-2 inline-flex items-center gap-1 font-medium transition-colors" title="Open ticket">
                        <mat-icon class="text-[12px] w-3 h-3 leading-none">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </a>
                    } @else {
                      <div class="text-meta text-zinc-900 bg-zinc-100 border border-zinc-200 rounded-lg px-2 py-1 mb-2 inline-flex items-center gap-1 font-medium">
                        <mat-icon class="text-[12px] w-3 h-3 leading-none">{{ getRelatedIcon(task) }}</mat-icon>
                        <span class="truncate max-w-[180px]">{{label}}</span>
                      </div>
                    }
                  }
                  <div class="flex items-center gap-2 text-meta text-zinc-500 pt-2 border-t border-zinc-100">
                    @if (task.assignedToUserId) {
                      <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                      <span class="font-medium truncate">{{ getAssigneeName(task.assignedToUserId) }}</span>
                    } @else {
                      <mat-icon class="text-[14px] w-3.5 h-3.5">person</mat-icon>
                      <span class="font-medium truncate">{{ 'leads.unassigned' | translate }}</span>
                    }
                    @if (task.assignedTeamId) {
                      <span class="ml-auto text-meta font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{{getTeamName(task.assignedTeamId)}}</span>
                    }
                  </div>
                  <div class="mt-2 pt-2 border-t border-zinc-50 flex items-center gap-2 text-meta text-zinc-400">
                    <app-created-by-badge [createdBy]="task.createdBy" [createdAt]="task.createdAt" [size]="20" />
                  </div>
                </div>
              } @empty {
                <div class="text-center py-8 text-xs text-zinc-400 italic">{{ 'tasks.noTasks' | translate }}</div>
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
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <h3 class="text-lg font-bold text-zinc-950">{{ 'tasks.newTask' | translate }}</h3>

          <div class="space-y-3">
            <div>
              <label for="task_title" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Task Title</label>
              <input id="task_title" [(ngModel)]="newTaskData.title" type="text" placeholder="e.g. Generate Customer Invoice" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
            </div>

            <div>
              <label for="description" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Description</label>
              <textarea id="description" [(ngModel)]="newTaskData.description" rows="2" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="assigned_team" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Assigned Team</label>
                <select id="assigned_team" [(ngModel)]="newTaskData.assignedTeamId" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                  <option value="">{{ 'leads.unassigned' | translate }}</option>
                  @for (team of state.teams(); track team.id) {
                    <option [value]="team.id">{{team.name}}</option>
                  }
                </select>
              </div>
              <div>
                <label for="priority" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Priority</label>
                <select id="priority" [(ngModel)]="newTaskData.priority" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label for="due_date" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Due Date</label>
              <input id="due_date" [(ngModel)]="newTaskData.dueDate" type="date" class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
            </div>

            <div>
              <span class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Assigned Person</span>
              <app-user-picker [(value)]="newTaskData.assignedToUserId" />
            </div>

            <app-related-entity-picker [(link)]="newTaskData.link" label="Related To" />
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-zinc-100">
            <button (click)="closeTaskModal()" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50 font-sans">{{ 'common.cancel' | translate }}</button>
            <button (click)="saveTask()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-sm shadow-lg shadow-zinc-300 font-sans">{{ 'common.save' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Assign Modal -->
    @if (assignModalOpen()) {
      <div class="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white shadow-xl rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <h3 class="text-lg font-bold text-zinc-950">Assign Task: {{selectedTask()?.title}}</h3>
          <div>
            <span class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Select Assignee</span>
            <app-user-picker [(value)]="reassignedUser" />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button (click)="assignModalOpen.set(false)" class="px-4 py-2 border border-zinc-200 text-zinc-600 text-sm font-semibold rounded-lg hover:bg-zinc-50">Cancel</button>
            <button (click)="saveAssignment()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 text-white text-sm font-semibold rounded-lg shadow-sm shadow-lg shadow-zinc-300">Assign</button>
          </div>
        </div>
      </div>
    }
  `
})
export class TasksComponent {
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

  /** All tasks, filtered by priority and/or linked record if a filter is active */
  filteredTasks = computed(() => {
    const priority = this.activePriorityFilter();
    const link = this.linkFilter();
    return this.tasksService.allTasks().filter(t =>
      (!priority || t.priority === priority) &&
      (!link || (link === 'NONE' ? !t.relatedEntityType : t.relatedEntityType === link))
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

  deleteTask(task: Task) {
    if (!this.canDelete()) return;
    if (confirm(`Delete task "${task.title}"? This cannot be undone.`)) {
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
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'In Progress': return 'bg-sky-50 text-sky-700 border border-sky-200';
      default: return 'bg-zinc-100 text-zinc-800 border border-zinc-200';
    }
  }

  getPriorityColor(priority: string) {
    switch (priority) {
      case 'Urgent': return 'text-red-600 border border-red-200';
      case 'Medium': return 'text-amber-600 border border-amber-200';
      case 'Low': return 'text-emerald-600 border border-emerald-200';
      default: return 'text-zinc-400 border border-zinc-200';
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
