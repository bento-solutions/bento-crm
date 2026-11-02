import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { ApiClientError } from '../core/services/base-api.service';
import { CATEGORY_COLORS, CategoriesService, Category, CategoryColor } from '../services/domains/categories.service';
import { CrmStateService } from '../services/crm-state.service';
import { ToastService } from '../services/toast.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { CategoryPillComponent } from '../shared/ui/category-pill.component';
import { ConfirmService } from '../shared/ui/confirm.service';

/**
 * Settings → Categories: the single-word coloured labels that say which product or project a
 * ticket or task belongs to (CRMbento, Orthoflow…). Create, rename, recolour and delete; the
 * list shows how many tickets and tasks use each one.
 */
@Component({
  selector: 'app-settings-categories',
  imports: [FormsModule, MatIconModule, PageHeaderComponent, EmptyStateComponent, CategoryPillComponent],
  template: `
    <div class="page max-w-3xl">
      <app-page-header size="section" title="Categories" subtitle="One-word coloured labels that say which product a ticket or task belongs to">
        @if (editing() === null && canWrite()) {
          <button actions type="button" class="btn-primary" (click)="startCreate()">
            <mat-icon>add</mat-icon>
            New category
          </button>
        }
      </app-page-header>

      @if (editing() !== null) {
        <section class="card">
          <div class="card-header">
            <h3 class="card-title">{{ editing() === 'new' ? 'New category' : 'Edit category' }}</h3>
          </div>
          <div class="card-body space-y-4">
            <div class="flex flex-wrap items-start gap-x-6 gap-y-4">
              <label class="field grow basis-56">
                <span class="field-label">Name</span>
                <input class="input-field" maxlength="24" placeholder="e.g. Orthoflow" autocomplete="off"
                       [ngModel]="name()" (ngModelChange)="name.set($event)" (keydown.enter)="save()" />
                <span [class]="nameError() ? 'field-error' : 'field-hint'">
                  {{ nameError() || 'One word, up to 24 characters.' }}
                </span>
              </label>
              <div class="field">
                <span class="field-label">Colour</span>
                <div class="flex flex-wrap items-center gap-2 h-9" role="radiogroup" aria-label="Colour">
                  @for (c of colors; track c) {
                    <button type="button" role="radio" class="tone swatch" [attr.data-tone]="c" [attr.aria-checked]="color() === c"
                            [class.is-selected]="color() === c" [attr.aria-label]="c" [title]="c" (click)="color.set(c)"></button>
                  }
                </div>
              </div>
              <div class="field">
                <span class="field-label">Preview</span>
                <span class="flex items-center h-9">
                  <span class="category-pill tone" [attr.data-tone]="color()">
                    <span class="category-pill__dot" aria-hidden="true"></span>
                    <span class="category-pill__name">{{ name().trim() || 'Category' }}</span>
                  </span>
                </span>
              </div>
            </div>

            @if (serverError()) {
              <div class="alert alert-danger" role="alert">{{ serverError() }}</div>
            }
          </div>
          <div class="card-footer">
            <button type="button" class="btn-secondary" (click)="cancel()">Cancel</button>
            <button type="button" class="btn-primary" [disabled]="busy() || !!nameError() || !name().trim()" (click)="save()">
              {{ editing() === 'new' ? 'Create category' : 'Save changes' }}
            </button>
          </div>
        </section>
      }

      <section class="card">
        <div class="card-header">
          <h3 class="card-title">All categories</h3>
          <span class="count-pill">{{ categories.categories().length }}</span>
        </div>
        @for (c of categories.categories(); track c.id) {
          <div class="list-row">
            <div class="list-row__main flex flex-wrap items-center gap-x-4 gap-y-1">
              <app-category-pill [category]="c" />
              <span class="text-xs text-ink-3">
                {{ c.ticketCount ?? 0 }} ticket{{ (c.ticketCount ?? 0) === 1 ? '' : 's' }} ·
                {{ c.taskCount ?? 0 }} task{{ (c.taskCount ?? 0) === 1 ? '' : 's' }}
              </span>
            </div>
            @if (canWrite()) {
              <div class="list-row__actions">
                <button type="button" class="btn-secondary btn-sm" (click)="startEdit(c)">Edit</button>
                <button type="button" class="btn-icon btn-sm btn-danger-hover" (click)="remove(c)" title="Delete" [attr.aria-label]="'Delete ' + c.name">
                  <mat-icon class="icon-sm">delete</mat-icon>
                </button>
              </div>
            }
          </div>
        } @empty {
          <app-empty-state icon="label" title="No categories yet" text="Create one to start labelling tickets and tasks." />
        }
      </section>
    </div>
  `,
  styles: [`
    .swatch {
      width: 24px; height: 24px; border-radius: 9999px; cursor: pointer;
      background: var(--tile); border: 2px solid var(--color-surface);
      box-shadow: 0 0 0 1px var(--color-border);
    }
    .swatch.is-selected { box-shadow: 0 0 0 2px var(--tile); }
    .swatch:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  `]
})
export class SettingsCategoriesComponent {
  protected categories = inject(CategoriesService);
  private state = inject(CrmStateService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmService);

  protected readonly colors = CATEGORY_COLORS;

  protected editing = signal<string | null>(null); // category id being edited, or 'new'
  protected name = signal('');
  protected color = signal<CategoryColor>('blue');
  protected busy = signal(false);
  protected serverError = signal('');

  protected canWrite = () => this.state.hasAuthority('TICKETS_WRITE') || this.state.hasAuthority('TASKS_WRITE');

  protected nameError = computed(() => {
    const n = this.name();
    if (/\s/.test(n.trim())) return 'One word only — no spaces.';
    return '';
  });

  constructor() {
    // Always re-read here: the usage counts shown next to each category change as tickets are edited.
    this.categories.load(true);
  }

  startCreate() {
    this.name.set('');
    this.color.set(this.nextColor());
    this.serverError.set('');
    this.editing.set('new');
  }

  startEdit(c: Category) {
    this.name.set(c.name);
    this.color.set(c.color);
    this.serverError.set('');
    this.editing.set(c.id);
  }

  cancel() {
    this.editing.set(null);
  }

  async save() {
    const id = this.editing();
    const name = this.name().trim();
    if (id === null || !name || this.nameError() || this.busy()) return;
    this.busy.set(true);
    this.serverError.set('');
    try {
      if (id === 'new') await firstValueFrom(this.categories.create(name, this.color()));
      else await firstValueFrom(this.categories.update(id, name, this.color()));
      this.editing.set(null);
      this.categories.load(true);
    } catch (e) {
      this.serverError.set((e as ApiClientError)?.detail || 'Could not save the category.');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(c: Category) {
    const tickets = c.ticketCount ?? 0;
    const tasks = c.taskCount ?? 0;
    const used = tickets || tasks
      ? ` It is used by ${tickets} ticket${tickets === 1 ? '' : 's'} and ${tasks} task${tasks === 1 ? '' : 's'}; they will be left without a category.`
      : '';
    if (!(await this.confirmDialog.ask({ title: `Delete “${c.name}”?`, message: `This cannot be undone.${used}`, confirmLabel: 'Delete category', danger: true }))) return;
    try {
      await firstValueFrom(this.categories.remove(c));
    } catch (e) {
      this.toast.show((e as ApiClientError)?.detail || 'Could not delete the category.', { type: 'error' });
    }
  }

  /** A colour not yet taken, so new categories start out distinguishable. */
  private nextColor(): CategoryColor {
    const used = new Set(this.categories.categories().map(c => c.color));
    return CATEGORY_COLORS.find(c => !used.has(c)) ?? CATEGORY_COLORS[0];
  }
}
