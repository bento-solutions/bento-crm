import { Component, ElementRef, OnDestroy, computed, input, model, signal, viewChild } from '@angular/core';
import { fold } from '../../shared/ledger.util';

export interface PickerOption {
  id: string;
  /** Shown first and matched as a prefix (an account code); optional. */
  code?: string | null;
  label: string;
  /** A muted second part (a partner's type…). */
  hint?: string | null;
}

const MAX_SHOWN = 60;
let nextId = 0;

/**
 * A searchable picker for long lists (accounts by code or name, partners by name). The list opens
 * in a fixed-position panel so it is not clipped by a modal or a scrolling table.
 */
@Component({
  selector: 'app-ledger-picker',
  template: `
    <input #box class="input-field w-full" type="text" autocomplete="off" role="combobox"
           [attr.aria-controls]="listId" [attr.aria-expanded]="open()" [attr.aria-label]="ariaLabel() || placeholder()"
           [placeholder]="placeholder()" [disabled]="disabled()"
           [value]="open() ? query() : selectedText()"
           (focus)="show()" (click)="show()" (input)="onInput($event)" (blur)="hide()" (keydown)="onKey($event)" />
    @if (open()) {
      <div class="menu ledger-picker-panel" role="listbox" [id]="listId" [style.top.px]="pos().top" [style.left.px]="pos().left" [style.width.px]="pos().width">
        @if (allowClear() && value()) {
          <button type="button" class="menu-item" (mousedown)="$event.preventDefault(); pick(null)">
            <span class="text-ink-3">{{ clearLabel() }}</span>
          </button>
        }
        @for (o of shown(); track o.id; let i = $index) {
          <button type="button" class="menu-item" role="option" [attr.aria-selected]="o.id === value()"
                  [class.bg-subtle]="i === active()" (mousedown)="$event.preventDefault(); pick(o.id)">
            @if (o.code) { <span class="num text-ink shrink-0">{{ o.code }}</span> }
            <span class="truncate">{{ o.label }}</span>
            @if (o.hint) { <span class="text-meta text-ink-3 ms-auto shrink-0">{{ o.hint }}</span> }
          </button>
        } @empty {
          <div class="px-2 py-2 text-xs text-ink-3">{{ emptyLabel() }}</div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .ledger-picker-panel { position: fixed; z-index: calc(var(--z-modal) + 5); max-height: 280px; overflow-y: auto; }
  `],
})
export class LedgerPickerComponent implements OnDestroy {
  items = input<PickerOption[]>([]);
  value = model<string | null>(null);
  placeholder = input('');
  ariaLabel = input('');
  allowClear = input(false);
  clearLabel = input('—');
  emptyLabel = input('—');
  disabled = input(false);

  readonly listId = `ledger-picker-${++nextId}`;

  private box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  open = signal(false);
  query = signal('');
  active = signal(0);
  pos = signal({ top: 0, left: 0, width: 280 });

  selectedText = computed(() => {
    const o = this.items().find(i => i.id === this.value());
    return o ? (o.code ? `${o.code} · ${o.label}` : o.label) : '';
  });

  shown = computed(() => {
    const q = fold(this.query().trim());
    const list = q
      ? this.items().filter(o => (o.code ?? '').startsWith(q) || fold(o.label).includes(q) || fold(o.code).includes(q))
      : this.items();
    return list.slice(0, MAX_SHOWN);
  });

  private readonly onScroll = (e: Event) => {
    if (!(e.target instanceof Node) || !e.target.contains(this.box().nativeElement)) return;
    this.place();
  };

  show(): void {
    if (this.disabled()) return;
    if (!this.open()) {
      this.query.set('');
      this.active.set(0);
      this.open.set(true);
      window.addEventListener('scroll', this.onScroll, true);
      window.addEventListener('resize', this.onScroll);
    }
    this.place();
  }

  hide(): void {
    if (!this.open()) return;
    this.open.set(false);
    window.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onScroll);
  }

  onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.active.set(0);
    if (!this.open()) this.show();
  }

  onKey(e: KeyboardEvent): void {
    const n = this.shown().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.show(); this.active.set(Math.min(n - 1, this.active() + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set(Math.max(0, this.active() - 1)); }
    else if (e.key === 'Enter' && this.open()) {
      e.preventDefault();
      const o = this.shown()[this.active()];
      if (o) this.pick(o.id);
    } else if (e.key === 'Escape' && this.open()) { e.stopPropagation(); this.hide(); }
  }

  pick(id: string | null): void {
    this.value.set(id);
    this.hide();
    this.box().nativeElement.blur();
  }

  private place(): void {
    const r = this.box().nativeElement.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 280), window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    this.pos.set({ top: r.bottom + 4, left, width });
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
