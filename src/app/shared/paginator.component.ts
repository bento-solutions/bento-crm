import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

/**
 * Drop-in pagination footer for list views. Paginates client-side over an
 * already-loaded array — pass the total item count and current page/size,
 * and slice the array yourself with `(page - 1) * pageSize` in a computed.
 */
@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [FormsModule, MatIconModule, CommonModule],
  template: `
    <div class="paginator">
      <label class="paginator__size">
        <span>Rows per page</span>
        <select [ngModel]="pageSize()" (ngModelChange)="pageSizeChange.emit($event); pageChange.emit(1)" class="input-field input-sm" aria-label="Rows per page">
          <option [ngValue]="5">5</option>
          <option [ngValue]="10">10</option>
          <option [ngValue]="20">20</option>
          <option [ngValue]="50">50</option>
        </select>
      </label>
      <div class="paginator__nav">
        <button (click)="pageChange.emit(1)" [disabled]="currentPage() === 1" title="First page" aria-label="First page" class="btn-icon btn-sm">
          <mat-icon class="icon-sm">first_page</mat-icon>
        </button>
        <button (click)="pageChange.emit(currentPage() - 1)" [disabled]="currentPage() === 1" title="Previous page" aria-label="Previous page" class="btn-icon btn-sm">
          <mat-icon class="icon-sm">chevron_left</mat-icon>
        </button>
        <span class="paginator__status">Page {{ currentPage() }} of {{ totalPages() }}</span>
        <button (click)="pageChange.emit(currentPage() + 1)" [disabled]="currentPage() === totalPages()" title="Next page" aria-label="Next page" class="btn-icon btn-sm">
          <mat-icon class="icon-sm">chevron_right</mat-icon>
        </button>
        <button (click)="pageChange.emit(totalPages())" [disabled]="currentPage() === totalPages()" title="Last page" aria-label="Last page" class="btn-icon btn-sm">
          <mat-icon class="icon-sm">last_page</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .paginator {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px;
      padding: 10px 20px; border-top: 1px solid var(--color-border); background: var(--color-surface);
    }
    .paginator__size { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; }
    .paginator__size select { width: auto; min-width: 64px; }
    .paginator__nav { display: inline-flex; align-items: center; gap: 2px; }
    .paginator__status { padding-inline: 10px; font-size: 12px; font-weight: 500; color: var(--color-text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
  `]
})
export class PaginatorComponent {
  currentPage = input.required<number>();
  totalPages = input.required<number>();
  pageSize = input<number>(10);

  pageChange = output<number>();
  pageSizeChange = output<number>();
}
