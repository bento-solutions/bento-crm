import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CategoriesService } from '../../services/domains/categories.service';

/**
 * Choose a category by clicking its pill — at most one; clicking the chosen one again clears it.
 * Disabled (with a reason) when the category is not the user's to pick, e.g. a task on a ticket
 * takes the ticket's.
 *
 *   <app-category-picker [(value)]="form.categoryId" />
 */
@Component({
  selector: 'app-category-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Category">
      @for (c of categories.categories(); track c.id) {
        <button type="button" class="category-pill category-pill--choice tone" [attr.data-tone]="c.color"
                [class.is-selected]="value() === c.id" [attr.aria-pressed]="value() === c.id"
                [disabled]="disabled()" (click)="toggle(c.id)">
          @if (value() === c.id) {
            <mat-icon class="icon-xs">check</mat-icon>
          } @else {
            <span class="category-pill__dot" aria-hidden="true"></span>
          }
          <span class="category-pill__name">{{ c.name }}</span>
        </button>
      } @empty {
        <span class="text-xs text-ink-3">No categories yet — add some in Settings → Categories.</span>
      }
    </div>
    @if (hint()) {
      <p class="text-xs text-ink-3 mt-1.5">{{ hint() }}</p>
    }
  `
})
export class CategoryPickerComponent {
  categories = inject(CategoriesService);

  /** The chosen category id, or '' for none. */
  value = model<string>('');
  disabled = input(false);
  hint = input('');

  constructor() {
    this.categories.load();
  }

  toggle(id: string) {
    if (this.disabled()) return;
    this.value.set(this.value() === id ? '' : id);
  }
}
