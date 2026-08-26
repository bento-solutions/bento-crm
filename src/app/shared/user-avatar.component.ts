import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrmStateService } from '../services/crm-state.service';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      [ngStyle]="{
        'background-color': getBgColor(),
        'width.px': size,
        'height.px': size,
        'font-size.px': getFontSize(),
        'line-height.px': size
      }"
      class="rounded-full text-white font-semibold text-center select-none uppercase flex items-center justify-center border border-white/10 shrink-0 shadow-xs"
    >
      {{ getInitials() }}
    </div>
  `
})
export class UserAvatarComponent {
  private state = inject(CrmStateService);

  @Input() userId?: string;
  @Input() initials?: string;
  @Input() color?: string;
  @Input() size = 36; // 28 | 36 | 44 | 56

  getBgColor(): string {
    if (this.userId) {
      const user = this.state.users().find(u => u.id === this.userId);
      return user?.avatarColor || '#64748b';
    }
    return this.color || '#64748b';
  }

  getInitials(): string {
    if (this.userId) {
      const user = this.state.users().find(u => u.id === this.userId);
      return user?.initials || '?';
    }
    return this.initials || '?';
  }

  getFontSize(): number {
    switch (this.size) {
      case 28: return 11;
      case 36: return 13;
      case 44: return 16;
      case 56: return 20;
      default: return Math.round(this.size * 0.38);
    }
  }
}
