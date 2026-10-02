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
        class="w-full input-field rounded-lg p-1.5 text-sm bg-surface flex items-center gap-2 text-left"
      >
        @if (selectedUser(); as user) {
          <app-user-avatar [userId]="user.id" [size]="24" />
          <span class="flex-1 min-w-0 truncate text-ink font-medium">{{ user.displayName }}</span>
        } @else {
          <div class="h-6 w-6 rounded-full border border-dashed border-line-strong shrink-0"></div>
          <span class="flex-1 min-w-0 truncate text-ink-3">{{ placeholder() }}</span>
        }
        <mat-icon class="text-ink-4 shrink-0 icon-md">expand_more</mat-icon>
      </button>

      @if (open()) {
        <div class="absolute z-20 mt-1 w-full bg-surface border border-line rounded-lg shadow-lg overflow-hidden">
          <div class="p-2 border-b border-line-soft">
            <input
              #searchInput
              type="text"
              [(ngModel)]="query"
              placeholder="Search people…"
              class="input-field w-full"
              (click)="$event.stopPropagation()"
            />
          </div>
          <div class="max-h-64 overflow-y-auto py-1">
            @if (allowUnassigned()) {
              <button
                type="button"
                (click)="select('')"
                class="menu-item"
              >
                <div class="h-6 w-6 rounded-full border border-dashed border-line-strong shrink-0"></div>
                <span class="text-ink-3 italic">{{ placeholder() }}</span>
              </button>
            }
            @for (user of filteredUsers(); track user.id) {
              <button
                type="button"
                (click)="select(user.id)"
                class="menu-item"
                [class.bg-subtle]="user.id === value()"
              >
                <app-user-avatar [userId]="user.id" [size]="28" />
                <span class="flex-1 min-w-0 text-left">
                  <span class="block truncate text-ink font-medium">{{ user.displayName }}</span>
                  @if (user.jobTitle || user.role) {
                    <span class="block truncate text-xs text-ink-3">{{ user.jobTitle || user.role }}</span>
                  }
                </span>
              </button>
            }
            @if (filteredUsers().length === 0) {
              <p class="px-3 py-2 text-xs text-ink-3 italic">No people found.</p>
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
