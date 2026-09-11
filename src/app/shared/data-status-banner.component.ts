import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

/**
 * Drop-in loading state for pages backed by a lazy `load*()` call on a domain service.
 * Bind `loading`/`error` to the matching `isLoading$`/`error$` signals.
 *
 * `variant="rows"` (default) renders `rows` skeleton row-blocks of `columns` cells each, sized
 * to sit where a `<table>` would go — swap it in via `@if (loading()) { <app-data-status-banner/> }
 * @else { <table>…real rows…</table> }` so the page never mounts a half-empty table. Deliberately
 * built from `<div>`s (not `<tr>`/`<td>`) since Angular component hosts can't legally sit inside
 * `<tbody>`/`<tr>` — the skeleton lives in the table's place, not inside it.
 * `variant="tiles"` renders a card-grid of `tiles` skeleton cards (partners customer/prospect/vendor grids).
 * `variant="none"` renders no skeleton (only the error banner still shows) — for pages that
 * already have their own skeleton markup.
 */
@Component({
  selector: 'app-data-status-banner',
  standalone: true,
  imports: [MatIconModule, CommonModule],
  template: `
    @if (loading()) {
      @if (variant() === 'rows') {
        <div class="card rounded-2xl overflow-hidden">
          @for (r of rowsArray(); track r) {
            <div class="flex items-center gap-4 px-4 py-3 border-b border-zinc-100 last:border-b-0">
              @for (c of columnsArray(); track c) {
                <div class="flex-1">
                  <div class="skeleton-shimmer h-3.5 rounded" [style.width.%]="skeletonWidth(c)"></div>
                </div>
              }
            </div>
          }
        </div>
      }
      @if (variant() === 'tiles') {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (t of tilesArray(); track t) {
            <div class="card rounded-2xl p-6">
              <div class="flex items-center gap-3 mb-4">
                <div class="skeleton-shimmer w-10 h-10 rounded-full shrink-0"></div>
                <div class="flex-1 space-y-2">
                  <div class="skeleton-shimmer h-3.5 rounded w-3/5"></div>
                  <div class="skeleton-shimmer h-2.5 rounded w-2/5"></div>
                </div>
              </div>
              <div class="space-y-2">
                <div class="skeleton-shimmer h-2.5 rounded w-full"></div>
                <div class="skeleton-shimmer h-2.5 rounded w-4/5"></div>
              </div>
            </div>
          }
        </div>
      }
    }
    @if (error()) {
      <div class="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-body">
        <mat-icon class="text-[18px] w-[18px] h-[18px]">warning</mat-icon>
        <span>{{ error() }}</span>
      </div>
    }
  `
})
export class DataStatusBannerComponent {
  loading = input<boolean>(false);
  error = input<string | null>(null);
  variant = input<'rows' | 'tiles' | 'none'>('rows');
  rows = input<number>(6);
  columns = input<number>(6);
  tiles = input<number>(6);

  rowsArray() {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }

  columnsArray() {
    return Array.from({ length: this.columns() }, (_, i) => i);
  }

  tilesArray() {
    return Array.from({ length: this.tiles() }, (_, i) => i);
  }

  skeletonWidth(colIndex: number): number {
    const widths = [70, 55, 40, 60, 45, 35, 50, 65];
    return widths[colIndex % widths.length];
  }
}
