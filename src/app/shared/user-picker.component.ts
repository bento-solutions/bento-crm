import { Component, ElementRef, HostListener, computed, inject, input, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CrmStateService, CrmUser } from '../services/crm-state.service';
import { UserAvatarComponent } from './user-avatar.component';

/**
 * Assignee picker showing each user's avatar badge next to their full name — a native `<select>`
 * can't render an avatar inside an `<option>`, so this renders its own dropdown panel instead.
 * Two-way bound via `value` (a user id, or '' for unassigned), so it drops into a form exactly
 * like a `<select id="..." [(ngModel)]="...">` would.
 */
@Component({
  selector: 'app-user-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, UserAvatarComponent],
  template: `
    <div class="relative">
      <button
        type="button"
        (click)="toggle()"
        class="w-full input-field rounded-lg p-1.5 text-sm bg-white flex items-center gap-2 text-left"
      >
        @if (selectedUser(); as user) {
          <app-user-avatar [userId]="user.id" [size]="24" />
          <span class="flex-1 min-w-0 truncate text-zinc-900 font-medium">{{ user.displayName }}</span>
        } @else {
          <div class="h-6 w-6 rounded-full border border-dashed border-zinc-300 shrink-0"></div>
          <span class="flex-1 min-w-0 truncate text-zinc-400">{{ placeholder() }}</span>
        }
        <mat-icon class="text-[18px] w-4.5 h-4.5 text-zinc-400 shrink-0">expand_more</mat-icon>
      </button>

      @if (open()) {
        <div class="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden">
          <div class="p-2 border-b border-zinc-100">
            <input
              #searchInput
              type="text"
              [(ngModel)]="query"
              placeholder="Search people…"
              class="w-full input-field rounded-md px-2 py-1.5 text-sm"
              (click)="$event.stopPropagation()"
            />
          </div>
          <div class="max-h-64 overflow-y-auto py-1">
            @if (allowUnassigned()) {
              <button
                type="button"
                (click)="select('')"
                class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 transition-colors"
              >
                <div class="h-6 w-6 rounded-full border border-dashed border-zinc-300 shrink-0"></div>
                <span class="text-zinc-500 italic">{{ placeholder() }}</span>
              </button>
            }
            @for (user of filteredUsers(); track user.id) {
              <button
                type="button"
                (click)="select(user.id)"
                class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 transition-colors"
                [class.bg-zinc-50]="user.id === value()"
              >
                <app-user-avatar [userId]="user.id" [size]="28" />
                <span class="flex-1 min-w-0 text-left">
                  <span class="block truncate text-zinc-900 font-medium">{{ user.displayName }}</span>
                  @if (user.jobTitle || user.role) {
                    <span class="block truncate text-xs text-zinc-400">{{ user.jobTitle || user.role }}</span>
                  }
                </span>
              </button>
            }
            @if (filteredUsers().length === 0) {
              <p class="px-3 py-2 text-xs text-zinc-400 italic">No people found.</p>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class UserPickerComponent {
  private state = inject(CrmStateService);
  private elementRef = inject(ElementRef);

  /** Selected user id, or '' for unassigned. */
  value = model<string>('');

  placeholder = input('Unassigned');
  allowUnassigned = input(true);

  /** Restricts the offered people; defaults to everyone in the org. */
  users = input<CrmUser[] | undefined>(undefined);

  open = signal(false);
  query = signal('');

  private sourceUsers = computed(() => this.users() ?? this.state.users());

  selectedUser = computed(() => this.sourceUsers().find(u => u.id === this.value()));

  filteredUsers = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.sourceUsers();
    if (!q) return list;
    return list.filter(u =>
      u.displayName.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.jobTitle?.toLowerCase().includes(q)
    );
  });

  toggle(): void {
    this.open.update(v => !v);
    if (!this.open()) this.query.set('');
  }

  select(userId: string): void {
    this.value.set(userId);
    this.open.set(false);
    this.query.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target)) {
      this.open.set(false);
      this.query.set('');
    }
  }
}
