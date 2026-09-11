import { Component, Input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrmStateService } from '../services/crm-state.service';
import { UserAvatarComponent } from './user-avatar.component';

@Component({
  selector: 'app-created-by-badge',
  standalone: true,
  imports: [CommonModule, UserAvatarComponent],
  template: `
    @if (createdBy && createdAt) {
      <div class="flex items-center gap-2">
        <app-user-avatar [userId]="createdBy" [size]="size" />
        <div class="flex flex-col">
          <span class="font-semibold text-zinc-700" [class.text-xs]="size <= 28" [class.text-sm]="size > 28">{{ userName() }}</span>
          <span class="text-meta text-zinc-400 font-medium">{{ createdAt | date:'mediumDate' }}</span>
        </div>
      </div>
    }
  `
})
export class CreatedByBadgeComponent {
  private state = inject(CrmStateService);

  @Input() createdBy?: string;
  @Input() createdAt?: string;
  @Input() size = 28;

  userName = computed(() => {
    const user = this.state.users().find(u => u.id === this.createdBy);
    return user?.displayName || this.createdBy || 'Unknown';
  });
}
