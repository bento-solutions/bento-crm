import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';
import type { Category, CategoryColor } from '../crm-state.service';
import { TasksService } from './tasks.service';
import { TicketsService } from './tickets.service';

export type { Category, CategoryColor };

export const CATEGORY_COLORS: readonly CategoryColor[] = ['blue', 'sky', 'emerald', 'amber', 'rose', 'violet', 'slate'];

/**
 * The organization's categories — the single-word coloured labels on tickets and tasks. One
 * shared store so a rename or recolour in Settings shows up in every list at once.
 */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private tickets = inject(TicketsService);
  private tasks = inject(TasksService);

  categories = signal<Category[]>([]);
  isLoaded = signal(false);
  private requested = false;

  byId = computed(() => new Map(this.categories().map(c => [c.id, c])));

  /** Loads once; pass `force` to re-read (e.g. to refresh the usage counts). */
  load(force = false): void {
    if (this.requested && !force) return;
    this.requested = true;
    this.api.getCategories().subscribe({
      next: list => { this.categories.set(list ?? []); this.isLoaded.set(true); },
      error: () => { this.requested = false; this.isLoaded.set(true); }
    });
  }

  get(id: string | undefined | null): Category | undefined {
    return id ? this.byId().get(id) : undefined;
  }

  /** Resolves with the saved category, or rejects with the API error so the form can show its message. */
  create(name: string, color: CategoryColor): Observable<Category> {
    return this.api.createCategory({ name, color }).pipe(
      tap(created => {
        this.categories.update(list => this.sorted([...list, created]));
        this.toast.show(`Category <strong>${created.name}</strong> created`);
      }));
  }

  update(id: string, name: string, color: CategoryColor): Observable<Category> {
    return this.api.updateCategory(id, { name, color }).pipe(
      tap(updated => {
        this.categories.update(list => this.sorted(list.map(c => c.id === id ? updated : c)));
        this.toast.show('Category updated');
      }));
  }

  /** Removes the category; the server clears it from every ticket and task, so those stores re-read. */
  remove(category: Category): Observable<void> {
    return this.api.deleteCategory(category.id).pipe(
      tap(() => {
        this.categories.update(list => list.filter(c => c.id !== category.id));
        this.tickets.tickets.update(list => list.map(t => t.categoryId === category.id ? { ...t, categoryId: undefined } : t));
        this.tasks.tasks.update(list => list.map(t => t.categoryId === category.id ? { ...t, categoryId: undefined } : t));
        this.toast.show(`Category <strong>${category.name}</strong> deleted`);
      }));
  }

  private sorted(list: Category[]): Category[] {
    return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }
}
