import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CategoriesService } from '../../services/domains/categories.service';
import type { Category } from '../../services/crm-state.service';

/**
 * The coloured one-word label of a ticket or task. Pass `categoryId` (resolved against the shared
 * store, so a rename in Settings shows everywhere) or a `category` directly. With nothing to show
 * it renders nothing, or a quiet dash when `showEmpty` is set — for table cells that must stay
 * aligned.
 *
 *   <app-category-pill [categoryId]="ticket.categoryId" [showEmpty]="true" />
 */
@Component({
  selector: 'app-category-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.category-pill]': 'resolved() !== undefined',
    '[class.tone]': 'resolved() !== undefined',
    '[attr.data-tone]': 'resolved()?.color ?? null',
    '[attr.title]': 'title()',
  },
  template: `
    @if (resolved(); as c) {
      <span class="category-pill__dot" aria-hidden="true"></span>
      <span class="category-pill__name">{{ c.name }}</span>
    } @else if (showEmpty()) {
      <span class="text-ink-4" aria-label="No category">—</span>
    }
  `
})
export class CategoryPillComponent {
  private categories = inject(CategoriesService);

  categoryId = input<string | null | undefined>(undefined);
  category = input<Category | null | undefined>(undefined);
  showEmpty = input(false);
  /** Extra tooltip detail, e.g. "Inherited from the ticket". */
  note = input('');

  constructor() {
    this.categories.load();
  }

  resolved = computed(() => this.category() ?? this.categories.get(this.categoryId()));
  title = computed(() => {
    const c = this.resolved();
    return c ? (this.note() ? `${c.name} — ${this.note()}` : c.name) : null;
  });
}
