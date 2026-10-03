import { Component, DestroyRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, Task, Ticket, TicketPriority, TicketStatus } from '../services/crm-state.service';
import { TasksService, TicketsService } from '../services/domains';
import { RelatedEntityService } from '../services/related-entity.service';
import { ApiService, TicketCommentDto } from '../services/api.service';
import { CreatedByBadgeComponent } from '../shared/created-by-badge.component';
import { UserAvatarComponent } from '../shared/user-avatar.component';
import { UserPickerComponent } from '../shared/user-picker.component';
import { AttachmentsComponent } from '../shared/attachments.component';
import { ClampDetectDirective } from '../shared/clamp-detect.directive';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../shared/ui/confirm.service';
import { CategoryPillComponent } from '../shared/ui/category-pill.component';
import { CategoryPickerComponent } from '../shared/ui/category-picker.component';

type TaskPriority = NonNullable<Task['priority']>;
interface TaskDraft { title: string; description: string; status: Task['status']; priority: TaskPriority | ''; assignedToUserId: string; dueDate: string }

/**
 * One ticket and the work raised for it: the ticket's own fields, editable in place, and its
 * sub-tasks with a progress bar — the Jira-style "ticket → tasks" view. Tasks live in the
 * shared Tasks store, so anything done here is immediately visible on the Tasks board and
 * vice versa; the ticket's own `taskCount` from the API is only a fallback until that store
 * has loaded.
 */
@Component({
  selector: 'app-ticket-detail',
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink, CreatedByBadgeComponent, UserAvatarComponent, UserPickerComponent, AttachmentsComponent, ClampDetectDirective, CategoryPillComponent, CategoryPickerComponent],
  template: `
    <div class="page max-w-5xl mx-auto">
      <a routerLink="/tickets" class="page-back">
        <mat-icon class="icon-sm">arrow_back</mat-icon>
        Back to Tickets
      </a>

      @if (ticket(); as t) {
        <!-- Header -->
        <div class="card p-5 space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <app-category-pill [categoryId]="t.categoryId" />
                <span [class]="statusColor(t.status)" class="badge">{{ statusLabel(t.status) }}</span>
                <span class="inline-flex items-center gap-1 text-meta font-semibold" [class]="priorityColor(t.priority)">
                  <mat-icon class="icon-sm">flag</mat-icon>{{ priorityLabel(t.priority) }}
                </span>
                @if (t.type) {
                  <span class="badge badge-neutral">{{ t.type }}</span>
                }
                <span class="text-meta text-ink-3 font-mono">#{{ t.id.slice(0, 8) }}</span>
              </div>
              @if (editingTitle()) {
                <input #titleInput [(ngModel)]="draftTitle" (keydown.enter)="saveTitle()" (keydown.escape)="editingTitle.set(false)"
                       class="input-field w-full text-xl" />
                <div class="flex gap-2">
                  <button (click)="saveTitle()" class="btn-primary btn-sm">Save</button>
                  <button (click)="editingTitle.set(false)" class="btn-secondary btn-sm">Cancel</button>
                </div>
              } @else {
                <h1 class="t-title leading-tight flex items-start gap-2">
                  <span>{{ t.title }}</span>
                  @if (canWrite()) {
                    <button (click)="startEditTitle(t)" title="Rename ticket" class="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-ink-2 transition-opacity mt-1">
                      <mat-icon class="icon-md">edit</mat-icon>
                    </button>
                  }
                </h1>
              }
              <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-3">
                @if (partner(); as p) {
                  <a [routerLink]="partnerRoute(p.id, p.type)" class="inline-flex items-center gap-1.5 hover:text-ink font-medium">
                    <mat-icon class="icon-sm">business</mat-icon>{{ p.name }}
                  </a>
                }
                @if (t.deadline) {
                  <span class="inline-flex items-center gap-1.5" [class.text-danger-ink]="isOverdue(t)">
                    <mat-icon class="icon-sm">event</mat-icon>Due {{ t.deadline | date:'mediumDate' }}
                  </span>
                }
                <app-created-by-badge [createdBy]="t.createdBy" [createdAt]="t.createdAt" [size]="20" />
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button (click)="copyTicket(t)" class="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink hover:bg-muted px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors" title="Copy the ticket, its description and its tasks">
                <mat-icon class="icon-md">{{ copied() ? 'check' : 'content_copy' }}</mat-icon>{{ copied() ? 'Copied' : 'Copy' }}
              </button>
              @if (canDelete()) {
                <button (click)="deleteTicket(t)" class="btn-icon btn-sm btn-danger-hover" title="Delete ticket">
                  <mat-icon class="icon-sm">delete</mat-icon>
                </button>
              }
            </div>
          </div>

          <!-- Inline-editable fields -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-line-soft">
            <div>
              <label for="td_status" class="field-label mb-1.5">Status</label>
              <select id="td_status" [ngModel]="t.status" (ngModelChange)="patch({ status: $event })" [disabled]="!canWrite()" class="input-field w-full">
                @for (s of statusOptions; track s) { <option [value]="s">{{ statusLabel(s) }}</option> }
              </select>
            </div>
            <div>
              <label for="td_priority" class="field-label mb-1.5">Priority</label>
              <select id="td_priority" [ngModel]="t.priority" (ngModelChange)="patch({ priority: $event })" [disabled]="!canWrite()" class="input-field w-full">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <span class="field-label mb-1.5">Assignee</span>
              @if (canWrite()) {
                <app-user-picker [value]="t.assignedToUserId || ''" (valueChange)="patch({ assignedToUserId: $event || undefined })" />
              } @else {
                <div class="flex items-center gap-2 text-sm text-ink-2 p-2">
                  @if (t.assignedToUserId) { <app-user-avatar [userId]="t.assignedToUserId" [size]="20" /> }
                  {{ userName(t.assignedToUserId) }}
                </div>
              }
            </div>
            <div>
              <label for="td_deadline" class="field-label mb-1.5">Deadline</label>
              <input id="td_deadline" type="date" [ngModel]="t.deadline || ''" (ngModelChange)="patch({ deadline: $event || undefined })" [disabled]="!canWrite()" class="input-field w-full" />
            </div>
            <div class="col-span-2 md:col-span-4">
              <span class="field-label mb-1.5 block">Category</span>
              <app-category-picker [value]="t.categoryId || ''" (valueChange)="patch({ categoryId: $event || undefined })" [disabled]="!canWrite()"
                                   hint="Every task on this ticket takes the same category." />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Tasks -->
          <div class="lg:col-span-2 space-y-6">
            <div class="card p-5 space-y-4">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                  <mat-icon class="text-ink-2 icon-md">task_alt</mat-icon>
                  <h2 class="card-title">Tasks</h2>
                  <span class="badge badge-neutral">{{ progress().done }}/{{ progress().total }}</span>
                </div>
                @if (progress().total > 0) {
                  <span class="text-xs font-semibold" [class]="progress().done === progress().total ? 'text-success-ink' : 'text-ink-3'">{{ progress().percent }}% done</span>
                }
              </div>

              @if (progress().total > 0) {
                <div class="h-2 w-full bg-muted rounded-full overflow-hidden" role="progressbar" [attr.aria-valuenow]="progress().percent" aria-valuemin="0" aria-valuemax="100">
                  <div class="h-full rounded-full transition-all duration-300" [class]="progress().done === progress().total ? 'bg-success' : 'bg-primary'" [style.width.%]="progress().percent"></div>
                </div>
              }

              @if (allDoneNudge()) {
                <div class="flex flex-wrap items-center justify-between gap-3 bg-success-soft border border-success-line rounded-xl px-4 py-3 text-sm text-success-ink">
                  <span class="inline-flex items-center gap-2"><mat-icon class="icon-md">check_circle</mat-icon>All tasks are done.</span>
                  <button (click)="patch({ status: 'RESOLVED' })" class="btn-primary btn-sm">Mark ticket resolved</button>
                </div>
              }

              <!-- Task rows -->
              <ul class="@container divide-y divide-line-soft">
                @for (task of tasks(); track task.id) {
                  <li class="flex items-start gap-3 py-3 group" [class.opacity-60]="task.status === 'Completed'">
                    <input type="checkbox" [checked]="task.status === 'Completed'" (change)="toggleDone(task)" [disabled]="!canWriteTasks()"
                           class="cursor-pointer mt-0.5 shrink-0" [attr.aria-label]="'Mark ' + task.title + (task.status === 'Completed' ? ' not done' : ' done')" />
                    <!-- Sized by the list's own width, not the viewport: the sidebar and the page's side column
                         can leave this card narrow on a wide screen, and the controls take ~230px. -->
                    <div class="min-w-0 flex-1 flex flex-col @xl:flex-row @xl:items-start gap-2 @xl:gap-3">
                      <div class="min-w-0 flex-1">
                        <button type="button" (click)="openTask(task)" class="block w-full text-left text-sm font-medium text-ink wrap-break-word hover:underline decoration-ink-4 underline-offset-2" [class.line-through]="task.status === 'Completed'">{{ task.title }}</button>
                        @if (task.description) {
                          <button type="button" (click)="openTask(task)" class="block w-full text-left mt-1 text-xs text-ink-3 hover:text-ink-2" [attr.aria-label]="'Read the full description of ' + task.title">
                            <span appClampDetect #clamp="clampDetect" class="line-clamp-2 whitespace-pre-line wrap-break-word">{{ task.description }}</span>
                            @if (clamp.clamped()) {
                              <span class="inline-flex items-center gap-0.5 mt-0.5 text-meta font-semibold text-ink-2">Read more<mat-icon class="icon-xs">chevron_right</mat-icon></span>
                            }
                          </button>
                        }
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-meta text-ink-3">
                          @if (task.priority) {
                            <span [class]="taskPriorityColor(task.priority)" class="badge">{{ task.priority }}</span>
                          }
                          <span class="inline-flex items-center gap-1.5 min-w-0" [title]="userName(task.assignedToUserId)">
                            @if (task.assignedToUserId) {
                              <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                              <span class="truncate max-w-[10rem]">{{ userName(task.assignedToUserId) }}</span>
                            } @else {
                              <mat-icon class="text-ink-4 icon-xs">person</mat-icon><span class="text-ink-3">Unassigned</span>
                            }
                          </span>
                          @if (task.dueDate) {
                            <span class="inline-flex items-center gap-1" [class]="isTaskOverdue(task) ? 'text-danger-ink font-semibold' : ''">
                              <mat-icon class="icon-xs">event</mat-icon>{{ task.dueDate | date:'d MMM' }}
                            </span>
                          }
                        </div>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        <select [ngModel]="task.status" (ngModelChange)="setStatus(task, $event)" [disabled]="!canWriteTasks()" class="input-field" [attr.aria-label]="'Status of ' + task.title">
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                        <!-- Hover-revealed on desktop; always visible on touch-sized screens, which have no hover. -->
                        <div class="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                          <button (click)="openTask(task)" title="Open task" class="btn-icon btn-sm">
                            <mat-icon class="icon-sm">open_in_full</mat-icon>
                          </button>
                          @if (canWriteTasks()) {
                            <button (click)="tasksService.relink(task.id, {})" title="Unlink from ticket" class="btn-icon btn-sm">
                              <mat-icon class="icon-sm">link_off</mat-icon>
                            </button>
                          }
                          @if (canDeleteTasks()) {
                            <button (click)="deleteTask(task)" title="Delete task" class="btn-icon btn-sm btn-danger-hover">
                              <mat-icon class="icon-sm">delete</mat-icon>
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  </li>
                } @empty {
                  <li class="py-8 text-center text-sm text-ink-3">
                    <mat-icon class="mb-1 text-ink-4 block mx-auto icon-xl">checklist</mat-icon>
                    No tasks yet. Break this ticket down into steps below.
                  </li>
                }
              </ul>

              <!-- Add task -->
              @if (canCreateTasks()) {
                <form (ngSubmit)="addTask()" class="border-t border-line-soft pt-4 space-y-3">
                  <div class="flex gap-2">
                    <input name="title" [(ngModel)]="newTask.title" (keydown.enter)="$event.preventDefault(); addTask()" type="text" placeholder="Add a task… (Enter to save)" autocomplete="off"
                           class="input-field flex-1" />
                    <button type="submit" [disabled]="!newTask.title.trim() || adding()" class="btn-primary">
                      <mat-icon class="icon-md">add</mat-icon>Add
                    </button>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <app-user-picker name="assignee" [(value)]="newTask.assignedToUserId" [placeholder]="'Assignee: ' + userName(t.assignedToUserId)" />
                    <select name="priority" [(ngModel)]="newTask.priority" class="input-field" aria-label="Task priority">
                      <option value="">Priority: same as ticket</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                    <input name="dueDate" [(ngModel)]="newTask.dueDate" type="date" class="input-field" aria-label="Task due date" [title]="t.deadline ? 'Defaults to the ticket deadline' : ''" />
                  </div>
                </form>
              }

              <!-- Link existing -->
              @if (canWriteTasks() && unlinkedTasks().length > 0) {
                <div class="flex items-center gap-2 text-xs text-ink-3">
                  <mat-icon class="icon-sm">link</mat-icon>
                  <label for="td_link_existing" class="font-semibold">Link an existing task</label>
                  <select id="td_link_existing" [ngModel]="''" (ngModelChange)="linkExisting($event)" class="input-field">
                    <option value="">Choose an unlinked task…</option>
                    @for (u of unlinkedTasks(); track u.id) { <option [value]="u.id">{{ u.title }}</option> }
                  </select>
                </div>
              }
            </div>

            <!-- Conversation / Comments Thread -->
            <div class="card p-5 space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <mat-icon class="text-ink-2 icon-md">forum</mat-icon>
                  <h2 class="card-title">Conversation & Notes</h2>
                  <span class="badge badge-neutral">{{ comments().length }}</span>
                </div>
              </div>

              <!-- Comment List -->
              @if (comments().length === 0) {
                <div class="text-center py-6 text-xs text-ink-3">No replies or notes yet. Start the conversation below.</div>
              } @else {
                <div class="space-y-3">
                  @for (c of comments(); track c.id) {
                    <div [class]="c.isInternal ? 'bg-warning-soft/70 border-warning-line' : 'bg-subtle border-line'" class="p-4 rounded-xl border space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-semibold text-ink">{{ c.authorName }}</span>
                          @if (c.authorRole) {
                            <span class="text-meta uppercase font-semibold tracking-wider text-ink-3">({{ c.authorRole }})</span>
                          }
                          @if (c.isInternal) {
                            <span class="badge badge-warning">Internal Note</span>
                          }
                        </div>
                        <span class="text-meta text-ink-3">{{ c.createdAt | date:'medium' }}</span>
                      </div>
                      <p class="text-xs text-ink-2 whitespace-pre-wrap leading-relaxed">{{ c.content }}</p>
                    </div>
                  }
                </div>
              }

              <!-- Add Comment / Reply Composer -->
              @if (canWrite()) {
                <div class="pt-3 border-t border-line-soft space-y-2">
                  <textarea [(ngModel)]="newCommentText" rows="3" placeholder="Write a reply or internal note..."
                            class="input-field w-full resize-none"></textarea>
                  <div class="flex items-center justify-between">
                    <label class="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer select-none">
                      <input type="checkbox" [(ngModel)]="isInternalNote" class="text-accent-ink">
                      <span>Internal note only (hidden from client)</span>
                    </label>
                    <button (click)="addComment()" [disabled]="!newCommentText.trim() || submittingComment()"
                            class="btn-primary btn-sm">
                      {{ submittingComment() ? 'Posting...' : isInternalNote ? 'Post Note' : 'Post Reply' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Side column -->
          <div class="space-y-6">
            <div class="card p-5 space-y-3">
              <h2 class="card-title">Description</h2>
              @if (canWrite()) {
                <textarea [ngModel]="t.description || ''" (ngModelChange)="draftDescription = $event" (blur)="saveDescription(t)" rows="6" placeholder="Describe the issue…"
                          class="input-field w-full"></textarea>
              } @else {
                <p class="text-sm text-ink-2 whitespace-pre-wrap">{{ t.description || 'No description.' }}</p>
              }
            </div>

            @if (t.status === 'RESOLVED' || t.status === 'CLOSED' || t.resolution) {
              <div class="card p-5 space-y-3">
                <h2 class="card-title">Resolution</h2>
                @if (canWrite()) {
                  <textarea [ngModel]="t.resolution || ''" (ngModelChange)="draftResolution = $event" (blur)="saveResolution(t)" rows="4" placeholder="How was it resolved?"
                            class="input-field w-full"></textarea>
                } @else {
                  <p class="text-sm text-ink-2 whitespace-pre-wrap">{{ t.resolution || '—' }}</p>
                }
              </div>
            }

            <div class="card p-5">
              <app-attachments ownerEntityType="TICKET" [ownerEntityId]="t.id" [canWrite]="canWrite()" />
            </div>
          </div>
        </div>
      } @else if (loading()) {
        <div class="card p-12 text-center text-sm text-ink-3">Loading ticket…</div>
      } @else {
        <div class="card p-12 text-center space-y-3">
          <mat-icon class="text-ink-4 block mx-auto icon-xl">support_agent</mat-icon>
          <p class="text-sm text-ink-3">This ticket doesn't exist or you don't have access to it.</p>
          <a routerLink="/tickets" class="inline-block bg-muted text-ink border border-line px-4 py-2 rounded-xl text-xs font-semibold">Return to Tickets</a>
        </div>
      }
    </div>

    <!-- Task modal: the full task, readable and (with TASKS_WRITE) editable -->
    @if (openedTask(); as task) {
      <!-- z-[60]: above the app's quick-actions FAB (z-50), below toasts. -->
      <div class="modal-backdrop items-end sm:items-center sm:p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="td_task_modal_title"
             class="bg-surface shadow-xl w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col duration-200">
          <div class="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-line-soft">
            <div class="min-w-0 flex items-center gap-2 text-xs text-ink-3">
              <mat-icon class="icon-md">task_alt</mat-icon>
              <span id="td_task_modal_title" class="font-semibold uppercase tracking-wide">Task</span>
              <span class="font-mono text-ink-3">#{{ task.id.slice(0, 8) }}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button (click)="copyTask(task)" title="Copy task" class="btn-icon btn-sm">
                <mat-icon class="icon-sm">content_copy</mat-icon>
              </button>
              <button (click)="closeTask()" title="Close" class="btn-icon btn-sm">
                <mat-icon class="icon-sm">close</mat-icon>
              </button>
            </div>
          </div>

          <div class="px-6 py-5 space-y-4 overflow-y-auto">
            @if (canWriteTasks()) {
              <div>
                <label for="td_task_title" class="field-label mb-1.5">Title</label>
                <textarea id="td_task_title" [(ngModel)]="taskDraft.title" rows="2"
                          class="input-field w-full resize-y font-semibold"></textarea>
              </div>
              <div>
                <label for="td_task_description" class="field-label mb-1.5">Description</label>
                <textarea id="td_task_description" [(ngModel)]="taskDraft.description" rows="8" placeholder="Add details, acceptance criteria, links…"
                          class="input-field w-full resize-y"></textarea>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="td_task_status" class="field-label mb-1.5">Status</label>
                  <select id="td_task_status" [(ngModel)]="taskDraft.status" class="input-field w-full">
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label for="td_task_priority" class="field-label mb-1.5">Priority</label>
                  <select id="td_task_priority" [(ngModel)]="taskDraft.priority" class="input-field w-full">
                    <option value="">None</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <span class="field-label mb-1.5">Assignee</span>
                  <app-user-picker [(value)]="taskDraft.assignedToUserId" />
                </div>
                <div>
                  <label for="td_task_due" class="field-label mb-1.5">Due date</label>
                  <input id="td_task_due" type="date" [(ngModel)]="taskDraft.dueDate" class="input-field w-full" />
                </div>
              </div>
            } @else {
              <h3 class="modal-title leading-snug">{{ task.title }}</h3>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3">
                <span class="font-semibold text-ink-2">{{ task.status }}</span>
                @if (task.priority) {
                  <span [class]="taskPriorityColor(task.priority)" class="badge">{{ task.priority }}</span>
                }
                <span class="inline-flex items-center gap-1.5">
                  @if (task.assignedToUserId) { <app-user-avatar [userId]="task.assignedToUserId" [size]="18" /> }
                  {{ userName(task.assignedToUserId) }}
                </span>
                @if (task.dueDate) {
                  <span class="inline-flex items-center gap-1" [class]="isTaskOverdue(task) ? 'text-danger-ink font-semibold' : ''">
                    <mat-icon class="icon-xs">event</mat-icon>{{ task.dueDate | date:'mediumDate' }}
                  </span>
                }
              </div>
              <div>
                <h4 class="eyebrow mb-1">Description</h4>
                <p class="text-sm text-ink-2 whitespace-pre-wrap wrap-break-word leading-relaxed">{{ task.description || 'No description.' }}</p>
              </div>
            }
          </div>

          <div class="flex justify-end gap-2 px-6 py-4 border-t border-line-soft">
            @if (canWriteTasks()) {
              <button (click)="closeTask()" class="btn-secondary">Cancel</button>
              <button (click)="saveTask(task)" [disabled]="!taskDraft.title.trim() || savingTask()"
                      class="btn-primary">
                {{ savingTask() ? 'Saving…' : 'Save' }}
              </button>
            } @else {
              <button (click)="closeTask()" class="btn-secondary">Close</button>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class TicketDetailComponent {
  private confirmDialog = inject(ConfirmService);
  state = inject(CrmStateService);
  tasksService = inject(TasksService);
  ticketsService = inject(TicketsService);
  private api = inject(ApiService);
  private related = inject(RelatedEntityService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastService);

  readonly statusOptions: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  ticketId = signal<string>('');
  loading = signal(true);
  editingTitle = signal(false);
  adding = signal(false);
  draftTitle = '';
  draftDescription: string | null = null;
  draftResolution: string | null = null;

  comments = signal<TicketCommentDto[]>([]);
  newCommentText = '';
  isInternalNote = false;
  submittingComment = signal(false);

  /** The task shown in the modal. Read live from the store so a save elsewhere is reflected. */
  private openedTaskId = signal<string | null>(null);
  openedTask = computed(() => {
    const id = this.openedTaskId();
    return id ? this.tasksService.getTaskById(id) : undefined;
  });
  taskDraft: TaskDraft = this.emptyTaskDraft();
  savingTask = signal(false);
  copied = signal(false);

  newTask: { title: string; assignedToUserId: string; priority: TaskPriority | ''; dueDate: string } =
    { title: '', assignedToUserId: '', priority: '', dueDate: '' };

  ticket = computed<Ticket | undefined>(() => this.ticketsService.getTicketById(this.ticketId()));
  partner = computed(() => {
    const t = this.ticket();
    const id = t?.relatedPartnerId || t?.partnerId
      || (t?.relatedEntityType === 'PARTNER' ? t.relatedEntityId : undefined);
    return id ? this.state.partners().find(p => p.id === id) : undefined;
  });

  /** Sub-tasks, open first, then by due date; completed ones sink to the bottom. */
  tasks = computed(() => {
    const id = this.ticketId();
    if (!id) return [];
    const rank = (t: Task) => t.status === 'Completed' ? 2 : t.status === 'In Progress' ? 0 : 1;
    return [...this.tasksService.relatedTo(this.related.linkTo('TICKET', id))]
      .sort((a, b) => rank(a) - rank(b) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  });

  unlinkedTasks = computed(() => this.tasksService.unlinked());

  progress = computed(() => {
    // The task store is the live source; the ticket's own counts cover the moment before it loads.
    const t = this.ticket();
    const local = this.tasks();
    const total = this.tasksService.isLoaded() ? local.length : (t?.taskCount ?? local.length);
    const done = this.tasksService.isLoaded()
      ? local.filter(x => x.status === 'Completed').length
      : (t?.taskDoneCount ?? 0);
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  });

  allDoneNudge = computed(() => {
    const t = this.ticket();
    const p = this.progress();
    return !!t && this.canWrite() && p.total > 0 && p.done === p.total && t.status !== 'RESOLVED' && t.status !== 'CLOSED';
  });

  canWrite(): boolean { return this.state.hasAuthority('TICKETS_WRITE'); }
  canDelete(): boolean { return this.state.hasAuthority('TICKETS_DELETE'); }
  canCreateTasks(): boolean { return this.state.hasAuthority('TASKS_CREATE'); }
  canWriteTasks(): boolean { return this.state.hasAuthority('TASKS_WRITE'); }
  canDeleteTasks(): boolean { return this.state.hasAuthority('TASKS_DELETE'); }

  constructor() {
    this.tasksService.load();
    this.ticketsService.load();
    this.state.loadPartners();

    const sub = this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '';
      this.ticketId.set(id);
      this.editingTitle.set(false);
      this.loading.set(true);
      // Always fetch: the list may be stale or, on a deep link, not loaded at all.
      this.ticketsService.fetchTicket(id).subscribe({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false)
      });
      if (id) {
        this.api.getTicketComments(id).subscribe({
          next: (res) => this.comments.set(res || []),
          error: () => this.comments.set([])
        });
      }
    });
    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.state.breadcrumbLabel.set(null);
    });

    effect(() => {
      const t = this.ticket();
      this.state.breadcrumbLabel.set(t ? t.title : null);
    });
  }

  addComment() {
    const text = this.newCommentText.trim();
    if (!text || this.submittingComment()) return;
    this.submittingComment.set(true);
    const currentUser = this.state.currentUser();
    const payload = {
      content: text,
      authorName: currentUser?.name || 'Support Staff',
      authorRole: currentUser?.role || 'Staff',
      isInternal: this.isInternalNote
    };
    this.api.addTicketComment(this.ticketId(), payload).subscribe({
      next: (comment) => {
        this.comments.update(list => [...list, comment]);
        this.newCommentText = '';
        this.isInternalNote = false;
        this.submittingComment.set(false);
      },
      error: () => {
        this.submittingComment.set(false);
      }
    });
  }

  // ---- Ticket edits ----

  patch(changes: Partial<Ticket>) {
    if (!this.canWrite()) return;
    this.ticketsService.patchTicket(this.ticketId(), changes);
  }

  startEditTitle(t: Ticket) {
    this.draftTitle = t.title;
    this.editingTitle.set(true);
  }

  saveTitle() {
    const title = this.draftTitle.trim();
    if (title && title !== this.ticket()?.title) this.patch({ title });
    this.editingTitle.set(false);
  }

  saveDescription(t: Ticket) {
    if (this.draftDescription !== null && this.draftDescription !== (t.description || '')) {
      this.patch({ description: this.draftDescription });
    }
    this.draftDescription = null;
  }

  saveResolution(t: Ticket) {
    if (this.draftResolution !== null && this.draftResolution !== (t.resolution || '')) {
      this.patch({ resolution: this.draftResolution });
    }
    this.draftResolution = null;
  }

  async deleteTicket(t: Ticket) {
    if (!this.canDelete()) return;
    const n = this.progress().total;
    const note = n > 0 ? ` Its ${n} task${n === 1 ? '' : 's'} will stay on the Tasks board, unlinked.` : '';
    if (await this.confirmDialog.ask({ title: 'Delete ticket?', message: `"${t.title}" will be permanently deleted.${note}`, confirmLabel: 'Delete ticket', danger: true })) {
      this.ticketsService.deleteTicket(t.id);
      this.router.navigate(['/tickets']);
    }
  }

  // ---- Task edits ----

  addTask() {
    const title = this.newTask.title.trim();
    if (!title || !this.canCreateTasks() || this.adding()) return;
    this.adding.set(true);
    this.tasksService.addTaskToTicket(this.ticketId(), {
      title,
      assignedToUserId: this.newTask.assignedToUserId || undefined,
      priority: this.newTask.priority || undefined,
      dueDate: this.newTask.dueDate || undefined
    }, () => {
      this.newTask = { title: '', assignedToUserId: '', priority: '', dueDate: '' };
    });
    // Re-enable the form whether the call succeeded or not; the toast reports failures.
    setTimeout(() => this.adding.set(false), 300);
  }

  toggleDone(task: Task) {
    if (!this.canWriteTasks()) return;
    this.tasksService.updateStatus(task.id, task.status === 'Completed' ? 'Pending' : 'Completed');
  }

  setStatus(task: Task, status: Task['status']) {
    if (!this.canWriteTasks() || status === task.status) return;
    this.tasksService.updateStatus(task.id, status);
  }

  linkExisting(taskId: string) {
    if (!taskId || !this.canWriteTasks()) return;
    this.tasksService.relink(taskId, this.related.linkTo('TICKET', this.ticketId()));
  }

  async deleteTask(task: Task) {
    if (!this.canDeleteTasks()) return;
    if (await this.confirmDialog.ask({ title: 'Delete task?', message: `"${task.title}" will be permanently deleted. This cannot be undone.`, confirmLabel: 'Delete task', danger: true })) {
      this.tasksService.deleteTask(task.id);
    }
  }

  // ---- Task modal ----

  openTask(task: Task) {
    this.taskDraft = this.draftFrom(task);
    this.openedTaskId.set(task.id);
  }

  @HostListener('document:keydown.escape')
  async closeTask() {
    const task = this.openedTask();
    if (!task) return;
    if (this.taskDraftDirty(task) && !(await this.confirmDialog.ask({ title: 'Discard changes?', message: 'Your edits to this task have not been saved.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) return;
    this.openedTaskId.set(null);
  }

  saveTask(task: Task) {
    const title = this.taskDraft.title.trim();
    if (!title || !this.canWriteTasks() || this.savingTask()) return;
    if (!this.taskDraftDirty(task)) { this.openedTaskId.set(null); return; }
    const d = this.taskDraft;
    this.savingTask.set(true);
    this.tasksService.updateDetails(task.id, {
      title,
      description: d.description.trim() || undefined,
      status: d.status,
      priority: d.priority || undefined,
      assignedToUserId: d.assignedToUserId || undefined,
      dueDate: d.dueDate || undefined
    }, () => this.openedTaskId.set(null));
    // Re-enable Save whether the call succeeded or not; the toast reports failures.
    setTimeout(() => this.savingTask.set(false), 300);
  }

  private taskDraftDirty(task: Task): boolean {
    const a = this.draftFrom(task);
    const b = this.taskDraft;
    return a.title !== b.title.trim() || a.description !== b.description.trim() || a.status !== b.status
      || a.priority !== b.priority || a.assignedToUserId !== b.assignedToUserId || a.dueDate !== b.dueDate;
  }

  private draftFrom(task: Task): TaskDraft {
    return {
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority || '',
      assignedToUserId: task.assignedToUserId || '',
      dueDate: task.dueDate || ''
    };
  }

  private emptyTaskDraft(): TaskDraft {
    return { title: '', description: '', status: 'Pending', priority: '', assignedToUserId: '', dueDate: '' };
  }

  // ---- Copy ----

  /** Copies the ticket as Markdown (plain text) and HTML, so it pastes well in Slack, docs and email alike. */
  copyTicket(t: Ticket) {
    const tasks = this.tasks();
    const done = tasks.filter(x => x.status === 'Completed').length;

    const md: string[] = [`# ${t.title}`, ''];
    const html: string[] = [`<h1>${esc(t.title)}</h1>`];
    md.push('## Description', '', t.description?.trim() || '_No description._', '');
    html.push('<h2>Description</h2>', paragraphs(t.description) || '<p><em>No description.</em></p>');

    md.push(`## Tasks (${done}/${tasks.length} done)`, '');
    html.push(`<h2>Tasks (${done}/${tasks.length} done)</h2>`);
    if (tasks.length === 0) {
      md.push('_No tasks._');
      html.push('<p><em>No tasks.</em></p>');
    } else {
      html.push('<ol>');
      tasks.forEach((task, i) => {
        const box = task.status === 'Completed' ? '[x]' : '[ ]';
        md.push(`${i + 1}. ${box} **${task.title}**`);
        const desc = task.description?.trim();
        if (desc) desc.split('\n').forEach(line => md.push(`   ${line}`.trimEnd()));
        md.push('');
        html.push(`<li><p>${task.status === 'Completed' ? '☑' : '☐'} <strong>${esc(task.title)}</strong></p>${paragraphs(desc)}</li>`);
      });
      html.push('</ol>');
    }

    this.writeClipboard(md.join('\n').trimEnd() + '\n', html.join(''), () => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
      this.toast.show('Ticket copied to clipboard', { type: 'success' });
    });
  }

  copyTask(task: Task) {
    const desc = task.description?.trim();
    const md = `**${task.title}**` + (desc ? `\n\n${desc}` : '') + '\n';
    const html = `<p><strong>${esc(task.title)}</strong></p>${paragraphs(desc)}`;
    this.writeClipboard(md, html, () => this.toast.show('Task copied to clipboard', { type: 'success' }));
  }

  private writeClipboard(text: string, html: string, onDone: () => void) {
    // Rich copy where supported; plain text is always included for editors that ignore HTML.
    // Falls back to a copy event where the async Clipboard API is missing or its permission
    // is denied (embedded webviews, locked-down browsers, non-HTTPS origins).
    const fallback = () => copyViaEvent(text, html)
      ? onDone()
      : this.toast.show('Failed to copy to clipboard', { type: 'error' });
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' })
      });
      navigator.clipboard.write([item]).then(onDone, fallback);
    } else {
      fallback();
    }
  }

  // ---- Display helpers ----

  userName(userId?: string): string {
    if (!userId) return 'Unassigned';
    return this.state.users().find(u => u.id === userId)?.displayName || 'Unknown';
  }

  partnerRoute(id: string, type: string): string[] {
    return type === 'Lead' ? ['/partners/lead', id] : ['/partners', id, 'customer-card'];
  }

  isOverdue(t: Ticket): boolean {
    return !!t.deadline && t.status !== 'RESOLVED' && t.status !== 'CLOSED' && t.deadline < this.today();
  }

  isTaskOverdue(task: Task): boolean {
    return !!task.dueDate && task.status !== 'Completed' && task.dueDate < this.today();
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  statusLabel(status: TicketStatus): string {
    switch (status) {
      case 'OPEN': return 'Open';
      case 'IN_PROGRESS': return 'In Progress';
      case 'RESOLVED': return 'Resolved';
      case 'CLOSED': return 'Closed';
    }
  }

  statusColor(status: TicketStatus): string {
    switch (status) {
      case 'OPEN': return 'badge-danger';
      case 'IN_PROGRESS': return 'badge-warning';
      case 'RESOLVED': return 'badge-success';
      case 'CLOSED': return 'text-ink-3 border-line bg-subtle';
    }
  }

  priorityLabel(priority: TicketPriority): string {
    switch (priority) {
      case 'URGENT': return 'Urgent';
      case 'HIGH': return 'High';
      case 'MEDIUM': return 'Medium';
      case 'LOW': return 'Low';
      default: return priority;
    }
  }

  priorityColor(priority: TicketPriority): string {
    switch (priority) {
      case 'URGENT': return 'text-danger-ink';
      case 'HIGH': return 'text-warning-ink';
      case 'MEDIUM': return 'text-success-ink';
      case 'LOW': return 'text-accent-ink';
      default: return 'text-ink-3';
    }
  }

  taskPriorityColor(priority: string): string {
    switch (priority) {
      case 'Urgent': return 'badge-danger';
      case 'Medium': return 'badge-warning';
      case 'Low': return 'badge-success';
      default: return 'text-ink-3 border-line';
    }
  }
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Synchronous clipboard write through the legacy copy command; needs no clipboard permission. */
function copyViaEvent(text: string, html: string): boolean {
  let written = false;
  const onCopy = (e: ClipboardEvent) => {
    if (!e.clipboardData) return;
    e.clipboardData.setData('text/plain', text);
    e.clipboardData.setData('text/html', html);
    e.preventDefault();
    written = true;
  };
  document.addEventListener('copy', onCopy);
  try {
    document.execCommand('copy');
  } finally {
    document.removeEventListener('copy', onCopy);
  }
  return written;
}

/** Blank-line-separated paragraphs, single newlines kept as line breaks. */
function paragraphs(text?: string): string {
  const trimmed = text?.trim();
  if (!trimmed) return '';
  return trimmed.split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}
