import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import { Task } from '../crm-state.service';
import { EntityLink, isLinked } from '../../shared/related-entity.model';

export type { Task };

@Injectable({
  providedIn: 'root'
})
export class TasksService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  tasks = signal<Task[]>([]);
  isLoaded = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  allTasks = computed(() => this.tasks());
  isLoading$ = computed(() => this.isLoading());
  error$ = computed(() => this.error());

  load(): void {
    if (this.isLoaded()) return;
    this.isLoading.set(true);
    this.error.set(null);

    this.api.getTasks().subscribe({
      next: (tasks) => {
        if (tasks && tasks.length > 0) {
          this.tasks.set(tasks);
        }
        this.isLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load tasks from API:', err);
        this.isLoaded.set(true);
        this.isLoading.set(false);
        this.error.set('Failed to load tasks from the server.');
      }
    });
  }

  addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.api.createTask(task).subscribe({
      next: (created) => {
        this.tasks.update(tasks => [...tasks, created]);
        this.toast.show(`Task <strong>${created.title}</strong> created`);
      },
      error: () => this.toast.show('Failed to create task', { type: 'error' })
    });
  }

  updateTask(id: string, task: Partial<Task>): void {
    this.api.updateTask(id, task).subscribe({
      next: (updated) => {
        this.tasks.update(tasks =>
          tasks.map(t => t.id === id ? updated : t)
        );
        this.toast.show(`Task updated`);
      },
      error: () => this.toast.show('Failed to update task', { type: 'error' })
    });
  }

  /**
   * The backend's PATCH /tasks/{id} re-validates the whole task (title, assignedByUserId, etc.
   * are all @NotNull on the shared create/update DTO), so a request carrying only `{ status }`
   * fails validation. Sending the full current task with the status (and optionally assignee)
   * overridden keeps every required field populated regardless of what actually changed.
   */
  updateStatus(id: string, status: Task['status'], assignedToUserId?: string): void {
    const current = this.tasks().find(t => t.id === id);
    if (!current) return;
    const prevStatus = current.status;
    const prevAssignee = current.assignedToUserId;
    const payload: Task = { ...current, status };
    if (assignedToUserId !== undefined) payload.assignedToUserId = assignedToUserId;
    this.api.updateTask(id, payload).subscribe({
      next: (dto) => {
        this.tasks.update(tasks => tasks.map(t => t.id === id ? dto : t));
        this.toast.show(`Task status updated`, {
          undo: () => {
            this.tasks.update(tasks =>
              tasks.map(t => t.id === id ? { ...t, status: prevStatus, assignedToUserId: prevAssignee } : t)
            );
          }
        });
      },
      error: () => this.toast.show('Failed to update task status', { type: 'error' })
    });
  }

  deleteTask(id: string): void {
    const deleted = this.tasks().find(t => t.id === id);
    this.api.deleteTask(id).subscribe({
      next: () => {
        this.tasks.update(tasks => tasks.filter(t => t.id !== id));
        this.toast.show(`Task <strong>${deleted?.title || id}</strong> deleted`, {
          undo: () => {
            if (deleted) {
              this.tasks.update(tasks => [...tasks, deleted]);
            }
          }
        });
      },
      error: () => this.toast.show('Failed to delete task', { type: 'error' })
    });
  }

  getTaskById(id: string): Task | undefined {
    return this.tasks().find(t => t.id === id);
  }

  /** Tasks linked to the given record, from the already-loaded list. */
  relatedTo(link: EntityLink): Task[] {
    if (!isLinked(link)) return [];
    return this.tasks().filter(t => t.relatedEntityId === link.relatedEntityId);
  }

  /**
   * Ensures the tasks for one record are present. The current API only exposes the
   * unfiltered/paginated list, so this simply guarantees the shared store is loaded;
   * `relatedTo` then filters from it.
   */
  loadRelatedTo(_link: EntityLink): void {
    this.load();
  }
}
