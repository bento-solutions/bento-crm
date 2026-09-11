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
    <div class="px-5 py-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-1.5 text-xs text-zinc-500">
        <span>Rows per page:</span>
        <select [ngModel]="pageSize()" (ngModelChange)="pageSizeChange.emit($event); pageChange.emit(1)" class="input-field rounded-lg px-2 py-1 text-xs outline-none bg-transparent">
          <option [value]="5">5</option>
          <option [value]="10">10</option>
          <option [value]="20">20</option>
          <option [value]="50">50</option>
        </select>
      </div>
      <div class="flex items-center gap-1">
        <button (click)="pageChange.emit(1)" [disabled]="currentPage() === 1" title="First page" class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all" [class]="currentPage() === 1 ? 'text-zinc-300 cursor-not-allowed' : 'btn-secondary text-zinc-600 hover:text-zinc-900'">
          <mat-icon class="text-[14px]! w-3.5 h-3.5">first_page</mat-icon>
        </button>
        <button (click)="pageChange.emit(currentPage() - 1)" [disabled]="currentPage() === 1" title="Previous page" class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all" [class]="currentPage() === 1 ? 'text-zinc-300 cursor-not-allowed' : 'btn-secondary text-zinc-600 hover:text-zinc-900'">
          <mat-icon class="text-[14px]! w-3.5 h-3.5">chevron_left</mat-icon>
        </button>
        <span class="text-xs text-zinc-500 font-semibold px-2">
          Page {{ currentPage() }} of {{ totalPages() }}
        </span>
        <button (click)="pageChange.emit(currentPage() + 1)" [disabled]="currentPage() === totalPages()" title="Next page" class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all" [class]="currentPage() === totalPages() ? 'text-zinc-300 cursor-not-allowed' : 'btn-secondary text-zinc-600 hover:text-zinc-900'">
          <mat-icon class="text-[14px]! w-3.5 h-3.5">chevron_right</mat-icon>
        </button>
        <button (click)="pageChange.emit(totalPages())" [disabled]="currentPage() === totalPages()" title="Last page" class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all" [class]="currentPage() === totalPages() ? 'text-zinc-300 cursor-not-allowed' : 'btn-secondary text-zinc-600 hover:text-zinc-900'">
          <mat-icon class="text-[14px]! w-3.5 h-3.5">last_page</mat-icon>
        </button>
      </div>
    </div>
  `
})
export class PaginatorComponent {
  currentPage = input.required<number>();
  totalPages = input.required<number>();
  pageSize = input<number>(10);

  pageChange = output<number>();
  pageSizeChange = output<number>();
}
