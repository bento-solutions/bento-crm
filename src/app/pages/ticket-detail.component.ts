import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
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

type TaskPriority = NonNullable<Task['priority']>;

/**
 * One ticket and the work raised for it: the ticket's own fields, editable in place, and its
 * sub-tasks with a progress bar — the Jira-style "ticket → tasks" view. Tasks live in the
 * shared Tasks store, so anything done here is immediately visible on the Tasks board and
 * vice versa; the ticket's own `taskCount` from the API is only a fallback until that store
 * has loaded.
 */
@Component({
  selector: 'app-ticket-detail',
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink, CreatedByBadgeComponent, UserAvatarComponent, UserPickerComponent, AttachmentsComponent],
  template: `
    <div class="space-y-6 font-sans max-w-5xl mx-auto">
      <a routerLink="/tickets" class="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors">
        <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">arrow_back</mat-icon>
        Back to Tickets
      </a>

      @if (ticket(); as t) {
        <!-- Header -->
        <div class="card rounded-2xl p-6 space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span [class]="statusColor(t.status)" class="px-2.5 py-1 text-body font-semibold rounded-full border">{{ statusLabel(t.status) }}</span>
                <span class="inline-flex items-center gap-1 text-meta font-semibold" [class]="priorityColor(t.priority)">
                  <mat-icon class="text-[16px] w-4 h-4">flag</mat-icon>{{ priorityLabel(t.priority) }}
                </span>
                @if (t.type) {
                  <span class="px-2 py-0.5 text-body bg-zinc-100 text-zinc-700 rounded-md border border-zinc-200 font-medium">{{ t.type }}</span>
                }
                <span class="text-meta text-zinc-400 font-mono">#{{ t.id.slice(0, 8) }}</span>
              </div>
              @if (editingTitle()) {
                <input #titleInput [(ngModel)]="draftTitle" (keydown.enter)="saveTitle()" (keydown.escape)="editingTitle.set(false)"
                       class="w-full input-field rounded-lg p-2 text-xl font-bold text-zinc-950 focus:outline-blue-600" />
                <div class="flex gap-2">
                  <button (click)="saveTitle()" class="px-3 py-1.5 bg-zinc-900 text-white text-xs font-semibold rounded-lg">Save</button>
                  <button (click)="editingTitle.set(false)" class="px-3 py-1.5 border border-zinc-200 text-zinc-600 text-xs font-semibold rounded-lg">Cancel</button>
                </div>
              } @else {
                <h1 class="text-2xl font-bold text-zinc-950 leading-tight flex items-start gap-2 group">
                  <span>{{ t.title }}</span>
                  @if (canWrite()) {
                    <button (click)="startEditTitle(t)" title="Rename ticket" class="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 transition-opacity mt-1">
                      <mat-icon class="text-[18px] w-4.5 h-4.5">edit</mat-icon>
                    </button>
                  }
                </h1>
              }
              <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500">
                @if (partner(); as p) {
                  <a [routerLink]="partnerRoute(p.id, p.type)" class="inline-flex items-center gap-1.5 hover:text-zinc-900 font-medium">
                    <mat-icon class="text-[16px] w-4 h-4">business</mat-icon>{{ p.name }}
                  </a>
                }
                @if (t.deadline) {
                  <span class="inline-flex items-center gap-1.5" [class.text-red-600]="isOverdue(t)">
                    <mat-icon class="text-[16px] w-4 h-4">event</mat-icon>Due {{ t.deadline | date:'mediumDate' }}
                  </span>
                }
                <app-created-by-badge [createdBy]="t.createdBy" [createdAt]="t.createdAt" [size]="20" />
              </div>
            </div>
            @if (canDelete()) {
              <button (click)="deleteTicket(t)" class="text-zinc-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Delete ticket">
                <mat-icon class="text-[20px] w-5 h-5">delete</mat-icon>
              </button>
            }
          </div>

          <!-- Inline-editable fields -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-zinc-100">
            <div>
              <label for="td_status" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Status</label>
              <select id="td_status" [ngModel]="t.status" (ngModelChange)="patch({ status: $event })" [disabled]="!canWrite()" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                @for (s of statusOptions; track s) { <option [value]="s">{{ statusLabel(s) }}</option> }
              </select>
            </div>
            <div>
              <label for="td_priority" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Priority</label>
              <select id="td_priority" [ngModel]="t.priority" (ngModelChange)="patch({ priority: $event })" [disabled]="!canWrite()" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <span class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Assignee</span>
              @if (canWrite()) {
                <app-user-picker [value]="t.assignedToUserId || ''" (valueChange)="patch({ assignedToUserId: $event || undefined })" />
              } @else {
                <div class="flex items-center gap-2 text-sm text-zinc-700 p-2">
                  @if (t.assignedToUserId) { <app-user-avatar [userId]="t.assignedToUserId" [size]="20" /> }
                  {{ userName(t.assignedToUserId) }}
                </div>
              }
            </div>
            <div>
              <label for="td_deadline" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">Deadline</label>
              <input id="td_deadline" type="date" [ngModel]="t.deadline || ''" (ngModelChange)="patch({ deadline: $event || undefined })" [disabled]="!canWrite()" class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600" />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Tasks -->
          <div class="lg:col-span-2 space-y-6">
            <div class="card rounded-2xl p-6 space-y-4">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                  <mat-icon class="text-[20px] w-5 h-5 text-zinc-700">task_alt</mat-icon>
                  <h2 class="text-base font-bold text-zinc-900">Tasks</h2>
                  <span class="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">{{ progress().done }}/{{ progress().total }}</span>
                </div>
                @if (progress().total > 0) {
                  <span class="text-xs font-semibold" [class]="progress().done === progress().total ? 'text-emerald-600' : 'text-zinc-500'">{{ progress().percent }}% done</span>
                }
              </div>

              @if (progress().total > 0) {
                <div class="h-2 w-full bg-zinc-100 rounded-full overflow-hidden" role="progressbar" [attr.aria-valuenow]="progress().percent" aria-valuemin="0" aria-valuemax="100">
                  <div class="h-full rounded-full transition-all duration-300" [class]="progress().done === progress().total ? 'bg-emerald-500' : 'bg-zinc-900'" [style.width.%]="progress().percent"></div>
                </div>
              }

              @if (allDoneNudge()) {
                <div class="flex flex-wrap items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                  <span class="inline-flex items-center gap-2"><mat-icon class="text-[18px] w-4.5 h-4.5">check_circle</mat-icon>All tasks are done.</span>
                  <button (click)="patch({ status: 'RESOLVED' })" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors">Mark ticket resolved</button>
                </div>
              }

              <!-- Task rows -->
              <ul class="divide-y divide-zinc-100">
                @for (task of tasks(); track task.id) {
                  <li class="flex items-start gap-3 py-3 group" [class.opacity-60]="task.status === 'Completed'">
                    <input type="checkbox" [checked]="task.status === 'Completed'" (change)="toggleDone(task)" [disabled]="!canWriteTasks()"
                           class="cursor-pointer h-4 w-4 mt-0.5 accent-zinc-900 shrink-0" [attr.aria-label]="'Mark ' + task.title + (task.status === 'Completed' ? ' not done' : ' done')" />
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium text-zinc-900 truncate" [class.line-through]="task.status === 'Completed'" [title]="task.title">{{ task.title }}</div>
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-meta text-zinc-500">
                        @if (task.priority) {
                          <span [class]="taskPriorityColor(task.priority)" class="font-bold px-1.5 py-0.5 rounded-full border">{{ task.priority }}</span>
                        }
                        <span class="inline-flex items-center gap-1.5 min-w-0" [title]="userName(task.assignedToUserId)">
                          @if (task.assignedToUserId) {
                            <app-user-avatar [userId]="task.assignedToUserId" [size]="18" />
                            <span class="truncate max-w-[10rem]">{{ userName(task.assignedToUserId) }}</span>
                          } @else {
                            <mat-icon class="text-[14px] w-3.5 h-3.5 text-zinc-400">person</mat-icon><span class="text-zinc-400">Unassigned</span>
                          }
                        </span>
                        @if (task.dueDate) {
                          <span class="inline-flex items-center gap-1" [class]="isTaskOverdue(task) ? 'text-red-600 font-semibold' : ''">
                            <mat-icon class="text-[14px] w-3.5 h-3.5">event</mat-icon>{{ task.dueDate | date:'d MMM' }}
                          </span>
                        }
                        @if (task.description) {
                          <span class="truncate max-w-[16rem] text-zinc-400" [title]="task.description">{{ task.description }}</span>
                        }
                      </div>
                    </div>
                    <select [ngModel]="task.status" (ngModelChange)="setStatus(task, $event)" [disabled]="!canWriteTasks()" class="input-field rounded-lg px-2 py-1 text-xs shrink-0 w-32!" [attr.aria-label]="'Status of ' + task.title">
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                      @if (canWriteTasks()) {
                        <button (click)="tasksService.relink(task.id, {})" title="Unlink from ticket" class="text-zinc-400 hover:text-zinc-700 p-1 rounded">
                          <mat-icon class="text-[16px] w-4 h-4">link_off</mat-icon>
                        </button>
                      }
                      @if (canDeleteTasks()) {
                        <button (click)="deleteTask(task)" title="Delete task" class="text-zinc-400 hover:text-red-600 p-1 rounded">
                          <mat-icon class="text-[16px] w-4 h-4">delete</mat-icon>
                        </button>
                      }
                    </div>
                  </li>
                } @empty {
                  <li class="py-8 text-center text-sm text-zinc-400">
                    <mat-icon class="text-[32px]! w-8 h-8 mb-1 text-zinc-300 block mx-auto">checklist</mat-icon>
                    No tasks yet. Break this ticket down into steps below.
                  </li>
                }
              </ul>

              <!-- Add task -->
              @if (canCreateTasks()) {
                <form (ngSubmit)="addTask()" class="border-t border-zinc-100 pt-4 space-y-3">
                  <div class="flex gap-2">
                    <input name="title" [(ngModel)]="newTask.title" (keydown.enter)="$event.preventDefault(); addTask()" type="text" placeholder="Add a task… (Enter to save)" autocomplete="off"
                           class="flex-1 input-field rounded-lg p-2 text-sm focus:outline-blue-600" />
                    <button type="submit" [disabled]="!newTask.title.trim() || adding()" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-950 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg flex items-center gap-1.5">
                      <mat-icon class="text-[18px] w-4.5 h-4.5">add</mat-icon>Add
                    </button>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <app-user-picker name="assignee" [(value)]="newTask.assignedToUserId" [placeholder]="'Assignee: ' + userName(t.assignedToUserId)" />
                    <select name="priority" [(ngModel)]="newTask.priority" class="input-field rounded-lg p-2 text-sm focus:outline-blue-600" aria-label="Task priority">
                      <option value="">Priority: same as ticket</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                    <input name="dueDate" [(ngModel)]="newTask.dueDate" type="date" class="input-field rounded-lg p-2 text-sm focus:outline-blue-600" aria-label="Task due date" [title]="t.deadline ? 'Defaults to the ticket deadline' : ''" />
                  </div>
                </form>
              }

              <!-- Link existing -->
              @if (canWriteTasks() && unlinkedTasks().length > 0) {
                <div class="flex items-center gap-2 text-xs text-zinc-500">
                  <mat-icon class="text-[16px] w-4 h-4">link</mat-icon>
                  <label for="td_link_existing" class="font-semibold">Link an existing task</label>
                  <select id="td_link_existing" [ngModel]="''" (ngModelChange)="linkExisting($event)" class="input-field rounded-lg px-2 py-1 text-xs w-72!">
                    <option value="">Choose an unlinked task…</option>
                    @for (u of unlinkedTasks(); track u.id) { <option [value]="u.id">{{ u.title }}</option> }
                  </select>
                </div>
              }
            </div>

            <!-- Conversation / Comments Thread -->
            <div class="card rounded-2xl p-6 space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <mat-icon class="text-[20px] w-5 h-5 text-zinc-700">forum</mat-icon>
                  <h2 class="text-base font-bold text-zinc-900">Conversation & Notes</h2>
                  <span class="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">{{ comments().length }}</span>
                </div>
              </div>

              <!-- Comment List -->
              @if (comments().length === 0) {
                <div class="text-center py-6 text-xs text-zinc-400">No replies or notes yet. Start the conversation below.</div>
              } @else {
                <div class="space-y-3">
                  @for (c of comments(); track c.id) {
                    <div [class]="c.isInternal ? 'bg-amber-50/70 border-amber-200' : 'bg-zinc-50 border-zinc-200/70'" class="p-4 rounded-xl border space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-bold text-zinc-900">{{ c.authorName }}</span>
                          @if (c.authorRole) {
                            <span class="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">({{ c.authorRole }})</span>
                          }
                          @if (c.isInternal) {
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">Internal Note</span>
                          }
                        </div>
                        <span class="text-[11px] text-zinc-400">{{ c.createdAt | date:'medium' }}</span>
                      </div>
                      <p class="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">{{ c.content }}</p>
                    </div>
                  }
                </div>
              }

              <!-- Add Comment / Reply Composer -->
              @if (canWrite()) {
                <div class="pt-3 border-t border-zinc-100 space-y-2">
                  <textarea [(ngModel)]="newCommentText" rows="3" placeholder="Write a reply or internal note..."
                            class="w-full input-field rounded-lg p-2.5 text-xs focus:outline-blue-600 resize-none"></textarea>
                  <div class="flex items-center justify-between">
                    <label class="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer select-none">
                      <input type="checkbox" [(ngModel)]="isInternalNote" class="rounded text-blue-600 focus:ring-0">
                      <span>Internal note only (hidden from client)</span>
                    </label>
                    <button (click)="addComment()" [disabled]="!newCommentText.trim() || submittingComment()"
                            class="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-950 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors">
                      {{ submittingComment() ? 'Posting...' : isInternalNote ? 'Post Note' : 'Post Reply' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Side column -->
          <div class="space-y-6">
            <div class="card rounded-2xl p-6 space-y-3">
              <h2 class="text-base font-bold text-zinc-900">Description</h2>
              @if (canWrite()) {
                <textarea [ngModel]="t.description || ''" (ngModelChange)="draftDescription = $event" (blur)="saveDescription(t)" rows="6" placeholder="Describe the issue…"
                          class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
              } @else {
                <p class="text-sm text-zinc-600 whitespace-pre-wrap">{{ t.description || 'No description.' }}</p>
              }
            </div>

            @if (t.status === 'RESOLVED' || t.status === 'CLOSED' || t.resolution) {
              <div class="card rounded-2xl p-6 space-y-3">
                <h2 class="text-base font-bold text-zinc-900">Resolution</h2>
                @if (canWrite()) {
                  <textarea [ngModel]="t.resolution || ''" (ngModelChange)="draftResolution = $event" (blur)="saveResolution(t)" rows="4" placeholder="How was it resolved?"
                            class="w-full input-field rounded-lg p-2 text-sm focus:outline-blue-600"></textarea>
                } @else {
                  <p class="text-sm text-zinc-600 whitespace-pre-wrap">{{ t.resolution || '—' }}</p>
                }
              </div>
            }

            <div class="card rounded-2xl p-6">
              <app-attachments ownerEntityType="TICKET" [ownerEntityId]="t.id" [canWrite]="canWrite()" />
            </div>
          </div>
        </div>
      } @else if (loading()) {
        <div class="card rounded-2xl p-12 text-center text-sm text-zinc-400">Loading ticket…</div>
      } @else {
        <div class="card rounded-2xl p-12 text-center space-y-3">
          <mat-icon class="text-[40px]! w-10 h-10 text-zinc-300 block mx-auto">support_agent</mat-icon>
          <p class="text-sm text-zinc-500">This ticket doesn't exist or you don't have access to it.</p>
          <a routerLink="/tickets" class="inline-block bg-zinc-100 text-zinc-950 border border-zinc-200/50 px-4 py-2 rounded-xl text-xs font-bold">Return to Tickets</a>
        </div>
      }
    </div>
  `
})
export class TicketDetailComponent {
  state = inject(CrmStateService);
  tasksService = inject(TasksService);
  ticketsService = inject(TicketsService);
  private api = inject(ApiService);
  private related = inject(RelatedEntityService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

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

  deleteTicket(t: Ticket) {
    if (!this.canDelete()) return;
    const n = this.progress().total;
    const note = n > 0 ? ` Its ${n} task${n === 1 ? '' : 's'} will stay on the Tasks board, unlinked.` : '';
    if (confirm(`Delete ticket "${t.title}"?${note}`)) {
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

  deleteTask(task: Task) {
    if (!this.canDeleteTasks()) return;
    if (confirm(`Delete task "${task.title}"? This cannot be undone.`)) {
      this.tasksService.deleteTask(task.id);
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
      case 'OPEN': return 'text-red-600 border-red-200 bg-red-50';
      case 'IN_PROGRESS': return 'text-amber-600 border-amber-200 bg-amber-50';
      case 'RESOLVED': return 'text-emerald-600 border-emerald-200 bg-emerald-50';
      case 'CLOSED': return 'text-zinc-500 border-zinc-200 bg-zinc-50';
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
      case 'URGENT': return 'text-red-600';
      case 'HIGH': return 'text-orange-500';
      case 'MEDIUM': return 'text-green-500';
      case 'LOW': return 'text-blue-400';
      default: return 'text-zinc-500';
    }
  }

  taskPriorityColor(priority: string): string {
    switch (priority) {
      case 'Urgent': return 'text-red-600 border-red-200';
      case 'Medium': return 'text-amber-600 border-amber-200';
      case 'Low': return 'text-emerald-600 border-emerald-200';
      default: return 'text-zinc-400 border-zinc-200';
    }
  }
}
