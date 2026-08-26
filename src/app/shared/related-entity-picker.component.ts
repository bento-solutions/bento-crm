import { Component, computed, inject, input, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RelatedEntityService } from '../services/related-entity.service';
import { EntityLink, findKind, isLinked } from './related-entity.model';

/**
 * Optional "what is this about?" picker: choose a kind of record (deal, proposal, customer,
 * prospect, …) and then the record itself. Leaving either empty means no link, which is a valid
 * state — nothing here is mandatory.
 *
 * Two-way bound via the `link` model, so the same control serves the create and the edit flows
 * of both tasks and tickets.
 */
@Component({
  selector: 'app-related-entity-picker',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-3">
      <div>
        <label for="kind-select" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">
          {{ label() }} <span class="text-zinc-400 normal-case font-medium">(optional)</span>
        </label>
        <select
          id="kind-select"
          [ngModel]="selectedKind()"
          (ngModelChange)="onKindChange($event)"
          class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
          <option value="">Not linked</option>
          @for (kind of kinds(); track kind.key) {
            <option [value]="kind.key">{{ kind.label }}</option>
          }
        </select>
      </div>

      @if (selectedKind()) {
        <div>
          <label for="entity-select" class="block text-xs font-semibold text-zinc-500 uppercase mb-1">{{ selectedKindLabel() }}</label>
          <select
            id="entity-select"
            [ngModel]="selectedId()"
            (ngModelChange)="onEntityChange($event)"
            class="w-full input-field rounded-lg p-2 text-sm bg-white focus:outline-blue-600">
            <option value="">Select…</option>
            @for (option of options(); track option.id) {
              <option [value]="option.id">{{ option.label }}</option>
            }
          </select>
          @if (options().length === 0) {
            <p class="text-xs text-zinc-400 italic mt-1">No {{ selectedKindLabel().toLowerCase() }} records yet.</p>
          }
        </div>
      }
    </div>
  `
})
export class RelatedEntityPickerComponent {
  private related = inject(RelatedEntityService);

  /** Two-way bound link. An empty object (or a half-filled one) means "not linked". */
  link = model<EntityLink>({});

  label = input('Related To');

  /** Restricts the offered kinds; defaults to every kind. */
  kindKeys = input<readonly string[] | undefined>(undefined);

  kinds = computed(() => this.related.kindsFor(this.kindKeys()));

  /**
   * Holds the kind while no record has been picked yet — at that point the link is empty and so
   * carries no kind of its own. Once a record is chosen the link is authoritative, which also
   * keeps the two in step when the parent swaps in a different task's link.
   */
  private pendingKind = signal('');

  selectedKind = computed(() => {
    if (!isLinked(this.link())) return this.pendingKind();
    const kind = this.related.kindOfLink(this.link());
    return kind && this.kinds().some(k => k.key === kind.key) ? kind.key : '';
  });

  selectedKindLabel = computed(() => findKind(this.selectedKind())?.label ?? 'Record');
  selectedId = computed(() => (isLinked(this.link()) ? this.link().relatedEntityId! : ''));
  options = computed(() => this.related.optionsFor(this.selectedKind()));

  onKindChange(key: string): void {
    this.pendingKind.set(key);
    // Switching kind invalidates the chosen record: a type without an id is rejected by the API,
    // so the link is cleared until a record of the new kind is picked.
    this.link.set({});
  }

  onEntityChange(id: string): void {
    const kind = findKind(this.selectedKind());
    this.link.set(kind && id ? { relatedEntityType: kind.type, relatedEntityId: id } : {});
  }
}
